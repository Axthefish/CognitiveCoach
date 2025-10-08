// 错误消息测试

import { getUserFriendlyError, extractZodErrorMessage, API_ERROR_MAP, SCHEMA_ERROR_MAP } from '@/lib/error-messages';

describe('error-messages', () => {
  describe('getUserFriendlyError', () => {
    it('should return API error for known error codes', () => {
      const error = getUserFriendlyError('TIMEOUT');
      
      expect(error.title).toBe('请求超时');
      expect(error.actionable).toBe(true);
      expect(error.suggestion).toBeDefined();
    });
    
    it('should return schema error for field names', () => {
      const error = getUserFriendlyError('userGoal');
      
      expect(error.title).toBe('学习目标缺失');
      expect(error.message).toBe('请输入您的学习目标');
      expect(error.actionable).toBe(true);
    });
    
    it('should return default error for unknown codes', () => {
      const error = getUserFriendlyError('UNKNOWN_ERROR_CODE');
      
      expect(error.title).toBe('操作失败');
      expect(error.actionable).toBe(true);
    });
    
    it('should prioritize stage-specific errors', () => {
      const error = getUserFriendlyError('QA_FAILED', 'S1');
      
      expect(error.title).toBe('知识框架质量检查未通过');
      expect(error.message).toContain('知识框架');
    });
  });
  
  describe('extractZodErrorMessage', () => {
    it('should extract friendly message from Zod error', () => {
      const zodError = {
        issues: [
          {
            path: ['payload', 'userGoal'],
            message: 'Required'
          }
        ]
      };
      
      const error = extractZodErrorMessage(zodError);
      
      expect(error.title).toBe('学习目标缺失');
      expect(error.actionable).toBe(true);
    });
    
    it('should handle multiple issues', () => {
      const zodError = {
        issues: [
          {
            path: ['userGoal'],
            message: 'Required'
          },
          {
            path: ['framework'],
            message: 'Required'
          }
        ]
      };
      
      const error = extractZodErrorMessage(zodError);
      
      expect(error.suggestion).toContain('2 个验证错误');
    });
    
    it('should handle empty issues array', () => {
      const zodError = {
        issues: []
      };
      
      const error = extractZodErrorMessage(zodError);
      
      expect(error.title).toBe('操作失败');
    });
  });
  
  describe('API_ERROR_MAP', () => {
    it('should have user-friendly messages for all error types', () => {
      const requiredErrors = [
        'NO_API_KEY',
        'TIMEOUT',
        'RATE_LIMIT',
        'PARSE_ERROR',
        'NETWORK_ERROR'
      ];
      
      requiredErrors.forEach(errorCode => {
        expect(API_ERROR_MAP[errorCode]).toBeDefined();
        expect(API_ERROR_MAP[errorCode].title).toBeTruthy();
        expect(API_ERROR_MAP[errorCode].message).toBeTruthy();
      });
    });
  });
  
  describe('SCHEMA_ERROR_MAP', () => {
    it('should cover common required fields', () => {
      const requiredFields = [
        'userGoal',
        'userInput',
        'framework',
        'actionPlan',
        'progressData'
      ];
      
      requiredFields.forEach(field => {
        expect(SCHEMA_ERROR_MAP[field]).toBeDefined();
        expect(SCHEMA_ERROR_MAP[field].title).toBeTruthy();
        expect(SCHEMA_ERROR_MAP[field].message).toBeTruthy();
      });
    });
  });
});

