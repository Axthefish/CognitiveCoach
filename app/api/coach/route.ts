import { NextRequest, NextResponse } from 'next/server';
import { CoachRequestSchema, KnowledgeFramework, ActionPlan } from '@/lib/schemas';
import { handleOptions, withCors } from '@/lib/cors';
import { buildRateKey, checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { serializeErrorDetailsSecurely } from '@/lib/app-errors';

// 导入所有服务
import { S0Service } from '@/services/s0-service';
import { S1Service } from '@/services/s1-service';
import { S2Service } from '@/services/s2-service';
import { S3Service } from '@/services/s3-service';
import { S4Service } from '@/services/s4-service';

// API请求的action类型
type CoachAction = 
  | 'refineGoal'
  | 'generateFramework'
  | 'generateSystemDynamics'
  | 'generateActionPlan'
  | 'analyzeProgress'
  | 'consult';

// 请求体接口
type RefineGoalPayload = { userInput: string; conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }> };
type GenerateFrameworkPayload = { userGoal: string; decisionType?: 'explore' | 'compare' | 'troubleshoot' | 'plan'; runTier?: 'Lite'|'Pro'|'Review'; riskPreference?: 'low' | 'medium' | 'high'; seed?: number };
type GenerateSystemDynamicsPayload = { framework: KnowledgeFramework; decisionType?: 'explore' | 'compare' | 'troubleshoot' | 'plan'; runTier?: 'Lite'|'Pro'|'Review'; riskPreference?: 'low' | 'medium' | 'high'; seed?: number };
type GenerateActionPlanPayload = { userGoal: string; framework: KnowledgeFramework; systemNodes?: Array<{ id: string; title?: string }>; decisionType?: 'explore' | 'compare' | 'troubleshoot' | 'plan'; runTier?: 'Lite'|'Pro'|'Review'; riskPreference?: 'low' | 'medium' | 'high'; seed?: number };
type AnalyzeProgressPayload = { progressData: { completedTasks?: string[]; confidenceScore?: number; hoursSpent?: number; challenges?: string; }; userContext: { userGoal: string; actionPlan: ActionPlan; kpis: string[]; strategySpec?: { metrics?: Array<{ metricId: string; confidence?: number; evidence?: unknown[] }> } } };
type ConsultPayload = { question: string; userContext: { userGoal: string; knowledgeFramework: KnowledgeFramework; actionPlan: ActionPlan; systemDynamics?: { mermaidChart: string; metaphor: string } } };

type CoachPayload = RefineGoalPayload | GenerateFrameworkPayload | GenerateSystemDynamicsPayload | GenerateActionPlanPayload | AnalyzeProgressPayload | ConsultPayload;

interface CoachRequest {
  action: CoachAction;
  payload: CoachPayload;
}

// 响应体接口
interface CoachResponse {
  status: 'success' | 'error';
  data?: unknown;
  error?: string;
}

// 主处理函数
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const rateKey = buildRateKey(ip, '/api/coach');
  const rl = checkRateLimit(rateKey);
  if (!rl.allowed) {
    const res = NextResponse.json({ status: 'error', error: 'Too Many Requests' });
    res.headers.set('Retry-After', String(rl.retryAfter ?? 60));
    return withCors(res, origin);
  }
  let body: CoachRequest | undefined;
  
  try {
    const json = await request.json();
    
    // 记录请求（生产环境不包含敏感数据）
    logger.debug('Received request body:', { action: json?.action });
    
    const parsed = CoachRequestSchema.safeParse(json);
    if (!parsed.success) {
      // 记录验证失败
      logger.error('Schema validation failed:', {
        action: json?.action,
        errorCount: parsed.error.issues.length,
        firstError: parsed.error.issues[0]?.message
      });
      
      const validationDetails = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      const res = NextResponse.json({ 
        status: 'error', 
        error: '请求格式不正确，请检查您的输入并重试', 
        details: serializeErrorDetailsSecurely(validationDetails),
        receivedData: serializeErrorDetailsSecurely(json) // 安全处理接收到的数据
      } as CoachResponse, { status: 400 });
      return withCors(res, origin);
    }
    body = parsed.data as unknown as CoachRequest;
    
    const { action, payload } = body;

    // 根据action调用对应的处理器
    switch (action) {
      case 'refineGoal':
        return withCors(await handleRefineGoal(payload as RefineGoalPayload), origin);
      
      case 'generateFramework':
        return withCors(await handleGenerateFramework(payload as GenerateFrameworkPayload), origin);
      
      case 'generateSystemDynamics':
        return withCors(await handleGenerateSystemDynamics(payload as GenerateSystemDynamicsPayload), origin);
      
      case 'generateActionPlan':
        return withCors(await handleGenerateActionPlan(payload as GenerateActionPlanPayload), origin);
      
      case 'analyzeProgress':
        return withCors(await handleAnalyzeProgress(payload as AnalyzeProgressPayload), origin);
      
      case 'consult':
        return withCors(await handleConsult(payload as ConsultPayload), origin);
      
      default:
        return withCors(NextResponse.json(
          { status: 'error', error: '不支持的操作类型，请联系技术支持' } as CoachResponse,
          { status: 400 }
        ), origin);
    }
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