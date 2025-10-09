// 缓存服务 - 使用 LRU 缓存优化 AI 调用
// 包含内存监控和自动清理功能

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
  size: number;
  maxSize: number;
  memoryUsage?: {
    estimated: number; // 估计的内存使用量（字节）
    percentage: number; // 占最大内存的百分比
  };
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
  
  static generateForPrompt(stage: string, prompt: string, context?: Record<string, unknown>, userId?: string): string {
    // 增加更多上下文信息以确保键的唯一性
    const data = {
      stage,
      prompt: prompt.substring(0, 200), // 增加到200字符以提高区分度
      context: context ? this.extractKeyContext(context) : {},
      userId: userId || 'anonymous', // 添加用户标识
      timestamp: Math.floor(Date.now() / (1000 * 60 * 5)), // 5分钟时间窗口（同一窗口内相同请求可复用）
    };
    
    return this.generate('prompt', data);
  }
  
  private static extractKeyContext(context: Record<string, unknown>): Record<string, unknown> {
    // 提取关键上下文信息用于缓存键，增加更多字段
    const keyFields = [
      'userGoal', 
      'decisionType', 
      'runTier', 
      'riskPreference',
      'seed', // 添加 seed 以区分不同随机性要求
      'iterationCount', // 添加迭代次数
      'frameworkSize', // 框架大小（用于区分不同复杂度）
    ];
    const extracted: Record<string, unknown> = {};
    
    for (const field of keyFields) {
      if (field in context && context[field] !== undefined) {
        extracted[field] = context[field];
      }
    }
    
    return extracted;
  }
}

// 内存监控器
class MemoryMonitor {
  private static instance: MemoryMonitor;
  private lastCleanup = Date.now();
  private cleanupInterval = 5 * 60 * 1000; // 5分钟清理间隔
  
  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }
  
  getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return null;
  }
  
  isMemoryPressure(): boolean {
    const memory = this.getMemoryUsage();
    if (!memory) return false;
    
    // 如果已使用内存超过100MB，认为有内存压力
    const threshold = 100 * 1024 * 1024; // 100MB
    return memory.heapUsed > threshold;
  }
  
  shouldTriggerCleanup(): boolean {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.lastCleanup;
    
    return (
      timeSinceLastCleanup > this.cleanupInterval ||
      this.isMemoryPressure()
    );
  }
  
  markCleanup(): void {
    this.lastCleanup = Date.now();
  }
}

