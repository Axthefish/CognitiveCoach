import { NextRequest } from 'next/server';
// Ensure this route is always dynamic and not cached by Next.js
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { CoachRequestSchema, StreamPayload } from '@/lib/schemas';
import { handleOptions, buildCorsHeaders } from '@/lib/cors';
import { buildRateKey, checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { KnowledgeFramework, ActionPlan, FrameworkNode } from '@/lib/types';
import { createGeminiClient, generateJson, generateText } from '@/lib/gemini-config';
import {
  KnowledgeFrameworkSchema,
  SystemDynamicsSchema,
  ActionPlanResponseSchema,
  AnalyzeProgressSchema,
} from '@/lib/schemas';
import { runQualityGates } from '@/lib/qa';
import { S0Service } from '@/services/s0-service';

// 流式消息类型定义
interface StreamMessage {
  type: 'cognitive_step' | 'content_chunk' | 'data_structure' | 'error' | 'done';
  payload: StreamPayload;
}

// 认知步骤状态
type CognitiveStepStatus = 'pending' | 'in_progress' | 'completed' | 'error';

interface CognitiveStep {
  id: string;
  message: string;
  status: CognitiveStepStatus;
  timestamp?: number;
}

// API请求的action类型
type CoachAction = 
  | 'refineGoal'
  | 'generateFramework'
  | 'generateSystemDynamics'
  | 'generateActionPlan'
  | 'analyzeProgress'
  | 'consult';

// 请求体接口（复制自原始路由）
type RefineGoalPayload = { userInput: string; conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }> };
type GenerateFrameworkPayload = { userGoal: string; decisionType?: string; runTier?: 'Lite'|'Pro'|'Review'; seed?: number };
type GenerateSystemDynamicsPayload = { framework: KnowledgeFramework; decisionType?: string; runTier?: 'Lite'|'Pro'|'Review'; seed?: number };
type GenerateActionPlanPayload = { userGoal: string; framework: KnowledgeFramework; systemNodes?: Array<{ id: string; title?: string }>; decisionType?: string; runTier?: 'Lite'|'Pro'|'Review'; seed?: number };
type AnalyzeProgressPayload = { progressData: { completedTasks?: string[]; confidenceScore?: number; hoursSpent?: number; challenges?: string; }; userContext: { userGoal: string; actionPlan: ActionPlan; kpis: string[]; strategySpec?: { metrics?: Array<{ metricId: string; confidence?: number; evidence?: unknown[] }> } } };
type ConsultPayload = { question: string; userContext: { userGoal: string; knowledgeFramework: KnowledgeFramework; actionPlan: ActionPlan; systemDynamics?: { mermaidChart: string; metaphor: string } } };

type CoachPayload = RefineGoalPayload | GenerateFrameworkPayload | GenerateSystemDynamicsPayload | GenerateActionPlanPayload | AnalyzeProgressPayload | ConsultPayload;

interface CoachRequest {
  action: CoachAction;
  payload: CoachPayload;
}

// 流式响应辅助函数 - 使用标准SSE格式
function createStreamMessage(type: StreamMessage['type'], payload: StreamMessage['payload']): string {
  return `data: ${JSON.stringify({ type, payload })}\n\n`;
}

// 预定义的认知步骤
const getCognitiveSteps = (action: CoachAction): CognitiveStep[] => {
  switch (action) {
    case 'generateFramework':
      return [
        { id: 'analyze-goal', message: '深入分析你的学习目标...', status: 'pending' },
        { id: 'brainstorm-concepts', message: '头脑风暴相关概念和领域...', status: 'pending' },
        { id: 'structure-hierarchy', message: '构建分层知识结构树...', status: 'pending' },
        { id: 'refine-categories', message: '优化类别和子主题的清晰度...', status: 'pending' }
      ];
    
    case 'generateSystemDynamics':
      return [
        { id: 'analyze-relationships', message: '分析知识点之间的关系...', status: 'pending' },
        { id: 'identify-sequence', message: '识别最优学习序列...', status: 'pending' },
        { id: 'craft-analogy', message: '制作生动的比喻来阐明系统...', status: 'pending' },
        { id: 'generate-diagram', message: '生成 Mermaid 可视化图表...', status: 'pending' }
      ];
    
    case 'generateActionPlan':
      return [
        { id: 'analyze-context', message: '分析学习背景和需求...', status: 'pending' },
        { id: 'design-progression', message: '设计渐进式学习路径...', status: 'pending' },
        { id: 'create-kpis', message: '制定关键绩效指标...', status: 'pending' },
        { id: 'optimize-plan', message: '优化行动计划的可执行性...', status: 'pending' }
      ];
    
    case 'analyzeProgress':
      return [
        { id: 'analyze-data', message: '分析学习进度数据...', status: 'pending' },
        { id: 'identify-patterns', message: '识别学习模式和趋势...', status: 'pending' },
        { id: 'assess-challenges', message: '评估挑战和瓶颈...', status: 'pending' },
        { id: 'generate-insights', message: '生成洞察和建议...', status: 'pending' }
      ];
    
    case 'refineGoal':
      return [
        { id: 'parse-input', message: '解析和理解你的目标描述...', status: 'pending' },
        { id: 'extract-intent', message: '抽取核心意图和关键要素...', status: 'pending' },
        { id: 'generate-clarification', message: '生成精准的目标表述...', status: 'pending' },
        { id: 'validate-feasibility', message: '评估目标的可行性和完整性...', status: 'pending' }
      ];
    
    default:
      return [
        { id: 'processing', message: '处理你的请求...', status: 'pending' },
        { id: 'analyzing', message: '分析输入内容...', status: 'pending' },
        { id: 'generating', message: '生成响应...', status: 'pending' }
      ];
  }
};

