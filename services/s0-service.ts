// S0 阶段服务 - 目标精炼

import { NextResponse } from 'next/server';
import { S0RefineGoalSchema } from '@/lib/schemas';
import type { RefineGoalPayload, RefineGoalResponse } from '@/lib/api-types';
import type { ConversationMessage } from '@/lib/types';
import { generateJsonWithRetry } from '@/lib/ai-retry-handler';
import { S0_PROMPTS, isVagueInput } from '@/lib/prompts/s0-prompts';
import { handleError, createStageError } from '@/lib/app-errors';
import { 
  validateObject,
  validateStringField,
  validateArrayField
} from '@/lib/service-utils';
import { logger } from '@/lib/logger';
import { getAIApiKey } from '@/lib/env-validator';
import { handleNoApiKeyResult, createS0FallbackResponse } from '@/lib/api-fallback';

export class S0Service {
  private static instance: S0Service;
  
  private constructor() {}
  
  static getInstance(): S0Service {
    if (!S0Service.instance) {
      S0Service.instance = new S0Service();
    }
    return S0Service.instance;
  }
  
  async refineGoal(payload: RefineGoalPayload): Promise<NextResponse> {
    logger.debug('S0Service.refineGoal called');
    
    try {
      const conversationHistory = payload.conversationHistory || [];
      const isFirstInteraction = conversationHistory.length === 0;
      
      logger.debug('S0 context:', {
        inputLength: payload.userInput?.length || 0,
        isFirstInteraction,
        historyLength: conversationHistory.length
      });
      
      // 构建 prompt 上下文
      const promptContext = {
        userInput: payload.userInput,
        conversationHistory,
        interactionCount: conversationHistory.length + 1,
        isVagueInput: isVagueInput(payload.userInput)
      };
      
      const prompt = S0_PROMPTS.refineGoal(promptContext);
      
      logger.debug('Calling AI with prompt length:', prompt.length);

      // Check if API key is available before making the AI call
      const apiKey = getAIApiKey();
      if (!apiKey) {
        logger.warn('No AI API key configured, returning fallback response');
        return createS0FallbackResponse();
      }

      // 计算用户澄清轮次（排除首次输入，只计算user消息）
      const userClarificationRounds = conversationHistory.filter(msg => msg.role === 'user').length;
      const CLARIFICATION_ROUND_LIMIT = 2; // 与模板承诺一致：最多2轮澄清
      
      // 使用智能重试机制调用 AI
      const result = await generateJsonWithRetry<RefineGoalResponse>(
        prompt,
        this.validateResponse,
        {
          maxRetries: 3,
          onRetry: (attempt, error) => {
            logger.warn(`S0 retry attempt ${attempt}:`, { error, userInput: payload.userInput });
          }
        },
        'Pro',
        's0' // 传递stage参数用于错误处理
      );
      
      if (!result.ok) {
        logger.error('AI call failed:', {
          error: result.error,
          attempts: result.attempts
        });
        
        // Handle NO_API_KEY error with unified fallback
        const noApiKeyResponse = handleNoApiKeyResult(result, 's0');
        if (noApiKeyResponse) {
          return noApiKeyResponse;
        }
        
        // 智能 fallback 处理
        if (result.error.includes('EMPTY_RESPONSE') && conversationHistory.length > 0) {
          return this.handleEmptyResponseFallback(payload, conversationHistory);
        }
        
        throw createStageError.s0('Failed to refine goal', {
          error: result.error,
          attempts: result.attempts,
          userInput: payload.userInput
        });
      }
      
      const validationResult = S0RefineGoalSchema.safeParse(result.data);
      if (!validationResult.success) {
        throw createStageError.s0('Invalid response format', {
          errors: validationResult.error.issues,
          receivedData: result.data
        });
      }

      // 如果澄清轮次达到限制，生成草拟目标或强制确认
      if (
        userClarificationRounds >= CLARIFICATION_ROUND_LIMIT &&
        validationResult.data.status === 'clarification_needed'
      ) {
        logger.info(`Clarification round limit reached (${userClarificationRounds}/${CLARIFICATION_ROUND_LIMIT}). Generating draft goal for confirmation.`);
        
        // 生成含合理假设的草拟目标供用户确认
        const draftGoal = this.generateDraftGoalFromHistory(conversationHistory, payload.userInput);
        return NextResponse.json({
          status: 'success',
          data: {
            status: 'clarification_needed',
            ai_question: `基于我们的对话，我生成了一个草拟目标："${draftGoal}"。请确认是否正确，或指出需要修改的最多2处地方。如果基本正确，回复"确认"即可进入下一阶段。`
          }
        });
      }
      
      // 记录成功日志
      logger.info('S0 goal refinement successful:', {
        status: validationResult.data.status,
        isFirstInteraction,
        hasRecommendations: !!validationResult.data.recommendations
      });
      
      logger.debug('S0 refinement completed successfully');
      
      return NextResponse.json({
        status: 'success',
        data: validationResult.data
      });
      
    } catch (error) {
      logger.error('S0Service.refineGoal error:', error);
      return handleError(error, 'S0');
    }
  }
  
