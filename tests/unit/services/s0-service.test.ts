// S0 服务测试

import { Stage0Service } from '@/services/stage0-service';

// Mock dependencies
jest.mock('@/lib/ai-retry-handler', () => ({
  generateJsonWithRetry: jest.fn()
}));

jest.mock('@/lib/env-validator', () => ({
  getAIApiKey: jest.fn(() => 'test-api-key'),
  isProduction: jest.fn(() => false),
  validateEnv: jest.fn()
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Stage0Service', () => {
  let service: Stage0Service;
  
  beforeEach(() => {
    service = Stage0Service.getInstance();
    jest.clearAllMocks();
  });
  
  it('should be a singleton', () => {
    const instance1 = Stage0Service.getInstance();
    const instance2 = Stage0Service.getInstance();
    
    expect(instance1).toBe(instance2);
  });
  
  describe('refineGoal', () => {
    it('should handle successful goal refinement', async () => {
      const { generateJsonWithRetry } = require('@/lib/ai-retry-handler');
      generateJsonWithRetry.mockResolvedValue({
        ok: true,
        data: {
          status: 'clarified',
          goal: 'Learn React and TypeScript',
          confidence: 0.9
        },
        attempts: 1
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
      const { generateJsonWithRetry } = require('@/lib/ai-retry-handler');
      generateJsonWithRetry.mockResolvedValue({
        ok: false,
        error: 'TIMEOUT',
        attempts: 3
      });
      
      const response = await service.refineGoal({
        userInput: 'I want to learn something'
      });
      
      // Error status codes may vary based on error handling implementation
      expect(response.status).toBeGreaterThanOrEqual(400);
      const json = await response.json();
      expect(json.status).toBe('error');
    });
  });
});

