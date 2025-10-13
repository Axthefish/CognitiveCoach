/**
 * Context Monitor - Token使用监控
 * 
 * 监控和记录每次生成的token使用情况
 * 帮助评估优化效果
 */

import { logger } from '@/lib/logger';
import { countTokensSync } from '@/lib/tokenizer';
import type { ChatMessage } from '@/lib/types-v2';

// ============================================
// 类型定义
// ============================================

export interface TokenUsageRecord {
  stage: 'stage0' | 'stage1' | 'stage2';
  runTier: 'Lite' | 'Pro' | 'Review';
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  wasCompacted: boolean;
  compressionRatio?: number;
  timestamp: number;
  sessionId?: string;
  // 🆕 Context质量指标
  contextQuality?: ContextQualityMetrics;
}

// 🆕 Context质量指标
export interface ContextQualityMetrics {
  tokenCount: number;
  informationDensity: number;  // 信息密度: 关键信息 / 总tokens
  repetitionRate: number;       // 重复率: 重复内容占比
  attentionScore: number;       // 注意力得分: 基于长度的衰减 (0-1)
}

export interface TokenUsageStats {
  totalRecords: number;
  totalPromptTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgPromptTokens: number;
  avgOutputTokens: number;
  byStage: Record<string, {
    count: number;
    avgPromptTokens: number;
    avgOutputTokens: number;
  }>;
  compactionStats: {
    compactedCount: number;
    avgCompressionRatio: number;
  };
}

// ============================================
// Context Monitor 实现
// ============================================

export class ContextMonitor {
  private static instance: ContextMonitor;
  private records: TokenUsageRecord[] = [];
  private maxRecords = 1000;  // 最多保留1000条记录
  
  private constructor() {
    // 尝试从localStorage加载
    this.loadFromStorage();
  }
  
  static getInstance(): ContextMonitor {
    if (!ContextMonitor.instance) {
      ContextMonitor.instance = new ContextMonitor();
    }
    return ContextMonitor.instance;
  }
  
  // ========================================
  // 记录功能
  // ========================================
  
  /**
   * 记录token使用情况
   */
  record(record: TokenUsageRecord): void {
    this.records.push(record);
    
    // 限制记录数量
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
    
    logger.info('[ContextMonitor] Token usage recorded', {
      stage: record.stage,
      promptTokens: record.promptTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      wasCompacted: record.wasCompacted,
      compressionRatio: record.compressionRatio
    });
    
    // 持久化
    this.persistToStorage();
  }
  
  /**
   * 记录prompt生成（便捷函数）
   */
  recordPrompt(
    _stage: 'stage0' | 'stage1' | 'stage2',
    promptText: string
  ): number {
    // 简单估算token数（实际应该使用tokenizer）
    const promptTokens = this.estimateTokens(promptText);
    
    return promptTokens;
  }
  
  /**
   * 记录完整的生成过程
   */
  recordGeneration(
    stage: 'stage0' | 'stage1' | 'stage2',
    promptText: string,
    outputText: string,
    options: {
      runTier?: 'Lite' | 'Pro' | 'Review';
      wasCompacted?: boolean;
      compressionRatio?: number;
      sessionId?: string;
    } = {}
  ): void {
    const promptTokens = this.estimateTokens(promptText);
    const outputTokens = this.estimateTokens(outputText);
    
    this.record({
      stage,
      runTier: options.runTier || 'Pro',
      promptTokens,
      outputTokens,
      totalTokens: promptTokens + outputTokens,
      wasCompacted: options.wasCompacted || false,
      compressionRatio: options.compressionRatio,
      timestamp: Date.now(),
      sessionId: options.sessionId
    });
  }
  
  // ========================================
  // 统计功能
  // ========================================
  
