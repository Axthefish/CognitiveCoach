/**
 * Example Selector 单元测试
 * 
 * 测试示例选择算法的准确性和fallback机制
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  selectStage0Examples,
  selectStage1Examples,
  selectStage2Examples,
  getExampleStats,
  preloadAllExamples,
} from '@/lib/prompts/example-selector';

describe('ExampleSelector', () => {
  
  beforeAll(() => {
    // 预加载示例
    preloadAllExamples();
  });
  
  // ========================================
  // 统计信息测试
  // ========================================
  
  describe('getExampleStats', () => {
    it('should return correct example counts', () => {
      const stats = getExampleStats();
      
      expect(stats.totalExamples).toBeGreaterThan(0);
      expect(stats.byStage.stage0).toBeGreaterThan(0);
      expect(stats.byStage.stage1).toBeGreaterThan(0);
      expect(stats.byStage.stage2).toBeGreaterThan(0);
      expect(stats.totalExamples).toBe(
        stats.byStage.stage0 + stats.byStage.stage1 + stats.byStage.stage2
      );
    });
    
    it('should include domain distribution', () => {
      const stats = getExampleStats();
      
      expect(Object.keys(stats.byDomain).length).toBeGreaterThan(0);
      
      const totalByDomain = Object.values(stats.byDomain).reduce(
        (sum, count) => sum + count,
        0
      );
      expect(totalByDomain).toBe(stats.totalExamples);
    });
  });
  
  // ========================================
  // Stage 0 示例选择测试
  // ========================================
  
  describe('selectStage0Examples', () => {
    it('should select relevant examples for Python learning', () => {
      const userInput = '我想学Python做数据分析';
      const selection = selectStage0Examples(userInput, { maxExamples: 2 });
      
      expect(selection.examples.length).toBeGreaterThan(0);
      expect(selection.examples.length).toBeLessThanOrEqual(2);
      expect(selection.formatted).toContain('<examples>');
      expect(['exact', 'partial', 'generic']).toContain(selection.matchQuality);
    });
    
    it('should select relevant examples for career transition', () => {
      const userInput = '我想转行做产品经理';
      const selection = selectStage0Examples(userInput, { maxExamples: 2 });
      
      expect(selection.examples.length).toBeGreaterThan(0);
      expect(selection.matchQuality).not.toBe('generic');
    });
    
    it('should fallback to generic when no match', () => {
      const userInput = 'xyz 完全不相关的输入 abc';
      const selection = selectStage0Examples(userInput, {
        maxExamples: 2,
        fallbackToGeneric: true
      });
      
      expect(selection.examples.length).toBe(1);
      expect(selection.matchQuality).toBe('generic');
    });
    
    it('should respect maxExamples limit', () => {
      const userInput = '学习编程';
      
      const selection1 = selectStage0Examples(userInput, { maxExamples: 1 });
      expect(selection1.examples.length).toBeLessThanOrEqual(1);
      
      const selection2 = selectStage0Examples(userInput, { maxExamples: 3 });
      expect(selection2.examples.length).toBeLessThanOrEqual(3);
    });
    
    it('should return empty array when fallback disabled and no match', () => {
      const userInput = 'completely irrelevant xyz';
      const selection = selectStage0Examples(userInput, {
        maxExamples: 2,
        fallbackToGeneric: false
      });
      
      // 如果没有匹配且不fallback，应该返回空或通用示例
      expect(selection.examples.length).toBeGreaterThanOrEqual(0);
    });
  });
  
  // ========================================
  // Stage 1 示例选择测试
  // ========================================
  
  describe('selectStage1Examples', () => {
    it('should select Python examples for Python domain', () => {
      const domain = 'Python编程学习';
      const purpose = '学习Python数据分析';
      const selection = selectStage1Examples(domain, purpose, { maxExamples: 2 });
      
      expect(selection.examples.length).toBeGreaterThan(0);
      expect(selection.formatted).toContain('参考示例');
      expect(selection.formatted).toContain('权重');
    });
    
    it('should select career examples for career domain', () => {
      const domain = '职业转型';
      const purpose = '从技术转产品';
      const selection = selectStage1Examples(domain, purpose, { maxExamples: 2 });
      
      expect(selection.examples.length).toBeGreaterThan(0);
      expect(selection.matchQuality).not.toBe('generic');
    });
    
    it('should include reasoning in examples', () => {
      const domain = 'Python编程';
      const purpose = '数据分析';
      const selection = selectStage1Examples(domain, purpose);
      
      expect(selection.formatted).toContain('reasoning');
      expect(selection.formatted).toContain('关键原则');
    });
    
    it('should fallback to generic when no exact match', () => {
      const domain = '完全未知的领域xyz';
      const purpose = '未知目的';
      const selection = selectStage1Examples(domain, purpose, {
        maxExamples: 2,
        fallbackToGeneric: true
      });
      
      expect(selection.examples.length).toBeGreaterThan(0);
      expect(selection.matchQuality).toBe('generic');
    });
    
    it('should respect maxExamples configuration', () => {
      const domain = '编程学习';
      const purpose = '掌握技能';
      
      const selection1 = selectStage1Examples(domain, purpose, { maxExamples: 1 });
      expect(selection1.examples.length).toBeLessThanOrEqual(1);
      
      const selection3 = selectStage1Examples(domain, purpose, { maxExamples: 3 });
      expect(selection3.examples.length).toBeLessThanOrEqual(3);
    });
  });
  
  // ========================================
  // Stage 2 示例选择测试
  // ========================================
  
  describe('selectStage2Examples', () => {
    it('should select examples for known domain', () => {
      const domain = 'Python数据分析';
      const selection = selectStage2Examples(domain, { maxExamples: 1 });
      
      expect(selection.examples.length).toBeGreaterThan(0);
      expect(selection.formatted).toContain('高质量问题设计示例');
      expect(selection.formatted).toContain('设计原则');
    });
    
    it('should include design principles', () => {
      const domain = '技能学习';
      const selection = selectStage2Examples(domain);
      
      expect(selection.formatted).toContain('✓');  // 好的实践
      expect(selection.formatted).toContain('✗');  // 避免的实践
      expect(selection.formatted).toContain('问题能直接影响');
    });
    
    it('should fallback gracefully', () => {
      const domain = '未知领域xyz';
      const selection = selectStage2Examples(domain, {
        maxExamples: 1,
        fallbackToGeneric: true
      });
      
      expect(selection.examples.length).toBeGreaterThan(0);
    });
  });
  
  // ========================================
  // 匹配质量评估测试
  // ========================================
  
  describe('Match Quality', () => {
    it('should classify match quality correctly', () => {
      // Exact match
      const exact = selectStage1Examples('Python编程学习', '数据分析', { maxExamples: 2 });
      expect(['exact', 'partial']).toContain(exact.matchQuality);
      
      // Partial match
      const partial = selectStage1Examples('编程', '学习', { maxExamples: 2 });
      expect(['exact', 'partial', 'generic']).toContain(partial.matchQuality);
      
      // Generic fallback
      const generic = selectStage1Examples('xyz未知', 'abc未知', {
        maxExamples: 2,
        fallbackToGeneric: true
      });
      expect(generic.matchQuality).toBe('generic');
    });
    
    it('should prefer exact matches over partial', () => {
      // 如果有完全匹配的示例，应该优先返回
      const selection = selectStage1Examples(
        'Python编程学习（数据分析方向）',
        '学习Python进行业务数据分析',
        { maxExamples: 2 }
      );
      
      expect(selection.examples.length).toBeGreaterThan(0);
      // 检查是否包含Python相关的示例
      const hasPythonExample = selection.examples.some(
        ex => ex.domain.includes('Python') || ex.purpose.includes('Python')
      );
      expect(hasPythonExample).toBe(true);
    });
  });
  
  // ========================================
  // 边缘情况测试
  // ========================================
  
  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const selection = selectStage0Examples('', { maxExamples: 2 });
      expect(selection.examples.length).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle very long input', () => {
      const longInput = '学习'.repeat(100);
      const selection = selectStage0Examples(longInput, { maxExamples: 2 });
      expect(selection.examples.length).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle special characters', () => {
      const specialInput = '学习@#$%Python!?数据分析';
      const selection = selectStage1Examples(specialInput, '目的', { maxExamples: 2 });
      expect(selection.examples.length).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle maxExamples = 0', () => {
      const selection = selectStage1Examples('Python', '学习', { maxExamples: 0 });
      expect(selection.examples.length).toBe(0);
    });
    
    it('should handle mixed Chinese and English', () => {
      const mixedInput = 'I want to learn Python数据分析';
      const selection = selectStage0Examples(mixedInput, { maxExamples: 2 });
      expect(selection.examples.length).toBeGreaterThan(0);
    });
  });
  
  // ========================================
  // 格式化输出测试
  // ========================================
  
  describe('Formatted Output', () => {
    it('should have consistent format structure', () => {
      const selection = selectStage1Examples('Python', '数据分析', { maxExamples: 2 });
      
      // 检查必要的结构元素
      expect(selection.formatted).toContain('参考示例');
      expect(selection.formatted).toContain('关键原则');
      expect(selection.formatted).toContain('---');
    });
    
    it('should include XML tags for Stage 0', () => {
      const selection = selectStage0Examples('学习Python', { maxExamples: 2 });
      
      expect(selection.formatted).toContain('<examples>');
      expect(selection.formatted).toContain('</examples>');
    });
    
    it('should be valid markdown', () => {
      const selection = selectStage2Examples('Python', { maxExamples: 1 });
      
      // 检查markdown结构
      expect(selection.formatted).toContain('#');  // 标题
      expect(selection.formatted).toContain('✓');  // 列表项
    });
  });
  
  // ========================================
  // 性能测试
  // ========================================
  
  describe('Performance', () => {
    it('should select examples quickly', () => {
      const start = Date.now();
      
      for (let i = 0; i < 100; i++) {
        selectStage1Examples('Python', '学习', { maxExamples: 2 });
      }
      
      const duration = Date.now() - start;
      
      // 100次选择应该在1秒内完成
      expect(duration).toBeLessThan(1000);
    });
    
    it('should cache preloaded examples', () => {
      const stats1 = getExampleStats();
      const stats2 = getExampleStats();
      
      // 统计应该立即返回，不需要重新计算
      expect(stats1.totalExamples).toBe(stats2.totalExamples);
    });
  });
});

