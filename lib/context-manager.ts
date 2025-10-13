/**
 * Context Manager - 对话历史压缩与Token管理
 * 
 * 基于Anthropic最佳实践：
 * - Context是稀缺资源，需要精心管理
 * - Compaction: 压缩早期对话，保留最近轮次
 * - Token estimation: 估算上下文大小
 */

import { ChatMessage } from '@/lib/types-v2';
import { generateText } from '@/lib/gemini-config';
import { logger } from '@/lib/logger';
import { countTokensSync, estimateTokensHeuristic } from '@/lib/tokenizer';

export interface CompactionResult {
  compactedMessages: ChatMessage[];
  summary: string;
  originalTokens: number;
  compactedTokens: number;
  compressionRatio: number;
  wasCompacted: boolean;
}

export interface CompactionOptions {
  maxTokens?: number;           // 最大token数，超过则触发压缩
  recentTurnsToKeep?: number;   // 保留最近N轮完整对话
  summaryMaxTokens?: number;    // 摘要最大tokens
}

export class ContextManager {
  private static instance: ContextManager;
  
  // 默认配置
  private readonly DEFAULT_MAX_TOKENS = 3000;
  private readonly DEFAULT_RECENT_TURNS = 3;  // 保留最近3轮（6条消息）
  private readonly DEFAULT_SUMMARY_MAX_TOKENS = 500;
  
  private constructor() {}
  
