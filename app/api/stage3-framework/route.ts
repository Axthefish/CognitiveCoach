/**
 * Stage 3 Framework API Route - 通用框架生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { Stage3FrameworkService } from '@/services/stage3-framework-service';
import type { ClarifiedMission } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';
import { z } from 'zod';

// ============================================
// 请求 Schema
// ============================================

const Stage3RequestSchema = z.object({
  mission: z.object({
    rawInput: z.string(),
    missionStatement: z.string(),
    subject: z.string(),
    desiredOutcome: z.string(),
    context: z.string(),
    keyLevers: z.array(z.string()),
    conversationHistory: z.array(z.any()),
    confidence: z.number(),
    generatedAt: z.number(),
  }),
});

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  logger.info('[Stage3 API] Received request');
  
  try {
    const body = await request.json();
    const validated = Stage3RequestSchema.parse(body);
    
    const service = Stage3FrameworkService.getInstance();
    
    return await service.generateFramework(
      validated.mission as ClarifiedMission
    );
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[Stage3 API] Validation error', { errors: error.issues });
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request format',
          errors: error.issues,
        },
        { status: 400 }
      );
    }
    
    return handleError(error, 'Stage3 API');
  }
}

// ============================================
// GET Handler
// ============================================

export async function GET() {
  return NextResponse.json({
    stage: 'stage3-framework',
    status: 'healthy',
    description: 'Universal Framework Generation with 3D Visualization',
  });
}

