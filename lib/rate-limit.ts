// 分布式速率限制系统
// 支持内存存储（降级）和外部存储（Redis等）

import { logger } from './logger';
import { getEnv } from './env-validator';

type Counter = { count: number; resetAt: number };
type RateLimitResult = { allowed: boolean; retryAfter?: number; remaining?: number };

// 抽象存储接口
interface RateLimitStore {
  get(key: string): Promise<Counter | null>;
  set(key: string, counter: Counter): Promise<void>;
  increment(key: string, resetAt: number): Promise<{ count: number; resetAt: number } | null>;
}

// 内存存储实现（降级方案）
class MemoryStore implements RateLimitStore {
  private counters = new Map<string, Counter>();
  
  async get(key: string): Promise<Counter | null> {
    return this.counters.get(key) || null;
  }
  
  async set(key: string, counter: Counter): Promise<void> {
    this.counters.set(key, counter);
  }
  
  async increment(key: string, resetAt: number): Promise<{ count: number; resetAt: number } | null> {
    const existing = this.counters.get(key);
    if (!existing || existing.resetAt <= Date.now()) {
      const newCounter = { count: 1, resetAt };
      this.counters.set(key, newCounter);
      return newCounter;
    }
    
    existing.count += 1;
    return existing;
  }
}

// Redis存储实现（分布式方案）
class RedisStore implements RateLimitStore {
  private connected = false;
  private fallback: MemoryStore;
  
  constructor() {
    this.fallback = new MemoryStore();
    this.initializeConnection();
  }
  
  private async initializeConnection(): Promise<void> {
    try {
      const env = getEnv();
      if (!env.REDIS_URL) {
        logger.info('Redis URL not configured, using memory fallback for rate limiting');
        return;
      }
      
      // 在实际项目中，这里会初始化Redis连接
      // 由于我们不想添加Redis依赖，这里只是模拟连接逻辑
      logger.info('Redis configuration detected but not implemented in this demo');
      this.connected = false;
    } catch (error) {
      logger.warn('Failed to connect to Redis for rate limiting:', error);
      this.connected = false;
    }
  }
  
  async get(key: string): Promise<Counter | null> {
    if (!this.connected) {
      return this.fallback.get(key);
    }
    
    try {
      // Redis实现逻辑（示例）
      // const result = await redis.get(key);
      // return result ? JSON.parse(result) : null;
      return this.fallback.get(key); // 降级到内存
    } catch (error) {
      logger.error('Redis get failed, falling back to memory:', error);
      return this.fallback.get(key);
    }
  }
  
  async set(key: string, counter: Counter): Promise<void> {
    if (!this.connected) {
      return this.fallback.set(key, counter);
    }
    
    try {
      // Redis实现逻辑（示例）
      // const ttl = Math.ceil((counter.resetAt - Date.now()) / 1000);
      // await redis.setex(key, ttl, JSON.stringify(counter));
      await this.fallback.set(key, counter); // 降级到内存
    } catch (error) {
      logger.error('Redis set failed, falling back to memory:', error);
      await this.fallback.set(key, counter);
    }
  }
  
  async increment(key: string, resetAt: number): Promise<{ count: number; resetAt: number } | null> {
    if (!this.connected) {
      return this.fallback.increment(key, resetAt);
    }
    
    try {
      // Redis原子操作实现（示例）
      // 这里应该使用Redis的INCR和EXPIRE命令来实现原子操作
      return this.fallback.increment(key, resetAt); // 降级到内存
    } catch (error) {
      logger.error('Redis increment failed, falling back to memory:', error);
      return this.fallback.increment(key, resetAt);
    }
  }
}

// 存储实例（单例模式）
let store: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (!store) {
    const env = getEnv();
    
    // 根据配置选择存储后端
    if (env.RATE_LIMIT_STORE === 'redis' || env.REDIS_URL) {
      logger.info('Initializing Redis-backed rate limiter');
      store = new RedisStore();
    } else {
      logger.info('Initializing memory-backed rate limiter');
      store = new MemoryStore();
    }
  }
  
  return store;
}

export function buildRateKey(ip: string | null, path: string): string {
  return `rate_limit:${ip || 'unknown'}:${path}`;
}



// 全局内存存储（用于向后兼容的同步版本）
const globalMemoryCounters = new Map<string, Counter>();

// 向后兼容的同步版本（使用内存存储）
export function checkRateLimit(
  key: string,
  limit?: number,
  windowMs: number = 60_000
): { allowed: boolean; retryAfter?: number } {
  const env = getEnv();
  const maxRequests = limit || env.MAX_REQUESTS_PER_MINUTE || 60;
  const now = Date.now();
  
  try {
    // 使用全局内存存储保持状态
    const existing = globalMemoryCounters.get(key);
    
    if (!existing || existing.resetAt <= now) {
      globalMemoryCounters.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }
    
    if (existing.count < maxRequests) {
      existing.count += 1;
      return { allowed: true };
    }
    
    const retryAfter = Math.max(0, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, retryAfter };
    
  } catch (error) {
    logger.error('Sync rate limit check failed:', error);
    return { allowed: true }; // 降级策略
  }
}

// 异步版本的速率限制检查（推荐）
export async function checkRateLimitAsync(
  key: string,
  limit?: number,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  const env = getEnv();
  const maxRequests = limit || env.MAX_REQUESTS_PER_MINUTE || 60;
  const now = Date.now();
  const resetAt = now + windowMs;
  
  try {
    const store = getStore();
    const result = await store.increment(key, resetAt);
    
    if (!result) {
      logger.error('Rate limit store returned null result');
      return { allowed: true }; // 降级：如果无法获取计数，允许请求
    }
    
    const { count } = result;
    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    
    if (!allowed) {
      const retryAfter = Math.max(0, Math.ceil((result.resetAt - now) / 1000));
      logger.debug('Rate limit exceeded:', { key, count, limit: maxRequests, retryAfter });
      return { allowed: false, retryAfter, remaining: 0 };
    }
    
    return { allowed: true, remaining };
    
  } catch (error) {
    logger.error('Rate limit check failed:', error);
    // 降级策略：如果速率限制系统失败，允许请求以避免服务不可用
    return { allowed: true };
  }
}


