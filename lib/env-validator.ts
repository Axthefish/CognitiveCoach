import { z } from 'zod';
import { logger } from './logger';

const envSchema = z.object({
  // AI API keys
  GOOGLE_AI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // CORS and security
  ALLOWED_ORIGINS: z.string().optional(),
  HEALTH_TOKEN: z.string().optional(),
  
  // Optional configuration
  MAX_REQUESTS_PER_MINUTE: z.string().optional().transform(val => val ? parseInt(val, 10) : 60),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

let cachedEnv: ValidatedEnv | null = null;

/**
 * 清除环境变量缓存
 * 用于测试或在需要重新加载环境变量时调用
 */
export function clearEnvCache(): void {
  cachedEnv = null;
  logger.debug('Environment variable cache cleared');
}

/**
 * 验证环境变量配置
 * @param forceRevalidate 强制重新验证，忽略缓存
 * @returns 验证后的环境变量对象
 * @throws 如果环境变量无效
 */
export function validateEnv(forceRevalidate = false): ValidatedEnv {
  // 在开发环境或测试环境，或者强制重新验证时，不使用缓存
  const shouldSkipCache = 
    forceRevalidate || 
    process.env.NODE_ENV === 'test';
  
  if (cachedEnv && !shouldSkipCache) return cachedEnv;
  
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    logger.error('❌ Invalid environment variables:', parsed.error.flatten());
    throw new Error(`Invalid environment variables: ${JSON.stringify(parsed.error.flatten())}`);
  }
  
  const env = parsed.data;
  
  // 检查 AI API key 配置
  if (!env.GOOGLE_AI_API_KEY && !env.GEMINI_API_KEY) {
    logger.warn('⚠️ No AI API keys configured. AI features will use fallback data.');
  }
  
  // 生产环境特殊检查
  if (env.NODE_ENV === 'production') {
    if (!env.HEALTH_TOKEN) {
      logger.warn('⚠️ HEALTH_TOKEN not configured for production');
    }
    
    if (!env.ALLOWED_ORIGINS) {
      logger.warn('⚠️ ALLOWED_ORIGINS not configured for production');
    }
  }
  
  logger.info('✅ Environment variables validated successfully', {
    nodeEnv: env.NODE_ENV,
    hasApiKey: !!(env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY),
    logLevel: env.LOG_LEVEL,
  });
  
  cachedEnv = env;
  return env;
}

/**
 * 获取已验证的环境变量（如果未验证则先验证）
 * @param forceRevalidate 强制重新验证
 */
export function getEnv(forceRevalidate = false): ValidatedEnv {
  if (forceRevalidate || !cachedEnv) {
    return validateEnv(forceRevalidate);
  }
  return cachedEnv;
}

/**
 * 检查是否为生产环境
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}

/**
 * 验证 Google Gemini API Key 格式
 * Google API Keys 通常以 "AIza" 开头，长度约为 39 字符
 */
function isValidGeminiApiKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  
  // 基本长度检查（至少20个字符）
  if (key.length < 20) {
    logger.warn('API key too short, expected at least 20 characters');
    return false;
  }
  
  // Google API Key 标准格式检查（通常以 AIza 开头）
  if (key.startsWith('AIza')) {
    if (key.length < 35 || key.length > 45) {
      logger.warn('Google API key length unexpected', { length: key.length });
      return false;
    }
    return true;
  }
  
  // 如果不是标准格式，至少检查是否是合理的字符串（字母数字和连字符/下划线）
  if (!/^[A-Za-z0-9\-_]+$/.test(key)) {
    logger.warn('API key contains invalid characters');
    return false;
  }
  
  return true;
}

/**
 * 获取配置的AI API密钥（带格式验证）
 */
export function getAIApiKey(): string | null {
  const env = getEnv();
  const key = env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY || null;
  
  if (!key) {
    return null;
  }
  
  // 验证 API Key 格式
  if (!isValidGeminiApiKey(key)) {
    logger.error('Invalid GEMINI_API_KEY format detected', {
      keyLength: key.length,
      keyPrefix: key.substring(0, 4) + '...',
    });
    return null;
  }
  
  return key;
}

/**
 * 检查是否配置了任何AI API密钥（与原env.ts的hasAIKey函数兼容）
 */
export function hasAIKey(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY);
}

/**
 * 获取允许的来源列表（与原env.ts的getAllowedOrigins函数兼容）
 */
export function getAllowedOrigins(): string[] {
  const env = getEnv();
  const allowedOrigins = env.ALLOWED_ORIGINS || '';
  return allowedOrigins.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * 检查健康检查是否受保护（与原env.ts的isHealthProtected函数兼容）
 */
export function isHealthProtected(): boolean {
  const env = getEnv();
  return typeof env.HEALTH_TOKEN === 'string' && env.HEALTH_TOKEN.length > 0;
}
