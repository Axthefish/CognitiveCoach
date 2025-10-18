/**
 * Stage 5-6 Diagnostic API Route - 权重分析和诊断提问
 */

import { NextRequest, NextResponse } from 'next/server';
import { Stage56DiagnosticService } from '@/services/stage5-6-diagnostic-service';
import type { UniversalFramework, UserContextInfo } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';
import { z } from 'zod';

// ============================================
// 请求 Schema
// ============================================

const Stage56RequestSchema = z.object({
  action: z.enum(['analyze', 'collect']),
  
  // 通用框架（两种操作都需要）
  framework: z.object({
    purpose: z.string(),
    domain: z.string(),
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    weightingLogic: z.string(),
    mainPath: z.array(z.string()),
    generatedAt: z.number(),
  }),
  
  // 用户答案（collect 操作需要）
  userAnswers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
    answeredAt: z.number(),
  })).optional(),
});

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  logger.info('[Stage56 API] Received request');
  
  try {
    const body = await request.json();
    const validated = Stage56RequestSchema.parse(body);
    
    const service = Stage56DiagnosticService.getInstance();
    
    // 根据 action 分发处理
    switch (validated.action) {
      case 'analyze':
        // 分析权重并生成诊断问题
        return await service.analyzeWeights(
          validated.framework as UniversalFramework
        );
      
      case 'collect':
        // 收集用户答案
        if (!validated.userAnswers || validated.userAnswers.length === 0) {
          return NextResponse.json(
            { success: false, message: 'userAnswers is required for collect action' },
            { status: 400 }
          );
        }
        return await service.collectAnswers(
          validated.userAnswers as UserContextInfo[]
        );
      
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[Stage56 API] Validation error', { errors: error.issues });
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request format',
          errors: error.issues,
        },
        { status: 400 }
      );
    }
    
    return handleError(error, 'Stage56 API');
  }
}

// ============================================
// GET Handler
// ============================================

export async function GET() {
  return NextResponse.json({
    stage: 'stage5-6-diagnostic',
    status: 'healthy',
    description: 'Weight Analysis and Diagnostic Questioning',
  });
}