// 通用缓存服务
export class CacheService<T extends object> {
  private cache: LRUCache<string, T>;
  private maxMemoryBytes: number;
  private cleanupTimer?: NodeJS.Timeout; // 存储定时器引用以便清理
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    size: 0,
    maxSize: 0
  };
  
  constructor(private name: string, options?: CacheOptions) {
    const maxSize = options?.max || 100;
    this.maxMemoryBytes = this.calculateMaxMemory(maxSize);
    
    this.cache = new LRUCache<string, T>({
      max: maxSize,
      ttl: options?.ttl || 1000 * 60 * 60, // 默认1小时
      updateAgeOnGet: options?.updateAgeOnGet ?? true,
      
      // 内存大小计算函数
      sizeCalculation: (value) => {
        return this.estimateObjectSize(value);
      },
      
      // 设置最大内存使用量
      maxSize: this.maxMemoryBytes,
      
      // 当项目被驱逐时的回调
      dispose: (value, key, reason) => {
        logger.debug(`Cache eviction in ${this.name}:`, { key, reason });
        this.stats.deletes++;
      }
    });
    
    this.stats.maxSize = maxSize;
    
    // 启动定期清理
    this.startPeriodicCleanup();
  }
  
  private calculateMaxMemory(maxItems: number): number {
    // 估算：每个项目平均5KB，最多不超过50MB
    const avgItemSize = 5 * 1024; // 5KB
    const calculated = maxItems * avgItemSize;
    const maxAllowed = 50 * 1024 * 1024; // 50MB
    
    return Math.min(calculated, maxAllowed);
  }
  
  private estimateObjectSize(obj: unknown): number {
    try {
      const jsonString = JSON.stringify(obj);
      // 粗略估算：JSON字符串长度 * 2（Unicode字符）+ 对象开销
      return jsonString.length * 2 + 200;
    } catch {
      // 如果无法序列化，返回默认大小
      return 1000;
    }
  }
  
  private startPeriodicCleanup(): void {
    // 定期清理过期项目
    this.cleanupTimer = setInterval(() => {
      this.performMaintenance();
    }, 2 * 60 * 1000); // 每2分钟执行一次
    
    // 如果是 Node.js 环境，取消 unref 以允许进程退出
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
  
  private performMaintenance(): void {
    const monitor = MemoryMonitor.getInstance();
    
    if (monitor.shouldTriggerCleanup()) {
      this.triggerCleanup('maintenance');
      monitor.markCleanup();
    }
    
    // 更新统计信息
    this.updateStats();
  }
  
  private triggerCleanup(reason: string): void {
    const sizeBefore = this.cache.size;
    
    // 如果内存压力很大，清理一半的缓存项目
    const monitor = MemoryMonitor.getInstance();
    if (monitor.isMemoryPressure()) {
      const targetSize = Math.floor(this.cache.size * 0.5);
      while (this.cache.size > targetSize) {
        // LRU缓存会自动移除最旧的项目
        const key = this.cache.keys().next().value;
        if (key) {
          this.cache.delete(key);
        } else {
          break;
        }
      }
      
      logger.info(`Emergency cache cleanup in ${this.name}:`, {
        reason,
        itemsRemoved: sizeBefore - this.cache.size,
        remainingItems: this.cache.size
      });
    }
  }
  
  private updateStats(): void {
    this.stats.size = this.cache.size;
    
    // 估算内存使用
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage) {
      this.stats.memoryUsage = {
        estimated: memoryUsage.estimated,
        percentage: (memoryUsage.estimated / this.maxMemoryBytes) * 100
      };
    }
  }
  
  private getMemoryUsage(): { estimated: number } | null {
    try {
      let totalSize = 0;
      for (const [, value] of this.cache.entries()) {
        totalSize += this.estimateObjectSize(value);
      }
      return { estimated: totalSize };
    } catch {
      return null;
    }
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
  
  /**
   * 销毁缓存服务，清理定时器和资源
   * 应该在应用关闭或缓存不再需要时调用
   */
  destroy(): void {
    // 停止定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      logger.info(`Cleanup timer stopped for ${this.name}`);
    }
    
    // 清空缓存
    this.cache.clear();
    logger.info(`Cache destroyed: ${this.name}`);
  }
  
  getStats(): CacheStats {
    this.updateStats(); // 确保统计信息是最新的
    return { ...this.stats };
  }
  
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
  
  // 手动触发清理
  public forceCleanup(): void {
    this.triggerCleanup('manual');
    logger.info(`Manual cache cleanup completed for ${this.name}`);
  }
  
  // 获取缓存健康状态
  public getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: {
      memoryPressure: boolean;
      hitRate: number;
      size: number;
      maxSize: number;
    };
    recommendations?: string[];
  } {
    this.updateStats();
    
    const monitor = MemoryMonitor.getInstance();
    const memoryPressure = monitor.isMemoryPressure();
    const hitRate = this.stats.hitRate;
    const utilizationRate = this.stats.size / this.stats.maxSize;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];
    
    // 判断健康状态
    if (memoryPressure || utilizationRate > 0.9) {
      status = 'critical';
      recommendations.push('考虑减少缓存大小或增加清理频率');
    } else if (utilizationRate > 0.7 || hitRate < 0.3) {
      status = 'warning';
      if (utilizationRate > 0.7) {
        recommendations.push('缓存利用率较高，注意内存使用');
      }
      if (hitRate < 0.3) {
        recommendations.push('缓存命中率较低，考虑调整缓存策略');
      }
    }
    
    return {
      status,
      metrics: {
        memoryPressure,
        hitRate,
        size: this.stats.size,
        maxSize: this.stats.maxSize
      },
      recommendations: recommendations.length > 0 ? recommendations : undefined
    };
  }
}

// AI 响应缓存
export class AIResponseCache {
  private caches: Map<string, CacheService<object>> = new Map();
  private destroyed = false;
  
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
  
  get<T extends object>(stage: string, key: string): T | undefined {
    const cache = this.caches.get(stage.toLowerCase());
    return cache?.get(key) as T | undefined;
  }
  
  set<T extends object>(stage: string, key: string, value: T, ttl?: number): void {
    const cache = this.caches.get(stage.toLowerCase());
    cache?.set(key, value, ttl);
  }
  
