/**
 * Stage 7 Personalization API Route - 个性化方案生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { Stage7PersonalizationService } from '@/services/stage7-personalization-service';
import type { UniversalFramework, HighLeveragePoint, UserContextInfo } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';
import { z } from 'zod';

// ============================================
// 请求 Schema
// ============================================

const Stage7RequestSchema = z.object({
  // 通用框架
  framework: z.object({
    purpose: z.string(),
    domain: z.string(),
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    weightingLogic: z.string(),
    mainPath: z.array(z.string()),
    generatedAt: z.number(),
  }),
  
  // 诊断点
  diagnosticPoints: z.array(z.object({
    id: z.string(),
    technicalName: z.string(),
    coachTitle: z.string(),
    coachExplanation: z.string(),
    question: z.string(),
    affectedNodeIds: z.array(z.string()),
    reasoning: z.string(),
  })),
  
  // 用户答案
  userAnswers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
    answeredAt: z.number(),
  })),
});

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  logger.info('[Stage7 API] Received request');
  
  try {
    const body = await request.json();
    const validated = Stage7RequestSchema.parse(body);
    
    const service = Stage7PersonalizationService.getInstance();
    
    return await service.generatePersonalizedFramework(
      validated.framework as UniversalFramework,
      validated.diagnosticPoints as HighLeveragePoint[],
      validated.userAnswers as UserContextInfo[]
    );
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[Stage7 API] Validation error', { errors: error.issues });
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request format',
          errors: error.issues,
        },
        { status: 400 }
      );
    }
    
    return handleError(error, 'Stage7 API');
  }
}

// ============================================
// GET Handler
// ============================================

export async function GET() {
  return NextResponse.json({
    stage: 'stage7-personalization',
    status: 'healthy',
    description: 'Personalized Action Framework Generation',
  });
}