// 微学习提示
const getMicroLearningTips = (action: CoachAction): string[] => {
  const tips = {
    refineGoal: [
      "清晰的目标是成功的一半：SMART原则帮你把模糊想法变成具体方向。",
      "问对问题比找答案更重要：深入思考'为什么'能让目标更有意义。",
      "目标应该激发你的热情，而不是让你感到压力。"
    ],
    generateFramework: [
      "知识框架就像是学习的地图，它能帮助你看清全貌，避免迷失方向。",
      "分层学习法：先掌握核心概念，再深入细节，最后连接成网络。",
      "记住费曼技巧：如果你无法用简单的话解释一个概念，说明你还没有真正理解它。"
    ],
    generateSystemDynamics: [
      "系统思维：理解各部分如何相互作用，比单独学习每个部分更重要。",
      "学习路径的设计遵循认知负荷理论：逐步增加复杂度，避免信息过载。",
      "好的比喻能让抽象概念变得具体，大大提高学习效率和记忆效果。"
    ],
    generateActionPlan: [
      "SMART 目标原则：具体、可衡量、可达成、相关性强、有时限。",
      "习惯叠加法：将新习惯附加在已有习惯之后，更容易坚持。",
      "定期复盘和调整计划，灵活性是成功学习的关键。"
    ],
    analyzeProgress: [
      "反思是学习的加速器：定期思考什么有效、什么需要改进。",
      "庆祝小胜利：认可进步能维持学习动力，无论进步多么微小。",
      "遗忘曲线告诉我们：及时复习比延后复习效率高得多。"
    ],
    consult: [
      "提问是学习的催化剂：好的问题能开启新的思维路径。",
      "苏格拉底式对话：通过问答深入探索，比直接给答案更有价值。",
      "联系实际：将理论知识与个人经验连接，理解更深刻。"
    ]
  };
  
  return tips[action] || [
    "学习是一个持续的过程，保持耐心和好奇心是关键。",
    "每个人的学习节奏不同，找到适合自己的方法最重要。"
  ];
};

// 主处理函数
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const rateKey = buildRateKey(ip, '/api/coach-stream');
  const rl = checkRateLimit(rateKey);
  
  if (!rl.allowed) {
    const encoder = new TextEncoder();
    const errorStream = createStreamMessage('error', 'Too Many Requests');
    const corsHeaders = buildCorsHeaders(origin);
    return new Response(encoder.encode(errorStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Retry-After': String(rl.retryAfter ?? 60),
        ...corsHeaders,
      },
      status: 429,
    });
  }

  let body: CoachRequest | undefined;
  
  try {
    const json = await request.json();
    const parsed = CoachRequestSchema.safeParse(json);
    
    if (!parsed.success) {
      const encoder = new TextEncoder();
      const errorStream = createStreamMessage('error', '请求格式不正确，请检查您的输入并重试');
      const corsHeaders = buildCorsHeaders(origin);
      return new Response(encoder.encode(errorStream), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          ...corsHeaders,
        },
        status: 400,
      });
    }
    
    body = parsed.data as unknown as CoachRequest;
    const { action, payload } = body;

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        // 确保每个请求只发送一次错误
        const errorState = { sent: false };
        const sendErrorSafe = (
          code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN',
          message: string,
          traceId?: string
        ) => {
          if (errorState.sent) return;
          controller.enqueue(encoder.encode(createStreamMessage('error', { code, message, traceId })));
          errorState.sent = true;
        };
        
        try {
          // 根据action调用对应的处理器
          switch (action) {
            case 'refineGoal':
              await handleRefineGoalStream(controller, encoder, payload as RefineGoalPayload);
              break;
            case 'generateFramework':
              await handleGenerateFrameworkStream(controller, encoder, payload as GenerateFrameworkPayload, sendErrorSafe);
              break;
            case 'generateSystemDynamics':
              await handleGenerateSystemDynamicsStream(controller, encoder, payload as GenerateSystemDynamicsPayload, sendErrorSafe);
              break;
            case 'generateActionPlan':
              await handleGenerateActionPlanStream(controller, encoder, payload as GenerateActionPlanPayload, sendErrorSafe);
              break;
            case 'analyzeProgress':
              await handleAnalyzeProgressStream(controller, encoder, payload as AnalyzeProgressPayload, sendErrorSafe);
              break;
            case 'consult':
              await handleConsultStream(controller, encoder, payload as ConsultPayload);
              break;
            default:
              controller.enqueue(encoder.encode(createStreamMessage('error', '不支持的操作类型，请联系技术支持')));
          }
          
          // 发送完成消息
          controller.enqueue(encoder.encode(createStreamMessage('done', null)));
        } catch (error) {
          logger.error('Streaming API Error:', { 
            error: error instanceof Error ? error.message : String(error) 
          });
          const readableMessage = error instanceof Error ? error.message : 'Internal server error';
          
          // 💡 改进：判断错误类型并发送用户友好的错误消息
          let userFriendlyMessage = readableMessage;
          let errorCode: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN' = 'UNKNOWN';
          
          if (readableMessage.includes('network') || readableMessage.includes('connection') || readableMessage.includes('fetch')) {
            errorCode = 'NETWORK';
            userFriendlyMessage = '网络连接出现问题，请检查网络后重试';
          } else if (readableMessage.includes('timeout') || readableMessage.includes('TIMEOUT')) {
            errorCode = 'TIMEOUT';
            userFriendlyMessage = '处理时间过长，正在重新尝试...';
          } else if (readableMessage.includes('SCHEMA') || readableMessage.includes('schema')) {
            errorCode = 'SCHEMA';
            userFriendlyMessage = '内容格式验证失败，正在重新生成...';
          } else if (readableMessage.includes('QA') || readableMessage.includes('quality')) {
            errorCode = 'QA';
            userFriendlyMessage = '内容质量检查未通过，正在改进中...';
          } else {
            userFriendlyMessage = '处理过程中遇到问题，正在尝试恢复...';
          }
          
          sendErrorSafe(errorCode, userFriendlyMessage);
        } finally {
          controller.close();
        }
      },
    });

    const corsHeaders = buildCorsHeaders(origin);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...corsHeaders,
      },
    });
  } catch (error) {
    logger.error('API Error:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    const encoder = new TextEncoder();
    const readableMessage = error instanceof Error ? error.message : 'Internal server error';
    
    // 判断错误类型并发送结构化错误
    let errorCode: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN' = 'UNKNOWN';
    if (readableMessage.includes('network') || readableMessage.includes('connection')) {
      errorCode = 'NETWORK';
    } else if (readableMessage.includes('timeout')) {
      errorCode = 'TIMEOUT';
    }
    
    const errorStream = createStreamMessage('error', { code: errorCode, message: readableMessage });
    const corsHeaders = buildCorsHeaders(origin);
    return new Response(encoder.encode(errorStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...corsHeaders,
      },
      status: 500,
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// 流式处理器实现

async function handleRefineGoalStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: RefineGoalPayload
) {
  // S0 - Enhanced with detailed progress steps for better UX
  const steps = getCognitiveSteps('refineGoal');
  
  // 发送初始步骤
  controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
    steps: steps.map(s => ({ ...s, status: 'pending' }))
  })));

  try {
    // 步骤1：解析输入
    steps[0].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // 步骤2：抽取意图
    steps[0].status = 'completed';
    steps[1].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    await new Promise(resolve => setTimeout(resolve, 800));

    // 步骤3：生成澄清
    steps[1].status = 'completed';
    steps[2].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    const s0Service = S0Service.getInstance();
    const result = await s0Service.refineGoal(payload);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 步骤4：验证可行性
    steps[2].status = 'completed';
    steps[3].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // 所有步骤完成
    steps[3].status = 'completed';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // 发送结果数据
    const resultJson = await result.json();
    controller.enqueue(encoder.encode(createStreamMessage('data_structure', resultJson)));
    
  } catch (error) {
    steps.forEach(s => s.status = 'error');
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    throw error;
  }
}

