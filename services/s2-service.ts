// S2 阶段服务 - 系统动力学生成

import { NextResponse } from 'next/server';
import {
  SystemDynamicsSchema,
  type KnowledgeFramework,
  type SystemDynamics,
} from '@/lib/schemas';
import { generateJsonWithRetry } from '@/lib/ai-retry-handler';
import { S2_PROMPTS } from '@/lib/prompts/s2-prompts';
import { createStageError, handleError } from '@/lib/app-errors';
import { runQualityGates } from '@/lib/qa';
import { logger } from '@/lib/logger';
import { createErrorResponse, createSuccessResponse } from '@/lib/error-utils';

export interface GenerateSystemDynamicsPayload {
  framework: KnowledgeFramework;
  decisionType?: 'explore' | 'compare' | 'troubleshoot' | 'plan';
  runTier?: 'Lite' | 'Pro' | 'Review';
  riskPreference?: 'low' | 'medium' | 'high';
  seed?: number;
}

export class S2Service {
  private static instance: S2Service;

  private constructor() {}

  static getInstance(): S2Service {
    if (!S2Service.instance) {
      S2Service.instance = new S2Service();
    }
    return S2Service.instance;
  }

  /**
   * 生成系统动力学
   */
  async generateSystemDynamics(
    payload: GenerateSystemDynamicsPayload
  ): Promise<NextResponse> {
    logger.debug('S2Service.generateSystemDynamics called', {
      frameworkSize: payload.framework?.length || 0,
      runTier: payload.runTier,
    });

    try {
      // 格式化框架描述
      const frameworkDescription = S2_PROMPTS.formatFrameworkDescription(
        payload.framework
      );

      // 构建 prompt
      const prompt = S2_PROMPTS.generateSystemDynamics({
        framework: payload.framework,
        frameworkDescription,
      });
      const config = S2_PROMPTS.getGenerationConfig(payload.runTier);

      // 使用智能重试机制调用 AI
      const result = await generateJsonWithRetry<SystemDynamics>(
        prompt,
        this.validateSystemDynamics,
        {
          maxRetries: 3,
          onRetry: (attempt, error) => {
            logger.warn(`S2 retry attempt ${attempt}:`, {
              error,
              frameworkSize: payload.framework.length,
            });
          },
        },
        payload.runTier,
        's2'
      );

      if (!result.ok) {
        logger.error('AI call failed:', {
          error: result.error,
          attempts: result.attempts,
        });

        throw createStageError.s2('Failed to generate system dynamics', {
          error: result.error,
          attempts: result.attempts,
        });
      }

      // Schema 验证
      const validationResult = SystemDynamicsSchema.safeParse(result.data);
      if (!validationResult.success) {
        logger.error('Schema validation failed:', validationResult.error);
        return createErrorResponse(
          'Schema validation failed for S2 output',
          400,
          {
            stage: 'S2',
            details: JSON.stringify(validationResult.error.issues),
          }
        );
      }

      // Mermaid 图表预检查
      const mermaidChart = validationResult.data.mermaidChart;
      if (
        typeof mermaidChart !== 'string' ||
        !mermaidChart.trim().startsWith('graph TD')
      ) {
        logger.error('Invalid Mermaid chart format');
        return createErrorResponse(
          'Invalid Mermaid chart: must start with "graph TD"',
          400,
          { stage: 'S2' }
        );
      }

      // 质量门控
      const qaResult = runQualityGates('S2', validationResult.data, {
        framework: payload.framework,
      });

      if (!qaResult.passed) {
        logger.warn('Quality gates failed:', qaResult.issues);
        return createErrorResponse('Quality gates failed', 400, {
          stage: 'S2',
          fixHints: qaResult.issues.map((i) => i.hint),
          details: JSON.stringify(qaResult.issues),
        });
      }

      logger.info('S2 system dynamics generation successful');

      return createSuccessResponse(validationResult.data);
    } catch (error) {
      logger.error('S2Service.generateSystemDynamics error:', error);
      return handleError(error, 'S2');
    }
  }

  /**
   * 验证系统动力学格式
   */
  private validateSystemDynamics(data: unknown): data is SystemDynamics {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;

    // 必须有 mermaidChart 和 metaphor
    if (typeof obj.mermaidChart !== 'string' || !obj.mermaidChart) return false;
    if (typeof obj.metaphor !== 'string' || !obj.metaphor) return false;

    // nodes 是可选的，但如果存在必须是数组
    if (obj.nodes !== undefined && !Array.isArray(obj.nodes)) return false;

    // 如果有 nodes，验证每个节点
    if (Array.isArray(obj.nodes)) {
      const valid = obj.nodes.every((node) => {
        if (!node || typeof node !== 'object') return false;
        const n = node as Record<string, unknown>;
        return typeof n.id === 'string' && typeof n.title === 'string';
      });
      if (!valid) return false;
    }

    return true;
  }
}

