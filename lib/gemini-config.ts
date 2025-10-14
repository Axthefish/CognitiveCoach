// Gemini API 配置
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger, truncate } from '@/lib/logger';
import { getAIApiKey } from '@/lib/env-validator';

// 获取 API key 的辅助函数
export function getApiKey(): string | undefined {
  return getAIApiKey() || undefined;
}

// 创建 Gemini 客户端实例
export function createGeminiClient(apiKey?: string): GoogleGenerativeAI | null {
  const key = apiKey || getApiKey();
  
  if (!key) {
    return null;
  }
  
  return new GoogleGenerativeAI(key);
}

export function getModelName(): string {
  // 统一使用Pro模型（gemini-2.5-pro）
  return process.env.GEMINI_MODEL || 'gemini-2.5-pro';
}

type GenConfig = {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  thinkingConfig?: {
    thinkingBudget?: number;
    includeThoughts?: boolean;  // 关键：启用思考内容返回
  };
};

// 获取超时配置 - 按阶段动态调整
function getTimeoutConfig(runTier?: 'Pro' | 'Review', stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'): number {
  // 基础超时配置（毫秒）- 为thinking mode预留足够时间
  const baseTimeouts = {
    'Pro': 45000,   // 45秒 (thinking mode需要更多时间)
    'Review': 60000 // 60秒 (复杂任务)
  };
  
  // 阶段复杂度系数（相对于基础值的倍数）
  const stageComplexity: Record<string, number> = {
    'S0': 1.5,  // S0：thinking mode需要更多时间
    'S1': 2.0,  // S1：框架生成，允许更长时间
    'S2': 1.5,  // S2：个性化方案
    'S3': 2.5,  // S3：策略生成，最复杂
    'S4': 1.0,  // S4：进度分析
  };
  
  const tier = runTier || 'Pro';
  const baseTimeout = baseTimeouts[tier];
  const complexityFactor = stage ? (stageComplexity[stage] || 1.0) : 1.0;
  
  const calculatedTimeout = Math.round(baseTimeout * complexityFactor);
  
  // 从环境变量读取覆盖值（如果设置）
  const envKey = stage 
    ? `GENERATION_TIMEOUT_MS_${tier.toUpperCase()}_${stage}`
    : `GENERATION_TIMEOUT_MS_${tier.toUpperCase()}`;
  
  const envTimeout = process.env[envKey];
  if (envTimeout) {
    return parseInt(envTimeout, 10);
  }
  
  logger.debug('Timeout calculated', { tier, stage, baseTimeout, complexityFactor, calculatedTimeout });
  
  return calculatedTimeout;
}

/**
 * 带超时控制的Promise包装器
 * 自动清理定时器，避免内存泄漏
 */
export async function withTimeout<T>(p: Promise<T>, ms = 30_000): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timeout')), ms);
  });
  
  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    // 无论promise成功还是失败，都清除定时器
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function generateJson<T>(
  prompt: string,
  overrides?: Partial<GenConfig>,
  runTier?: 'Pro' | 'Review',
  stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'
): Promise<{ ok: true; data: T; thinking?: string } | { ok: false; error: string; raw?: string }> {
  const client = createGeminiClient();
  if (!client) return { ok: false, error: 'NO_API_KEY' };

  const config: GenConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 65536,
    responseMimeType: 'application/json',
    // 不使用thinkingConfig - 通过prompt引导实现0延迟thinking
    ...overrides,
  };

  const timeoutMs = getTimeoutConfig(runTier, stage);
  
  const run = async (temperature: number) => {
    const model = client.getGenerativeModel({ model: getModelName() });
    try {
      const res = await withTimeout(
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { ...config, temperature },
        }),
        timeoutMs
      );
      
      // 提取thinking和主要内容
      const candidates = res.response.candidates;
      let thinkingText: string | undefined;
      
      if (candidates && candidates[0]?.content?.parts) {
        const parts = candidates[0].content.parts;
        // 查找thought part
        const thoughtPart = parts.find((p: { thought?: boolean; text?: string }) => p.thought === true);
        if (thoughtPart && 'text' in thoughtPart && thoughtPart.text) {
          thinkingText = thoughtPart.text;
        }
      }
      
      const text = res.response.text();
      if (!text) return { ok: false as const, error: 'EMPTY_RESPONSE' };
      try {
        const data = JSON.parse(text) as T;
        return { ok: true as const, data, thinking: thinkingText };
      } catch (parseError) {
        logger.warn('Gemini JSON parse failed:', {
          error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          sample: truncate(text)
        });
        return { ok: false as const, error: 'PARSE_ERROR', raw: truncate(text) };
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Request timeout')) {
        return { ok: false as const, error: 'TIMEOUT' };
      }
      // Convert unknown API errors into a recoverable object instead of throwing
      logger.warn('Gemini API error during JSON generation', { error: error instanceof Error ? error.message : String(error) });
      return { ok: false as const, error: 'API_ERROR' };
    }
  };

  // primary attempt
  const first = await run(config.temperature ?? 0.7);
  if (first.ok) return first;
  // retry with lower temperature
  return await run(0.4);
}

