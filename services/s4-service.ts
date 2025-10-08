// S4 阶段服务 - 进度分析和咨询

import { NextResponse } from 'next/server';
import {
  AnalyzeProgressSchema,
  type ActionPlan,
  type KnowledgeFramework,
  type AnalyzeProgress,
} from '@/lib/schemas';
import { generateJson, generateText } from '@/lib/gemini-config';
import { S4_PROMPTS } from '@/lib/prompts/s4-prompts';
import { createStageError, handleError, serializeErrorDetailsSecurely } from '@/lib/app-errors';
import { runQualityGates } from '@/lib/qa';
import { logger } from '@/lib/logger';
import { createErrorResponse, createSuccessResponse } from '@/lib/error-utils';

export interface AnalyzeProgressPayload {
  progressData: {
    completedTasks?: string[];
    confidenceScore?: number;
    hoursSpent?: number;
    challenges?: string;
  };
  userContext: {
    userGoal: string;
    actionPlan: ActionPlan;
    kpis: string[];
    strategySpec?: { metrics?: Array<{ metricId: string }> };
  };
}

export interface ConsultPayload {
  question: string;
  userContext: {
    userGoal: string;
    knowledgeFramework: KnowledgeFramework;
    actionPlan: ActionPlan;
    systemDynamics?: {
      mermaidChart: string;
      metaphor: string;
    };
  };
}

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

      const config = S4_PROMPTS.getGenerationConfig();

      // 调用 AI 生成分析
      const result = await generateJson<AnalyzeProgress>(prompt, config, 'Pro');

      if (!result.ok) {
        const errorMessage =
          result.error === 'EMPTY_RESPONSE'
            ? '抱歉，AI暂时无法分析您的进度。请稍后重试。'
            : '进度分析遇到问题，请检查输入数据并重试。';

        logger.error('AI call failed:', result.error);

        return createErrorResponse(errorMessage, 400, {
          stage: 'S4',
          details: serializeErrorDetailsSecurely(result.error) as string | undefined,
        });
      }

      // Schema 验证
      const validationResult = AnalyzeProgressSchema.safeParse(result.data);
      if (!validationResult.success) {
        logger.error('Schema validation failed:', validationResult.error);
        return createErrorResponse(
          'Schema validation failed for S4 output',
          400,
          {
            stage: 'S4',
            details: JSON.stringify(validationResult.error.issues),
          }
        );
      }

      // 质量门控（S3->S4 linkage）
      const qaResult = runQualityGates('S4', validationResult.data, {
        strategyMetrics: payload.userContext.strategySpec?.metrics || [],
      });

      if (!qaResult.passed) {
        logger.warn('Quality gates failed:', qaResult.issues);
        return createErrorResponse('Quality gates failed', 400, {
          stage: 'S4',
          fixHints: qaResult.issues.map((i) => i.hint),
          details: JSON.stringify(qaResult.issues),
        });
      }

      logger.info('S4 progress analysis successful');

      return createSuccessResponse(validationResult.data);
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
        return createErrorResponse('Failed to get consultation response', 400, {
          stage: 'S4',
          details: result.error,
        });
      }

      logger.info('S4 consultation successful');

      return createSuccessResponse({ response: result.text });
    } catch (error) {
      logger.error('S4Service.consult error:', error);
      return handleError(error, 'S4');
    }
  }
}