async function handleGenerateFrameworkStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: GenerateFrameworkPayload,
  sendErrorSafe: (code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN', message: string, traceId?: string) => void
) {
  // 生成 traceId
  const traceId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  
  const steps = getCognitiveSteps('generateFramework');
  const tips = getMicroLearningTips('generateFramework');
  
  // 发送初始步骤和提示（附带traceId）
  controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
    steps: steps.map(s => ({ ...s, status: 'pending' })),
    tip: tips[Math.floor(Math.random() * tips.length)],
    traceId
  })));

  // 启动心跳机制
  const hb = setInterval(() => {
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
      steps, 
      tip: tips[Math.floor(Math.random() * tips.length)],
      traceId
    })));
  }, 9000);

  const genAI = createGeminiClient();
  if (!genAI) {
    sendErrorSafe('UNKNOWN', 'Gemini API key not configured', traceId);
    throw new Error('NO_API_KEY');
  }

  try {
    // 步骤1：分析目标
    steps[0].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    steps[0].status = 'completed';
    steps[1].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // 构建prompt
    const prompt = `作为一名专业的教育专家，请为以下学习目标创建一个结构化的知识框架：

目标：${payload.userGoal}

请生成一个分层的知识结构，包含2-3个主要类别，每个类别下有2-4个子项目。

请严格按照以下JSON格式返回（不要包含任何其他文字）：
[
  {
    "id": "唯一标识符",
    "title": "类别标题",
    "summary": "简短描述（20-40字）",
    "children": [
      {
        "id": "子项唯一标识符",
        "title": "子项标题",
        "summary": "子项描述（20-40字）"
      }
    ],
    "evidence": [],
    "confidence": 0.6,
    "applicability": ""
  }
]

确保：
1. id使用英文和数字的组合（如 "fundamental-concepts-1"）
2. title简洁明了
3. summary提供有价值的描述
4. 内容与学习目标高度相关`;

    // 步骤2：头脑风暴概念
    await new Promise(resolve => setTimeout(resolve, 800));
    steps[1].status = 'completed';
    steps[2].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // 调用AI - T3: 默认使用 Lite 档位
    let g = await generateJson<KnowledgeFramework>(prompt, { 
      maxOutputTokens: 65536,
      temperature: 0.8
    }, 'Lite');

    // 检查是否超时，如果是则降级重试
    if (!g.ok && g.error === 'TIMEOUT') {
      // 推送降级重试状态
      steps[2].status = 'in_progress';
      steps[2].message = '模型响应超时，正在降级重试…';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      
      // 降级重试
      g = await generateJson<KnowledgeFramework>(prompt, { 
        maxOutputTokens: 65536,
        temperature: 0.4
      }, 'Lite');
      
      if (!g.ok && g.error === 'TIMEOUT') {
        sendErrorSafe('TIMEOUT', '生成超时，请稍后重试');
        throw new Error('TIMEOUT');
      }
    }

    // 步骤3：构建结构
    await new Promise(resolve => setTimeout(resolve, 800));
    steps[2].status = 'completed';
    steps[3].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    if (!g.ok) {
      steps[3].status = 'error';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      throw new Error('AI响应解析失败');
    }

    let framework = g.data;
    const s1 = KnowledgeFrameworkSchema.safeParse(framework);
    
    if (!s1.success) {
      steps[3].status = 'error';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      sendErrorSafe('SCHEMA', 'Schema validation failed for S1 output', traceId);
      throw new Error('SCHEMA');
    }

    // QA gate
    const qa = runQualityGates('S1', framework);
    if (!qa.passed) {
      // T3: QA failed - Pro 复算
      steps[3].status = 'in_progress';
      steps[3].message = 'QA检查未通过，正在使用 Pro 档位复算...';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      
      // Pro 复算
      const gPro = await generateJson<KnowledgeFramework>(prompt, { 
        maxOutputTokens: 65536,
        temperature: 0.4
      }, 'Pro');
      
      if (!gPro.ok) {
        steps[3].status = 'error';
        controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        sendErrorSafe('QA', 'Pro复算后仍无法通过质量检查');
        throw new Error('QA');
      }
      
      const frameworkPro = gPro.data;
      const s1Pro = KnowledgeFrameworkSchema.safeParse(frameworkPro);
      
      if (!s1Pro.success) {
        steps[3].status = 'error';
        controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        sendErrorSafe('SCHEMA', 'Pro复算后Schema验证仍失败', traceId);
        throw new Error('SCHEMA');
      }
      
      // 使用Pro结果更新framework
      const qaPro = runQualityGates('S1', frameworkPro);
      if (!qaPro.passed) {
        steps[3].status = 'error';
        controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        sendErrorSafe('QA', 'Pro复算后仍无法通过质量检查');
        throw new Error('QA');
      }
      
      // 更新为Pro结果
      framework = frameworkPro;
    }

    // 步骤4：优化完成
    await new Promise(resolve => setTimeout(resolve, 500));
    steps[3].status = 'completed';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // T8: 记录可观测性信息
    logger.info('S1 Generation completed', {
      traceId,
      tier_used: qa.passed ? 'Lite' : 'Pro',
      qa_passed: qa.passed,
      auto_repair_applied: !qa.passed
    });

    // 发送最终结果
    controller.enqueue(encoder.encode(createStreamMessage('data_structure', {
      status: 'success',
      data: { framework },
      traceId
    })));
    
  } catch (error) {
    steps.forEach(s => { if (s.status === 'in_progress') s.status = 'error'; });
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    throw error;
  } finally {
    clearInterval(hb);
  }
}

async function handleGenerateSystemDynamicsStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: GenerateSystemDynamicsPayload,
  sendErrorSafe: (code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN', message: string, traceId?: string) => void
) {
  // 生成 traceId
  const traceId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  
  const steps = getCognitiveSteps('generateSystemDynamics');
  const tips = getMicroLearningTips('generateSystemDynamics');
  
  controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
    steps: steps.map(s => ({ ...s, status: 'pending' })),
    tip: tips[Math.floor(Math.random() * tips.length)],
    traceId
  })));

  // 启动心跳机制
  const hb = setInterval(() => {
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
      steps, 
      tip: tips[Math.floor(Math.random() * tips.length)],
      traceId
    })));
  }, 9000);

  const genAI = createGeminiClient();
  if (!genAI) {
    sendErrorSafe('UNKNOWN', 'Gemini API key not configured');
    throw new Error('NO_API_KEY');
  }

  try {
    // 逐步处理
    steps[0].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    
    const frameworkDescription = payload.framework.map(node => {
      const childrenDesc = node.children?.map(child => `  - ${child.title}: ${child.summary}`).join('\n') || '';
      return `${node.title}: ${node.summary}\n${childrenDesc}`;
    }).join('\n\n');
    
    await new Promise(resolve => setTimeout(resolve, 1200));
    steps[0].status = 'completed';
    steps[1].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // Extract all S1 framework IDs for coverage requirement
    const extractFrameworkIds = (framework: KnowledgeFramework | FrameworkNode): string[] => {
      const ids: string[] = [];
      const walk = (node: FrameworkNode) => {
        if (!node || typeof node !== 'object') return;
        if (typeof node.id === 'string') ids.push(node.id);
        if (Array.isArray(node.children)) node.children.forEach(walk);
      };
      if (Array.isArray(framework)) framework.forEach(walk);
      else walk(framework);
      return ids;
    };
    
    const s1Ids = extractFrameworkIds(payload.framework);
    const s1IdsExample = s1Ids.slice(0, 2).map(id => `    { "id": "${id}", "title": "<中文名称或与 S1 同步>" }`).join(',\n');

    const prompt = `基于以下知识框架，创建一个系统动力学图表和一个生动的比喻，并补充“主路径/关键回路/节点类比”：

知识框架：
${frameworkDescription}

请完成关键任务：

1. 创建一个Mermaid流程图，展示这些知识点之间的关系和学习流程。
2. 创建一个生动形象的比喻（全局类比）。
3. **MUST包含nodes数组**：必须包含所有S1框架中的ID，不能遗漏任何一个。
4. 提取 mainPath（S1的id顺序）、loops（Top3，含id/title/nodes/summary≤20字）、nodeAnalogies（nodeId/1句类比/1句日常示例）。

**CRITICAL REQUIREMENT**: nodes数组必须完全覆盖所有S1框架ID。
- ID集合必须完全等同于S1框架的id集合（原样使用，不要标准化）
- 不允许额外的ID
- 如果S1某个id没有清晰的标签，请复用其id作为title

请严格按照以下JSON格式返回（不要包含任何其他文字）：
{
  "mermaidChart": "以 graph TD 开头的 Mermaid 图，不要添加 <br/>",
  "metaphor": "一个生动的比喻（50-100字）",
  "nodes": [
${s1IdsExample}
  ],
  "mainPath": ["<id1>", "<id2>"],
  "loops": [ { "id": "loop-1", "title": "<中文>", "nodes": ["<idA>","<idB>"], "summary": "<≤20字>" } ],
  "nodeAnalogies": [ { "nodeId": "<id>", "analogy": "<1句类比>", "example": "<1句日常示例>" } ],
  "evidence": [],
  "confidence": 0.6,
  "applicability": ""
}

Mermaid图表要求：
- 使用graph TD（从上到下）
- 节点使用中文标签
- 展示学习路径和知识点之间的关系
- 包含反馈循环或进阶路径

比喻要求：
- 使用日常生活中的事物
- 能够形象地说明学习过程
- 与知识框架内容相关

请只返回JSON格式内容。`;

    await new Promise(resolve => setTimeout(resolve, 1000));
    steps[1].status = 'completed';
    steps[2].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // T3: 默认使用 Lite 档位
    let g = await generateJson<{ mermaidChart: string; metaphor: string; nodes?: Array<{ id: string; title: string }> }>(
      prompt,
      { maxOutputTokens: 65536, temperature: 0.5 },
      'Lite'
    );

    // 检查是否超时，如果是则降级重试
    if (!g.ok && g.error === 'TIMEOUT') {
      // 推送降级重试状态
      steps[2].status = 'in_progress';
      steps[2].message = '模型响应超时，正在降级重试…';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      
      // 降级重试
      g = await generateJson<{ mermaidChart: string; metaphor: string; nodes?: Array<{ id: string; title: string }> }>(
        prompt,
        { maxOutputTokens: 65536, temperature: 0.4 },
        'Lite'
      );
      
      if (!g.ok && g.error === 'TIMEOUT') {
        sendErrorSafe('TIMEOUT', '生成超时，请稍后重试');
        throw new Error('TIMEOUT');
      }
    }

    await new Promise(resolve => setTimeout(resolve, 800));
    steps[2].status = 'completed';
    steps[3].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    if (!g.ok) {
      steps[3].status = 'error';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      throw new Error('AI响应解析失败，请重试');
    }

    const dynamics = g.data;
    const s2 = SystemDynamicsSchema.safeParse(dynamics);
    if (!s2.success) {
      steps[3].status = 'error';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        sendErrorSafe('SCHEMA', 'Schema validation failed for S2 output', traceId);
      throw new Error('SCHEMA');
    }

    // Mermaid precheck and QA
    if (typeof dynamics.mermaidChart !== 'string' || !dynamics.mermaidChart.trim().startsWith('graph TD')) {
      steps[3].status = 'error';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        sendErrorSafe('SCHEMA', 'Invalid Mermaid chart: must start with "graph TD"', traceId);
      throw new Error('SCHEMA');
    }

    // Helper function to extract nodes from framework
    function extractNodesFromFramework(fw: KnowledgeFramework): Array<{ id: string; title: string }> {
      const out: Array<{ id: string; title: string }> = [];
      const walk = (n: FrameworkNode) => {
        if (!n || typeof n !== 'object') return;
        if (typeof n.id === 'string') out.push({ id: n.id, title: typeof n.title === 'string' ? n.title : n.id });
        if (Array.isArray(n.children)) n.children.forEach(walk);
      };
      fw.forEach(walk);
      return out;
    }

    const qa = runQualityGates('S2', dynamics, { framework: payload.framework });
    if (!qa.passed) {
      // Check if any issue is a schema blocker
      const schemaBlockers = qa.issues.filter(i => i.severity === 'blocker' && i.area === 'schema');
      
      if (schemaBlockers.length > 0) {
        // Keep current behavior for schema errors
        steps[3].status = 'error';
        controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        sendErrorSafe('SCHEMA', 'Schema validation failed', traceId);
        throw new Error('SCHEMA');
      }
      
      // Non-schema blockers or only warnings - apply auto-repair
      logger.info('S2 QA failed but non-schema, applying auto-repair', { 
        traceId,
        issueCount: qa.issues.length,
        blockerCount: qa.issues.filter(i => i.severity === 'blocker').length
      });
      
      // Derive nodes from S1 framework
      const frameworkNodes = extractNodesFromFramework(payload.framework);
      
      // Ensure dynamics.nodes exists and merge
      if (!dynamics.nodes || !Array.isArray(dynamics.nodes)) {
        dynamics.nodes = [];
      }
      
      // Create a union by id (prefer model-provided title, fallback to framework title)
      const nodeMap = new Map<string, { id: string; title: string }>();
      
      // First add framework nodes (fallback)
      frameworkNodes.forEach(node => {
        nodeMap.set(node.id, node);
      });
      
      // Then add model-provided nodes (preferred)
      dynamics.nodes.forEach(node => {
        if (node.id && node.title) {
          nodeMap.set(node.id, { id: node.id, title: node.title });
        }
      });
      
      // Update dynamics with merged nodes
      dynamics.nodes = Array.from(nodeMap.values());
      
      // Send informative message
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', {
        steps: steps.map(s => ({ ...s, status: s.status })),
        message: 'Quality gates warnings found, applying safe fallback to ensure continuity.'
      })));
      
      logger.info('S2 auto-repair completed', {
        traceId,
        derivedNodesCount: frameworkNodes.length,
        finalNodesCount: dynamics.nodes.length,
        missingResolved: frameworkNodes.length - (dynamics.nodes?.length || 0)
      });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    steps[3].status = 'completed';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // Prepare final response with warning flags if auto-repair was applied
    const finalResponse = {
      status: 'success' as const,
      data: {
        ...dynamics,
        ...(qa.passed ? {} : {
          requiresHumanReview: true,
          qaIssues: qa.issues
        })
      }
    };

    // T8: 记录S2可观测性信息  
    logger.info('S2 Generation completed', {
      traceId,
      tier_used: 'Lite',
      qa_passed: qa.passed,
      auto_repair_applied: !qa.passed
    });

    controller.enqueue(encoder.encode(createStreamMessage('data_structure', { 
      ...finalResponse, 
      traceId 
    })));
    
  } catch (error) {
    steps.forEach(s => { if (s.status === 'in_progress') s.status = 'error'; });
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    throw error;
  } finally {
    clearInterval(hb);
  }
}

