// S1 Service 单元测试

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Stage1Service } from '@/services/stage1-service';

// Mock dependencies
jest.mock('@/lib/gemini-config');
jest.mock('@/lib/ai-retry-handler');
jest.mock('@/lib/qa');
jest.mock('@/lib/logger');

describe('Stage1Service', () => {
  let service: Stage1Service;
  
  beforeEach(() => {
    service = Stage1Service.getInstance();
  });
  
  it('should be a singleton', () => {
    const instance1 = Stage1Service.getInstance();
    const instance2 = Stage1Service.getInstance();
    
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

