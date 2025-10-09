// S4 阶段服务 - 进度分析和咨询

import { NextResponse } from 'next/server';
import {
  AnalyzeProgressSchema,
  type AnalyzeProgress,
} from '@/lib/schemas';
import type { AnalyzeProgressPayload, ConsultPayload } from '@/lib/api-types';
import { generateJsonWithRetry } from '@/lib/ai-retry-handler';
import { generateText } from '@/lib/gemini-config';
import { S4_PROMPTS } from '@/lib/prompts/s4-prompts';
import { createStageError, handleError } from '@/lib/app-errors';
import { runQualityGates } from '@/lib/qa';
import { logger } from '@/lib/logger';
import { createSuccessResponse } from '@/lib/error-utils';
import { handleNoApiKeyResult } from '@/lib/api-fallback';
import { 
  handleSchemaValidation,
  handleQAValidation,
  validateObject,
  validateStringField,
  validateArrayField
} from '@/lib/service-utils';

export class S4Service {
  private static instance: S4Service;

  private constructor() {}

  static getInstance(): S4Service {
    if (!S4Service.instance) {
      S4Service.instance = new S4Service();
    }
    return S4Service.instance;
  }

  /**
   * 分析学习进度
   */
  async analyzeProgress(payload: AnalyzeProgressPayload): Promise<NextResponse> {
    logger.debug('S4Service.analyzeProgress called', {
      completedTasks: payload.progressData.completedTasks?.length || 0,
      totalTasks: payload.userContext.actionPlan?.length || 0,
    });

    try {
      // 计算完成率
      const completedTasksCount = payload.progressData.completedTasks?.length || 0;
      const totalTasksCount = payload.userContext.actionPlan?.length || 0;
      const completionRate =
        totalTasksCount > 0
          ? Math.round((completedTasksCount / totalTasksCount) * 100)
          : 0;

      // 构建 prompt
      const prompt = S4_PROMPTS.analyzeProgress({
        userGoal: payload.userContext.userGoal,
        completionRate,
        completedTasksCount,
        totalTasksCount,
        confidenceScore: payload.progressData.confidenceScore,
        hoursSpent: payload.progressData.hoursSpent,
        challenges: payload.progressData.challenges,
        kpis: payload.userContext.kpis,
      });

      // 使用带重试的版本调用 AI 生成分析
      const result = await generateJsonWithRetry<AnalyzeProgress>(
        prompt,
        this.validateAnalyzeProgress,
        {
          maxRetries: 3,
          onRetry: (attempt, error) => {
            logger.warn(`S4 analyzeProgress retry attempt ${attempt}:`, { error });
          }
        },
        'Pro',
        's4'
      );

      if (!result.ok) {
        logger.error('AI call failed:', {
          error: result.error,
          attempts: result.attempts
        });

        // Handle NO_API_KEY error with unified fallback
        const noApiKeyResponse = handleNoApiKeyResult(result, 's4');
        if (noApiKeyResponse) {
          return noApiKeyResponse;
        }

        throw createStageError.s4('Failed to analyze progress', {
          error: result.error,
          attempts: result.attempts,
        });
      }

      // Schema 验证
      const validationResult = AnalyzeProgressSchema.safeParse(result.data);
      const analysisData = handleSchemaValidation(validationResult, 's4', result.data);

      // 质量门控（S3->S4 linkage）
      const qaResult = runQualityGates('S4', analysisData, {
        strategyMetrics: payload.userContext.strategySpec?.metrics || [],
      });
      handleQAValidation(qaResult, 'S4');

      logger.info('S4 progress analysis successful');

      return createSuccessResponse(analysisData);
    } catch (error) {
      logger.error('S4Service.analyzeProgress error:', error);
      return handleError(error, 'S4');
    }
  }

  /**
   * AI 咨询服务
   */
  async consult(payload: ConsultPayload): Promise<NextResponse> {
    logger.debug('S4Service.consult called', {
      questionLength: payload.question?.length || 0,
      hasFramework: !!payload.userContext.knowledgeFramework,
    });

    try {
      // 格式化知识框架摘要
      const frameworkSummary = S4_PROMPTS.formatFrameworkSummary(
        payload.userContext.knowledgeFramework
      );

      // 获取当前行动计划状态
      const completedActions =
        payload.userContext.actionPlan?.filter((item) => item.isCompleted)
          .length || 0;
      const totalActions = payload.userContext.actionPlan?.length || 0;

      // 构建 prompt
      const prompt = S4_PROMPTS.consult({
        question: payload.question,
        userGoal: payload.userContext.userGoal,
        frameworkSummary,
        completedActions,
        totalActions,
        metaphor: payload.userContext.systemDynamics?.metaphor,
      });

      const config = S4_PROMPTS.getGenerationConfig();

      // 调用 AI 生成回答（纯文本）
      const result = await generateText(prompt, config, 'Pro');

      if (!result.ok) {
        logger.error('AI call failed:', result.error);

        // Handle NO_API_KEY error with unified fallback
        const noApiKeyResponse = handleNoApiKeyResult(result, 's4');
        if (noApiKeyResponse) {
          return noApiKeyResponse;
        }

        throw createStageError.s4('Failed to get consultation response', {
          error: result.error,
        });
      }

      logger.info('S4 consultation successful');

      return createSuccessResponse({ response: result.text });
    } catch (error) {
      logger.error('S4Service.consult error:', error);
      return handleError(error, 'S4');
    }
  }

  /**
   * 验证进度分析响应格式
   * 使用通用验证辅助函数减少重复代码
   */
  private validateAnalyzeProgress(data: unknown): data is AnalyzeProgress {
    const obj = validateObject(data);
    if (!obj) return false;
    
    // 验证必需的 analysis 字符串
    if (!validateStringField(obj, 'analysis', { required: true, minLength: 1 })) {
      return false;
    }
    
    // 验证必需的 suggestions 数组
    if (!validateArrayField(obj, 'suggestions', {
      required: true,
      minLength: 1,
      elementValidator: (s) => typeof s === 'string' && s.length > 0
    })) {
      return false;
    }
    
    return true;
  }
}

