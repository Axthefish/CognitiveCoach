/**
 * Token Budget Manager - Token预算管理系统
 * 
 * 基于Anthropic最佳实践：
 * - 事前规划而非事后统计
 * - 动态调整策略避免超限
 * - 为每个stage设置合理预算
 */

import { countTokensSync } from '@/lib/tokenizer';
import { logger } from '@/lib/logger';
import type { ChatMessage, PurposeDefinition } from '@/lib/types-v2';

// ============================================
// 类型定义
// ============================================

export type StageType = 'stage0' | 'stage1' | 'stage2';

export interface StageBudget {
  maxPerTurn: number;      // 单轮最大token数
  maxTotal: number;        // 该stage总计最大
  warningThreshold: number; // 警告阈值
}

export interface TokenEstimate {
  promptTokens: number;
  estimatedOutputTokens: number;
  total: number;
  breakdown: {
    systemPrompt: number;
    context: number;
    examples: number;
    userInput: number;
  };
}

export interface BudgetStatus {
  stage: StageType;
  used: number;
  remaining: number;
  maxTotal: number;
  utilizationRate: number; // 使用率 (0-1)
  isNearLimit: boolean;    // 是否接近上限
}

export type OptimizationAction = 
  | 'proceed'              // 继续，预算充足
  | 'compact_now'          // 立即压缩历史
  | 'reduce_examples'      // 减少示例数量
  | 'use_shorter_prompt';  // 使用简化版prompt

export interface OptimizationStrategy {
  action: OptimizationAction;
  reason: string;
  expectedSavings: number;  // 预期节省的token数
  priority: 'low' | 'medium' | 'high';
}

// ============================================
// Token Budget Manager 实现
// ============================================

export class TokenBudgetManager {
  private static instance: TokenBudgetManager;
  
  // 每个stage的预算配置
  private readonly STAGE_BUDGETS: Record<StageType, StageBudget> = {
    stage0: {
      maxPerTurn: 2000,
      maxTotal: 8000,
      warningThreshold: 6000,
    },
    stage1: {
      maxPerTurn: 4000,
      maxTotal: 6000,
      warningThreshold: 5000,
    },
    stage2: {
      maxPerTurn: 3000,
      maxTotal: 5000,
      warningThreshold: 4000,
    },
  };
  
  // 跟踪每个session的token使用情况
  // sessionId -> stage -> tokenCount
  private sessionUsage: Map<string, Record<StageType, number>>;
  
  private constructor() {
    this.sessionUsage = new Map();
  }
  
  static getInstance(): TokenBudgetManager {
    if (!TokenBudgetManager.instance) {
      TokenBudgetManager.instance = new TokenBudgetManager();
    }
    return TokenBudgetManager.instance;
  }
  
  // ========================================
  // 预算查询
  // ========================================
  
  /**
   * 获取某个stage的预算配置
   */
  getStageBudget(stage: StageType): StageBudget {
    return this.STAGE_BUDGETS[stage];
  }
  
  /**
   * 获取某个session在某个stage的剩余预算
   */
  getRemainingBudget(stage: StageType, sessionId?: string): BudgetStatus {
    const budget = this.STAGE_BUDGETS[stage];
    const used = this.getSessionUsage(sessionId || 'default', stage);
    const remaining = Math.max(0, budget.maxTotal - used);
    const utilizationRate = used / budget.maxTotal;
    const isNearLimit = used >= budget.warningThreshold;
    
    return {
      stage,
      used,
      remaining,
      maxTotal: budget.maxTotal,
      utilizationRate,
      isNearLimit,
    };
  }
  
  /**
   * 获取session的使用量
   */
  private getSessionUsage(sessionId: string, stage: StageType): number {
    const usage = this.sessionUsage.get(sessionId);
    if (!usage) return 0;
    return usage[stage] || 0;
  }
  
  // ========================================
  // Token估算
  // ========================================
  
  /**
   * 估算Stage 0的下一轮token消耗
   */
  estimateStage0NextTurn(
    conversationHistory: ChatMessage[],
    currentDefinition: Partial<PurposeDefinition>
  ): TokenEstimate {
    // 系统prompt（固定部分）
    const systemPromptTokens = 400; // Stage 0 prompt约400 tokens
    
    // 对话历史
    const historyText = conversationHistory
      .map(m => m.content)
      .join('\n');
    const contextTokens = countTokensSync(historyText);
    
    // 当前理解（较短）
    const currentUnderstandingText = [
      currentDefinition.rawInput || '',
      currentDefinition.problemDomain || '',
      currentDefinition.clarifiedPurpose || '',
    ].join(' ');
    const currentTokens = countTokensSync(currentUnderstandingText);
    
    // 无示例（Stage 0通常无示例）
    const examplesTokens = 0;
    
    const promptTokens = systemPromptTokens + contextTokens + currentTokens + examplesTokens;
    
    // 估算输出tokens（Stage 0通常输出JSON，较短）
    const estimatedOutputTokens = 200;
    
    return {
      promptTokens,
      estimatedOutputTokens,
      total: promptTokens + estimatedOutputTokens,
      breakdown: {
        systemPrompt: systemPromptTokens,
        context: contextTokens,
        examples: examplesTokens,
        userInput: currentTokens,
      },
    };
  }
  
