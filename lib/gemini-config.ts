// Gemini API 配置
import { GoogleGenAI } from '@google/genai';

// 获取 API key 的辅助函数
export function getApiKey(): string | undefined {
  // 优先从环境变量读取
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ Gemini API key 未配置。请在 .env.local 文件中设置 GOOGLE_AI_API_KEY 或 GEMINI_API_KEY');
  }
  
  return apiKey;
}

// 创建 Gemini 客户端实例
export function createGeminiClient(apiKey?: string): GoogleGenAI | null {
  const key = apiKey || getApiKey();
  
  if (!key) {
    return null;
  }
  
  return new GoogleGenAI({ apiKey: key });
}