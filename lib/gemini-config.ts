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
};

// 获取超时配置 - 按阶段和档位动态调整
function getTimeoutConfig(runTier?: 'Lite' | 'Pro' | 'Review', stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'): number {
  // 基础超时配置（毫秒）
  const baseTimeouts = {
    'Lite': 45000,  // 45秒
    'Pro': 90000,   // 90秒
    'Review': 120000 // 120秒
  };
  
  // 阶段复杂度系数（相对于基础值的倍数）
  const stageComplexity: Record<string, number> = {
    'S0': 0.5,  // S0最简单：对话式，快速响应
    'S1': 1.0,  // S1标准：知识框架生成
    'S2': 1.2,  // S2稍复杂：需要生成Mermaid图
    'S3': 1.5,  // S3最复杂：策略DSL生成，n-best
    'S4': 0.8,  // S4中等：进度分析
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
): Promise<{ ok: true; data: T } | { ok: false; error: string; raw?: string }> {
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
      try {
        const data = JSON.parse(text) as T;
        return { ok: true as const, data };
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

