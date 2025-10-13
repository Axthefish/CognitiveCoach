/**
 * Memory Store - 跨Stage记忆系统
 * 
 * 基于Anthropic最佳实践的structured note-taking
 * 持久化关键信息，支持跨stage查询和摘要生成
 */

import type {
  StageMemory,
  MemoryQuery,
  MemorySummary,
  PurposeDefinition,
  UniversalFramework,
  PersonalizedPlan
} from '@/lib/types-v2';
import { logger } from '@/lib/logger';

// ============================================
// Memory Store 实现
// ============================================

export class MemoryStore {
  private static instance: MemoryStore;
  private memoryMap: Map<string, StageMemory[]>;  // sessionId -> memories
  
  private constructor() {
    this.memoryMap = new Map();
    // 尝试从 localStorage 加载（如果在浏览器环境）
    this.loadFromStorage();
  }
  
  static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }
  
  // ========================================
  // 核心功能
  // ========================================
  
  /**
   * 保存Stage记忆
   */
  async saveMemory(memory: StageMemory): Promise<void> {
    const { sessionId, stage } = memory;
    
    logger.info('[MemoryStore] Saving memory', {
      sessionId,
      stage,
      insightsCount: memory.keyInsights.length,
      decisionsCount: memory.decisions.length
    });
    
    // 获取或创建session的记忆列表
    const sessionMemories = this.memoryMap.get(sessionId) || [];
    
    // 检查是否已存在该stage的记忆
    const existingIndex = sessionMemories.findIndex(m => m.stage === stage);
    
    if (existingIndex >= 0) {
      // 更新现有记忆
      sessionMemories[existingIndex] = memory;
    } else {
      // 添加新记忆
      sessionMemories.push(memory);
    }
    
    this.memoryMap.set(sessionId, sessionMemories);
    
    // 持久化到存储
    await this.persistToStorage();
  }
  
  /**
   * 查询记忆
   */
  async queryMemory(query: MemoryQuery): Promise<StageMemory[]> {
    const { sessionId, stage, keywords, limit } = query;
    
    const sessionMemories = this.memoryMap.get(sessionId) || [];
    
    // 过滤
    let filtered = sessionMemories;
    
    if (stage) {
      filtered = filtered.filter(m => m.stage === stage);
    }
    
    if (keywords && keywords.length > 0) {
      filtered = filtered.filter(memory => {
        const allText = [
          ...memory.keyInsights,
          ...memory.decisions.map(d => `${d.what} ${d.why}`),
          ...memory.constraints
        ].join(' ').toLowerCase();
        
        return keywords.some(keyword => allText.includes(keyword.toLowerCase()));
      });
    }
    
    // 限制数量
    if (limit && limit > 0) {
      filtered = filtered.slice(0, limit);
    }
    
    logger.debug('[MemoryStore] Query result', {
      sessionId,
      queryStage: stage,
      foundCount: filtered.length
    });
    
    return filtered;
  }
  
  /**
   * 获取Session的记忆摘要（<100 tokens）
   */
  async getContextSummary(sessionId: string): Promise<MemorySummary> {
    const memories = this.memoryMap.get(sessionId) || [];
    
    if (memories.length === 0) {
      return {
        sessionId,
        totalInsights: 0,
        totalDecisions: 0,
        stages: [],
        summary: '无记忆数据'
      };
    }
    
    // 聚合信息
    const allInsights = memories.flatMap(m => m.keyInsights);
    const allDecisions = memories.flatMap(m => m.decisions);
    const stages = memories.map(m => m.stage);
    
    // 生成简洁摘要
    const summary = this.generateCompactSummary(memories);
    
    return {
      sessionId,
      totalInsights: allInsights.length,
      totalDecisions: allDecisions.length,
      stages,
      summary
    };
  }
  
  /**
   * 获取特定Stage的记忆
   */
  async getStageMemory(
    sessionId: string,
    stage: 'stage0' | 'stage1' | 'stage2'
  ): Promise<StageMemory | null> {
    const sessionMemories = this.memoryMap.get(sessionId) || [];
    return sessionMemories.find(m => m.stage === stage) || null;
  }
  
  /**
   * 删除Session的所有记忆
   */
  async clearSession(sessionId: string): Promise<void> {
    this.memoryMap.delete(sessionId);
    await this.persistToStorage();
    
    logger.info('[MemoryStore] Session cleared', { sessionId });
  }
  
  /**
   * 清理过期记忆
   */
  async cleanupExpired(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();
    
    for (const [sessionId, memories] of this.memoryMap.entries()) {
      const validMemories = memories.filter(m => {
        if (!m.expiresAt) return true;
        if (m.expiresAt > now) return true;
        cleanedCount++;
        return false;
      });
      
      if (validMemories.length === 0) {
        this.memoryMap.delete(sessionId);
      } else if (validMemories.length !== memories.length) {
        this.memoryMap.set(sessionId, validMemories);
      }
    }
    
    if (cleanedCount > 0) {
      await this.persistToStorage();
      logger.info('[MemoryStore] Cleaned expired memories', { count: cleanedCount });
    }
    
    return cleanedCount;
  }
  
  // ========================================
  // 辅助函数
  // ========================================
  
  /**
   * 生成紧凑的摘要（目标<100 tokens）
   */
  private generateCompactSummary(memories: StageMemory[]): string {
    const parts: string[] = [];
    
    // Stage 0 记忆
    const stage0 = memories.find(m => m.stage === 'stage0');
    if (stage0) {
      const topInsights = stage0.keyInsights.slice(0, 2);
      if (topInsights.length > 0) {
        parts.push(`目的: ${topInsights.join('；')}`);
      }
      if (stage0.constraints.length > 0) {
        parts.push(`约束: ${stage0.constraints.slice(0, 2).join('，')}`);
      }
    }
    
    // Stage 1 记忆
    const stage1 = memories.find(m => m.stage === 'stage1');
    if (stage1) {
      const topDecisions = stage1.decisions.slice(0, 2);
      if (topDecisions.length > 0) {
        parts.push(`框架: ${topDecisions.map(d => d.what).join('；')}`);
      }
    }
    
    // Stage 2 记忆
    const stage2 = memories.find(m => m.stage === 'stage2');
    if (stage2) {
      if (stage2.keyInsights.length > 0) {
        parts.push(`个性化: ${stage2.keyInsights[0]}`);
      }
    }
    
    return parts.join(' | ') || '空摘要';
  }
  
  /**
   * 持久化到存储（localStorage）
   */
  private async persistToStorage(): Promise<void> {
    if (typeof window === 'undefined') {
      // 服务器端，不持久化
      return;
    }
    
    try {
      const serialized = JSON.stringify(
        Array.from(this.memoryMap.entries())
      );
      localStorage.setItem('cognitivecoach_memory', serialized);
    } catch (error) {
      logger.warn('[MemoryStore] Failed to persist to storage', { error });
    }
  }
  
  /**
   * 从存储加载
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      const stored = localStorage.getItem('cognitivecoach_memory');
      if (stored) {
        const entries = JSON.parse(stored) as Array<[string, StageMemory[]]>;
        this.memoryMap = new Map(entries);
        logger.info('[MemoryStore] Loaded from storage', {
          sessionsCount: this.memoryMap.size
        });
      }
    } catch (error) {
      logger.warn('[MemoryStore] Failed to load from storage', { error });
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalSessions: number;
    totalMemories: number;
    byStage: Record<string, number>;
  } {
    let totalMemories = 0;
    const byStage: Record<string, number> = {
      stage0: 0,
      stage1: 0,
      stage2: 0
    };
    
    for (const memories of this.memoryMap.values()) {
      totalMemories += memories.length;
      memories.forEach(m => {
        byStage[m.stage]++;
      });
    }
    
    return {
      totalSessions: this.memoryMap.size,
      totalMemories,
      byStage
    };
  }
}

// ============================================
// 导出单例和辅助函数
// ============================================

export const memoryStore = MemoryStore.getInstance();

/**
 * 便捷函数：从PurposeDefinition创建Stage 0记忆
 */