async function handleGenerateActionPlanStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: GenerateActionPlanPayload,
  sendErrorSafe: (code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN', message: string, traceId?: string) => void
) {
  // 生成 traceId
  const traceId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  
  const steps = getCognitiveSteps('generateActionPlan');
  const tips = getMicroLearningTips('generateActionPlan');
  
  controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
    steps: steps.map(s => ({ ...s, status: 'pending' })),
    tip: tips[Math.floor(Math.random() * tips.length)],
    traceId
  })));

  // 启动心跳机制
  const hb = setInterval(() => {
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
      steps, 
      tip: tips[Math.floor(Math.random() * tips.length)],
      traceId
    })));
  }, 9000);

  const genAI = createGeminiClient();
  
  if (!genAI) {
    // 模拟处理
    for (let i = 0; i < steps.length; i++) {
      steps[i].status = 'in_progress';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      steps[i].status = 'completed';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    }

    const mockActionPlan: ActionPlan = [
      {
        id: 'action-1',
        text: '完成基础概念学习：阅读推荐资料，做笔记总结',
        isCompleted: false
      },
      {
        id: 'action-2',
        text: '搭建开发环境：安装必要工具和配置',
        isCompleted: false
      }
    ];
    
    const mockKPIs = [
      '每周学习时间（小时）',
      '完成的练习项目数'
    ];
    
    controller.enqueue(encoder.encode(createStreamMessage('data_structure', {
      status: 'success',
      data: {
        actionPlan: mockActionPlan,
        kpis: mockKPIs
      }
    })));
    return;
  }

  try {
    // 渐进式处理步骤
    steps[0].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    
    const frameworkDescription = payload.framework.map(node => {
      const childrenDesc = node.children?.map(child => `  - ${child.title}: ${child.summary}`).join('\n') || '';
      return `${node.title}: ${node.summary}\n${childrenDesc}`;
    }).join('\n\n');
    
    await new Promise(resolve => setTimeout(resolve, 1200));
    steps[0].status = 'completed';
    steps[1].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    const prompt = `作为一名专业的学习规划专家，基于以下学习目标和知识框架，为学习者创建一个个性化的行动计划。

学习目标：${payload.userGoal}

知识框架：
${frameworkDescription}

请完成两个任务：

1. 创建一个具体、可执行的行动计划（5-8个步骤）
2. 设计3-5个关键绩效指标（KPIs）来跟踪学习进度

要求：
- 行动计划应该循序渐进，从基础到高级
- 每个步骤都应该具体且可执行
- 步骤应该与知识框架紧密相关
- 使用第一人称（"我"）来描述行动步骤
- KPIs应该可量化或可评估

请严格按照以下JSON格式返回（不要包含任何其他文字）：
{
  "actionPlan": [
    {
      "id": "step-1",
      "text": "具体的行动步骤描述",
      "isCompleted": false
    }
  ],
  "kpis": [
    "KPI描述1",
    "KPI描述2"
  ]
}

注意：为了确保生成成功，请只返回 actionPlan 和 kpis 两个字段。
如果需要高级策略配置，系统会在后续步骤中单独处理。

确保：
1. id使用 "step-1", "step-2" 等格式
2. text是具体的行动描述（20-50字）
3. 所有isCompleted都设为false
4. KPIs简洁明了（10-20字）`;

    await new Promise(resolve => setTimeout(resolve, 1000));
    steps[1].status = 'completed';
    steps[2].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // T3: 先用 Lite 生成 1 个方案
    const variants = [] as Array<{ text: string; qaScore: number; issues: string[] }>;
    const n = 1; // 固定为1，如需要会在后续添加Pro方案
    
    for (let i = 0; i < n; i++) {
      const r = await generateJson<Record<string, unknown>>(prompt, { 
        maxOutputTokens: 65536, 
        temperature: 0.5 
      }, 'Lite');
      
      if (!r.ok && r.error === 'TIMEOUT') {
        // 推送降级重试状态
        steps[2].status = 'in_progress';
        steps[2].message = '模型响应超时，正在降级重试…';
        controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        
        // 降级重试
        const retryR = await generateJson<Record<string, unknown>>(prompt, { 
          maxOutputTokens: 65536, 
          temperature: 0.4 
        }, 'Lite');
        
        if (!retryR.ok && retryR.error === 'TIMEOUT') {
          sendErrorSafe('TIMEOUT', '生成超时，请稍后重试');
          throw new Error('TIMEOUT');
        }
        
        const text = retryR.ok ? JSON.stringify(retryR.data) : '';
        variants.push({ text, qaScore: 0, issues: [] });
        break; // 降级重试成功后退出循环
      } else {
        const text = r.ok ? JSON.stringify(r.data) : '';
        variants.push({ text, qaScore: 0, issues: [] });
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    steps[2].status = 'completed';
    steps[3].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // Evaluate variants
    let best: unknown | null = null;
    let bestIssuesCount = Number.POSITIVE_INFINITY;
    for (const v of variants) {
      try {
        const planData = JSON.parse(v.text);
        const s3 = ActionPlanResponseSchema.safeParse(planData);
        if (!s3.success) {
          v.issues = ['schema'];
          continue;
        }
        const qa = runQualityGates('S3', planData, { nodes: (payload.systemNodes || []).map(n => ({ id: n.id })) });
        v.issues = qa.issues.map(issue => issue.hint || 'Quality issue');
        if (qa.passed) {
          const issueCount = qa.issues.length;
          if (issueCount < bestIssuesCount) {
            best = planData;
            bestIssuesCount = issueCount;
          }
        }
      } catch (parseError) {
        logger.error('JSON parsing failed during action plan generation:', parseError);
        v.issues = ['parse'];
      }
    }

    // T3: 如果Lite没有找到合适的方案，尝试Pro复算
    if (!best) {
      steps[3].status = 'in_progress';
      steps[3].message = 'Lite方案质量不足，正在使用 Pro 档位生成对照方案...';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      
      // 用Pro生成一个对照方案
      const rPro = await generateJson<Record<string, unknown>>(prompt, { 
        maxOutputTokens: 65536, 
        temperature: 0.8 
      }, 'Pro');
      
      if (rPro.ok) {
        const textPro = JSON.stringify(rPro.data);
        variants.push({ text: textPro, qaScore: 0, issues: [] });
        
        // 重新评估包括Pro方案的所有变体
        for (const v of variants) {
          try {
            const planData = JSON.parse(v.text);
            const s3 = ActionPlanResponseSchema.safeParse(planData);
            if (!s3.success) {
              v.issues = ['schema'];
              continue;
            }
            const qa = runQualityGates('S3', planData, { nodes: (payload.systemNodes || []).map(n => ({ id: n.id })) });
            v.issues = qa.issues.map(issue => issue.hint || 'Quality issue');
            if (qa.passed) {
              const issueCount = qa.issues.length;
              if (!best || issueCount < bestIssuesCount) {
                best = planData;
                bestIssuesCount = issueCount;
              }
            }
          } catch (parseError) {
            logger.error('JSON parsing failed during Pro recalc:', parseError);
            v.issues = ['parse'];
          }
        }
      }
    }

    if (best) {
      await new Promise(resolve => setTimeout(resolve, 500));
      steps[3].status = 'completed';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

      const povTags = ['maximize_gain', 'minimize_risk'];
      const requiresHumanReview = Array.isArray((best as { strategySpec?: { metrics?: Array<{ confidence?: number; evidence?: unknown[] }> } }).strategySpec?.metrics)
        && ((((best as { strategySpec?: { metrics?: Array<{ confidence?: number; evidence?: unknown[] }> } }).strategySpec)?.metrics) || [])
          .some((m) => ((m.confidence ?? 1) < 0.4) || !m.evidence || ((m.evidence as unknown[])?.length ?? 0) === 0);
      const telemetry = { n_best_count: variants.length };
      
      // T8: 记录S3可观测性信息
      logger.info('S3 Generation completed', {
        traceId,
        tier_used: variants.length > 1 ? 'Lite+Pro' : 'Lite',
        qa_passed: true,
        auto_repair_applied: false,
        n_best_count: variants.length
      });

      controller.enqueue(encoder.encode(createStreamMessage('data_structure', {
        status: 'success', 
        data: { ...(best as object), povTags, requiresHumanReview, telemetry },
        traceId
      })));
      return;
    }

    // Final attempt with lower temperature using Lite first
    const retryR = await generateJson<Record<string, unknown>>(prompt, { 
      temperature: 0.4, topK: 40, topP: 0.9, maxOutputTokens: 65536 
    }, 'Lite');
    const retryText = retryR.ok ? JSON.stringify(retryR.data) : '';
    
    const planData = JSON.parse(retryText);
    const enrichedPlanData = {
      ...planData,
      strategySpec: planData.strategySpec || null,
      missingEvidenceTop3: planData.missingEvidenceTop3 || [],
      reviewWindow: planData.reviewWindow || "P14D",
      evidence: planData.evidence || [],
      confidence: planData.confidence || 0.6,
      applicability: planData.applicability || ""
    };
    
    const s3 = ActionPlanResponseSchema.safeParse(enrichedPlanData);
    if (!s3.success) {
      sendErrorSafe('SCHEMA', 'Schema validation failed for S3 output', traceId);
      throw new Error('SCHEMA');
    }
    
    const qa = runQualityGates('S3', planData, { nodes: (payload.systemNodes || []).map(n => ({ id: n.id })) });
    if (!qa.passed) {
      sendErrorSafe('QA', 'Quality gates failed', traceId);
      throw new Error('QA');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    steps[3].status = 'completed';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    const povTags = ['maximize_gain', 'minimize_risk'];
    const requiresHumanReview = Array.isArray(planData.strategySpec?.metrics)
      && ((planData.strategySpec?.metrics) || [])
        .some((m: { confidence?: number; evidence?: unknown[] }) => ((m.confidence ?? 1) < 0.4) || !m.evidence || ((m.evidence as unknown[])?.length ?? 0) === 0);
    const telemetry = { n_best_count: 1, retry: true };
    
    // T8: 记录S3 fallback可观测性信息
    logger.info('S3 Fallback Generation completed', {
      traceId,
      tier_used: 'Lite',
      qa_passed: true,
      auto_repair_applied: false,
      retry: true
    });

    controller.enqueue(encoder.encode(createStreamMessage('data_structure', {
      status: 'success', 
      data: { ...planData, povTags, requiresHumanReview, telemetry },
      traceId
    })));
    
  } catch (error) {
    steps.forEach(s => { if (s.status === 'in_progress') s.status = 'error'; });
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    throw error;
  } finally {
    clearInterval(hb);
  }
}

async function handleAnalyzeProgressStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: AnalyzeProgressPayload,
  sendErrorSafe: (code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN', message: string, traceId?: string) => void
) {
  // 生成 traceId
  const traceId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  
  const steps = getCognitiveSteps('analyzeProgress');
  const tips = getMicroLearningTips('analyzeProgress');
  
  controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
    steps: steps.map(s => ({ ...s, status: 'pending' })),
    tip: tips[Math.floor(Math.random() * tips.length)],
    traceId
  })));

  // 启动心跳机制
  const hb = setInterval(() => {
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
      steps, 
      tip: tips[Math.floor(Math.random() * tips.length)],
      traceId
    })));
  }, 9000);

  const genAI = createGeminiClient();
  
  if (!genAI) {
    // 模拟处理
    for (let i = 0; i < steps.length; i++) {
      steps[i].status = 'in_progress';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 800));
      steps[i].status = 'completed';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    }

    const analysis = '基于您的数据，您在理论学习方面进展良好，但实践应用还需要加强。建议增加动手练习的时间。';
    
    controller.enqueue(encoder.encode(createStreamMessage('data_structure', {
      status: 'success',
      data: {
        analysis,
        suggestions: ['增加实践时间', '寻找实际项目机会', '与他人交流学习经验']
      }
    })));
    return;
  }

  try {
    // 逐步分析
    steps[0].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    
    const completedTasksCount = payload.progressData.completedTasks?.length || 0;
    const totalTasksCount = payload.userContext.actionPlan?.length || 0;
    const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    steps[0].status = 'completed';
    steps[1].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    const prompt = `作为一名专业的学习教练，基于以下学习进度数据，提供深入的分析和建议。请尽量引用 S3 的策略指标（metrics.metricId）与复评指标（recovery.reviewMetricIds）进行参考。

学习目标：${payload.userContext.userGoal}

进度数据：
- 任务完成率：${completionRate}% (${completedTasksCount}/${totalTasksCount})
- 自评信心分数：${payload.progressData.confidenceScore || '未提供'}/10
- 已投入时间：${payload.progressData.hoursSpent || '未提供'}小时
- 遇到的挑战：${payload.progressData.challenges || '未提供'}

关键绩效指标（KPIs）：
${payload.userContext.kpis?.join('\n') || '无'}

请提供：
1. 对当前学习进度的分析（考虑完成率、信心水平、时间投入等）
2. 识别潜在的问题或瓶颈
3. 3-5个具体、可执行的改进建议

要求：
- 分析要具体且有洞察力
- 建议要实用且针对性强
- 语气要鼓励和支持
- 使用简体中文

请严格按照以下JSON格式返回（不要包含任何其他文字）：
{
  "analysis": "详细的进度分析（100-200字）",
  "suggestions": [
    "具体建议1",
    "具体建议2",
    "具体建议3"
  ],
  "encouragement": "鼓励性的结语（30-50字）",
  "referencedMetricIds": [],
  "evidence": [],
  "confidence": 0.6,
  "applicability": ""
}`;

    await new Promise(resolve => setTimeout(resolve, 1000));
    steps[1].status = 'completed';
    steps[2].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // T3: S4默认使用 Lite
    let g = await generateJson<Record<string, unknown>>(prompt, { maxOutputTokens: 65536 }, 'Lite');

    // 检查是否超时，如果是则降级重试
    if (!g.ok && g.error === 'TIMEOUT') {
      // 推送降级重试状态
      steps[2].status = 'in_progress';
      steps[2].message = '模型响应超时，正在降级重试…';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      
      // 降级重试
      g = await generateJson<Record<string, unknown>>(prompt, { 
        maxOutputTokens: 65536, 
        temperature: 0.4 
      }, 'Lite');
      
      if (!g.ok && g.error === 'TIMEOUT') {
        sendErrorSafe('TIMEOUT', '生成超时，请稍后重试');
        throw new Error('TIMEOUT');
      }
    }

    await new Promise(resolve => setTimeout(resolve, 800));
    steps[2].status = 'completed';
    steps[3].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    if (!g.ok) {
      steps[3].status = 'error';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      const errorMessage = g.error === 'EMPTY_RESPONSE' 
        ? '抱歉，AI暂时无法分析您的进度。请稍后重试。'
        : '进度分析遇到问题，请检查输入数据并重试。';
      throw new Error(errorMessage);
    }

    let analysisData = g.data;
    const s4 = AnalyzeProgressSchema.safeParse(analysisData);
    if (!s4.success) {
      steps[3].status = 'error';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      sendErrorSafe('SCHEMA', 'Schema validation failed for S4 output', traceId);
      throw new Error('SCHEMA');
    }

    // QA S3->S4 linkage
    const s4qa = runQualityGates('S4', analysisData, { strategyMetrics: payload.userContext.strategySpec?.metrics || [] });
    if (!s4qa.passed) {
      // T3: S4 QA失败时，使用Pro进行深度跨策略分析
      steps[3].status = 'in_progress';
      steps[3].message = '需要深度分析，正在使用 Pro 档位重新分析...';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      
      // Pro复算
      const gPro = await generateJson<Record<string, unknown>>(prompt, { 
        maxOutputTokens: 65536, 
        temperature: 0.4 
      }, 'Pro');
      
      if (!gPro.ok) {
        steps[3].status = 'error';
        controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        sendErrorSafe('QA', 'Pro深度分析后仍无法通过质量检查');
        throw new Error('QA');
      }
      
      const analysisDataPro = gPro.data;
      const s4Pro = AnalyzeProgressSchema.safeParse(analysisDataPro);
      if (!s4Pro.success) {
        steps[3].status = 'error';
        controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        sendErrorSafe('SCHEMA', 'Pro深度分析后Schema验证失败', traceId);
        throw new Error('SCHEMA');
      }
      
      // 重新检查Pro结果的QA
      const s4qaPro = runQualityGates('S4', analysisDataPro, { strategyMetrics: payload.userContext.strategySpec?.metrics || [] });
      if (!s4qaPro.passed) {
        steps[3].status = 'error';
        controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
        sendErrorSafe('QA', 'Pro深度分析后仍无法通过质量检查');
        throw new Error('QA');
      }
      
      // 使用Pro分析结果
      analysisData = analysisDataPro;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    steps[3].status = 'completed';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    // T8: 记录S4可观测性信息
    const wasProUsed = !s4qa.passed; // 如果QA失败，说明使用了Pro
    logger.info('S4 Analysis completed', {
      traceId,
      tier_used: wasProUsed ? 'Pro' : 'Lite',
      qa_passed: s4qa.passed,
      auto_repair_applied: wasProUsed
    });

    controller.enqueue(encoder.encode(createStreamMessage('data_structure', {
      status: 'success',
      data: analysisData,
      traceId
    })));
    
  } catch (error) {
    steps.forEach(s => { if (s.status === 'in_progress') s.status = 'error'; });
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    throw error;
  } finally {
    clearInterval(hb);
  }
}

