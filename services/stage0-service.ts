/**
 * Stage 0 Service - 目的澄清与问题域框定
 * 
 * 通过多轮对话，从用户的模糊输入中提取明确的目的和问题域
 */

import { NextResponse } from 'next/server';
import type { ChatMessage, PurposeDefinition, Stage0Response, ClarifiedMission } from '@/lib/types-v2';
import { generateJson } from '@/lib/gemini-config';
import {
  getInitialCollectionPrompt,
  getDeepDivePrompt,
  getConfirmationPrompt,
  getStage0GenerationConfig,
  isVagueInput,
  getGuidanceForVagueInput,
} from '@/lib/prompts/stage0-prompts';
import { contextManager } from '@/lib/context-manager';
import { contextMonitor } from '@/lib/context-monitor';
import { tokenBudgetManager } from '@/lib/token-budget-manager';
import { validateStage0Output, canProceedToStage1 } from '@/lib/output-validator';
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';
import { handleNoApiKeyResult } from '@/lib/api-fallback';

export class Stage0Service {
  private static instance: Stage0Service;
  
  private constructor() {}
  
  static getInstance(): Stage0Service {
    if (!Stage0Service.instance) {
      Stage0Service.instance = new Stage0Service();
    }
    return Stage0Service.instance;
  }
  
  // ========================================
  // 主处理函数
  // ========================================
  
  /**
   * 处理初始输入
   */
  async processInitialInput(userInput: string): Promise<NextResponse<Stage0Response>> {
    logger.info('[Stage0Service] Processing initial input');
    
    try {
      // 直接生成完整的ClarifiedMission - 不调用AI，避免超时
      const clarifiedMission = {
        rawInput: userInput,
        missionStatement: userInput, // 直接使用用户输入作为mission statement
        subject: this.extractSubject(userInput),
        desiredOutcome: '通过系统化的方法达成目标',
        context: userInput,
        keyLevers: this.extractKeywords(userInput),
        conversationHistory: [],
        confidence: 0.8,
        generatedAt: Date.now(),
      };
      
      logger.info('[Stage0Service] Generated clarified mission', {
        missionLength: clarifiedMission.missionStatement.length,
        subject: clarifiedMission.subject,
      });
      
      return NextResponse.json({
        success: true,
        data: clarifiedMission,
        message: '我理解了您的目标，请确认是否正确',
        nextAction: 'confirm',
      });
      
    } catch (error) {
      logger.error('[Stage0Service] processInitialInput error', { 
        error: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process input',
      }, { status: 500 });
    }
  }
  
  // 辅助方法：从输入中提取主题
  private extractSubject(input: string): string {
    // 简单的关键词提取
    const keywords = ['学习', '理解', '掌握', '提升', '改善', '解决', '实现'];
    for (const keyword of keywords) {
      const index = input.indexOf(keyword);
      if (index !== -1) {
        // 提取关键词后的内容作为主题
        const after = input.substring(index + keyword.length).trim();
        if (after.length > 0) {
          return after.split(/[，。；！？]/)[0].substring(0, 50);
        }
      }
    }
    return input.substring(0, 30);
  }
  
  // 辅助方法：提取关键词
  private extractKeywords(input: string): string[] {
    const words = input.split(/[，。；！？\s]+/).filter(w => w.length > 2);
    return words.slice(0, 5);
  }
  
