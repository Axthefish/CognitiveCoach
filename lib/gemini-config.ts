// Gemini API 配置
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger, truncate } from '@/lib/logger';

// 获取 API key 的辅助函数
export function getApiKey(): string | undefined {
  // 支持多种环境变量名称格式
  const apiKey = process.env.GOOGLE_AI_API_KEY || 
                process.env.GEMINI_API_KEY || 
                process.env.Gemini_API_KEY ||
                process.env.GOOGLE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ Gemini API key 未配置。请在 .env.local 文件中设置以下任一变量：GOOGLE_AI_API_KEY、GEMINI_API_KEY、Gemini_API_KEY、GOOGLE_GEMINI_API_KEY');
  }
  
  return apiKey;
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

  const run = async (temperature: number) => {
    const model = client.getGenerativeModel({ model: getModelName(runTier) });
    const res = await withTimeout(
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { ...config, temperature },
      })
    );
    const text = res.response.text();
    if (!text) return { ok: false as const, error: 'EMPTY_RESPONSE' };
    try {
      const data = JSON.parse(text) as T;
      return { ok: true as const, data };
    } catch {
      logger.warn('Gemini JSON parse failed, sample:', truncate(text));
      return { ok: false as const, error: 'PARSE_ERROR', raw: truncate(text) };
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

  const run = async (temperature: number) => {
    const model = client.getGenerativeModel({ model: getModelName(runTier) });
    const res = await withTimeout(
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { ...config, temperature },
      })
    );
    const text = res.response.text();
    if (!text) return { ok: false as const, error: 'EMPTY_RESPONSE' };
    return { ok: true as const, text };
  };

  const first = await run(config.temperature ?? 0.7);
  if (first.ok) return first;
  return await run(0.4);
}
