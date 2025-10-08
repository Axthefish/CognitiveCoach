// S1 Prompts 单元测试

import { describe, it, expect } from '@jest/globals';
import { S1_PROMPTS } from '@/lib/prompts/s1-prompts';

describe('S1 Prompts', () => {
  describe('generateFramework', () => {
    it('should include user goal in prompt', () => {
      const userGoal = 'Learn React fundamentals';
      const prompt = S1_PROMPTS.generateFramework({ userGoal });
      
      expect(prompt).toContain(userGoal);
      expect(prompt).toContain('知识框架');
    });
    
    it('should request JSON format', () => {
      const prompt = S1_PROMPTS.generateFramework({ userGoal: 'Test' });
      
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('id');
      expect(prompt).toContain('title');
      expect(prompt).toContain('summary');
    });
  });
  
  describe('getGenerationConfig', () => {
    it('should return config for Lite tier', () => {
      const config = S1_PROMPTS.getGenerationConfig('Lite');
      
      expect(config.temperature).toBe(0.5);
      expect(config.maxOutputTokens).toBe(65536);
    });
    
    it('should return config for Pro tier', () => {
      const config = S1_PROMPTS.getGenerationConfig('Pro');
      
      expect(config.temperature).toBe(0.8);
      expect(config.maxOutputTokens).toBe(65536);
    });
  });
});

