import { NextRequest } from 'next/server';
// Ensure this route is always dynamic and not cached by Next.js
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { handleOptions, buildCorsHeaders } from '@/lib/cors';
import { logger } from '@/lib/logger';
import { generateTraceId } from '@/lib/id-generator';
import { mapErrorToUserMessage } from '@/lib/error-utils';
import {
  extractRequestInfo,
  checkRequestRateLimit,
  validateRequestBody,
  createSSEHeaders,
} from '@/lib/api-middleware';

// 导入所有服务
import { S0Service } from '@/services/s0-service';
import { S1Service } from '@/services/s1-service';
import { S2Service } from '@/services/s2-service';
import { S3Service } from '@/services/s3-service';
import { S4Service } from '@/services/s4-service';

import {
  wrapServiceAsStream,
  getCognitiveSteps,
  getRandomTip,
  createSSEMessage,
} from '@/lib/streaming-wrapper';

// 使用共享的API类型定义
import type {
  RefineGoalPayload,
  GenerateFrameworkPayload,
  GenerateSystemDynamicsPayload,
  GenerateActionPlanPayload,
  AnalyzeProgressPayload,
  ConsultPayload,
} from '@/lib/api-types';

// 主处理函数
export async function POST(request: NextRequest) {
  const { origin, ip } = extractRequestInfo(request);
  
  // Rate limiting检查
  const rl = checkRequestRateLimit(ip, '/api/coach-stream');
  if (!rl.allowed) {
    const encoder = new TextEncoder();
    const errorStream = createSSEMessage('error', 'Too Many Requests');
    const corsHeaders = buildCorsHeaders(origin);
    return new Response(encoder.encode(errorStream), {
      headers: {
        ...createSSEHeaders(corsHeaders),
        'Retry-After': String(rl.retryAfter ?? 60),
      },
      status: 429,
    });
  }
  
  // Schema验证
  const validation = await validateRequestBody(request);
  if (!validation.valid) {
    const encoder = new TextEncoder();
    const errorStream = createSSEMessage('error', validation.error?.message || '请求验证失败');
    const corsHeaders = buildCorsHeaders(origin);
    return new Response(encoder.encode(errorStream), {
      headers: createSSEHeaders(corsHeaders),
      status: 400,
    });
  }
  
  const body = validation.request!;
  
  try {
    const { action, payload } = body;

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const streamState = { errorSent: false, doneSent: false, closed: false };
        
        const traceId = generateTraceId(); // 为整个请求生成唯一 traceId
        
        const sendErrorSafe = (
          code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN',
          message: string
        ) => {
          if (streamState.errorSent || streamState.closed) {
            logger.warn('Attempted to send duplicate error message', { code, message, traceId });
            return;
          }
          controller.enqueue(encoder.encode(createSSEMessage('error', { code, message, traceId })));
          streamState.errorSent = true;
        };
        
        const sendDoneSafe = () => {
          if (streamState.doneSent || streamState.closed || streamState.errorSent) {
            return;
          }
          controller.enqueue(encoder.encode(createSSEMessage('done', null)));
          streamState.doneSent = true;
        };
        
        try {
          // 根据action调用对应的处理器，传递 traceId
          switch (action) {
            case 'refineGoal':
              await handleRefineGoalStream(controller, encoder, payload as RefineGoalPayload, traceId);
              break;
            case 'generateFramework':
              await handleGenerateFrameworkStream(controller, encoder, payload as GenerateFrameworkPayload, traceId);
              break;
            case 'generateSystemDynamics':
              await handleGenerateSystemDynamicsStream(controller, encoder, payload as GenerateSystemDynamicsPayload, traceId);
              break;
            case 'generateActionPlan':
              await handleGenerateActionPlanStream(controller, encoder, payload as GenerateActionPlanPayload, traceId);
              break;
            case 'analyzeProgress':
              await handleAnalyzeProgressStream(controller, encoder, payload as AnalyzeProgressPayload, traceId);
              break;
            case 'consult':
              await handleConsultStream(controller, encoder, payload as ConsultPayload, traceId);
              break;
            default:
              sendErrorSafe('UNKNOWN', '不支持的操作类型，请联系技术支持');
              return;
          }
          
          sendDoneSafe();
        } catch (error) {
          logger.error('Streaming API Error:', { 
            traceId,
            error: error instanceof Error ? error.message : String(error) 
          });
          
          if (!streamState.errorSent) {
            const readableMessage = error instanceof Error ? error.message : 'Internal server error';
            const { code, message } = mapErrorToUserMessage(readableMessage);
            sendErrorSafe(code, message);
          }
        } finally {
          streamState.closed = true;
          controller.close();
        }
      },
    });

    const corsHeaders = buildCorsHeaders(origin);
    return new Response(stream, {
      headers: createSSEHeaders(corsHeaders),
    });
  } catch (error) {
    logger.error('API Error:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    const encoder = new TextEncoder();
    const readableMessage = error instanceof Error ? error.message : 'Internal server error';
    const { code, message } = mapErrorToUserMessage(readableMessage);
    
    const errorStream = createSSEMessage('error', { code, message });
    const corsHeaders = buildCorsHeaders(origin);
    return new Response(encoder.encode(errorStream), {
      headers: createSSEHeaders(corsHeaders),
      status: 500,
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// ============================================
// 流式处理器实现 - 使用 Service 层
// ============================================

/**
 * S0: 目标精炼流式处理
 * 
 * 注意：S0 使用自定义实现而不是 wrapServiceAsStream
 * 原因：S0 需要更细粒度的进度控制，响应时间相对较短（2-5秒）
 * 如果改用 wrapServiceAsStream，大部分时间会花在进度模拟上而不是实际处理
 * 
 * 如果将来 S0 的处理时间变长，可以考虑迁移到 wrapServiceAsStream
 */
async function handleRefineGoalStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: RefineGoalPayload,
  traceId: string
) {
  const steps = getCognitiveSteps('refineGoal');
  const tip = getRandomTip('refineGoal');
  
  logger.info('S0 streaming started', { traceId });
  
  // 发送初始步骤，包含 traceId
  controller.enqueue(encoder.encode(createSSEMessage('cognitive_step', { 
    steps: steps.map(s => ({ ...s, status: 'pending' })),
    tip,
    traceId
  })));

  try {
    // 步骤1：解析输入
    steps[0].status = 'in_progress';
    controller.enqueue(encoder.encode(createSSEMessage('cognitive_step', { steps })));
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // 步骤2：抽取意图
    steps[0].status = 'completed';
    steps[1].status = 'in_progress';
    controller.enqueue(encoder.encode(createSSEMessage('cognitive_step', { steps })));
    await new Promise(resolve => setTimeout(resolve, 800));

    // 步骤3：生成澄清
    steps[1].status = 'completed';
    steps[2].status = 'in_progress';
    controller.enqueue(encoder.encode(createSSEMessage('cognitive_step', { steps })));

    const s0Service = S0Service.getInstance();
    const result = await s0Service.refineGoal(payload);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 步骤4：验证可行性
    steps[2].status = 'completed';
    steps[3].status = 'in_progress';
    controller.enqueue(encoder.encode(createSSEMessage('cognitive_step', { steps })));
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // 所有步骤完成
    steps[3].status = 'completed';
    controller.enqueue(encoder.encode(createSSEMessage('cognitive_step', { steps })));

    // 发送结果数据
    const resultJson = await result.json();
    controller.enqueue(encoder.encode(createSSEMessage('data_structure', resultJson)));
    
    logger.info('S0 streaming completed', { traceId });
  } catch (error) {
    steps.forEach(s => s.status = 'error');
    controller.enqueue(encoder.encode(createSSEMessage('cognitive_step', { steps, traceId })));
    logger.error('S0 streaming error:', { traceId, error });
    throw error;
  }
}

/**
 * S1: 知识框架生成流式处理
 */
async function handleGenerateFrameworkStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: GenerateFrameworkPayload,
  traceId: string
) {
  try {
    const s1Service = S1Service.getInstance();
    
    await wrapServiceAsStream(
      controller,
      encoder,
      'generateFramework',
      async () => await s1Service.generateFramework({
        userGoal: payload.userGoal,
        decisionType: payload.decisionType,
        runTier: payload.runTier,
        riskPreference: payload.riskPreference,
        seed: payload.seed,
      }),
      traceId
    );
    
    logger.info('S1 streaming completed', { traceId });
  } catch (error) {
    logger.error('S1 streaming error:', { traceId, error });
    throw error;
  }
}

/**
 * S2: 系统动力学生成流式处理
 * 使用 Service 层而不是重新实现业务逻辑
 */
async function handleGenerateSystemDynamicsStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: GenerateSystemDynamicsPayload,
  traceId: string
) {
  try {
    const s2Service = S2Service.getInstance();
    
    await wrapServiceAsStream(
      controller,
      encoder,
      'generateSystemDynamics',
      async () => await s2Service.generateSystemDynamics(payload),
      traceId
    );
    
    logger.info('S2 streaming completed', { traceId });
  } catch (error) {
    logger.error('S2 streaming error:', { traceId, error });
    throw error;
  }
}

/**
 * S3: 行动计划生成流式处理
 * 使用 Service 层而不是重新实现业务逻辑
 */
async function handleGenerateActionPlanStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: GenerateActionPlanPayload,
  traceId: string
) {
  try {
    const s3Service = S3Service.getInstance();
    
    await wrapServiceAsStream(
      controller,
      encoder,
      'generateActionPlan',
      async () => await s3Service.generateActionPlan(payload),
      traceId
    );
    
    logger.info('S3 streaming completed', { traceId });
  } catch (error) {
    logger.error('S3 streaming error:', { traceId, error });
    throw error;
  }
}

/**
 * S4: 进度分析流式处理
 * 使用 Service 层而不是重新实现业务逻辑
 */
async function handleAnalyzeProgressStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: AnalyzeProgressPayload,
  traceId: string
) {
  try {
    const s4Service = S4Service.getInstance();
    
    await wrapServiceAsStream(
      controller,
      encoder,
      'analyzeProgress',
      async () => await s4Service.analyzeProgress(payload),
      traceId
    );
    
    logger.info('S4 streaming completed', { traceId });
  } catch (error) {
    logger.error('S4 streaming error:', { traceId, error });
    throw error;
  }
}

/**
 * S4: 咨询服务流式处理
 */
async function handleConsultStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: ConsultPayload,
  traceId: string
) {
  try {
    const s4Service = S4Service.getInstance();
    
    await wrapServiceAsStream(
      controller,
      encoder,
      'consult',
      async () => await s4Service.consult(payload),
      traceId
    );
    
    logger.info('S4 consult streaming completed', { traceId });
  } catch (error) {
    logger.error('S4 consult streaming error:', { traceId, error });
    throw error;
  }
}