  /**
   * 处理后续对话轮次（增强版）
   */
  async processContinuation(
    conversationHistory: ChatMessage[],
    currentDefinition: Partial<PurposeDefinition>,
    sessionId?: string
  ): Promise<NextResponse<Stage0Response>> {
    logger.info('[Stage0Service] Processing continuation', {
      historyLength: conversationHistory.length,
      sessionId,
    });
    
    try {
      // 🆕 评估Context质量
      const contextQuality = contextMonitor.assessContextQuality(conversationHistory);
      
      logger.debug('[Stage0Service] Context quality assessed', {
        tokenCount: contextQuality.tokenCount,
        attentionScore: contextQuality.attentionScore,
        informationDensity: contextQuality.informationDensity,
      });
      
      // 🆕 Token预算管理
      const estimate = tokenBudgetManager.estimateStage0NextTurn(
        conversationHistory,
        currentDefinition
      );
      
      const budget = tokenBudgetManager.getRemainingBudget(
        'stage0',
        sessionId || 'default'
      );
      
      const strategy = tokenBudgetManager.suggestOptimization(estimate, budget);
      
      logger.info('[Stage0Service] Token budget check', {
        estimate: estimate.total,
        remaining: budget.remaining,
        strategyAction: strategy.action,
      });
      
      // 应用上下文压缩
      let processedHistory = conversationHistory;
      let compactionInfo = null;
      let compactionSummary: string | undefined = undefined;
      
      // 🆕 智能触发压缩：基于token预算或context质量
      const shouldCompactByBudget = strategy.action === 'compact_now';
      const shouldCompactByQuality = contextQuality.attentionScore < 0.6;
      const shouldCompactByLength = conversationHistory.length > 10;
      
      if (shouldCompactByBudget || shouldCompactByQuality || shouldCompactByLength) {
        const reason = shouldCompactByBudget 
          ? 'token预算即将超限' 
          : shouldCompactByQuality 
          ? 'context质量下降（注意力得分<0.6）'
          : '对话轮次过多';
        
        logger.info('[Stage0Service] Triggering compaction', { reason });
        
        const compactionResult = await contextManager.smartCompact(conversationHistory);
        if (compactionResult.wasCompacted) {
          processedHistory = compactionResult.compactedMessages;
          compactionSummary = compactionResult.summary;
          compactionInfo = {
            originalTokens: compactionResult.originalTokens,
            compactedTokens: compactionResult.compactedTokens,
            compressionRatio: compactionResult.compressionRatio,
          };
          logger.info('[Stage0Service] History compacted', compactionInfo);
        }
      }
      
      const prompt = getDeepDivePrompt(processedHistory, currentDefinition);
      const config = getStage0GenerationConfig();
      
      const aiResponse = await generateJson<{
        assessment: {
          clarity_score: number;
          missing_info: string[];
          confidence: number;
        };
        action: 'continue' | 'confirm';
        next_question?: string;
      }>(prompt, config, 'Pro', 'S0');
      
      // 检查是否是NO_API_KEY错误，使用fallback
      const fallbackResponse = handleNoApiKeyResult(aiResponse, 'S0');
      if (fallbackResponse) {
        return fallbackResponse as NextResponse<Stage0Response>;
      }
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      // AI 响应已经是解析后的对象
      const result = aiResponse.data;
      
      // 🆕 记录token使用（包含压缩信息）
      const actualTokensUsed = estimate.total;
      
      contextMonitor.recordGeneration(
        'stage0',
        prompt,
        JSON.stringify(result),
        {
          runTier: 'Pro',
          wasCompacted: compactionInfo !== null,
          compressionRatio: compactionInfo?.compressionRatio,
          sessionId: sessionId || currentDefinition.rawInput?.substring(0, 20),
        }
      );
      
      // 注意：contextQuality可以单独记录或在后续版本中添加到TokenUsageRecord
      
      // 🆕 跟踪session的token使用
      if (sessionId) {
        tokenBudgetManager.trackSessionUsage(sessionId, 'stage0', actualTokensUsed);
      }
      
      // 根据 AI 的判断决定下一步
      if (result.action === 'confirm') {
        // 进入确认阶段，传递可能的compaction insights
        return this.generateConfirmation(
          processedHistory, 
          compactionSummary
        );
      } else {
        // 继续追问，保存可能的compaction insights
        return NextResponse.json({
          success: true,
          data: {
            ...currentDefinition,
            confidence: result.assessment.confidence,
            clarificationState: 'REFINING',
            conversationInsights: compactionSummary || currentDefinition.conversationInsights,
          } as PurposeDefinition,
          message: result.next_question,
          nextAction: 'continue_dialogue',
        });
      }
      
    } catch (error) {
      logger.error('[Stage0Service] processContinuation error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  /**
   * 生成最终确认
   */
  async generateConfirmation(
    conversationHistory: ChatMessage[],
    conversationInsights?: string
  ): Promise<NextResponse<Stage0Response>> {
    logger.info('[Stage0Service] Generating confirmation', {
      hasInsights: !!conversationInsights
    });
    
    try {
      const prompt = getConfirmationPrompt(conversationHistory);
      const config = getStage0GenerationConfig(); // 最后一轮
      
      const aiResponse = await generateJson<{
        clarified_purpose: string;
        problem_domain: string;
        domain_boundary: string;
        boundary_constraints: string[];
        personal_constraints: string[];
        confidence: number;
        confirmation_message: string;
      }>(prompt, config, 'Pro', 'S0');
      
      // 检查是否是NO_API_KEY错误，使用fallback
      const fallbackResponse = handleNoApiKeyResult(aiResponse, 'S0');
      if (fallbackResponse) {
        return fallbackResponse as NextResponse<Stage0Response>;
      }
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      // AI 响应已经是解析后的对象
      const responseData = aiResponse.data;
      const finalDefinition: PurposeDefinition = {
        rawInput: conversationHistory[0]?.content || '',
        clarifiedPurpose: responseData.clarified_purpose,
        problemDomain: responseData.problem_domain,
        domainBoundary: responseData.domain_boundary,
        boundaryConstraints: responseData.boundary_constraints || [],
        personalConstraints: responseData.personal_constraints || [],
        keyConstraints: [
          ...responseData.boundary_constraints || [],
          ...responseData.personal_constraints || []
        ], // 向后兼容：合并两类约束
        conversationHistory,
        conversationInsights, // 🆕 保存压缩后的insights
        confidence: responseData.confidence || 1.0,
        clarificationState: 'COMPLETED',
      };
      
      // 🆕 验证输出质量
      const validation = validateStage0Output(finalDefinition);
      
      if (!validation.isValid) {
        logger.warn('[Stage0Service] Output validation failed', {
          errorCount: validation.errorCount,
          issues: validation.issues.map(i => i.checkName),
        });
      }
      
      // 检查是否可以进入Stage 1
      const canProceed = canProceedToStage1(finalDefinition);
      if (!canProceed.canProceed) {
        logger.warn('[Stage0Service] Cannot proceed to Stage 1', {
          reason: canProceed.reason,
          blockingIssues: canProceed.blockingIssues.map(i => i.checkName),
        });
      }
      
      return NextResponse.json({
        success: true,
        data: finalDefinition,
        message: finalDefinition.clarifiedPurpose,
        nextAction: 'confirm', // 总是返回confirm，验证issues只是警告
      });
      
    } catch (error) {
      logger.error('[Stage0Service] generateConfirmation error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  /**
   * 用户确认后完成 Stage 0
   */
  async completeStage0(
    definition: PurposeDefinition,
    userConfirmed: boolean
  ): Promise<NextResponse<Stage0Response>> {
    if (userConfirmed) {
      return NextResponse.json({
        success: true,
        data: {
          ...definition,
          clarificationState: 'COMPLETED',
          confidence: 1.0,
        },
        message: '太好了！现在我会为你生成通用框架。',
        nextAction: 'complete',
      });
    } else {
      // 用户不确认，回到收集阶段
      return NextResponse.json({
        success: true,
        data: {
          ...definition,
          clarificationState: 'REFINING',
          confidence: definition.confidence * 0.8,
        },
        message: '好的，让我重新理解。请告诉我哪里需要调整？',
        nextAction: 'continue_dialogue',
      });
    }
  }
  
  // Note: AI response parsing is now handled by generateJson() which returns parsed objects directly
}

