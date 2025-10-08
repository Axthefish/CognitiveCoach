// 缓存服务单元测试

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CacheService, CacheKeyGenerator } from '@/lib/cache-service';

describe('CacheKeyGenerator', () => {
  it('should generate consistent keys for same input', () => {
    const data = { userGoal: 'Learn React', runTier: 'Pro' };
    const key1 = CacheKeyGenerator.generate('test', data);
    const key2 = CacheKeyGenerator.generate('test', data);
    
    expect(key1).toBe(key2);
  });
  
  it('should generate different keys for different inputs', () => {
    const data1 = { userGoal: 'Learn React' };
    const data2 = { userGoal: 'Learn Vue' };
    
    const key1 = CacheKeyGenerator.generate('test', data1);
    const key2 = CacheKeyGenerator.generate('test', data2);
    
    expect(key1).not.toBe(key2);
  });
  
  it('should generate prompt cache key', () => {
    const key = CacheKeyGenerator.generateForPrompt(
      's1',
      'Generate a knowledge framework for React',
      { runTier: 'Pro' }
    );
    
    expect(key).toMatch(/^prompt:/);
  });
});

describe('CacheService', () => {
  let cache: CacheService<{ value: string }>;
  
  beforeEach(() => {
    cache = new CacheService('test-cache', {
      max: 10,
      ttl: 1000 * 60, // 1分钟
    });
  });
  
  it('should store and retrieve values', () => {
    const testData = { value: 'test' };
    cache.set('key1', testData);
    
    const retrieved = cache.get('key1');
    expect(retrieved).toEqual(testData);
  });
  
  it('should return undefined for non-existent keys', () => {
    const retrieved = cache.get('non-existent');
    expect(retrieved).toBeUndefined();
  });
  
  it('should track cache hits and misses', () => {
    cache.set('key1', { value: 'test' });
    
    cache.get('key1'); // hit
    cache.get('non-existent'); // miss
    
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.5);
  });
  
  it('should delete values', () => {
    cache.set('key1', { value: 'test' });
    expect(cache.has('key1')).toBe(true);
    
    cache.delete('key1');
    expect(cache.has('key1')).toBe(false);
  });
  
  it('should clear all values', () => {
    cache.set('key1', { value: 'test1' });
    cache.set('key2', { value: 'test2' });
    
    cache.clear();
    
    const stats = cache.getStats();
    expect(stats.size).toBe(0);
  });
  
  it('should provide health status', () => {
    const health = cache.getHealthStatus();
    
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('metrics');
    expect(['healthy', 'warning', 'critical']).toContain(health.status);
  });
});