  /**
   * 估算Stage 1的token消耗
   */
  estimateStage1NextTurn(
    purpose: PurposeDefinition,
    exampleCount: number = 2
  ): TokenEstimate {
    // 系统prompt（优化后约1500 tokens）
    const systemPromptTokens = 1500;
    
    // Purpose context
    const purposeText = [
      purpose.clarifiedPurpose,
      purpose.problemDomain,
      purpose.domainBoundary,
      ...purpose.keyConstraints,
    ].join(' ');
    const contextTokens = countTokensSync(purposeText);
    
    // 示例（每个约300-400 tokens）
    const examplesTokens = exampleCount * 350;
    
    const promptTokens = systemPromptTokens + contextTokens + examplesTokens;
    
    // 估算输出tokens（框架JSON较大）
    const estimatedOutputTokens = 1500;
    
    return {
      promptTokens,
      estimatedOutputTokens,
      total: promptTokens + estimatedOutputTokens,
      breakdown: {
        systemPrompt: systemPromptTokens,
        context: contextTokens,
        examples: examplesTokens,
        userInput: 0,
      },
    };
  }
  
  /**
   * 估算Stage 2的token消耗
   */
  estimateStage2NextTurn(
    frameworkNodeCount: number,
    exampleCount: number = 1
  ): TokenEstimate {
    // 系统prompt（约1000 tokens）
    const systemPromptTokens = 1000;
    
    // Framework context（取决于节点数）
    const contextTokens = frameworkNodeCount * 50; // 每个节点约50 tokens
    
    // 示例
    const examplesTokens = exampleCount * 250;
    
    const promptTokens = systemPromptTokens + contextTokens + examplesTokens;
    
    // 估算输出tokens
    const estimatedOutputTokens = 800;
    
    return {
      promptTokens,
      estimatedOutputTokens,
      total: promptTokens + estimatedOutputTokens,
      breakdown: {
        systemPrompt: systemPromptTokens,
        context: contextTokens,
        examples: examplesTokens,
        userInput: 0,
      },
    };
  }
  
  // ========================================
  // 优化建议
  // ========================================
  
  /**
   * 根据估算和预算提出优化建议
   */
  suggestOptimization(
    estimate: TokenEstimate,
    budget: BudgetStatus
  ): OptimizationStrategy {
    const wouldExceed = estimate.total > budget.remaining;
    const wouldExceedWarning = (budget.used + estimate.total) > this.STAGE_BUDGETS[budget.stage].warningThreshold;
    
    // 场景1: 会超出总预算
    if (wouldExceed) {
      // 检查是否主要是context太大
      if (estimate.breakdown.context > estimate.promptTokens * 0.5) {
        return {
          action: 'compact_now',
          reason: `对话历史占用${estimate.breakdown.context} tokens，压缩可节省40-60%`,
          expectedSavings: Math.floor(estimate.breakdown.context * 0.5),
          priority: 'high',
        };
      }
      
      // 检查是否示例太多
      if (estimate.breakdown.examples > 500) {
        return {
          action: 'reduce_examples',
          reason: `示例占用${estimate.breakdown.examples} tokens，减少示例可节省约${Math.floor(estimate.breakdown.examples * 0.5)} tokens`,
          expectedSavings: Math.floor(estimate.breakdown.examples * 0.5),
          priority: 'high',
        };
      }
      
      // 其他情况：使用更短的prompt
      return {
        action: 'use_shorter_prompt',
        reason: '预算即将超限，建议使用简化版prompt',
        expectedSavings: 300,
        priority: 'high',
      };
    }
    
    // 场景2: 接近警告阈值
    if (wouldExceedWarning) {
      if (estimate.breakdown.context > 1500) {
        return {
          action: 'compact_now',
          reason: '对话历史较长，建议提前压缩以避免后续超限',
          expectedSavings: Math.floor(estimate.breakdown.context * 0.5),
          priority: 'medium',
        };
      }
      
      if (estimate.breakdown.examples > 600) {
        return {
          action: 'reduce_examples',
          reason: '接近预算上限，建议减少示例数量',
          expectedSavings: Math.floor(estimate.breakdown.examples * 0.3),
          priority: 'medium',
        };
      }
    }
    
    // 场景3: 预算充足
    return {
      action: 'proceed',
      reason: `预算充足，剩余${budget.remaining} tokens`,
      expectedSavings: 0,
      priority: 'low',
    };
  }
  
