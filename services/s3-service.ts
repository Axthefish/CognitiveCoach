// S3 阶段服务 - 行动计划生成

import { NextResponse } from 'next/server';
import {
  ActionPlanResponseSchema,
  type KnowledgeFramework,
  type ActionPlanResponse,
} from '@/lib/schemas';
import { generateJson } from '@/lib/gemini-config';
import { S3_PROMPTS } from '@/lib/prompts/s3-prompts';
import { createStageError, handleError } from '@/lib/app-errors';
import { runQualityGates } from '@/lib/qa';
import { logger } from '@/lib/logger';
import { createSuccessResponse } from '@/lib/error-utils';

export interface GenerateActionPlanPayload {
  userGoal: string;
  framework: KnowledgeFramework;
  systemNodes?: Array<{ id: string; title?: string }>;
  decisionType?: 'explore' | 'compare' | 'troubleshoot' | 'plan';
  runTier?: 'Lite' | 'Pro' | 'Review';
  riskPreference?: 'low' | 'medium' | 'high';
  seed?: number;
}

interface PlanVariant {
  text: string;
  qaScore: number;
  issues: unknown[];
}

export class S3Service {
  private static instance: S3Service;

  private constructor() {}

  static getInstance(): S3Service {
    if (!S3Service.instance) {
      S3Service.instance = new S3Service();
    }
    return S3Service.instance;
  }

  /**
   * 生成行动计划
   */
  async generateActionPlan(
    payload: GenerateActionPlanPayload
  ): Promise<NextResponse> {
    logger.debug('S3Service.generateActionPlan called', {
      goalLength: payload.userGoal?.length || 0,
      frameworkSize: payload.framework?.length || 0,
      runTier: payload.runTier,
    });

    try {
      // 格式化框架描述
      const frameworkDescription = S3_PROMPTS.formatFrameworkDescription(
        payload.framework
      );

      // 构建 prompt
      const prompt = S3_PROMPTS.generateActionPlan({
        userGoal: payload.userGoal,
        framework: payload.framework,
        frameworkDescription,
      });

      // n-best generation (Pro 模式生成 2 个变体，Lite 模式只生成 1 个)
      const variantCount = payload.runTier === 'Pro' ? 2 : 1;
      const variants = await this.generateVariants(
        prompt,
        variantCount,
        payload.runTier
      );

      // 评估变体并选择最佳
      const best = this.selectBestVariant(variants, payload.systemNodes || []);

      if (best) {
        // 添加 POV tags 和人工审核标志
        const enrichedPlan = this.enrichPlanData(best);
        const telemetry = { n_best_count: variantCount };

        logger.info('S3 action plan generation successful');

        return createSuccessResponse({
          ...enrichedPlan,
          telemetry,
        });
      }

      // 如果所有变体都失败，尝试最后一次重试（降低温度）
      logger.warn('All variants failed, attempting final retry');
      const retryResult = await this.retryWithLowerTemperature(
        prompt,
        payload.runTier,
        payload.systemNodes || []
      );

      if (retryResult) {
        return retryResult;
      }

      // 完全失败
      throw createStageError.s3('Failed to generate action plan', {
        variantIssues: variants.map((v) => v.issues),
      });
    } catch (error) {
      logger.error('S3Service.generateActionPlan error:', error);
      return handleError(error, 'S3');
    }
  }

  /**
   * 生成多个变体
   */
  private async generateVariants(
    prompt: string,
    count: number,
    runTier?: 'Lite' | 'Pro' | 'Review'
  ): Promise<PlanVariant[]> {
    const variants: PlanVariant[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const config = S3_PROMPTS.getGenerationConfig(runTier, i);
        const result = await generateJson<Record<string, unknown>>(
          prompt,
          config,
          runTier
        );

        const text = result.ok ? JSON.stringify(result.data) : '';
        const issues = result.ok ? [] : [result.error];
        variants.push({ text, qaScore: 0, issues });
      } catch (error) {
        logger.error(`Action plan variant ${i} generation failed:`, error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        variants.push({ text: '', qaScore: 0, issues: [errorMessage] });
      }
    }

    return variants;
  }

