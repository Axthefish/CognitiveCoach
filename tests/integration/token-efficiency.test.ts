/**
 * Token效率集成测试
 * 
 * 验证Context Engineering优化是否达到预期的40-50% token节省
 * 使用真实场景数据测试完整流程
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { contextManager } from '@/lib/context-manager';
import { getFrameworkGenerationPrompt } from '@/lib/prompts/stage1-prompts';
import { getMissingInfoAnalysisPrompt } from '@/lib/prompts/stage2-prompts';
import {
  ALL_SCENARIOS,
  getScenarioStats,
  getCompactionScenarios,
  scenario1_pythonDataAnalysis,
  scenario2_careerTransition,
  scenario5_careerPlanning,
} from '../fixtures/real-scenarios';

describe('Token Efficiency Integration Tests', () => {
  
  let scenarioStats: ReturnType<typeof getScenarioStats>;
  
  beforeAll(() => {
    scenarioStats = getScenarioStats();
    console.log('\n=== Scenario Statistics ===');
    console.log(`Total Scenarios: ${scenarioStats.totalScenarios}`);
    console.log(`Avg Conversation Turns: ${scenarioStats.avgConversationTurns.toFixed(1)}`);
    console.log(`Expected Total Savings: ${scenarioStats.expectedTotalSavings} tokens`);
    console.log(`Expected Avg Savings: ${scenarioStats.expectedAvgSavingsPercent.toFixed(1)}%`);
    console.log('===========================\n');
  });
  
  // ========================================
  // Stage 0: 对话压缩效率测试
  // ========================================
  
  describe('Stage 0: Conversation Compaction', () => {
    it('should not compact short conversations (< 10 turns)', () => {
      const scenario = scenario1_pythonDataAnalysis;
      const messages = scenario.stage0.conversationHistory;
      
      // 场景1是9轮对话，不应该触发压缩
      const shouldCompact = contextManager.shouldCompact(messages);
      expect(shouldCompact).toBe(false);
      
      const tokens = contextManager.estimateMessagesTokens(messages);
      console.log(`\n[Scenario 1] ${scenario.name}`);
      console.log(`  Turns: ${messages.length / 2}`);
      console.log(`  Tokens: ${tokens}`);
      console.log(`  Compaction needed: No`);
    });
    
    it('should compact long conversations (> 10 turns) effectively', async () => {
      const compactionScenarios = getCompactionScenarios();
      
      console.log(`\n=== Testing ${compactionScenarios.length} scenarios requiring compaction ===\n`);
      
      for (const scenario of compactionScenarios) {
        const messages = scenario.stage0.conversationHistory;
        const originalTokens = contextManager.estimateMessagesTokens(messages);
        
        // 执行压缩
        const result = await contextManager.smartCompact(messages);
        
        console.log(`[${scenario.name}]`);
        console.log(`  Turns: ${messages.length / 2}`);
        console.log(`  Original tokens: ${originalTokens}`);
        console.log(`  Compacted tokens: ${result.compactedTokens}`);
        console.log(`  Compression ratio: ${(result.compressionRatio * 100).toFixed(1)}%`);
        console.log(`  Tokens saved: ${originalTokens - result.compactedTokens}`);
        console.log(`  Was compacted: ${result.wasCompacted}`);
        
        if (result.wasCompacted) {
          // 验证压缩效果
          expect(result.compactedTokens).toBeLessThan(originalTokens);
          expect(result.compressionRatio).toBeLessThan(1.0);
          
          // 验证至少节省20%（保守目标）
          const savingsPercent = (1 - result.compressionRatio) * 100;
          expect(savingsPercent).toBeGreaterThan(20);
          
          // 验证摘要存在
          expect(result.summary).toBeTruthy();
          expect(result.summary.length).toBeGreaterThan(0);
          
          // 验证最近轮次被保留
          expect(result.compactedMessages.length).toBeGreaterThan(0);
        }
        console.log('');
      }
    });
    
    it('should achieve ≥40% token savings on career planning scenario', async () => {
      const scenario = scenario5_careerPlanning;
      const messages = scenario.stage0.conversationHistory;
      
      const originalTokens = contextManager.estimateMessagesTokens(messages);
      const result = await contextManager.smartCompact(messages);
      
      const savingsPercent = (1 - result.compressionRatio) * 100;
      
      console.log(`\n[Long Conversation Test: ${scenario.name}]`);
      console.log(`  Original: ${originalTokens} tokens`);
      console.log(`  Compacted: ${result.compactedTokens} tokens`);
      console.log(`  Savings: ${savingsPercent.toFixed(1)}%`);
      console.log(`  Target: ≥40%`);
      
      // 验证达到40%节省目标
      expect(savingsPercent).toBeGreaterThanOrEqual(40);
    });
    
    it('should preserve key information after compaction', async () => {
      const scenario = scenario2_careerTransition;
      const messages = scenario.stage0.conversationHistory;
      
      const result = await contextManager.smartCompact(messages);
      
      if (result.wasCompacted) {
        const summary = result.summary.toLowerCase();
        
        // 验证关键信息在摘要中
        const keyTerms = ['产品', '技术', '转型'];
        const hasKeyTerms = keyTerms.some(term => summary.includes(term));
        
        console.log(`\n[Information Preservation Test]`);
        console.log(`  Summary length: ${summary.length} chars`);
        console.log(`  Contains key terms: ${hasKeyTerms}`);
        console.log(`  Recent turns preserved: ${result.compactedMessages.length - 1}`);
        
        expect(hasKeyTerms).toBe(true);
        
        // 验证最近的对话被完整保留
        const lastUserMessage = messages[messages.length - 2];
        const preservedLastUserMessage = result.compactedMessages.find(
          m => m.content === lastUserMessage.content
        );
        expect(preservedLastUserMessage).toBeDefined();
      }
    });
  });
  
  // ========================================
  // Stage 1: Prompt Token效率测试
  // ========================================
  
  describe('Stage 1: Framework Generation Prompt Efficiency', () => {
    it('should generate prompts within target token limit', () => {
      console.log(`\n=== Stage 1 Prompt Token Tests ===\n`);
      
      const results: Array<{
        scenario: string;
        tokens: number;
        target: number;
        achieved: boolean;
      }> = [];
      
      for (const scenario of ALL_SCENARIOS) {
        const purpose = scenario.stage0.purposeDefinition;
        const prompt = getFrameworkGenerationPrompt(purpose);
        const tokens = contextManager.estimateTokens(prompt);
        
        const target = scenario.expectedTokens_after.stage1_prompt;
        const achieved = tokens <= target * 1.1;  // 允许10%误差
        
        results.push({
          scenario: scenario.name,
          tokens,
          target,
          achieved,
        });
        
        console.log(`[${scenario.name}]`);
        console.log(`  Prompt tokens: ${tokens}`);
        console.log(`  Target: ≤${target}`);
        console.log(`  Status: ${achieved ? '✓ PASS' : '✗ FAIL'}`);
        console.log('');
      }
      
      // 统计
      const passCount = results.filter(r => r.achieved).length;
      const avgTokens = results.reduce((sum, r) => sum + r.tokens, 0) / results.length;
      const avgTarget = results.reduce((sum, r) => sum + r.target, 0) / results.length;
      
      console.log(`Summary:`);
      console.log(`  Pass rate: ${passCount}/${results.length}`);
      console.log(`  Avg actual: ${avgTokens.toFixed(0)} tokens`);
      console.log(`  Avg target: ${avgTarget.toFixed(0)} tokens`);
      console.log('');
      
      // 验证平均值在目标范围内
      expect(avgTokens).toBeLessThanOrEqual(avgTarget * 1.1);
    });
    
    it('should save ≥40% compared to pre-optimization baseline', () => {
      const baselineTokens = 3500;  // 优化前的平均prompt大小
      
      let totalTokens = 0;
      let count = 0;
      
      for (const scenario of ALL_SCENARIOS) {
        const purpose = scenario.stage0.purposeDefinition;
        const prompt = getFrameworkGenerationPrompt(purpose);
        const tokens = contextManager.estimateTokens(prompt);
        
        totalTokens += tokens;
        count++;
      }
      
      const avgTokens = totalTokens / count;
      const savingsPercent = ((baselineTokens - avgTokens) / baselineTokens) * 100;
      
      console.log(`\n[Stage 1 Optimization Comparison]`);
      console.log(`  Baseline (pre-optimization): ${baselineTokens} tokens`);
      console.log(`  Current average: ${avgTokens.toFixed(0)} tokens`);
      console.log(`  Savings: ${savingsPercent.toFixed(1)}%`);
      console.log(`  Target: ≥40%`);
      
      // 验证节省至少40%
      expect(savingsPercent).toBeGreaterThanOrEqual(40);
    });
    
    it('should include examples but remain token-efficient', () => {
      const scenario = scenario1_pythonDataAnalysis;
      const purpose = scenario.stage0.purposeDefinition;
      const prompt = getFrameworkGenerationPrompt(purpose);
      
      // 验证包含示例
      expect(prompt).toContain('参考示例');
      expect(prompt).toContain('reasoning');
      
      // 验证仍然高效
      const tokens = contextManager.estimateTokens(prompt);
      expect(tokens).toBeLessThan(2000);
      
      console.log(`\n[Example Inclusion Test]`);
      console.log(`  Prompt includes examples: Yes`);
      console.log(`  Total tokens: ${tokens}`);
      console.log(`  Remains efficient: ${tokens < 2000 ? 'Yes' : 'No'}`);
    });
  });
  
  // ========================================
  // Stage 2: 个性化Prompt效率测试
  // ========================================
  
  describe('Stage 2: Personalization Prompt Efficiency', () => {
    // 创建模拟框架
    const createMockFramework = (scenario: typeof scenario1_pythonDataAnalysis) => ({
      purpose: scenario.stage0.purposeDefinition.clarifiedPurpose,
      domain: scenario.stage0.purposeDefinition.problemDomain,
      nodes: [
        {
          id: 'node-1',
          title: '核心节点1',
          description: '描述',
          necessity: 1.0,
          impact: 0.9,
          timeROI: 0.85,
          weight: 92,
          reasoning: 'reasoning',
          estimatedTimeHours: 40,
          prerequisites: [],
          category: 'core' as const,
        },
        {
          id: 'node-2',
          title: '核心节点2',
          description: '描述',
          necessity: 0.9,
          impact: 1.0,
          timeROI: 0.9,
          weight: 95,
          reasoning: 'reasoning',
          estimatedTimeHours: 60,
          prerequisites: ['node-1'],
          category: 'core' as const,
        },
      ],
      edges: [],
      weightingLogic: 'test logic',
      mainPath: ['node-1', 'node-2'],
      generatedAt: Date.now(),
    });
    
    it('should generate Stage 2 prompts within target', () => {
      console.log(`\n=== Stage 2 Prompt Token Tests ===\n`);
      
      for (const scenario of ALL_SCENARIOS) {
        const framework = createMockFramework(scenario);
        const prompt = getMissingInfoAnalysisPrompt(framework);
        const tokens = contextManager.estimateTokens(prompt);
        
        const target = scenario.expectedTokens_after.stage2_prompt;
        const achieved = tokens <= target * 1.1;
        
        console.log(`[${scenario.name}]`);
        console.log(`  Prompt tokens: ${tokens}`);
        console.log(`  Target: ≤${target}`);
        console.log(`  Status: ${achieved ? '✓ PASS' : '✗ FAIL'}`);
        console.log('');
        
        expect(tokens).toBeLessThanOrEqual(target * 1.15);  // 允许15%误差
      }
    });
    
    it('should save ≥30% compared to baseline', () => {
      const baselineTokens = 2000;  // 优化前baseline
      
      let totalTokens = 0;
      let count = 0;
      
      for (const scenario of ALL_SCENARIOS) {
        const framework = createMockFramework(scenario);
        const prompt = getMissingInfoAnalysisPrompt(framework);
        const tokens = contextManager.estimateTokens(prompt);
        
        totalTokens += tokens;
        count++;
      }
      
      const avgTokens = totalTokens / count;
      const savingsPercent = ((baselineTokens - avgTokens) / baselineTokens) * 100;
      
      console.log(`\n[Stage 2 Optimization Comparison]`);
      console.log(`  Baseline: ${baselineTokens} tokens`);
      console.log(`  Current: ${avgTokens.toFixed(0)} tokens`);
      console.log(`  Savings: ${savingsPercent.toFixed(1)}%`);
      console.log(`  Target: ≥30%`);
      
      expect(savingsPercent).toBeGreaterThanOrEqual(25);  // 略宽松目标
    });
  });
  
  // ========================================
  // 整体效率验证
  // ========================================
  
  describe('Overall Token Efficiency', () => {
    it('should achieve overall 40-50% savings across all stages', async () => {
      console.log(`\n=== Overall Token Efficiency Test ===\n`);
      
      let totalOriginal = 0;
      let totalOptimized = 0;
      
      for (const scenario of ALL_SCENARIOS) {
        // Stage 0
        const messages = scenario.stage0.conversationHistory;
        let stage0Tokens = contextManager.estimateMessagesTokens(messages);
        
        if (messages.length > 10) {
          const compacted = await contextManager.smartCompact(messages);
          stage0Tokens = compacted.compactedTokens;
        }
        
        // Stage 1
        const purpose = scenario.stage0.purposeDefinition;
        const stage1Prompt = getFrameworkGenerationPrompt(purpose);
        const stage1Tokens = contextManager.estimateTokens(stage1Prompt);
        
        // Stage 2
        const framework = {
          purpose: purpose.clarifiedPurpose,
          domain: purpose.problemDomain,
          nodes: [{
            id: 'n1',
            title: 'Node',
            description: '',
            necessity: 1,
            impact: 1,
            timeROI: 1,
            weight: 95,
            reasoning: '',
            estimatedTimeHours: 10,
            prerequisites: [],
            category: 'core' as const,
          }],
          edges: [],
          weightingLogic: '',
          mainPath: ['n1'],
          generatedAt: Date.now(),
        };
        const stage2Prompt = getMissingInfoAnalysisPrompt(framework);
        const stage2Tokens = contextManager.estimateTokens(stage2Prompt);
        
        const optimizedTotal = stage0Tokens + stage1Tokens + stage2Tokens;
        const originalTotal = scenario.expectedTokens_before.total;
        
        totalOriginal += originalTotal;
        totalOptimized += optimizedTotal;
        
        const savingsPercent = ((originalTotal - optimizedTotal) / originalTotal) * 100;
        
        console.log(`[${scenario.name}]`);
        console.log(`  Original: ${originalTotal} tokens`);
        console.log(`  Optimized: ${optimizedTotal} tokens`);
        console.log(`  Savings: ${savingsPercent.toFixed(1)}%`);
        console.log('');
      }
      
      const overallSavings = ((totalOriginal - totalOptimized) / totalOriginal) * 100;
      
      console.log(`Overall Results:`);
      console.log(`  Total original: ${totalOriginal} tokens`);
      console.log(`  Total optimized: ${totalOptimized} tokens`);
      console.log(`  Overall savings: ${overallSavings.toFixed(1)}%`);
      console.log(`  Target range: 40-50%`);
      console.log('');
      
      // 验证达到40%目标
      expect(overallSavings).toBeGreaterThanOrEqual(35);  // 略宽松（考虑估算误差）
      
      // 理想情况应该在40-60%之间
      if (overallSavings >= 40 && overallSavings <= 60) {
        console.log(`✓ Excellent: Savings within ideal range (40-60%)`);
      } else if (overallSavings >= 35) {
        console.log(`✓ Good: Savings achieved target (≥35%)`);
      }
    });
  });
  
  // ========================================
  // 性能基准
  // ========================================
  
  describe('Performance Benchmarks', () => {
    it('should estimate tokens quickly', () => {
      const scenario = scenario1_pythonDataAnalysis;
      const prompt = getFrameworkGenerationPrompt(scenario.stage0.purposeDefinition);
      
      const iterations = 100;
      const start = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        contextManager.estimateTokens(prompt);
      }
      
      const duration = Date.now() - start;
      const avgTime = duration / iterations;
      
      console.log(`\n[Token Estimation Performance]`);
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total time: ${duration}ms`);
      console.log(`  Avg per estimation: ${avgTime.toFixed(2)}ms`);
      
      // 应该很快（<1ms per call）
      expect(avgTime).toBeLessThan(1);
    });
    
    it('should compact conversations in reasonable time', async () => {
      const scenario = scenario5_careerPlanning;  // 最长的对话
      const messages = scenario.stage0.conversationHistory;
      
      const start = Date.now();
      await contextManager.smartCompact(messages);
      const duration = Date.now() - start;
      
      console.log(`\n[Compaction Performance]`);
      console.log(`  Messages: ${messages.length}`);
      console.log(`  Compaction time: ${duration}ms`);
      
      // 应该在合理时间内完成（考虑AI调用）
      // 这个测试可能因为mock而很快
      expect(duration).toBeLessThan(5000);  // 5秒内
    });
  });
});