  // ========================================
  // 使用跟踪
  // ========================================
  
  /**
   * 记录token使用
   */
  trackSessionUsage(
    sessionId: string,
    stage: StageType,
    tokens: number
  ): void {
    if (!this.sessionUsage.has(sessionId)) {
      this.sessionUsage.set(sessionId, {
        stage0: 0,
        stage1: 0,
        stage2: 0,
      });
    }
    
    const usage = this.sessionUsage.get(sessionId)!;
    usage[stage] += tokens;
    
    logger.debug('[TokenBudgetManager] Session usage updated', {
      sessionId,
      stage,
      tokensAdded: tokens,
      totalForStage: usage[stage],
    });
    
    // 检查是否超限
    const budget = this.STAGE_BUDGETS[stage];
    if (usage[stage] > budget.maxTotal) {
      logger.warn('[TokenBudgetManager] Session exceeded budget', {
        sessionId,
        stage,
        used: usage[stage],
        max: budget.maxTotal,
        overBy: usage[stage] - budget.maxTotal,
      });
    }
  }
  
  /**
   * 清除session的使用记录
   */
  clearSessionUsage(sessionId: string): void {
    this.sessionUsage.delete(sessionId);
    logger.debug('[TokenBudgetManager] Session usage cleared', { sessionId });
  }
  
  /**
   * 获取所有session的使用统计
   */
  getUsageStats(): {
    totalSessions: number;
    byStage: Record<StageType, { total: number; avg: number; max: number }>;
  } {
    const sessions = Array.from(this.sessionUsage.values());
    
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        byStage: {
          stage0: { total: 0, avg: 0, max: 0 },
          stage1: { total: 0, avg: 0, max: 0 },
          stage2: { total: 0, avg: 0, max: 0 },
        },
      };
    }
    
    const byStage: Record<StageType, { total: number; avg: number; max: number }> = {
      stage0: { total: 0, avg: 0, max: 0 },
      stage1: { total: 0, avg: 0, max: 0 },
      stage2: { total: 0, avg: 0, max: 0 },
    };
    
    (['stage0', 'stage1', 'stage2'] as StageType[]).forEach(stage => {
      const stageTotals = sessions.map(s => s[stage]);
      byStage[stage].total = stageTotals.reduce((sum, val) => sum + val, 0);
      byStage[stage].avg = byStage[stage].total / sessions.length;
      byStage[stage].max = Math.max(...stageTotals);
    });
    
    return {
      totalSessions: sessions.length,
      byStage,
    };
  }
  
  // ========================================
  // 便捷方法
  // ========================================
  
  /**
   * 检查是否应该触发压缩
   */
  shouldCompactNow(
    stage: StageType,
    sessionId: string,
    estimate: TokenEstimate
  ): boolean {
    const budget = this.getRemainingBudget(stage, sessionId);
    const strategy = this.suggestOptimization(estimate, budget);
    
    return strategy.action === 'compact_now' && strategy.priority === 'high';
  }
  
  /**
   * 计算推荐的示例数量
   */
  getRecommendedExampleCount(
    stage: StageType,
    sessionId: string,
    defaultCount: number
  ): number {
    const budget = this.getRemainingBudget(stage, sessionId);
    
    // 如果预算很充足，使用默认数量
    if (budget.utilizationRate < 0.5) {
      return defaultCount;
    }
    
    // 如果接近上限，减少示例
    if (budget.utilizationRate > 0.8) {
      return Math.max(1, Math.floor(defaultCount * 0.5));
    }
    
    // 中等情况，略微减少
    return Math.max(1, defaultCount - 1);
  }
}

// ============================================
// 导出单例
// ============================================

export const tokenBudgetManager = TokenBudgetManager.getInstance();

/**
 * 便捷函数：检查预算并获取优化建议
 */
export function checkBudgetAndOptimize(
  stage: StageType,
  sessionId: string,
  estimate: TokenEstimate
): {
  canProceed: boolean;
  strategy: OptimizationStrategy;
  budget: BudgetStatus;
} {
  const budget = tokenBudgetManager.getRemainingBudget(stage, sessionId);
  const strategy = tokenBudgetManager.suggestOptimization(estimate, budget);
  
  return {
    canProceed: strategy.action === 'proceed',
    strategy,
    budget,
  };
}

