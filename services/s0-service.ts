// S0 阶段服务 - 目标精炼

import { NextResponse } from 'next/server';
import { S0RefineGoalSchema } from '@/lib/schemas';
import { generateJsonWithRetry } from '@/lib/ai-retry-handler';
import { DynamicPromptBuilder, S0_TEMPLATES, PROMPT_STRATEGIES } from '@/lib/prompt-templates';
import { AppError, ErrorCodes, handleError, createStageError } from '@/lib/app-errors';
import { logger } from '@/lib/logger';
import type { ConversationMessage } from '@/lib/store';

export interface RefineGoalPayload {
  userInput: string;
  conversationHistory?: ConversationMessage[];
}

export interface RefineGoalResponse {
  status: 'clarification_needed' | 'clarified' | 'recommendations_provided';
  ai_question?: string;
  goal?: string;
  recommendations?: Array<{
    category: string;
    examples: string[];
    description: string;
  }>;
}

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
      
      // 构建动态 prompt
      const promptBuilder = new DynamicPromptBuilder(S0_TEMPLATES.refineGoal);
      
      // 根据用户输入特征调整 prompt
      const userInput = payload.userInput.trim().toLowerCase();
      if (this.isVagueInput(userInput)) {
        PROMPT_STRATEGIES.vague_input(promptBuilder);
      }
      
      // 如果有对话历史，添加到示例中
      if (conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-2).map(msg => ({
          input: msg.content,
          output: msg.role === 'assistant' ? msg.content : ''
        }));
        promptBuilder.withUserHistory(recentHistory);
      }
      
      // 构建上下文
      const context = {
        userInput: payload.userInput,
        conversationHistory: this.formatConversationHistory(conversationHistory),
        interactionCount: conversationHistory.length + 1
      };
      
      const prompt = promptBuilder.build(context);
      
      logger.debug('Calling AI with prompt length:', prompt.length);

      // 定义对话轮次阈值
      const CONVERSATION_TURN_THRESHOLD = 5; // ~2-3轮对话
      
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

      // 如果对话轮次超过阈值，且AI仍在追问，则给予用户选择权
      if (
        conversationHistory.length >= CONVERSATION_TURN_THRESHOLD &&
        validationResult.data.status === 'clarification_needed'
      ) {
        logger.info(`Conversation turn threshold reached. Forcing clarification option for user.`);
        // 在返回数据中添加一个标志，让前端知道应该显示确认按钮
        return NextResponse.json({
          status: 'success',
          data: {
            ...validationResult.data,
            force_clarification: true, 
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
  
  // 验证响应格式
  private validateResponse(data: unknown): data is RefineGoalResponse {
    if (!data || typeof data !== 'object') return false;
    
    const obj = data as Record<string, unknown>;
    
    // 必须有 status 字段
    if (!obj.status || typeof obj.status !== 'string') return false;
    
    // 根据 status 验证其他字段
    switch (obj.status) {
      case 'clarification_needed':
        return typeof obj.ai_question === 'string' && obj.ai_question.length > 0;
        
      case 'clarified':
        return typeof obj.goal === 'string' && obj.goal.length > 0;
        
      case 'recommendations_provided':
        return (
          typeof obj.ai_question === 'string' &&
          Array.isArray(obj.recommendations) &&
          obj.recommendations.length > 0
        );
        
      default:
        return false;
    }
  }
  
  // 判断用户输入是否模糊
  private isVagueInput(input: string): boolean {
    const vaguePatterns = [
      /不知道/,
      /不确定/,
      /帮我/,
      /推荐/,
      /建议/,
      /什么/,
      /怎么/,
      /没有/,
      /暂时/
    ];
    
    return vaguePatterns.some(pattern => pattern.test(input)) || input.length < 10;
  }
  
  // 格式化对话历史
  private formatConversationHistory(history: ConversationMessage[]): string {
    if (history.length === 0) return '无';
    
    return history
      .map(msg => `${msg.role === 'user' ? '用户' : '教练'}: ${msg.content}`)
      .join('\n');
  }
  
  // 处理空响应的智能 fallback
  private handleEmptyResponseFallback(
    payload: RefineGoalPayload,
    conversationHistory: ConversationMessage[]
  ): NextResponse {
    const lastUserInput = payload.userInput.toLowerCase().trim();
    
    // 用户表示完成或确认
    if (this.isCompletionSignal(lastUserInput)) {
      const firstUserInput = conversationHistory.find(msg => msg.role === 'user')?.content || '';
      const fallbackGoal = this.generateFallbackGoal(firstUserInput);
      
      return NextResponse.json({
        status: 'success',
        data: {
          status: 'clarified',
          goal: fallbackGoal
        }
      });
    }
    
    // 继续对话
    return NextResponse.json({
      status: 'success',
      data: {
        status: 'clarification_needed',
        ai_question: '我想确保完全理解您的学习目标。您能再详细描述一下您希望达到的具体成果吗？'
      }
    });
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
