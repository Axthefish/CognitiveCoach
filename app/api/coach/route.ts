import { NextRequest, NextResponse } from 'next/server';
import { handleOptions, withCors } from '@/lib/cors';
import { logger } from '@/lib/logger';
import { serializeErrorDetailsSecurely } from '@/lib/app-errors';
import {
  extractRequestInfo,
  checkRequestRateLimit,
  validateRequestBody,
  logRequestCompletion,
} from '@/lib/api-middleware';

// 导入所有服务
import { S0Service } from '@/services/s0-service';
import { S1Service } from '@/services/s1-service';
import { S2Service } from '@/services/s2-service';
import { S3Service } from '@/services/s3-service';
import { S4Service } from '@/services/s4-service';

// 使用共享的API类型定义，消除重复
import type {
  CoachResponse,
  RefineGoalPayload,
  GenerateFrameworkPayload,
  GenerateSystemDynamicsPayload,
  GenerateActionPlanPayload,
  AnalyzeProgressPayload,
  ConsultPayload,
} from '@/lib/api-types';

// 主处理函数
export async function POST(request: NextRequest) {
  const startTime = Date.now(); // 记录请求开始时间
  
  const { origin, ip } = extractRequestInfo(request);
  
  // Rate limiting检查
  const rl = checkRequestRateLimit(ip, '/api/coach');
  if (!rl.allowed) {
    const res = NextResponse.json({ status: 'error', error: 'Too Many Requests' });
    res.headers.set('Retry-After', String(rl.retryAfter ?? 60));
    return withCors(res, origin);
  }
  
  // Schema验证
  const validation = await validateRequestBody(request);
  if (!validation.valid) {
    const res = NextResponse.json({ 
      status: 'error', 
      error: validation.error?.message || '请求验证失败',
      code: validation.error?.code,
      details: serializeErrorDetailsSecurely(validation.error?.issues),
    } as CoachResponse, { status: 400 });
    return withCors(res, origin);
  }
  
  const body = validation.request!;
  
  try {
    
    const { action, payload } = body;

    // 根据action调用对应的处理器
    let response: NextResponse;
    switch (action) {
      case 'refineGoal':
        response = await handleRefineGoal(payload as RefineGoalPayload);
        break;
      
      case 'generateFramework':
        response = await handleGenerateFramework(payload as GenerateFrameworkPayload);
        break;
      
      case 'generateSystemDynamics':
        response = await handleGenerateSystemDynamics(payload as GenerateSystemDynamicsPayload);
        break;
      
      case 'generateActionPlan':
        response = await handleGenerateActionPlan(payload as GenerateActionPlanPayload);
        break;
      
      case 'analyzeProgress':
        response = await handleAnalyzeProgress(payload as AnalyzeProgressPayload);
        break;
      
      case 'consult':
        response = await handleConsult(payload as ConsultPayload);
        break;
      
      default:
        response = NextResponse.json(
          { status: 'error', error: '不支持的操作类型，请联系技术支持' } as CoachResponse,
          { status: 400 }
        );
    }
    
    // 记录API请求完成
    logRequestCompletion(action, startTime, response.status, ip);
    
    return withCors(response, origin);
  } catch (error) {
    logger.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log detailed error in production
    if (process.env.NODE_ENV === 'production') {
      logger.error('Production error details:', { message: errorMessage, action: body?.action, hasApiKey: !!process.env.GEMINI_API_KEY });
    }
    
    return withCors(NextResponse.json(
      { 
        status: 'error', 
        error: errorMessage,
        details: serializeErrorDetailsSecurely(errorStack, true) // 强制隐藏堆栈信息
      } as CoachResponse,
      { status: 500 }
    ), origin);
  }
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// ============================================
// Action 处理器 - 使用服务层
// ============================================

// S0: 目标精炼
async function handleRefineGoal(payload: RefineGoalPayload) {
  const s0Service = S0Service.getInstance();
  return await s0Service.refineGoal(payload);
}



// S1: 知识框架生成
async function handleGenerateFramework(payload: GenerateFrameworkPayload) {
  const s1Service = S1Service.getInstance();
  return await s1Service.generateFramework(payload);
}

// S2: 系统动力学生成
async function handleGenerateSystemDynamics(payload: GenerateSystemDynamicsPayload) {
  const s2Service = S2Service.getInstance();
  return await s2Service.generateSystemDynamics(payload);
}

// S3: 行动计划生成
async function handleGenerateActionPlan(payload: GenerateActionPlanPayload) {
  const s3Service = S3Service.getInstance();
  return await s3Service.generateActionPlan(payload);
}

// S4: 进度分析
async function handleAnalyzeProgress(payload: AnalyzeProgressPayload) {
  const s4Service = S4Service.getInstance();
  return await s4Service.analyzeProgress(payload);
}

// S4: 咨询服务
async function handleConsult(payload: ConsultPayload) {
  const s4Service = S4Service.getInstance();
  return await s4Service.consult(payload);
}