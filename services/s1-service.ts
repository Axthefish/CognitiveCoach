// S1 阶段服务 - 知识框架生成

import { NextResponse } from 'next/server';
import { KnowledgeFrameworkSchema, type KnowledgeFramework } from '@/lib/schemas';
import { generateJsonWithRetry } from '@/lib/ai-retry-handler';
import { S1_PROMPTS } from '@/lib/prompts/s1-prompts';
import { createStageError, handleError } from '@/lib/app-errors';
import { runQualityGates } from '@/lib/qa';
import { logger } from '@/lib/logger';
import { createErrorResponse, createSuccessResponse } from '@/lib/error-utils';

export interface GenerateFrameworkPayload {
  userGoal: string;
  decisionType?: 'explore' | 'compare' | 'troubleshoot' | 'plan';
  runTier?: 'Lite' | 'Pro' | 'Review';
  riskPreference?: 'low' | 'medium' | 'high';
  seed?: number;
}

export interface GenerateFrameworkResponse {
  framework: KnowledgeFramework;
}

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
      const config = S1_PROMPTS.getGenerationConfig(payload.runTier);

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

        throw createStageError.s1('Failed to generate framework', {
          error: result.error,
          attempts: result.attempts,
          userGoal: payload.userGoal,
        });
      }

      // Schema 验证
      const validationResult = KnowledgeFrameworkSchema.safeParse(result.data);
      if (!validationResult.success) {
        logger.error('Schema validation failed:', validationResult.error);
        throw createStageError.s1('Invalid framework format', {
          errors: validationResult.error.issues,
          receivedData: result.data,
        });
      }

      // 质量门控
      const qaResult = runQualityGates('S1', validationResult.data);
      if (!qaResult.passed) {
        logger.warn('Quality gates failed:', qaResult.issues);
        return createErrorResponse(
          'Quality gates failed',
          400,
          {
            fixHints: qaResult.issues.map((i) => i.hint),
            stage: 'S1',
            details: JSON.stringify(qaResult.issues),
          }
        );
      }

      logger.info('S1 framework generation successful');

      return createSuccessResponse({ framework: validationResult.data });
    } catch (error) {
      logger.error('S1Service.generateFramework error:', error);
      return handleError(error, 'S1');
    }
  }

  /**
   * 验证框架格式
   */
  private validateFramework(data: unknown): data is KnowledgeFramework {
    if (!Array.isArray(data)) return false;
    if (data.length === 0) return false;

    // 验证每个节点
    return data.every((node) => {
      if (!node || typeof node !== 'object') return false;
      const n = node as Record<string, unknown>;
      
      // 必须有 id, title, summary
      if (typeof n.id !== 'string' || !n.id) return false;
      if (typeof n.title !== 'string' || !n.title) return false;
      if (typeof n.summary !== 'string' || !n.summary) return false;

      // children 是可选的，但如果存在必须是数组
      if (n.children !== undefined && !Array.isArray(n.children)) return false;

      return true;
    });
  }
}

