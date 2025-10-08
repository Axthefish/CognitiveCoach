// S1 Service 单元测试

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { S1Service } from '@/services/s1-service';

// Mock dependencies
jest.mock('@/lib/gemini-config');
jest.mock('@/lib/ai-retry-handler');
jest.mock('@/lib/qa');
jest.mock('@/lib/logger');

describe('S1Service', () => {
  let service: S1Service;
  
  beforeEach(() => {
    service = S1Service.getInstance();
  });
  
  it('should be a singleton', () => {
    const instance1 = S1Service.getInstance();
    const instance2 = S1Service.getInstance();
    
    expect(instance1).toBe(instance2);
  });
  
  describe('generateFramework', () => {
    it('should accept valid payload', () => {
      const payload = {
        userGoal: 'Learn React',
        runTier: 'Pro' as const,
      };
      
      expect(() => service.generateFramework(payload)).not.toThrow();
    });
  });
});