  /**
   * 验证响应格式
   * 使用通用验证辅助函数减少重复代码
   */
  private validateResponse(data: unknown): data is RefineGoalResponse {
    const obj = validateObject(data);
    if (!obj) return false;
    
    // 验证必需的 status 字段
    if (!validateStringField(obj, 'status', { required: true })) return false;
    
    // 根据 status 验证其他字段
    switch (obj.status) {
      case 'clarification_needed':
        return validateStringField(obj, 'ai_question', { required: true, minLength: 1 });
        
      case 'clarified':
        return validateStringField(obj, 'goal', { required: true, minLength: 1 });
        
      case 'recommendations_provided':
        return (
          validateStringField(obj, 'ai_question', { required: true }) &&
          validateArrayField(obj, 'recommendations', { required: true, minLength: 1 })
        );
        
      default:
        return false;
    }
  }
  
  // 处理空响应的智能 fallback - 使用结构化一次性补齐
  private handleEmptyResponseFallback(
    payload: RefineGoalPayload,
    conversationHistory: ConversationMessage[]
  ): NextResponse {
    const lastUserInput = payload.userInput.toLowerCase().trim();
    
    // 用户表示完成或确认
    if (this.isCompletionSignal(lastUserInput)) {
      const draftGoal = this.generateDraftGoalFromHistory(conversationHistory, payload.userInput);
      
      return NextResponse.json({
        status: 'success',
        data: {
          status: 'clarified',
          goal: draftGoal
        }
      });
    }
    
    // 使用结构化一次性补齐方式继续对话
    return NextResponse.json({
      status: 'success',
      data: {
        status: 'clarification_needed',
        ai_question: '为加速明确目标，请一次性回答：1) 具体学习主题（如React、数据分析、英语口语）；2) 期望产出（作品/证书/岗位能力）；3) 时间范围（如3个月内）。若已有部分明确，仅补充缺失项即可。'
      }
    });
  }
  
  // 基于对话历史生成草拟目标
  private generateDraftGoalFromHistory(
    conversationHistory: ConversationMessage[],
    currentInput: string
  ): string {
    // 提取所有用户输入
    const allUserInputs = [
      ...conversationHistory.filter(msg => msg.role === 'user').map(msg => msg.content),
      currentInput
    ].join(' ');
    
    // 提取关键信息
    const keywords = this.extractKeywords(allUserInputs);
    const timeframe = this.extractTimeframe(allUserInputs) || '3个月';
    const outcome = this.extractOutcome(allUserInputs) || '熟练掌握相关技能';
    
    if (keywords.length > 0) {
      return `在${timeframe}内学习并掌握${keywords.join('、')}，目标达到${outcome}的水平，能够独立完成相关实践项目`;
    }
    
    return `在${timeframe}内完成学习目标，达到${outcome}的水平，能够熟练应用所学内容`;
  }
  
  // 提取时间框架
  private extractTimeframe(text: string): string | null {
    const timePatterns = [
      /(\d+)个?月/,
      /(\d+)周/,
      /(\d+)天/,
      /半年/,
      /一年/
    ];
    
    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  }
  
  // 提取期望产出
  private extractOutcome(text: string): string | null {
    const outcomePatterns = [
      /找工作|求职|就业/,
      /项目|作品|产品/,
      /证书|认证|考试/,
      /技能|能力|水平/,
      /创业|自主/
    ];
    
    for (const pattern of outcomePatterns) {
      if (pattern.test(text)) {
        if (pattern.source.includes('工作')) return '就业准备';
        if (pattern.source.includes('项目')) return '项目实践';
        if (pattern.source.includes('证书')) return '获得认证';
        if (pattern.source.includes('创业')) return '创业应用';
      }
    }
    
    return null;
  }
  
  // 判断是否为完成信号
  private isCompletionSignal(input: string): boolean {
    const completionPatterns = [
      /没有了/,
      /完成/,
      /够了/,
      /好的/,
      /可以/,
      /行/,
      /ok/,
      /就这样/
    ];
    
    return completionPatterns.some(pattern => pattern.test(input));
  }
  
  // 生成 fallback 目标
  private generateFallbackGoal(originalInput: string): string {
    // 提取关键词
    const keywords = this.extractKeywords(originalInput);
    
    if (keywords.length > 0) {
      return `学习并掌握${keywords.join('、')}的相关技能和知识，能够熟练应用所学内容`;
    }
    
    return `掌握${originalInput}的核心概念和实践技能，能够独立完成相关项目`;
  }
  
  // 提取关键词
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取逻辑
    const stopWords = ['我', '想', '要', '学', '学习', '的', '了', '吗', '呢', '吧'];
    const words = text.split(/[\s，。！？、]+/)
      .filter(word => word.length > 1 && !stopWords.includes(word));
    
    return words.slice(0, 3); // 最多返回3个关键词
  }
}
