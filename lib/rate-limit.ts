// 速率限制系统 - 内存存储实现

import { logger } from './logger';
import { getEnv } from './env-validator';

type Counter = { count: number; resetAt: number };
type RateLimitResult = { allowed: boolean; retryAfter?: number; remaining?: number };

export function buildRateKey(ip: string | null, path: string): string {
  return `rate_limit:${ip || 'unknown'}:${path}`;
}

// 全局内存存储
const globalMemoryCounters = new Map<string, Counter>();

// 定期清理过期的计数器，防止内存泄漏
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupTimer(): void {
  if (cleanupInterval) return; // 避免重复启动
  
  // 每分钟清理一次过期的计数器
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, counter] of globalMemoryCounters.entries()) {
      // 清理已过期超过1分钟的计数器
      if (counter.resetAt + 60_000 < now) {
        globalMemoryCounters.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      logger.debug(`Rate limit cleanup: removed ${removedCount} expired entries, ${globalMemoryCounters.size} remaining`);
    }
  }, 60_000); // 每60秒清理一次
  
  // 在Node.js环境中，允许进程退出而不等待此定时器
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

// 手动清理内存计数器（用于测试或重置）
export function clearRateLimitMemory(): void {
  globalMemoryCounters.clear();
  logger.info('Rate limit memory cleared');
}

// 获取当前内存中的计数器数量（用于监控）
export function getRateLimitStats(): { totalKeys: number; activeKeys: number } {
  const now = Date.now();
  let activeKeys = 0;
  
  for (const counter of globalMemoryCounters.values()) {
    if (counter.resetAt > now) {
      activeKeys++;
    }
  }
  
  return {
    totalKeys: globalMemoryCounters.size,
    activeKeys
  };
}

// 同步版本的速率限制检查（使用内存存储）
export function checkRateLimit(
  key: string,
  limit?: number,
  windowMs: number = 60_000
): { allowed: boolean; retryAfter?: number } {
  // 启动清理定时器（只会启动一次）
  startCleanupTimer();
  
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

// 异步版本的速率限制检查（使用全局内存存储）
export async function checkRateLimitAsync(
  key: string,
  limit?: number,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  // 使用同步版本的逻辑，但返回 Promise 以保持接口兼容性
  return Promise.resolve(checkRateLimit(key, limit, windowMs));
}