  static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }
  
  /**
   * 估算文本的token数量
   * 优先使用真实tokenizer，fallback到启发式方法
   */
  estimateTokens(text: string): number {
    // 使用真实tokenizer的同步版本（基于启发式）
    // 异步版本在需要高精度时使用
    return countTokensSync(text);
  }
  
  /**
   * 异步精确计数tokens（使用真实tokenizer）
   * 用于需要高精度的场景
   */
  async estimateTokensAccurate(text: string): Promise<number> {
    try {
      const { countTokensCached } = await import('@/lib/tokenizer');
      return await countTokensCached(text);
    } catch (error) {
      logger.warn('[ContextManager] Accurate token count failed, using heuristic', { error });
      return estimateTokensHeuristic(text);
    }
  }
  
  /**
   * 估算消息列表的总token数
   */
  estimateMessagesTokens(messages: ChatMessage[]): number {
    const totalText = messages.map(m => m.content).join('\n');
    return this.estimateTokens(totalText);
  }
  
  /**
   * 判断是否需要压缩
   */
  shouldCompact(
    messages: ChatMessage[],
    maxTokens: number = this.DEFAULT_MAX_TOKENS
  ): boolean {
    const estimatedTokens = this.estimateMessagesTokens(messages);
    const shouldCompact = estimatedTokens > maxTokens;
    
    logger.debug('[ContextManager] Compaction check', {
      messageCount: messages.length,
      estimatedTokens,
      maxTokens,
      shouldCompact
    });
    
    return shouldCompact;
  }
  
  /**
   * 识别对话中的关键转折点（基于Anthropic最佳实践）
   * 
   * 策略：保留高信息密度的消息，压缩冗余对话
   * 
   * 识别标准：
   * 1. 用户明确表达约束/需求的消息
   * 2. 包含决策性关键词
   * 3. 包含具体数字、时间、资源约束
   * 4. 消息长度较长（通常包含更多上下文）
   */
  private identifyKeyTurningPoints(messages: ChatMessage[]): Set<number> {
    const keyIndices = new Set<number>();
    
    // 决策性关键词（高权重）
    const criticalKeywords = [
      /必须|一定|不能|只|仅|exclusively|must|cannot|only/i,
      /约束|限制|边界|constraint|limitation|boundary/i,
      /确认|明确|clarify|confirm/i,
    ];
    
    // 具体信息模式（中权重）
    const concretePatterns = [
      /\d+\s*(周|月|年|天|小时|week|month|year|day|hour)/i,
      /\d+\s*(元|块|万|预算|dollar|budget)/i,
      /每天|每周|每月|daily|weekly|monthly/i,
    ];
    
    // 一般关键词（低权重）
    const generalKeywords = [
      /重要|关键|核心|优先|important|key|priority/i,
      /目标|目的|goal|purpose|objective/i,
    ];
    
    messages.forEach((message, index) => {
      const content = message.content;
      let score = 0;
      
      // 用户消息基础分
      if (message.role === 'user') score += 1;
      
      // 决策性关键词（高权重）
      if (criticalKeywords.some(p => p.test(content))) score += 3;
      
      // 具体信息（中权重）
      if (concretePatterns.some(p => p.test(content))) score += 2;
      
      // 一般关键词（低权重）
      if (generalKeywords.some(p => p.test(content))) score += 1;
      
      // 消息长度（信息密度指标）
      if (content.length > 150) score += 1;
      if (content.length > 300) score += 1;
      
      // 阈值：>=4分视为关键转折点
      if (score >= 4) {
        keyIndices.add(index);
      }
    });
    
    logger.debug('[ContextManager] Key turning points identified', {
      total: messages.length,
      keyPoints: keyIndices.size,
      ratio: `${((keyIndices.size / messages.length) * 100).toFixed(1)}%`,
    });
    
    return keyIndices;
  }
  
  /**
   * 压缩对话历史（增强版）
   * 策略：保留最近N轮完整对话 + 选择性保留关键转折点 + 压缩其余早期对话为摘要
   */
  async compactHistory(
    messages: ChatMessage[],
    options: CompactionOptions = {}
  ): Promise<CompactionResult> {
    const {
      maxTokens = this.DEFAULT_MAX_TOKENS,
      recentTurnsToKeep = this.DEFAULT_RECENT_TURNS,
      summaryMaxTokens = this.DEFAULT_SUMMARY_MAX_TOKENS,
    } = options;
    
    const originalTokens = this.estimateMessagesTokens(messages);
    
    // 如果不需要压缩，直接返回
    if (!this.shouldCompact(messages, maxTokens)) {
      return {
        compactedMessages: messages,
        summary: '',
        originalTokens,
        compactedTokens: originalTokens,
        compressionRatio: 1.0,
        wasCompacted: false,
      };
    }
    
    logger.info('[ContextManager] Starting history compaction', {
      totalMessages: messages.length,
      estimatedTokens: originalTokens,
      recentTurnsToKeep
    });
    
    // 计算需要保留的最近消息数（每轮对话=2条消息）
    const recentMessagesToKeep = recentTurnsToKeep * 2;
    
    // 分离早期和最近的消息
    const earlyMessages = messages.slice(0, -recentMessagesToKeep);
    const recentMessages = messages.slice(-recentMessagesToKeep);
    
    // 如果早期消息为空，说明总消息数就不多
    if (earlyMessages.length === 0) {
      return {
        compactedMessages: messages,
        summary: '',
        originalTokens,
        compactedTokens: originalTokens,
        compressionRatio: 1.0,
        wasCompacted: false,
      };
    }
    
    // 🆕 识别早期消息中的关键转折点
    const allKeyIndices = this.identifyKeyTurningPoints(messages);
    const earlyKeyIndices = Array.from(allKeyIndices).filter(
      idx => idx < earlyMessages.length
    );
    
    // 🆕 分离关键消息和非关键消息
    const keyTurningPoints: ChatMessage[] = [];
    const messagesToSummarize: ChatMessage[] = [];
    
    earlyMessages.forEach((msg, relativeIndex) => {
      if (earlyKeyIndices.includes(relativeIndex)) {
        keyTurningPoints.push(msg);
      } else {
        messagesToSummarize.push(msg);
      }
    });
    
    logger.info('[ContextManager] Separated key turning points', {
      earlyTotal: earlyMessages.length,
      keyPoints: keyTurningPoints.length,
      toSummarize: messagesToSummarize.length,
    });
    
    // 生成非关键对话的摘要（如果有的话）
    let summaryMessage: ChatMessage | null = null;
    
    if (messagesToSummarize.length > 0) {
      const summary = await this.generateConversationSummary(
        messagesToSummarize,
        summaryMaxTokens
      );
      
      summaryMessage = {
        id: `summary-${Date.now()}`,
        role: 'system',
        content: `<conversation_summary>
以下是早期对话的摘要（${messagesToSummarize.length}条消息）：

${summary}
</conversation_summary>`,
        timestamp: Date.now(),
        metadata: {
          type: 'info'
        }
      };
    }
    
    // 🆕 构建压缩后的消息列表：摘要 + 关键转折点 + 最近消息
    const compactedMessages = [
      ...(summaryMessage ? [summaryMessage] : []),
      ...keyTurningPoints,
      ...recentMessages,
    ];
    const compactedTokens = this.estimateMessagesTokens(compactedMessages);
    
    const result: CompactionResult = {
      compactedMessages,
      summary: summaryMessage?.content || '',
      originalTokens,
      compactedTokens,
      compressionRatio: compactedTokens / originalTokens,
      wasCompacted: true,
    };
    
    logger.info('[ContextManager] Compaction completed', {
      originalMessages: messages.length,
      compactedMessages: compactedMessages.length,
      keyPointsPreserved: keyTurningPoints.length,
      originalTokens,
      compactedTokens,
      compressionRatio: `${(result.compressionRatio * 100).toFixed(1)}%`,
      tokensSaved: originalTokens - compactedTokens
    });
    
    return result;
  }
  
  /**
   * 生成对话摘要
   * 使用AI提取关键信息
   */
  private async generateConversationSummary(
    messages: ChatMessage[],
    maxTokens: number
  ): Promise<string> {
    // 构建对话文本
    const conversationText = messages
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');
    
    const prompt = `请为以下对话生成一个简洁的摘要。

**要求**:
1. 提取关键信息：用户的主要问题、重要的澄清点、已确认的事实
2. 忽略重复和冗余内容
3. 保持客观，使用第三人称
4. 控制在${maxTokens} tokens以内（约${Math.floor(maxTokens * 1.5)}个中文字）

**对话内容**:
${conversationText}

**摘要**:`;
    
    try {
      const result = await generateText(
        prompt,
        { temperature: 0.3, maxOutputTokens: maxTokens },
        'Pro',
        'S0'
      );
      
      if (result.ok) {
        return result.text.trim();
      } else {
        logger.warn('[ContextManager] Summary generation failed, using fallback');
        return this.generateFallbackSummary(messages);
      }
    } catch (error) {
      logger.error('[ContextManager] Error generating summary', { error });
      return this.generateFallbackSummary(messages);
    }
  }
  
  /**
   * 降级策略：简单的摘要生成
   */
  private generateFallbackSummary(messages: ChatMessage[]): string {
    const userMessages = messages.filter(m => m.role === 'user');
    const aiMessages = messages.filter(m => m.role === 'assistant');
    
    return `对话包含${messages.length}条消息（用户${userMessages.length}条，AI${aiMessages.length}条）。
主要讨论内容：${userMessages.slice(0, 3).map(m => m.content.slice(0, 50)).join('；')}...`;
  }
  
  /**
   * 批量压缩：适用于多个对话历史需要同时处理的场景
   */
  async batchCompact(
    conversationsList: ChatMessage[][],
    options: CompactionOptions = {}
  ): Promise<CompactionResult[]> {
    const results = await Promise.all(
      conversationsList.map(messages => this.compactHistory(messages, options))
    );
    
    const totalOriginal = results.reduce((sum, r) => sum + r.originalTokens, 0);
    const totalCompacted = results.reduce((sum, r) => sum + r.compactedTokens, 0);
    
    logger.info('[ContextManager] Batch compaction completed', {
      conversationsCount: conversationsList.length,
      totalOriginalTokens: totalOriginal,
      totalCompactedTokens: totalCompacted,
      overallCompressionRatio: `${((totalCompacted / totalOriginal) * 100).toFixed(1)}%`
    });
    
    return results;
  }
  
  /**
   * 智能压缩：根据对话特征动态调整压缩策略
   */
  async smartCompact(
    messages: ChatMessage[],
    targetTokens?: number
  ): Promise<CompactionResult> {
    const currentTokens = this.estimateMessagesTokens(messages);
    
    // 如果已经很少，不压缩
    if (currentTokens < 1000) {
      return this.compactHistory(messages, { maxTokens: Infinity });
    }
    
    // 根据当前token数动态调整保留轮数
    let recentTurnsToKeep = this.DEFAULT_RECENT_TURNS;
    
    if (currentTokens > 5000) {
      recentTurnsToKeep = 2;  // 如果很多，只保留2轮
    } else if (currentTokens > 3000) {
      recentTurnsToKeep = 3;  // 中等，保留3轮
    } else {
      recentTurnsToKeep = 4;  // 较少，保留4轮
    }
    
    return this.compactHistory(messages, {
      maxTokens: targetTokens || this.DEFAULT_MAX_TOKENS,
      recentTurnsToKeep
    });
  }
}

// 导出单例
export const contextManager = ContextManager.getInstance();

