// S1 阶段服务 - 知识框架生成

import { NextResponse } from 'next/server';
import { KnowledgeFrameworkSchema, type KnowledgeFramework } from '@/lib/schemas';
import type { GenerateFrameworkPayload } from '@/lib/api-types';
import { generateJsonWithRetry } from '@/lib/ai-retry-handler';
import { S1_PROMPTS } from '@/lib/prompts/s1-prompts';
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

export class S1Service {
  private static instance: S1Service;

  private constructor() {}

  static getInstance(): S1Service {
    if (!S1Service.instance) {
      S1Service.instance = new S1Service();
    }
    return S1Service.instance;
  }

  /**
   * 生成知识框架
   */
  async generateFramework(payload: GenerateFrameworkPayload): Promise<NextResponse> {
    logger.debug('S1Service.generateFramework called', {
      goalLength: payload.userGoal?.length || 0,
      runTier: payload.runTier,
    });

    try {
      // 构建 prompt
      const prompt = S1_PROMPTS.generateFramework({ userGoal: payload.userGoal });

      // 使用智能重试机制调用 AI
      const result = await generateJsonWithRetry<KnowledgeFramework>(
        prompt,
        this.validateFramework,
        {
          maxRetries: 3,
          onRetry: (attempt, error) => {
            logger.warn(`S1 retry attempt ${attempt}:`, { error, userGoal: payload.userGoal });
          },
        },
        payload.runTier,
        's1'
      );

      if (!result.ok) {
        logger.error('AI call failed:', {
          error: result.error,
          attempts: result.attempts,
        });

        // Handle NO_API_KEY error with unified fallback
        const noApiKeyResponse = handleNoApiKeyResult(result, 's1');
        if (noApiKeyResponse) {
          return noApiKeyResponse;
        }

        throw createStageError.s1('Failed to generate framework', {
          error: result.error,
          attempts: result.attempts,
          userGoal: payload.userGoal,
        });
      }

      // Schema 验证
      const validationResult = KnowledgeFrameworkSchema.safeParse(result.data);
      const framework = handleSchemaValidation(validationResult, 's1', result.data);

      // 质量门控
      const qaResult = runQualityGates('S1', framework);
      handleQAValidation(qaResult, 'S1');

      logger.info('S1 framework generation successful');

      return createSuccessResponse({ framework });
    } catch (error) {
      logger.error('S1Service.generateFramework error:', error);
      return handleError(error, 'S1');
    }
  }

  /**
   * 验证框架格式
   * 使用通用验证辅助函数减少重复代码
   */
  private validateFramework(data: unknown): data is KnowledgeFramework {
    if (!Array.isArray(data)) return false;
    if (data.length === 0) return false;

    // 验证每个节点
    return data.every((node) => {
      const n = validateObject(node);
      if (!n) return false;
      
      // 使用辅助函数验证必需字段
      return (
        validateStringField(n, 'id', { required: true, minLength: 1 }) &&
        validateStringField(n, 'title', { required: true, minLength: 1 }) &&
        validateStringField(n, 'summary', { required: true, minLength: 1 }) &&
        validateArrayField(n, 'children', { required: false })
      );
    });
  }
}