  /**
   * 获取统计信息
   */
  getStats(filters?: {
    stage?: 'stage0' | 'stage1' | 'stage2';
    sessionId?: string;
    since?: number;  // timestamp
  }): TokenUsageStats {
    let filtered = this.records;
    
    // 应用过滤器
    if (filters) {
      if (filters.stage) {
        filtered = filtered.filter(r => r.stage === filters.stage);
      }
      if (filters.sessionId) {
        filtered = filtered.filter(r => r.sessionId === filters.sessionId);
      }
      if (filters.since !== undefined) {
        filtered = filtered.filter(r => r.timestamp >= filters.since!);
      }
    }
    
    if (filtered.length === 0) {
      return {
        totalRecords: 0,
        totalPromptTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        avgPromptTokens: 0,
        avgOutputTokens: 0,
        byStage: {},
        compactionStats: {
          compactedCount: 0,
          avgCompressionRatio: 0
        }
      };
    }
    
    // 计算总计
    const totalPromptTokens = filtered.reduce((sum, r) => sum + r.promptTokens, 0);
    const totalOutputTokens = filtered.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalTokens = totalPromptTokens + totalOutputTokens;
    
    // 按stage统计
    const byStage: Record<string, { count: number; avgPromptTokens: number; avgOutputTokens: number }> = {};
    
    ['stage0', 'stage1', 'stage2'].forEach(stage => {
      const stageRecords = filtered.filter(r => r.stage === stage);
      if (stageRecords.length > 0) {
        byStage[stage] = {
          count: stageRecords.length,
          avgPromptTokens: stageRecords.reduce((sum, r) => sum + r.promptTokens, 0) / stageRecords.length,
          avgOutputTokens: stageRecords.reduce((sum, r) => sum + r.outputTokens, 0) / stageRecords.length
        };
      }
    });
    
    // 压缩统计
    const compactedRecords = filtered.filter(r => r.wasCompacted);
    const avgCompressionRatio = compactedRecords.length > 0
      ? compactedRecords.reduce((sum, r) => sum + (r.compressionRatio || 1), 0) / compactedRecords.length
      : 0;
    
    return {
      totalRecords: filtered.length,
      totalPromptTokens,
      totalOutputTokens,
      totalTokens,
      avgPromptTokens: totalPromptTokens / filtered.length,
      avgOutputTokens: totalOutputTokens / filtered.length,
      byStage,
      compactionStats: {
        compactedCount: compactedRecords.length,
        avgCompressionRatio
      }
    };
  }
  
  /**
   * 获取最近的记录
   */
  getRecentRecords(count: number = 10): TokenUsageRecord[] {
    return this.records.slice(-count);
  }
  
  /**
   * 清除所有记录
   */
  clear(): void {
    this.records = [];
    this.persistToStorage();
    logger.info('[ContextMonitor] All records cleared');
  }
  
  /**
   * 清除特定session的记录
   */
  clearSession(sessionId: string): void {
    const before = this.records.length;
    this.records = this.records.filter(r => r.sessionId !== sessionId);
    const after = this.records.length;
    
    this.persistToStorage();
    logger.info('[ContextMonitor] Session records cleared', {
      sessionId,
      deletedCount: before - after
    });
  }
  
  // ========================================
  // 辅助函数
  // ========================================
  
  /**
   * 估算token数量
   * 使用真实tokenizer
   */
  private estimateTokens(text: string): number {
    return countTokensSync(text);
  }
  
  // ========================================
  // 🆕 Context质量评估
  // ========================================
  
  /**
   * 评估Context质量
   * 基于Anthropic的context rot观察
   */
  assessContextQuality(messages: ChatMessage[]): ContextQualityMetrics {
    const allText = messages.map(m => m.content).join('\n');
    const tokenCount = this.estimateTokens(allText);
    
    // 计算信息密度
    const informationDensity = this.calculateInformationDensity(messages);
    
    // 计算重复率
    const repetitionRate = this.calculateRepetitionRate(messages);
    
    // 计算注意力得分
    const attentionScore = this.calculateAttentionScore(tokenCount);
    
    return {
      tokenCount,
      informationDensity,
      repetitionRate,
      attentionScore,
    };
  }
  
  /**
   * 计算信息密度
   * 识别关键信息（约束、决策、确认）并计算占比
   */
  private calculateInformationDensity(messages: ChatMessage[]): number {
    const keyInfoPatterns = [
      /必须|不能|只能|约束|限制|要求/,
      /确认|决定|选择|优先/,
      /\d+\s*(周|月|年|天|小时)/,  // 时间约束
      /\d+\s*(元|块|万)/,          // 资源约束
    ];
    
    let keyInfoChars = 0;
    let totalChars = 0;
    
    messages.forEach(msg => {
      totalChars += msg.content.length;
      
      // 检查是否包含关键信息
      if (keyInfoPatterns.some(pattern => pattern.test(msg.content))) {
        keyInfoChars += msg.content.length;
      }
    });
    
    if (totalChars === 0) return 0;
    return keyInfoChars / totalChars;
  }
  
  /**
   * 计算重复率
   * 使用简单的n-gram重复检测
   */
  private calculateRepetitionRate(messages: ChatMessage[]): number {
    if (messages.length === 0) return 0;
    
    // 提取所有3-gram
    const ngrams: string[] = [];
    
    messages.forEach(msg => {
      const words = msg.content.split(/\s+/);
      for (let i = 0; i < words.length - 2; i++) {
        const ngram = words.slice(i, i + 3).join(' ');
        if (ngram.length > 5) { // 过滤太短的ngram
          ngrams.push(ngram.toLowerCase());
        }
      }
    });
    
    if (ngrams.length === 0) return 0;
    
    const uniqueNgrams = new Set(ngrams);
    
    // 重复率 = 1 - (唯一ngrams / 总ngrams)
    return 1 - (uniqueNgrams.size / ngrams.length);
  }
  
