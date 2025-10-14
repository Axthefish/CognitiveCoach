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
    includeThoughts?: boolean;
  };
};

// 获取超时配置 - 按阶段动态调整
function getTimeoutConfig(runTier?: 'Pro' | 'Review', stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'): number {
  // 基础超时配置（毫秒）- thinking mode需要更长时间
  const baseTimeouts = {
    'Pro': 120000,  // 120秒 (2分钟) - thinking可能需要较长时间
    'Review': 180000 // 180秒 (3分钟)
  };
  
  // 阶段复杂度系数
  const stageComplexity: Record<string, number> = {
    'S0': 1.0,  // S0：目的澄清，thinking较复杂
    'S1': 1.5,  // S1：框架生成
    'S2': 1.2,  // S2：动态分析
    'S3': 1.0,  // S3：行动计划
    'S4': 0.8,  // S4：进度追踪
  };
  
  const baseDuration = baseTimeouts[runTier || 'Pro'];
  const complexity = stage ? (stageComplexity[stage] || 1.0) : 1.0;
  
  return Math.round(baseDuration * complexity);
}

/**
 * 非流式纯文本生成
 */
export async function generateText(
  prompt: string,
  overrides?: Partial<GenConfig>,
  _runTier?: 'Pro' | 'Review',
  _stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const client = createGeminiClient();
  if (!client) return { ok: false, error: 'NO_API_KEY' };

  const config: GenConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
    ...overrides,
  };

  const model = client.getGenerativeModel({ model: getModelName() });

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config,
    });

    const text = result.response.text();
    return { ok: true, text };
  } catch (error) {
    logger.error('[Gemini] Text generation failed', { error });
    return { ok: false, error: 'API_ERROR' };
  }
}

/**
 * 非流式 JSON 生成（用于不需要thinking的场景）
 */
export async function generateJson<T>(
  prompt: string,
  overrides?: Partial<GenConfig>,
  _runTier?: 'Pro' | 'Review',
  _stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const client = createGeminiClient();
  if (!client) return { ok: false, error: 'NO_API_KEY' };

  const config: GenConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 65536,
    responseMimeType: 'application/json',
    ...overrides,
  };

  const model = client.getGenerativeModel({ model: getModelName() });

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config,
    });

    const text = result.response.text();
    const data = JSON.parse(text) as T;

    return { ok: true, data };
  } catch (error) {
    logger.error('[Gemini] JSON generation failed', { error });
    return { ok: false, error: 'API_ERROR' };
  }
}

/**
 * 纯文本流式生成（用于聊天等场景）
 */
export async function generateTextStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  overrides?: Partial<GenConfig>,
  _runTier?: 'Pro' | 'Review',
  _stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'
): Promise<{ ok: true; fullText: string } | { ok: false; error: string }> {
  const client = createGeminiClient();
  if (!client) return { ok: false, error: 'NO_API_KEY' };

  const config: GenConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
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
      onChunk(chunkText);
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
 * Streaming JSON生成 with thinking - 官方正确方式
 * 
 * 使用Gemini官方的thinkingConfig + responseMimeType: 'application/json'
 * 参考: https://ai.google.dev/gemini-api/docs/thinking
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
    responseMimeType: 'application/json', // JSON格式输出
    thinkingConfig: {
      includeThoughts: true, // 关键：启用思考摘要的流式传输
    },
    ...overrides,
  };

  const timeoutMs = getTimeoutConfig(runTier, stage);
  const model = client.getGenerativeModel({ model: getModelName() });
  
  try {
    logger.info('[Gemini] Starting official thinking streaming', {
      model: getModelName(),
      hasThinkingConfig: true,
      timeout: timeoutMs
    });
    
    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config,
    });
    
    let thoughtsText = '';
    let answerText = '';
    let thinkingDoneCalled = false;
    let chunkCount = 0;
    const startTime = Date.now();
    
    // 官方方式：检查part.thought字段
    for await (const chunk of result.stream) {
      // 超时检查
      if (Date.now() - startTime > timeoutMs) {
        logger.warn('[Gemini] Stream timeout exceeded');
        throw new Error('Request timeout');
      }
      
      chunkCount++;
      
      // 获取candidates
      const candidates = chunk.candidates;
      if (!candidates || candidates.length === 0) {
        logger.warn('[Gemini] Chunk without candidates', { chunkCount });
        continue;
      }
      
      const content = candidates[0].content;
      if (!content || !content.parts) {
        logger.warn('[Gemini] Chunk without content.parts', { chunkCount });
        continue;
      }
      
      // 遍历parts
      for (const part of content.parts) {
        const text = part.text;
        if (!text) continue;
        
        // 关键：检查thought字段 (TypeScript可能不识别这个字段，需要类型断言)
        const isThought = (part as unknown as { thought?: boolean }).thought;
        
        if (isThought) {
          // 这是thinking内容 - 实时发送
          onThinkingChunk(text);
          thoughtsText += text;
          if (thoughtsText.length < 100) {
            logger.info('[Gemini] Thinking started:', {
              sample: truncate(text, 50)
            });
          }
        } else {
          // 这是答案内容（JSON）
          if (!thinkingDoneCalled && thoughtsText) {
            onThinkingDone();
            thinkingDoneCalled = true;
            logger.info('[Gemini] Thinking completed:', {
              totalLength: thoughtsText.length,
              chunks: chunkCount
            });
          }
          answerText += text;
        }
      }
    }
    
    // 确保thinking完成回调被调用
    if (!thinkingDoneCalled) {
      onThinkingDone();
      logger.info('[Gemini] Thinking done (no thoughts or already called)');
    }
    
    logger.info('[Gemini] Stream completed:', {
      thoughtsLength: thoughtsText.length,
      answerLength: answerText.length,
      totalChunks: chunkCount
    });
    
    // 解析JSON
    const trimmedAnswer = answerText.trim();
    if (!trimmedAnswer) {
      logger.warn('[Gemini] Empty answer from stream');
      return { ok: false, error: 'EMPTY_RESPONSE' };
    }
    
    try {
      const data = JSON.parse(trimmedAnswer) as T;
      logger.info('[Gemini] JSON parsed successfully');
      return { ok: true, data };
    } catch (parseError) {
      logger.error('[Gemini] JSON parse failed:', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        answer: truncate(trimmedAnswer, 500)
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

/**
 * 聊天式多轮对话（保留上下文）
 */
export async function generateChatResponse(
  messages: Array<{ role: 'user' | 'model'; content: string }>,
  onChunk?: (chunk: string) => void,
  overrides?: Partial<GenConfig>
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const client = createGeminiClient();
  if (!client) return { ok: false, error: 'NO_API_KEY' };

  const config: GenConfig = {
    temperature: 0.8,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
    ...overrides,
  };

  const model = client.getGenerativeModel({ model: getModelName() });
  const chat = model.startChat({
    generationConfig: config,
    history: messages.slice(0, -1).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
  });

  try {
    const lastMessage = messages[messages.length - 1];
    
    if (onChunk) {
      const result = await chat.sendMessageStream(lastMessage.content);
      let fullText = '';
      
      for await (const chunk of result.stream) {
        const text = chunk.text();
        fullText += text;
        onChunk(text);
      }
      
      return { ok: true, text: fullText };
    } else {
      const result = await chat.sendMessage(lastMessage.content);
      return { ok: true, text: result.response.text() };
    }
  } catch (error) {
    logger.error('[Gemini] Chat generation failed', { error });
    return { ok: false, error: 'API_ERROR' };
  }
}
