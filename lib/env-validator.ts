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
  
  // Rate limiting configuration
  RATE_LIMIT_STORE: z.enum(['memory', 'redis']).optional().default('memory'),
  REDIS_URL: z.string().optional(),
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
    process.env.NODE_ENV === 'test' ||
    (process.env.NODE_ENV === 'development' && process.env.SKIP_ENV_CACHE === 'true');
  
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
 * 获取配置的AI API密钥
 */
export function getAIApiKey(): string | null {
  const env = getEnv();
  return env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY || null;
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