  /**
   * 计算注意力得分
   * 基于Anthropic的观察：注意力随token数增长而衰减
   * 
   * 经验公式:
   * - 0-2000 tokens: 1.0 (excellent)
   * - 2000-4000: 0.9-0.7 (good)
   * - 4000-8000: 0.7-0.5 (degrading)
   * - >8000: <0.5 (poor)
   */
  private calculateAttentionScore(tokenCount: number): number {
    if (tokenCount < 2000) {
      return 1.0;
    }
    
    if (tokenCount < 4000) {
      // 线性衰减从0.9到0.7
      return 0.9 - (tokenCount - 2000) / 10000;
    }
    
    if (tokenCount < 8000) {
      // 线性衰减从0.7到0.5
      return 0.7 - (tokenCount - 4000) / 20000;
    }
    
    // 超过8000，继续缓慢衰减，最低0.3
    return Math.max(0.3, 0.5 - (tokenCount - 8000) / 40000);
  }
  
  /**
   * 持久化到localStorage
   */
  private persistToStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      // 只保存最近的记录以避免超出localStorage限制
      const toStore = this.records.slice(-500);
      localStorage.setItem('cognitivecoach_context_monitor', JSON.stringify(toStore));
    } catch (error) {
      logger.warn('[ContextMonitor] Failed to persist', { error });
    }
  }
  
  /**
   * 从localStorage加载
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      const stored = localStorage.getItem('cognitivecoach_context_monitor');
      if (stored) {
        this.records = JSON.parse(stored);
        logger.info('[ContextMonitor] Loaded from storage', {
          recordsCount: this.records.length
        });
      }
    } catch (error) {
      logger.warn('[ContextMonitor] Failed to load from storage', { error });
    }
  }
  
  /**
   * 导出统计报告
   */
  exportReport(): string {
    const stats = this.getStats();
    
    // 🆕 计算质量指标统计
    const recordsWithQuality = this.records.filter(r => r.contextQuality);
    let qualityStats = '';
    
    if (recordsWithQuality.length > 0) {
      const avgAttentionScore = recordsWithQuality.reduce((sum, r) => 
        sum + (r.contextQuality?.attentionScore || 0), 0) / recordsWithQuality.length;
      const avgInformationDensity = recordsWithQuality.reduce((sum, r) => 
        sum + (r.contextQuality?.informationDensity || 0), 0) / recordsWithQuality.length;
      const avgRepetitionRate = recordsWithQuality.reduce((sum, r) => 
        sum + (r.contextQuality?.repetitionRate || 0), 0) / recordsWithQuality.length;
      
      qualityStats = `
## Context Quality Metrics
- Records with Quality Data: ${recordsWithQuality.length}
- Avg Attention Score: ${avgAttentionScore.toFixed(3)} (1.0 = excellent, <0.6 = degrading)
- Avg Information Density: ${avgInformationDensity.toFixed(3)} (higher = more key info)
- Avg Repetition Rate: ${avgRepetitionRate.toFixed(3)} (lower = less redundancy)
`;
    }
    
    const report = `
# Context Usage Report

**Generated**: ${new Date().toISOString()}

## Overall Statistics
- Total Records: ${stats.totalRecords}
- Total Tokens: ${stats.totalTokens.toLocaleString()}
  - Prompt Tokens: ${stats.totalPromptTokens.toLocaleString()}
  - Output Tokens: ${stats.totalOutputTokens.toLocaleString()}
- Average per Generation:
  - Prompt: ${Math.round(stats.avgPromptTokens)} tokens
  - Output: ${Math.round(stats.avgOutputTokens)} tokens

## By Stage
${Object.entries(stats.byStage).map(([stage, data]) => `
### ${stage}
- Count: ${data.count}
- Avg Prompt: ${Math.round(data.avgPromptTokens)} tokens
- Avg Output: ${Math.round(data.avgOutputTokens)} tokens
`).join('\n')}

## Compaction Statistics
- Compacted Generations: ${stats.compactionStats.compactedCount}
- Avg Compression Ratio: ${(stats.compactionStats.avgCompressionRatio * 100).toFixed(1)}%
${qualityStats}
---
`;
    
    return report;
  }
}

// ============================================
// 导出单例
// ============================================

export const contextMonitor = ContextMonitor.getInstance();

/**
 * 便捷函数：记录带压缩信息的生成
 */
export function recordWithCompaction(
  stage: 'stage0' | 'stage1' | 'stage2',
  promptText: string,
  outputText: string,
  compactionInfo?: {
    wasCompacted: boolean;
    compressionRatio?: number;
  },
  sessionId?: string
): void {
  contextMonitor.recordGeneration(
    stage,
    promptText,
    outputText,
    {
      wasCompacted: compactionInfo?.wasCompacted || false,
      compressionRatio: compactionInfo?.compressionRatio,
      sessionId
    }
  );
}