async function handleConsultStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: ConsultPayload
) {
  const steps = getCognitiveSteps('consult');
  
  controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { 
    steps: steps.map(s => ({ ...s, status: 'pending' }))
  })));

  const genAI = createGeminiClient();
  
  if (!genAI) {
    // 模拟处理
    for (let i = 0; i < steps.length; i++) {
      steps[i].status = 'in_progress';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
      await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 600));
      steps[i].status = 'completed';
      controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    }

    const response = '这是一个很好的问题。让我基于您的学习历程来回答...';
    
    controller.enqueue(encoder.encode(createStreamMessage('data_structure', {
      status: 'success',
      data: { response }
    })));
    return;
  }

  try {
    steps[0].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    
    const frameworkSummary = payload.userContext.knowledgeFramework?.map(node => 
      `${node.title}: ${node.summary}`
    ).join('; ') || '无';
    
    const completedActions = payload.userContext.actionPlan?.filter(item => item.isCompleted).length || 0;
    const totalActions = payload.userContext.actionPlan?.length || 0;
    
    await new Promise(resolve => setTimeout(resolve, 800));
    steps[0].status = 'completed';
    steps[1].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    const prompt = `作为一名专业的认知教练和学习顾问，请回答学习者的问题。

学习者背景：
- 学习目标：${payload.userContext.userGoal}
- 知识框架：${frameworkSummary}
- 行动计划进度：${completedActions}/${totalActions} 已完成
- 学习比喻：${payload.userContext.systemDynamics?.metaphor || '无'}

学习者的问题：${payload.question}

请提供：
1. 直接回答问题
2. 结合学习者的具体情况和进度
3. 提供实用的指导或建议
4. 保持在学习目标的范围内

要求：
- 回答要具体、实用、有针对性
- 语气要友好、支持和鼓励
- 长度控制在150-300字
- 使用简体中文
- 如果问题超出学习目标范围，礼貌地引导回到主题

请直接返回你的回答内容（纯文本，不需要JSON格式）。`;

    await new Promise(resolve => setTimeout(resolve, 800));
    steps[1].status = 'completed';
    steps[2].status = 'in_progress';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    const g = await generateText(prompt, { maxOutputTokens: 65536, temperature: 0.8 }, 'Pro');

    await new Promise(resolve => setTimeout(resolve, 500));
    steps[2].status = 'completed';
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));

    if (!g.ok) {
      throw new Error('Failed to get consultation response');
    }

    controller.enqueue(encoder.encode(createStreamMessage('data_structure', {
      status: 'success', 
      data: { response: g.text }
    })));
    
  } catch (error) {
    steps.forEach(s => { if (s.status === 'in_progress') s.status = 'error'; });
    controller.enqueue(encoder.encode(createStreamMessage('cognitive_step', { steps })));
    throw error;
  }
}
