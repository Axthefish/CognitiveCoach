// S2 阶段服务 - 系统动力学生成

import { NextResponse } from 'next/server';
import {
  SystemDynamicsSchema,
  type SystemDynamics,
} from '@/lib/schemas';
import type { GenerateSystemDynamicsPayload } from '@/lib/api-types';
import { generateJsonWithRetry } from '@/lib/ai-retry-handler';
import { S2_PROMPTS } from '@/lib/prompts/s2-prompts';
import { createStageError, handleError } from '@/lib/app-errors';
import { runQualityGates } from '@/lib/qa';
import { logger } from '@/lib/logger';
import { createSuccessResponse } from '@/lib/error-utils';
import { handleNoApiKeyResult } from '@/lib/api-fallback';
import { formatFrameworkDescription } from '@/lib/framework-utils';
import { 
  handleSchemaValidation,
  handleQAValidation,
  validateObject,
  validateStringField,
  validateArrayField
} from '@/lib/service-utils';

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
      // 使用公共工具函数格式化框架描述
      const frameworkDescription = formatFrameworkDescription(
        payload.framework
      );

      // 构建 prompt
      const prompt = S2_PROMPTS.generateSystemDynamics({
        framework: payload.framework,
        frameworkDescription,
      });

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

        // Handle NO_API_KEY error with unified fallback
        const noApiKeyResponse = handleNoApiKeyResult(result, 's2');
        if (noApiKeyResponse) {
          return noApiKeyResponse;
        }

        throw createStageError.s2('Failed to generate system dynamics', {
          error: result.error,
          attempts: result.attempts,
        });
      }

      // Schema 验证
      const validationResult = SystemDynamicsSchema.safeParse(result.data);
      let dynamics = handleSchemaValidation(validationResult, 's2', result.data);

      // Mermaid 图表预检查
      const mermaidChart = dynamics.mermaidChart;
      if (
        typeof mermaidChart !== 'string' ||
        !mermaidChart.trim().startsWith('graph TD')
      ) {
        logger.error('Invalid Mermaid chart format');
        throw createStageError.s2('Mermaid图表格式不正确', {
          fixHints: ['图表必须以 "graph TD" 开头', '请检查生成的图表格式'],
          receivedData: mermaidChart,
        });
      }

      // 质量门控
      const qaResult = runQualityGates('S2', dynamics, {
        framework: payload.framework,
      });
      handleQAValidation(qaResult, 'S2');

      logger.info('S2 system dynamics generation successful');

      return createSuccessResponse(dynamics);
    } catch (error) {
      logger.error('S2Service.generateSystemDynamics error:', error);
      return handleError(error, 'S2');
    }
  }

  /**
   * 验证系统动力学格式
   * 使用通用验证辅助函数减少重复代码
   */
  private validateSystemDynamics(data: unknown): data is SystemDynamics {
    const obj = validateObject(data);
    if (!obj) return false;

    // 验证必需字段
    if (!validateStringField(obj, 'mermaidChart', { required: true, minLength: 1 })) {
      return false;
    }
    if (!validateStringField(obj, 'metaphor', { required: true, minLength: 1 })) {
      return false;
    }

    // 验证可选的 nodes 数组
    if (!validateArrayField(obj, 'nodes', { 
      required: false,
      elementValidator: (node) => {
        const n = validateObject(node);
        if (!n) return false;
        return (
          validateStringField(n, 'id', { required: true }) &&
          validateStringField(n, 'title', { required: true })
        );
      }
    })) {
      return false;
    }

    return true;
  }
}

