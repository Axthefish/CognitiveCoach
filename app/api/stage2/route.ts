/**
 * Stage 2 API Route - 个性化方案生成
 * 
 * 支持动态信息收集和个性化方案生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { Stage2Service } from '@/services/stage2-service';
import type { UniversalFramework, UserContextInfo } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';
import { z } from 'zod';

// ============================================
// 请求 Schema
// ============================================

const Stage2RequestSchema = z.object({
  action: z.enum(['analyze', 'generate']),
  
  // 通用框架（两种操作都需要）
  framework: z.object({
    purpose: z.string(),
    domain: z.string(),
    nodes: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      weight: z.number(),
      estimatedTime: z.string(),
      nodeType: z.enum(['input', 'process', 'output', 'parallel']),
      color: z.enum(['DEEP_BLUE', 'BLUE', 'LIGHT_BLUE', 'GRAY']),
      dependencies: z.array(z.string()),
    })),
    edges: z.array(z.object({
      from: z.string(),
      to: z.string(),
      type: z.enum(['required', 'recommended', 'optional']),
      strength: z.number(),
    })),
    weightingLogic: z.string(),
    mainPath: z.array(z.string()),
    generatedAt: z.number(),
  }),
  
  // 收集的用户信息（generate 操作需要）
  collectedInfo: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
    answeredAt: z.number(),
  })).optional(),
});

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  logger.info('[Stage2 API] Received request');
  
  try {
    // 解析请求体
    const body = await request.json();
    const validated = Stage2RequestSchema.parse(body);
    
    const service = Stage2Service.getInstance();
    
    // 根据 action 分发处理
    switch (validated.action) {
      case 'analyze':
        // 分析缺失信息并生成问题
        return await service.analyzeMissingInfo(
          validated.framework as UniversalFramework
        );
      
      case 'generate':
        // 生成个性化方案
        if (!validated.collectedInfo || validated.collectedInfo.length === 0) {
          return NextResponse.json(
            { success: false, message: 'collectedInfo is required for generate action' },
            { status: 400 }
          );
        }
        return await service.generatePersonalizedPlan(
          validated.framework as UniversalFramework,
          validated.collectedInfo as UserContextInfo[]
        );
      
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[Stage2 API] Validation error', { errors: error.issues });
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request format',
          errors: error.issues,
        },
        { status: 400 }
      );
    }
    
    return handleError(error, 'Stage2 API');
  }
}

// ============================================
// GET Handler (健康检查)
// ============================================

export async function GET() {
  return NextResponse.json({
    stage: 'stage2',
    status: 'healthy',
    description: 'Personalized Plan Generation',
  });
}

