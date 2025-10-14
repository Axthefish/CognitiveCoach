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

export function getModelName(runTier?: 'Lite' | 'Pro' | 'Review'): string {
  // Lite档位使用flash-lite模型以提高响应速度
  if (runTier === 'Lite') {
    return process.env.GEMINI_LITE_MODEL || 'gemini-2.5-flash-lite';
  }
  // Pro和Review档位使用标准模型
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
  };
};

// 获取超时配置 - 按阶段和档位动态调整
function getTimeoutConfig(runTier?: 'Lite' | 'Pro' | 'Review', stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'): number {
  // 基础超时配置（毫秒）- 参考Cursor：优先响应速度
  const baseTimeouts = {
    'Lite': 20000,  // 20秒 (Lite应该极快)
    'Pro': 30000,   // 30秒 (合理的等待时间)
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
  runTier?: 'Lite' | 'Pro' | 'Review',
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
    // 对于Stage 0启用thinking mode
    ...(stage === 'S0' && runTier === 'Pro' ? {
      thinkingConfig: {
        thinkingBudget: 8192, // 给足够的thinking token
      }
    } : {}),
    ...overrides,
  };

  const timeoutMs = getTimeoutConfig(runTier, stage);
  
  const run = async (temperature: number) => {
    const model = client.getGenerativeModel({ model: getModelName(runTier) });
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
  runTier?: 'Lite' | 'Pro' | 'Review',
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
    const model = client.getGenerativeModel({ model: getModelName(runTier) });
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
  overrides?: Partial<GenConfig>,
  runTier?: 'Lite' | 'Pro' | 'Review'
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

  const model = client.getGenerativeModel({ model: getModelName(runTier) });
  
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
  runTier?: 'Lite' | 'Pro' | 'Review',
  stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const client = createGeminiClient();
  if (!client) return { ok: false, error: 'NO_API_KEY' };

  const config: GenConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 65536,
    // 不使用responseMimeType - streaming模式下会导致空响应
    // responseMimeType: 'application/json',
    // 启用thinking mode
    ...(stage === 'S0' && runTier === 'Pro' ? {
      thinkingConfig: {
        thinkingBudget: 8192,
      }
    } : {}),
    ...overrides,
  };

  const timeoutMs = getTimeoutConfig(runTier, stage);
  const model = client.getGenerativeModel({ model: getModelName(runTier) });
  
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
    
    let jsonText = '';
    let thinkingText = '';
    let hasThinkingEnded = false;
    let thinkingChunkCount = 0;
    let textChunkCount = 0;
    const startTime = Date.now();
    
    // Stream处理
    for await (const chunk of result.stream) {
      // 检查超时
      if (Date.now() - startTime > timeoutMs) {
        logger.warn('[Gemini] Stream timeout exceeded');
        throw new Error('Request timeout');
      }
      
      const candidates = chunk.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        const parts = candidates[0].content.parts;
        
        for (const part of parts) {
          logger.info('[Gemini] Part received:', {
            hasThought: 'thought' in part,
            thoughtValue: 'thought' in part ? (part as { thought?: boolean }).thought : undefined,
            hasText: 'text' in part,
            textLength: 'text' in part ? (part as { text?: string }).text?.length : 0
          });
          
          // Thought part - 实时发送thinking
          if ('thought' in part && part.thought === true && 'text' in part && part.text) {
            thinkingChunkCount++;
            const chunkText = part.text;
            thinkingText += chunkText;
            logger.info(`[Gemini] Thinking chunk #${thinkingChunkCount}:`, {
              length: chunkText.length,
              sample: truncate(chunkText, 50)
            });
            onThinkingChunk(chunkText);
          }
          // Text part - 累积JSON内容
          else if ('text' in part && part.text) {
            if (!hasThinkingEnded) {
              logger.info('[Gemini] Thinking phase ended, starting JSON content');
              onThinkingDone();
              hasThinkingEnded = true;
            }
            textChunkCount++;
            jsonText += part.text;
            logger.info(`[Gemini] Text chunk #${textChunkCount}:`, {
              length: part.text.length,
              sample: truncate(part.text, 50)
            });
          }
        }
      }
    }
    
    logger.info('[Gemini] Stream completed:', {
      thinkingChunks: thinkingChunkCount,
      textChunks: textChunkCount,
      thinkingLength: thinkingText.length,
      jsonLength: jsonText.length
    });
    
    // 确保thinking结束回调
    if (!hasThinkingEnded) {
      onThinkingDone();
    }
    
    // 如果没有thinking chunks但有非streaming API的fallback
    if (thinkingChunkCount === 0 && thinkingText.length === 0) {
      logger.warn('[Gemini] No thinking chunks in stream, likely streaming mode doesnt support thought parts');
    }
    
    // 解析JSON
    if (!jsonText.trim()) {
      logger.warn('[Gemini] Empty JSON text from stream');
      return { ok: false, error: 'EMPTY_RESPONSE' };
    }
    
    try {
      const data = JSON.parse(jsonText) as T;
      logger.info('[Gemini] JSON parsed successfully from stream');
      return { ok: true, data };
    } catch (parseError) {
      logger.error('[Gemini] JSON parse failed:', {
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        sample: truncate(jsonText, 500)
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