export async function generateText(
  prompt: string,
  overrides?: Partial<GenConfig>,
  runTier?: 'Pro' | 'Review',
  stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const client = createGeminiClient();
  if (!client) return { ok: false, error: 'NO_API_KEY' };

  const config: GenConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 65536,
    ...overrides,
  };

  const timeoutMs = getTimeoutConfig(runTier, stage);
  
  const run = async (temperature: number) => {
    const model = client.getGenerativeModel({ model: getModelName() });
    try {
      const res = await withTimeout(
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { ...config, temperature },
        }),
        timeoutMs
      );
      const text = res.response.text();
      if (!text) return { ok: false as const, error: 'EMPTY_RESPONSE' };
      return { ok: true as const, text };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Request timeout')) {
        return { ok: false as const, error: 'TIMEOUT' };
      }
      throw error;
    }
  };

  const first = await run(config.temperature ?? 0.7);
  if (first.ok) return first;
  return await run(0.4);
}

/**
 * Streaming文本生成（用于展示思考过程）
 */
export async function generateStreamingText(
  prompt: string,
  onChunk: (text: string) => void,
  overrides?: Partial<GenConfig>
): Promise<{ ok: true; fullText: string } | { ok: false; error: string }> {
  const client = createGeminiClient();
  if (!client) return { ok: false, error: 'NO_API_KEY' };

  const config: GenConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 65536,
    ...overrides,
  };

  const model = client.getGenerativeModel({ model: getModelName() });
  
  try {
    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config,
    });
    
    let fullText = '';
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onChunk(chunkText); // 实时回调
    }
    
    return { ok: true, fullText };
  } catch (error) {
    logger.error('[Gemini] Streaming generation failed', { error });
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'STREAM_ERROR' 
    };
  }
}

/**
 * Streaming JSON生成 with thinking - Cursor风格
 * 
 * 实时流式传输thinking过程，然后返回JSON结果
 * 参考Cursor：使用真正的streaming API，thinking几乎0延迟开始显示
 */