  // 获取或生成缓存值
  async getOrGenerate<T extends object>(
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
  
  // 获取全局缓存健康状态
  getGlobalHealthStatus(): {
    overallStatus: 'healthy' | 'warning' | 'critical';
    cacheDetails: Record<string, ReturnType<CacheService<object>['getHealthStatus']>>;
    globalMetrics: {
      totalItems: number;
      totalMemoryEstimate: number;
      averageHitRate: number;
    };
    recommendations: string[];
  } {
    const cacheDetails: Record<string, ReturnType<CacheService<object>['getHealthStatus']>> = {};
    let totalItems = 0;
    let totalMemoryEstimate = 0;
    let totalHits = 0;
    let totalRequests = 0;
    
    // 收集所有缓存的健康状态
    for (const [name, cache] of this.caches) {
      const health = cache.getHealthStatus();
      cacheDetails[name] = health;
      
      const stats = cache.getStats();
      totalItems += stats.size;
      totalMemoryEstimate += stats.memoryUsage?.estimated || 0;
      totalHits += stats.hits;
      totalRequests += stats.hits + stats.misses;
    }
    
    // 计算全局指标
    const averageHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    
    // 确定整体状态
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];
    
    const criticalCount = Object.values(cacheDetails).filter(d => d.status === 'critical').length;
    const warningCount = Object.values(cacheDetails).filter(d => d.status === 'warning').length;
    
    if (criticalCount > 0) {
      overallStatus = 'critical';
      recommendations.push(`${criticalCount} 个缓存处于关键状态，需要立即处理`);
    } else if (warningCount > 0) {
      overallStatus = 'warning';
      recommendations.push(`${warningCount} 个缓存需要注意`);
    }
    
    // 全局建议
    if (totalMemoryEstimate > 100 * 1024 * 1024) { // 100MB
      recommendations.push('总内存使用量较高，考虑减少缓存项目或调整TTL');
    }
    
    if (averageHitRate < 0.4) {
      recommendations.push('整体缓存命中率较低，考虑优化缓存策略');
    }
    
    return {
      overallStatus,
      cacheDetails,
      globalMetrics: {
        totalItems,
        totalMemoryEstimate,
        averageHitRate
      },
      recommendations
    };
  }
  
  // 执行全局缓存清理
  performGlobalCleanup(): void {
    logger.info('Starting global cache cleanup...');
    
    for (const [, cache] of this.caches) {
      cache.forceCleanup();
    }
    
    logger.info('Global cache cleanup completed');
  }
  
  // 清理低价值缓存项目
  cleanupLowValueItems(): void {
    const stats = this.getAllStats();
    
    for (const [cacheName, cache] of this.caches) {
      const cacheStats = stats[cacheName];
      
      // 如果命中率很低，清理该缓存
      if (cacheStats.hitRate < 0.2 && cacheStats.size > 10) {
        logger.info(`Cleaning up low-value cache ${cacheName} (hit rate: ${cacheStats.hitRate.toFixed(2)})`);
        cache.clear();
      }
    }
  }
  
  /**
   * 销毁所有缓存服务
   * 应该在应用关闭时调用
   */
  destroy(): void {
    if (this.destroyed) {
      logger.warn('AIResponseCache already destroyed');
      return;
    }
    
    logger.info('Destroying AIResponseCache and all sub-caches...');
    
    for (const [name, cache] of this.caches) {
      cache.destroy();
      logger.info(`Cache ${name} destroyed`);
    }
    
    this.caches.clear();
    this.destroyed = true;
    
    logger.info('AIResponseCache destroyed successfully');
  }
  
  /**
   * 检查缓存是否已销毁
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }
}

// 单例实例
export const aiResponseCache = new AIResponseCache();

// 进程生命周期管理 - 确保在进程退出时正确清理资源
// 使用标志避免重复注册监听器（防止内存泄漏）
let cleanupHandlersRegistered = false;

if (typeof process !== 'undefined' && !cleanupHandlersRegistered) {
  cleanupHandlersRegistered = true;
  
  const cleanup = () => {
    logger.info('Process shutting down, cleaning up cache resources...');
    aiResponseCache.destroy();
  };
  
  // 监听各种退出信号
  process.once('SIGTERM', cleanup); // 使用once避免重复调用
  process.once('SIGINT', cleanup);
  process.once('beforeExit', cleanup);
  
  // 监听未捕获的异常和Promise拒绝
  process.once('uncaughtException', (error) => {
    logger.error('Uncaught exception, cleaning up before exit:', error);
    aiResponseCache.destroy();
    process.exit(1);
  });
  
  process.once('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection, cleaning up before exit:', { reason, promise });
    aiResponseCache.destroy();
    process.exit(1);
  });
  
  logger.debug('Cache cleanup handlers registered (once)');
}

// 缓存装饰器
export function cached(stage: string, ttl?: number) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
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
  condition: (...args: unknown[]) => boolean,
  ttl?: number
) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
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
