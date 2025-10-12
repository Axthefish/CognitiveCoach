/**
 * Stage 1 API Route - 框架生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { Stage1Service } from '@/services/stage1-service';
import type { PurposeDefinition } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';
import { z } from 'zod';

// ============================================
// 请求 Schema
// ============================================

const Stage1RequestSchema = z.object({
  purposeDefinition: z.object({
    rawInput: z.string(),
    clarifiedPurpose: z.string(),
    problemDomain: z.string(),
    domainBoundary: z.string(),
    keyConstraints: z.array(z.string()),
    confidence: z.number(),
  }),
  runTier: z.enum(['Lite', 'Pro']).optional(),
});

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  logger.info('[Stage1 API] Received request');
  
  try {
    const body = await request.json();
    const validated = Stage1RequestSchema.parse(body);
    
    const service = Stage1Service.getInstance();
    
    return await service.generateFramework(
      validated.purposeDefinition as PurposeDefinition,
      validated.runTier || 'Pro'
    );
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[Stage1 API] Validation error', { errors: error.issues });
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request format',
          errors: error.issues,
        },
        { status: 400 }
      );
    }
    
    return handleError(error, 'Stage1 API');
  }
}

// ============================================
// GET Handler
// ============================================

export async function GET() {
  return NextResponse.json({
    stage: 'stage1',
    status: 'healthy',
    description: 'Universal Framework Generation',
  });
}

