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

// 获取超时配置
function getTimeoutConfig(runTier?: 'Lite' | 'Pro' | 'Review'): number {
  if (runTier === 'Lite') {
    return parseInt(process.env.GENERATION_TIMEOUT_MS_LITE || '45000', 10);
  }
  return parseInt(process.env.GENERATION_TIMEOUT_MS_PRO || '90000', 10);
}

export async function withTimeout<T>(p: Promise<T>, ms = 30_000): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms)),
  ]);
}

export async function generateJson<T>(
  prompt: string,
  overrides?: Partial<GenConfig>,
  runTier?: 'Lite' | 'Pro' | 'Review'
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

  const timeoutMs = getTimeoutConfig(runTier);
  
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
  runTier?: 'Lite' | 'Pro' | 'Review'
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

  const timeoutMs = getTimeoutConfig(runTier);
  
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