  /**
   * 选择最佳变体
   */
  private selectBestVariant(
    variants: PlanVariant[],
    systemNodes: Array<{ id: string }>
  ): Record<string, unknown> | null {
    let best: Record<string, unknown> | null = null;
    let bestIssuesCount = Number.POSITIVE_INFINITY;

    for (const variant of variants) {
      // 跳过空文本的变体
      if (!variant.text || variant.text.trim() === '') {
        variant.issues = ['empty_response'];
        continue;
      }

      try {
        const planData = JSON.parse(variant.text);

        // Schema 验证
        const schemaResult = ActionPlanResponseSchema.safeParse(planData);
        if (!schemaResult.success) {
          variant.issues = [
            'schema',
            ...schemaResult.error.issues.map((i) => i.message),
          ];
          continue;
        }

        // 质量门控
        const qaResult = runQualityGates('S3', planData, {
          nodes: systemNodes.map((n) => ({ id: n.id })),
        });
        variant.issues = qaResult.issues.map((i) => i.hint);

        if (qaResult.passed) {
          const issueCount = qaResult.issues.length;
          if (issueCount < bestIssuesCount) {
            best = planData;
            bestIssuesCount = issueCount;
          }
        }
      } catch (parseError) {
        logger.error('JSON parsing failed during action plan generation:', parseError);
        const errorMessage =
          parseError instanceof Error ? parseError.message : 'JSON parse error';
        variant.issues = ['parse', errorMessage];
      }
    }

    return best;
  }

  /**
   * 使用降低的温度重试
   */
  private async retryWithLowerTemperature(
    prompt: string,
    runTier?: 'Lite' | 'Pro' | 'Review',
    systemNodes: Array<{ id: string }> = []
  ): Promise<NextResponse | null> {
    try {
      const config = S3_PROMPTS.getRetryConfig();
      const result = await generateJson<Record<string, unknown>>(
        prompt,
        config,
        runTier
      );

      if (!result.ok) return null;

      const planData = result.data;

      // 补充可选字段的默认值
      const enrichedPlanData = {
        ...planData,
        strategySpec: planData.strategySpec || null,
        missingEvidenceTop3: planData.missingEvidenceTop3 || [],
        reviewWindow: planData.reviewWindow || 'P14D',
        evidence: planData.evidence || [],
        confidence: planData.confidence || 0.6,
        applicability: planData.applicability || '',
      };

      // Schema 验证
      const schemaResult = ActionPlanResponseSchema.safeParse(enrichedPlanData);
      if (!schemaResult.success) {
        logger.error('Retry schema validation failed:', schemaResult.error);
        return null;
      }

      // 质量门控
      const qaResult = runQualityGates('S3', enrichedPlanData, {
        nodes: systemNodes.map((n) => ({ id: n.id })),
      });

      if (!qaResult.passed) {
        logger.error('Retry QA failed:', qaResult.issues);
        return null;
      }

      // 成功
      const enrichedPlan = this.enrichPlanData(enrichedPlanData);
      const telemetry = { n_best_count: 1, retry: true };

      logger.info('S3 action plan generation successful (retry)');

      return createSuccessResponse({
        ...enrichedPlan,
        telemetry,
      });
    } catch (error) {
      logger.error('Retry attempt failed:', error);
      return null;
    }
  }

  /**
   * 丰富计划数据（添加 POV tags 和人工审核标志）
   */
  private enrichPlanData(
    planData: Record<string, unknown>
  ): Record<string, unknown> {
    const povTags = ['maximize_gain', 'minimize_risk'];

    // 检查是否需要人工审核
    const strategySpec = planData.strategySpec as
      | { metrics?: Array<{ confidence?: number; evidence?: unknown[] }> }
      | undefined;
    const metrics = strategySpec?.metrics || [];
    const requiresHumanReview = metrics.some(
      (m) =>
        (m.confidence ?? 1) < 0.4 ||
        !m.evidence ||
        ((m.evidence as unknown[])?.length ?? 0) === 0
    );

    return {
      ...planData,
      povTags,
      requiresHumanReview,
    };
  }
}