export function createStage0Memory(
  sessionId: string,
  purposeDefinition: PurposeDefinition
): StageMemory {
  return {
    sessionId,
    stage: 'stage0',
    keyInsights: [
      purposeDefinition.clarifiedPurpose,
      `问题域: ${purposeDefinition.problemDomain}`,
      purposeDefinition.domainBoundary
    ].filter(Boolean),
    decisions: [],
    constraints: purposeDefinition.keyConstraints || [],
    compactedHistory: purposeDefinition.conversationHistory
      ? `对话历史包含${purposeDefinition.conversationHistory.length}轮`
      : undefined,
    timestamp: Date.now()
  };
}

/**
 * 便捷函数：从UniversalFramework创建Stage 1记忆
 */
export function createStage1Memory(
  sessionId: string,
  framework: UniversalFramework
): StageMemory {
  const coreNodes = framework.nodes
    .filter((n) => n.weight >= 90)
    .map((n) => n.title);
  
  return {
    sessionId,
    stage: 'stage1',
    keyInsights: [
      `生成了${framework.nodes.length}个节点的框架`,
      `核心节点: ${coreNodes.join('、')}`
    ],
    decisions: [
      {
        what: framework.weightingLogic || '框架权重分配',
        why: `基于目的: ${framework.purpose}`,
        timestamp: Date.now()
      }
    ],
    constraints: [],
    timestamp: Date.now()
  };
}

/**
 * 便捷函数：从PersonalizedPlan创建Stage 2记忆
 */
export function createStage2Memory(
  sessionId: string,
  plan: PersonalizedPlan
): StageMemory {
  return {
    sessionId,
    stage: 'stage2',
    keyInsights: plan.personalizedTips || [],
    decisions: [
      {
        what: '生成个性化方案',
        why: plan.adjustmentRationale || '基于用户反馈',
        timestamp: Date.now()
      }
    ],
    constraints: [],
    timestamp: Date.now()
  };
}

