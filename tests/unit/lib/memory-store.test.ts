/**
 * Memory Store 单元测试
 * 
 * 测试跨Stage记忆系统的CRUD操作、查询性能和存储限制
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  MemoryStore,
  memoryStore,
  createStage0Memory,
  createStage1Memory,
  createStage2Memory,
} from '@/lib/memory-store';
import type { StageMemory, PurposeDefinition, UniversalFramework } from '@/lib/types-v2';

// Mock localStorage for Node environment
class LocalStorageMock {
  private store: Record<string, string> = {};
  
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  
  removeItem(key: string): void {
    delete this.store[key];
  }
  
  clear(): void {
    this.store = {};
  }
}

// @ts-ignore
global.localStorage = new LocalStorageMock();

describe('MemoryStore', () => {
  
  const testSessionId = 'test-session-123';
  const testSessionId2 = 'test-session-456';
  
  beforeEach(async () => {
    // 清空localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    // 清理memoryStore
    await memoryStore.clearSession(testSessionId);
    await memoryStore.clearSession(testSessionId2);
  });
  
  afterEach(async () => {
    // 测试后清理
    await memoryStore.clearSession(testSessionId);
    await memoryStore.clearSession(testSessionId2);
  });
  
  // ========================================
  // 基础CRUD操作测试
  // ========================================
  
  describe('Basic CRUD Operations', () => {
    it('should save and retrieve memory', async () => {
      const memory: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: ['用户想学Python', '零基础'],
        decisions: [],
        constraints: ['每天1小时', '3个月'],
        timestamp: Date.now(),
      };
      
      await memoryStore.saveMemory(memory);
      
      const retrieved = await memoryStore.getStageMemory(testSessionId, 'stage0');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.sessionId).toBe(testSessionId);
      expect(retrieved?.stage).toBe('stage0');
      expect(retrieved?.keyInsights).toEqual(memory.keyInsights);
      expect(retrieved?.constraints).toEqual(memory.constraints);
    });
    
    it('should update existing memory', async () => {
      const memory1: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage1',
        keyInsights: ['初始洞察'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      };
      
      await memoryStore.saveMemory(memory1);
      
      const memory2: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage1',
        keyInsights: ['更新后的洞察', '新增洞察'],
        decisions: [{ what: '决策1', why: '原因1', timestamp: Date.now() }],
        constraints: ['约束1'],
        timestamp: Date.now(),
      };
      
      await memoryStore.saveMemory(memory2);
      
      const retrieved = await memoryStore.getStageMemory(testSessionId, 'stage1');
      
      expect(retrieved?.keyInsights).toEqual(memory2.keyInsights);
      expect(retrieved?.decisions.length).toBe(1);
      expect(retrieved?.constraints).toEqual(memory2.constraints);
    });
    
    it('should query memories by sessionId', async () => {
      const memory0: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: ['洞察0'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      };
      
      const memory1: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage1',
        keyInsights: ['洞察1'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      };
      
      await memoryStore.saveMemory(memory0);
      await memoryStore.saveMemory(memory1);
      
      const memories = await memoryStore.queryMemory({ sessionId: testSessionId });
      
      expect(memories.length).toBe(2);
      expect(memories.map(m => m.stage)).toContain('stage0');
      expect(memories.map(m => m.stage)).toContain('stage1');
    });
    
    it('should delete session memories', async () => {
      const memory: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: ['测试'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      };
      
      await memoryStore.saveMemory(memory);
      
      const before = await memoryStore.queryMemory({ sessionId: testSessionId });
      expect(before.length).toBeGreaterThan(0);
      
      await memoryStore.clearSession(testSessionId);
      
      const after = await memoryStore.queryMemory({ sessionId: testSessionId });
      expect(after.length).toBe(0);
    });
  });
  
  // ========================================
  // 查询功能测试
  // ========================================
  
  describe('Query Functionality', () => {
    beforeEach(async () => {
      // 准备测试数据
      const memories: StageMemory[] = [
        {
          sessionId: testSessionId,
          stage: 'stage0',
          keyInsights: ['Python学习', '数据分析'],
          decisions: [],
          constraints: ['零基础', '3个月'],
          timestamp: Date.now() - 3000,
        },
        {
          sessionId: testSessionId,
          stage: 'stage1',
          keyInsights: ['生成框架', '8个节点'],
          decisions: [{ what: '权重计算', why: '基于目的', timestamp: Date.now() }],
          constraints: [],
          timestamp: Date.now() - 2000,
        },
        {
          sessionId: testSessionId,
          stage: 'stage2',
          keyInsights: ['个性化调整'],
          decisions: [],
          constraints: [],
          timestamp: Date.now() - 1000,
        },
        {
          sessionId: testSessionId2,
          stage: 'stage0',
          keyInsights: ['职业转型'],
          decisions: [],
          constraints: [],
          timestamp: Date.now(),
        },
      ];
      
      for (const memory of memories) {
        await memoryStore.saveMemory(memory);
      }
    });
    
    it('should filter by stage', async () => {
      const stage0Memories = await memoryStore.queryMemory({
        sessionId: testSessionId,
        stage: 'stage0',
      });
      
      expect(stage0Memories.length).toBe(1);
      expect(stage0Memories[0].stage).toBe('stage0');
    });
    
    it('should filter by keywords', async () => {
      const pythonMemories = await memoryStore.queryMemory({
        sessionId: testSessionId,
        keywords: ['Python', '数据'],
      });
      
      expect(pythonMemories.length).toBeGreaterThan(0);
      const hasKeyword = pythonMemories.some(m =>
        m.keyInsights.some(insight => insight.includes('Python') || insight.includes('数据'))
      );
      expect(hasKeyword).toBe(true);
    });
    
    it('should respect limit parameter', async () => {
      const limited = await memoryStore.queryMemory({
        sessionId: testSessionId,
        limit: 2,
      });
      
      expect(limited.length).toBeLessThanOrEqual(2);
    });
    
    it('should return empty array for non-existent session', async () => {
      const memories = await memoryStore.queryMemory({
        sessionId: 'non-existent-session-xyz',
      });
      
      expect(memories.length).toBe(0);
    });
    
    it('should get specific stage memory', async () => {
      const stage1 = await memoryStore.getStageMemory(testSessionId, 'stage1');
      
      expect(stage1).not.toBeNull();
      expect(stage1?.stage).toBe('stage1');
      expect(stage1?.keyInsights).toContain('生成框架');
    });
    
    it('should return null for non-existent stage', async () => {
      await memoryStore.clearSession(testSessionId);
      
      const missing = await memoryStore.getStageMemory(testSessionId, 'stage1');
      expect(missing).toBeNull();
    });
  });
  
  // ========================================
  // 摘要生成测试
  // ========================================
  
  describe('Context Summary', () => {
    it('should generate compact summary', async () => {
      // 保存多个stage的记忆
      await memoryStore.saveMemory({
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: ['学习Python数据分析', '目标是业务分析'],
        decisions: [],
        constraints: ['零基础', '3个月'],
        timestamp: Date.now(),
      });
      
      await memoryStore.saveMemory({
        sessionId: testSessionId,
        stage: 'stage1',
        keyInsights: ['框架包含8个节点', '核心是Pandas'],
        decisions: [{ what: '权重分配', why: '基于实用性', timestamp: Date.now() }],
        constraints: [],
        timestamp: Date.now(),
      });
      
      const summary = await memoryStore.getContextSummary(testSessionId);
      
      expect(summary.sessionId).toBe(testSessionId);
      expect(summary.totalInsights).toBeGreaterThan(0);
      expect(summary.totalDecisions).toBeGreaterThan(0);
      expect(summary.stages.length).toBe(2);
      expect(summary.stages).toContain('stage0');
      expect(summary.stages).toContain('stage1');
      expect(summary.summary).toBeTruthy();
      expect(summary.summary.length).toBeLessThan(500);  // 应该是简洁的摘要
    });
    
    it('should handle empty session', async () => {
      await memoryStore.clearSession(testSessionId);
      
      const summary = await memoryStore.getContextSummary(testSessionId);
      
      expect(summary.totalInsights).toBe(0);
      expect(summary.totalDecisions).toBe(0);
      expect(summary.stages.length).toBe(0);
      expect(summary.summary).toBe('无记忆数据');
    });
    
    it('should include key information in summary', async () => {
      await memoryStore.saveMemory({
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: ['Python数据分析'],
        decisions: [],
        constraints: ['零基础'],
        timestamp: Date.now(),
      });
      
      const summary = await memoryStore.getContextSummary(testSessionId);
      
      // 摘要应该包含关键信息
      expect(summary.summary).toContain('Python');
    });
  });
  
  // ========================================
  // 过期清理测试
  // ========================================
  
  describe('Expiration Cleanup', () => {
    it('should clean expired memories', async () => {
      const expiredMemory: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: ['过期记忆'],
        decisions: [],
        constraints: [],
        timestamp: Date.now() - 10000,
        expiresAt: Date.now() - 1000,  // 已过期
      };
      
      const validMemory: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage1',
        keyInsights: ['有效记忆'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
        expiresAt: Date.now() + 10000,  // 未过期
      };
      
      await memoryStore.saveMemory(expiredMemory);
      await memoryStore.saveMemory(validMemory);
      
      const cleanedCount = await memoryStore.cleanupExpired();
      
      expect(cleanedCount).toBeGreaterThan(0);
      
      const remaining = await memoryStore.queryMemory({ sessionId: testSessionId });
      expect(remaining.length).toBe(1);
      expect(remaining[0].stage).toBe('stage1');
    });
    
    it('should keep memories without expiresAt', async () => {
      const memory: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: ['永久记忆'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
        // 没有expiresAt，不会过期
      };
      
      await memoryStore.saveMemory(memory);
      
      const cleanedCount = await memoryStore.cleanupExpired();
      
      // 不应该清理没有过期时间的记忆
      const remaining = await memoryStore.queryMemory({ sessionId: testSessionId });
      expect(remaining.length).toBe(1);
    });
  });
  
  // ========================================
  // 便捷函数测试
  // ========================================
  
  describe('Helper Functions', () => {
    it('should create Stage 0 memory from PurposeDefinition', () => {
      const purpose: PurposeDefinition = {
        rawInput: '学Python',
        clarifiedPurpose: '学习Python数据分析',
        problemDomain: 'Python编程',
        domainBoundary: '数据分析方向',
        keyConstraints: ['零基础', '3个月'],
        confidence: 0.95,
        clarificationState: 'CONFIRMED',
        conversationHistory: [],
      };
      
      const memory = createStage0Memory(testSessionId, purpose);
      
      expect(memory.sessionId).toBe(testSessionId);
      expect(memory.stage).toBe('stage0');
      expect(memory.keyInsights.length).toBeGreaterThan(0);
      expect(memory.constraints).toEqual(purpose.keyConstraints);
    });
    
    it('should create Stage 1 memory from framework', () => {
      const framework: UniversalFramework = {
        purpose: '学习Python数据分析',
        domain: 'Python编程',
        nodes: [
          {
            id: 'node-1',
            title: 'Python基础',
            description: '基础语法',
            necessity: 1.0,
            impact: 0.8,
            timeROI: 0.9,
            weight: 92,
            reasoning: '必须掌握',
            estimatedTimeHours: 40,
            prerequisites: [],
            category: 'foundation',
          },
          {
            id: 'node-2',
            title: 'Pandas',
            description: '数据处理',
            necessity: 0.95,
            impact: 1.0,
            timeROI: 0.9,
            weight: 95,
            reasoning: '核心技能',
            estimatedTimeHours: 60,
            prerequisites: ['node-1'],
            category: 'core',
          },
        ],
        edges: [],
        weightingLogic: '基于实用性',
        mainPath: ['node-1', 'node-2'],
        generatedAt: Date.now(),
      };
      
      const memory = createStage1Memory(testSessionId, framework);
      
      expect(memory.sessionId).toBe(testSessionId);
      expect(memory.stage).toBe('stage1');
      expect(memory.keyInsights.length).toBeGreaterThan(0);
      expect(memory.decisions.length).toBeGreaterThan(0);
    });
    
    it('should create Stage 2 memory from plan', () => {
      const plan = {
        personalizedTips: ['建议1', '建议2'],
        adjustmentRationale: '基于用户反馈调整',
      };
      
      const memory = createStage2Memory(testSessionId, plan);
      
      expect(memory.sessionId).toBe(testSessionId);
      expect(memory.stage).toBe('stage2');
      expect(memory.keyInsights).toEqual(plan.personalizedTips);
      expect(memory.decisions[0].why).toBe(plan.adjustmentRationale);
    });
  });
  
  // ========================================
  // 统计功能测试
  // ========================================
  
  describe('Statistics', () => {
    beforeEach(async () => {
      // 准备测试数据
      await memoryStore.saveMemory({
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: ['test'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      });
      
      await memoryStore.saveMemory({
        sessionId: testSessionId,
        stage: 'stage1',
        keyInsights: ['test'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      });
      
      await memoryStore.saveMemory({
        sessionId: testSessionId2,
        stage: 'stage0',
        keyInsights: ['test'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      });
    });
    
    it('should return correct stats', () => {
      const stats = memoryStore.getStats();
      
      expect(stats.totalSessions).toBeGreaterThan(0);
      expect(stats.totalMemories).toBeGreaterThan(0);
      expect(stats.byStage).toBeDefined();
      expect(stats.byStage.stage0).toBeGreaterThan(0);
    });
    
    it('should count by stage correctly', () => {
      const stats = memoryStore.getStats();
      
      const totalByStage = Object.values(stats.byStage).reduce(
        (sum, count) => sum + count,
        0
      );
      
      expect(totalByStage).toBe(stats.totalMemories);
    });
  });
  
  // ========================================
  // 性能测试
  // ========================================
  
  describe('Performance', () => {
    it('should handle large number of memories', async () => {
      const memories: StageMemory[] = [];
      
      // 创建100条记忆
      for (let i = 0; i < 100; i++) {
        memories.push({
          sessionId: `session-${i}`,
          stage: ['stage0', 'stage1', 'stage2'][i % 3] as 'stage0' | 'stage1' | 'stage2',
          keyInsights: [`Insight ${i}`],
          decisions: [],
          constraints: [],
          timestamp: Date.now(),
        });
      }
      
      // 保存所有记忆
      const saveStart = Date.now();
      for (const memory of memories) {
        await memoryStore.saveMemory(memory);
      }
      const saveDuration = Date.now() - saveStart;
      
      // 保存应该很快（<1秒）
      expect(saveDuration).toBeLessThan(1000);
      
      // 查询应该很快
      const queryStart = Date.now();
      await memoryStore.queryMemory({ sessionId: 'session-50' });
      const queryDuration = Date.now() - queryStart;
      
      expect(queryDuration).toBeLessThan(50);  // <50ms
    });
  });
  
  // ========================================
  // 边缘情况测试
  // ========================================
  
  describe('Edge Cases', () => {
    it('should handle empty insights and decisions', async () => {
      const memory: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: [],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      };
      
      await memoryStore.saveMemory(memory);
      const retrieved = await memoryStore.getStageMemory(testSessionId, 'stage0');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.keyInsights).toEqual([]);
      expect(retrieved?.decisions).toEqual([]);
    });
    
    it('should handle very long insights', async () => {
      const longInsight = 'A'.repeat(1000);
      
      const memory: StageMemory = {
        sessionId: testSessionId,
        stage: 'stage0',
        keyInsights: [longInsight],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      };
      
      await memoryStore.saveMemory(memory);
      const retrieved = await memoryStore.getStageMemory(testSessionId, 'stage0');
      
      expect(retrieved?.keyInsights[0]).toBe(longInsight);
    });
    
    it('should handle special characters in sessionId', async () => {
      const specialSessionId = 'session-!@#$%^&*()_+-={}[]|:;<>?,./';
      
      const memory: StageMemory = {
        sessionId: specialSessionId,
        stage: 'stage0',
        keyInsights: ['test'],
        decisions: [],
        constraints: [],
        timestamp: Date.now(),
      };
      
      await memoryStore.saveMemory(memory);
      const retrieved = await memoryStore.getStageMemory(specialSessionId, 'stage0');
      
      expect(retrieved).not.toBeNull();
      
      // 清理
      await memoryStore.clearSession(specialSessionId);
    });
  });
});

