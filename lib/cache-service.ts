// 缓存服务 - 使用 LRU 缓存优化 AI 调用

import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import { logger } from './logger';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  max?: number; // Maximum number of items in cache
  updateAgeOnGet?: boolean; // Whether to update item age on get
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

// 缓存键生成器
export class CacheKeyGenerator {
  static generate(prefix: string, data: unknown): string {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);
    
    return `${prefix}:${hash}`;
  }
  
  static generateForPrompt(stage: string, prompt: string, context?: Record<string, unknown>): string {
    const data = {
      stage,
      prompt: prompt.substring(0, 100), // 只使用前100个字符
      context: context ? this.extractKeyContext(context) : {}
    };
    
    return this.generate('prompt', data);
  }
  
  private static extractKeyContext(context: Record<string, unknown>): Record<string, unknown> {
    // 只提取关键上下文信息用于缓存键
    const keyFields = ['userGoal', 'decisionType', 'runTier', 'riskPreference'];
    const extracted: Record<string, unknown> = {};
    
    for (const field of keyFields) {
      if (field in context) {
        extracted[field] = context[field];
      }
    }
    
    return extracted;
  }
}

// 通用缓存服务
export class CacheService<T> {
  private cache: LRUCache<string, T>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0
  };
  
  constructor(private name: string, options?: CacheOptions) {
    this.cache = new LRUCache<string, T>({
      max: options?.max || 100,
      ttl: options?.ttl || 1000 * 60 * 60, // 默认1小时
      updateAgeOnGet: options?.updateAgeOnGet ?? true,
      
      // 当项目被驱逐时的回调
      dispose: (value, key) => {
        logger.debug(`Cache eviction in ${this.name}:`, { key });
      }
    });
  }
  
  get(key: string): T | undefined {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      this.stats.hits++;
      logger.debug(`Cache hit in ${this.name}:`, { key });
    } else {
      this.stats.misses++;
      logger.debug(`Cache miss in ${this.name}:`, { key });
    }
    
    this.updateHitRate();
    return value;
  }
  
  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, value, { ttl });
    this.stats.sets++;
    logger.debug(`Cache set in ${this.name}:`, { key, ttl });
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.stats.deletes++;
      logger.debug(`Cache delete in ${this.name}:`, { key });
    }
    return result;
  }
  
  clear(): void {
    this.cache.clear();
    logger.info(`Cache cleared: ${this.name}`);
  }
  
  getStats(): CacheStats {
    return { ...this.stats };
  }
  
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// AI 响应缓存
export class AIResponseCache {
  private caches: Map<string, CacheService<any>> = new Map();
  
  constructor() {
    // 为每个阶段创建独立的缓存
    this.caches.set('s0', new CacheService('S0-GoalRefinement', {
      max: 50,
      ttl: 1000 * 60 * 30 // 30分钟
    }));
    
    this.caches.set('s1', new CacheService('S1-KnowledgeFramework', {
      max: 100,
      ttl: 1000 * 60 * 60 // 1小时
    }));
    
    this.caches.set('s2', new CacheService('S2-SystemDynamics', {
      max: 100,
      ttl: 1000 * 60 * 60 // 1小时
    }));
    
    this.caches.set('s3', new CacheService('S3-ActionPlan', {
      max: 100,
      ttl: 1000 * 60 * 60 // 1小时
    }));
    
    this.caches.set('s4', new CacheService('S4-Progress', {
      max: 200,
      ttl: 1000 * 60 * 15 // 15分钟，进度分析需要更频繁更新
    }));
  }
  
  get<T>(stage: string, key: string): T | undefined {
    const cache = this.caches.get(stage.toLowerCase());
    return cache?.get(key);
  }
  
  set<T>(stage: string, key: string, value: T, ttl?: number): void {
    const cache = this.caches.get(stage.toLowerCase());
    cache?.set(key, value, ttl);
  }
  
  // 获取或生成缓存值
  async getOrGenerate<T>(
    stage: string,
    key: string,
    generator: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // 尝试从缓存获取
    const cached = this.get<T>(stage, key);
    if (cached !== undefined) {
      return cached;
    }
    
    // 生成新值
    const value = await generator();
    
    // 存入缓存
    this.set(stage, key, value, ttl);
    
    return value;
  }
  
  invalidate(stage: string, key?: string): void {
    const cache = this.caches.get(stage.toLowerCase());
    if (cache) {
      if (key) {
        cache.delete(key);
      } else {
        cache.clear();
      }
    }
  }
  
  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    
    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats();
    }
    
    return stats;
  }
}

// 单例实例
export const aiResponseCache = new AIResponseCache();

// 缓存装饰器
export function cached(stage: string, ttl?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // 生成缓存键
      const key = CacheKeyGenerator.generate(`${stage}:${propertyKey}`, args);
      
      // 尝试使用缓存
      return await aiResponseCache.getOrGenerate(
        stage,
        key,
        async () => originalMethod.apply(this, args),
        ttl
      );
    };
    
    return descriptor;
  };
}

// 条件缓存装饰器 - 只在特定条件下使用缓存
export function cachedIf(
  stage: string,
  condition: (...args: any[]) => boolean,
  ttl?: number
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // 检查是否应该使用缓存
      if (!condition(...args)) {
        return originalMethod.apply(this, args);
      }
      
      // 生成缓存键
      const key = CacheKeyGenerator.generate(`${stage}:${propertyKey}`, args);
      
      // 尝试使用缓存
      return await aiResponseCache.getOrGenerate(
        stage,
        key,
        async () => originalMethod.apply(this, args),
        ttl
      );
    };
    
    return descriptor;
  };
}
