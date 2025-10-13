/**
 * Stage 0 API Route - 目的澄清
 * 
 * 支持流式对话响应
 */

import { NextRequest, NextResponse } from 'next/server';
import { Stage0Service } from '@/services/stage0-service';
import type { ChatMessage, PurposeDefinition } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

// ============================================
// 请求 Schema
// ============================================

const Stage0RequestSchema = z.object({
  action: z.enum(['initial', 'continue', 'confirm']),
  
  // 初始请求
  userInput: z.string().optional(),
  
  // 继续对话
  conversationHistory: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.number(),
  })).optional(),
  
  currentDefinition: z.object({
    rawInput: z.string(),
    clarifiedPurpose: z.string(),
    problemDomain: z.string(),
    domainBoundary: z.string(),
    boundaryConstraints: z.array(z.string()),
    personalConstraints: z.array(z.string()),
    keyConstraints: z.array(z.string()),
    conversationHistory: z.array(z.any()),
    conversationInsights: z.string().optional(),
    confidence: z.number(),
    clarificationState: z.enum(['COLLECTING', 'REFINING', 'COMPLETED']).optional(),
  }).optional(),
  
  // 确认
  userConfirmed: z.boolean().optional(),
});

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  logger.info('[Stage0 API] Received request');
  
  try {
    // 检查速率限制
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const rateLimitResult = checkRateLimit(ip);
    if (!rateLimitResult.allowed) {
      logger.warn('[Stage0 API] Rate limit exceeded', { ip });
      return NextResponse.json(
        { 
          success: false, 
          message: '请求过于频繁，请稍后再试',
          retryAfter: rateLimitResult.retryAfter
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      );
    }
    
    // 解析请求体
    const body = await request.json();
    const validated = Stage0RequestSchema.parse(body);
    
    const service = Stage0Service.getInstance();
    
    // 根据 action 分发处理
    switch (validated.action) {
      case 'initial':
        if (!validated.userInput) {
          return NextResponse.json(
            { success: false, message: 'userInput is required for initial action' },
            { status: 400 }
          );
        }
        return await service.processInitialInput(validated.userInput);
      
      case 'continue':
        if (!validated.conversationHistory || !validated.currentDefinition) {
          return NextResponse.json(
            { success: false, message: 'conversationHistory and currentDefinition are required for continue action' },
            { status: 400 }
          );
        }
        return await service.processContinuation(
          validated.conversationHistory as ChatMessage[],
          validated.currentDefinition
        );
      
      case 'confirm':
        if (!validated.currentDefinition || validated.userConfirmed === undefined) {
          return NextResponse.json(
            { success: false, message: 'currentDefinition and userConfirmed are required for confirm action' },
            { status: 400 }
          );
        }
        return await service.completeStage0(
          validated.currentDefinition as PurposeDefinition,
          validated.userConfirmed
        );
      
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[Stage0 API] Validation error', { errors: error.issues });
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request format',
          errors: error.issues,
        },
        { status: 400 }
      );
    }
    
    return handleError(error, 'Stage0 API');
  }
}

// ============================================
// GET Handler (健康检查)
// ============================================

export async function GET() {
  return NextResponse.json({
    stage: 'stage0',
    status: 'healthy',
    description: 'Purpose Clarification & Problem Domain Framing',
  });
}