export async function generateJsonWithStreamingThinking<T>(
  prompt: string,
  onThinkingChunk: (chunk: string) => void,
  onThinkingDone: () => void,
  overrides?: Partial<GenConfig>,
  runTier?: 'Pro' | 'Review',
  stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const client = createGeminiClient();
  if (!client) return { ok: false, error: 'NO_API_KEY' };

  const config: GenConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 65536,
    responseMimeType: 'text/plain', // 使用text/plain支持thinking标签+JSON混合格式
    // 不使用thinkingConfig - 通过prompt引导实现0延迟thinking
    ...overrides,
  };

  const timeoutMs = getTimeoutConfig(runTier, stage);
  const model = client.getGenerativeModel({ model: getModelName() });
  
  try {
    logger.info('[Gemini] Attempting real streaming with updated SDK', { 
      hasThinkingConfig: !!(config as { thinkingConfig?: unknown }).thinkingConfig,
      sdkVersion: '0.24.1',
      timeout: timeoutMs 
    });
    
    // 尝试使用真正的streaming - with latest SDK
    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config,
    });
    
    let fullText = '';
    let inThinkingSection = false;
    let thinkingBuffer = '';
    let jsonBuffer = '';
    let chunkCount = 0;
    const startTime = Date.now();
    
    // Stream处理 - 解析<thinking>标签
    for await (const chunk of result.stream) {
      // 检查超时
      if (Date.now() - startTime > timeoutMs) {
        logger.warn('[Gemini] Stream timeout exceeded');
        throw new Error('Request timeout');
      }
      
      const chunkText = chunk.text();
      if (!chunkText) continue;
      
      chunkCount++;
      fullText += chunkText;
      
      // 实时解析<thinking>标签
      if (chunkText.includes('<thinking>')) {
        inThinkingSection = true;
        const afterTag = chunkText.split('<thinking>')[1] || '';
        if (afterTag) {
          onThinkingChunk(afterTag);
          thinkingBuffer += afterTag;
          logger.info('[Gemini] Thinking started, first chunk:', {
            length: afterTag.length,
            sample: truncate(afterTag, 50)
          });
        }
      } else if (chunkText.includes('</thinking>')) {
        const beforeTag = chunkText.split('</thinking>')[0] || '';
        if (beforeTag) {
          onThinkingChunk(beforeTag);
          thinkingBuffer += beforeTag;
        }
        inThinkingSection = false;
        onThinkingDone();
        logger.info('[Gemini] Thinking completed, total length:', thinkingBuffer.length);
        
        const afterTag = chunkText.split('</thinking>')[1] || '';
        jsonBuffer += afterTag;
      } else if (inThinkingSection) {
        // 在thinking区间内，实时发送
        onThinkingChunk(chunkText);
        thinkingBuffer += chunkText;
        logger.info(`[Gemini] Thinking chunk #${chunkCount}:`, {
          length: chunkText.length,
          sample: truncate(chunkText, 50)
        });
      } else {
        // thinking之后的JSON内容
        jsonBuffer += chunkText;
      }
    }
    
    logger.info('[Gemini] Stream completed:', {
      totalChunks: chunkCount,
      thinkingLength: thinkingBuffer.length,
      jsonLength: jsonBuffer.length,
      fullLength: fullText.length
    });
    
    // 确保thinking已结束
    if (inThinkingSection) {
      onThinkingDone();
      logger.warn('[Gemini] Thinking section not properly closed');
    }
    
    // 解析JSON部分
    let extracted = jsonBuffer.trim();
    
    // 如果jsonBuffer为空，尝试从fullText中提取
    if (!extracted && fullText) {
      const thinkingMatch = fullText.match(/<thinking>[\s\S]*?<\/thinking>\s*([\s\S]*)/);
      if (thinkingMatch) {
        extracted = thinkingMatch[1].trim();
        logger.info('[Gemini] Extracted JSON from full text after thinking tag');
      } else {
        // 没有thinking标签，尝试提取JSON部分
        extracted = fullText.trim();
        logger.warn('[Gemini] No thinking tags found, using full text');
      }
    }
    
    if (!extracted) {
      logger.warn('[Gemini] Empty JSON text from stream');
      return { ok: false, error: 'EMPTY_RESPONSE' };
    }
    logger.info('[Gemini] Raw JSON text:', { sample: truncate(extracted, 200) });
    
    // 移除markdown code block（如果有）
    const jsonBlockMatch = extracted.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      extracted = jsonBlockMatch[1].trim();
      logger.info('[Gemini] Extracted from ```json``` block');
    }
    
    // 提取第一个完整的JSON对象
    const jsonObjectMatch = extracted.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      extracted = jsonObjectMatch[0].trim();
    }
    
    try {
      const data = JSON.parse(extracted) as T;
      logger.info('[Gemini] JSON parsed successfully from stream');
      return { ok: true, data };
    } catch (parseError) {
      logger.error('[Gemini] JSON parse failed:', {
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        extracted: truncate(extracted, 500),
        fullText: truncate(fullText, 500)
      });
      return { ok: false, error: 'PARSE_ERROR' };
    }
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('Request timeout')) {
      logger.warn('[Gemini] Request timeout');
      return { ok: false, error: 'TIMEOUT' };
    }
    logger.error('[Gemini] API error:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return { ok: false, error: 'API_ERROR' };
  }
}

