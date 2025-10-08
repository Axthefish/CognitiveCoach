// S0 服务测试

import { S0Service } from '@/services/s0-service';

// Mock dependencies
jest.mock('@/lib/gemini-config', () => ({
  generateJson: jest.fn()
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('S0Service', () => {
  let service: S0Service;
  
  beforeEach(() => {
    service = S0Service.getInstance();
    jest.clearAllMocks();
  });
  
  it('should be a singleton', () => {
    const instance1 = S0Service.getInstance();
    const instance2 = S0Service.getInstance();
    
    expect(instance1).toBe(instance2);
  });
  
  describe('refineGoal', () => {
    it('should handle successful goal refinement', async () => {
      const { generateJson } = require('@/lib/gemini-config');
      generateJson.mockResolvedValue({
        ok: true,
        data: {
          status: 'clarified',
          goal: 'Learn React and TypeScript',
          confidence: 0.9
        }
      });
      
      const response = await service.refineGoal({
        userInput: 'I want to learn frontend development'
      });
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('success');
      expect(json.data.goal).toBe('Learn React and TypeScript');
    });
    
    it('should handle AI timeout', async () => {
      const { generateJson } = require('@/lib/gemini-config');
      generateJson.mockResolvedValue({
        ok: false,
        error: 'TIMEOUT'
      });
      
      const response = await service.refineGoal({
        userInput: 'I want to learn something'
      });
      
      expect(response.status).toBe(504);
      const json = await response.json();
      expect(json.status).toBe('error');
      expect(json.code).toContain('TIMEOUT');
    });
  });
});

