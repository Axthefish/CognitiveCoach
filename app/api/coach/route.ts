import { NextRequest, NextResponse } from 'next/server';
import { CoachRequestSchema } from '@/lib/schemas';
import { handleOptions, withCors } from '@/lib/cors';
import { buildRateKey, checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { KnowledgeFramework, ActionPlan } from '@/lib/types';
import { createGeminiClient, generateJson, generateText } from '@/lib/gemini-config';
import {
  KnowledgeFrameworkSchema,
  SystemDynamicsSchema,
  ActionPlanResponseSchema,
  AnalyzeProgressSchema,
} from '@/lib/schemas';
import { runQualityGates } from '@/lib/qa';
import { createErrorResponse, createSuccessResponse, handleAPIError } from '@/lib/error-utils';
import { S0Service } from '@/services/s0-service';
import { serializeErrorDetailsSecurely } from '@/lib/app-errors';

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

// Action处理器

// S0: 目标精炼 - Enhanced with multi-turn conversation support
async function handleRefineGoal(payload: { 
  userInput: string; 
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }> 
}) {
  logger.debug('handleRefineGoal called', { 
    inputLength: payload.userInput?.length || 0, 
    historyLength: payload.conversationHistory?.length || 0 
  });
  
  try {
    const s0Service = S0Service.getInstance();
    const result = await s0Service.refineGoal(payload);
    logger.debug('handleRefineGoal completed successfully');
    return result;
  } catch (error) {
    logger.error('handleRefineGoal failed:', error);
    throw error;
  }
}



// S1: 知识框架生成
async function handleGenerateFramework(payload: GenerateFrameworkPayload) {
  const genAI = createGeminiClient();
  if (!genAI) {
    return NextResponse.json({ status: 'error', error: 'Gemini API key not configured' } as CoachResponse, { status: 500 });
  }

  try {
    // 使用 Gemini 2.5 Pro 生成知识框架
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

    // 为gemini-2.5-pro的思考过程预留充足空间
    const g = await generateJson<KnowledgeFramework>(prompt, { 
      maxOutputTokens: 65536, // 最大化支持深度思考和复杂推理
      temperature: 0.8        // 保持创造性
    }, payload.runTier);
    if (!g.ok) return createErrorResponse('AI响应解析失败', 400, { details: g.error, fixHints: ['请重试生成', '检查模型输出格式'], stage: 'S1' });
    const framework = g.data;
    const s1 = KnowledgeFrameworkSchema.safeParse(framework);
    if (!s1.success) {
      return handleAPIError(s1.error, 'S1');
    }

    // QA gate (v1 minimal)
    const qa = runQualityGates('S1', framework);
    if (!qa.passed) {
      return createErrorResponse(
        'Quality gates failed',
        400,
        {
          fixHints: qa.issues.map(i => i.hint),
          stage: 'S1',
          details: JSON.stringify(qa.issues)
        }
      );
    }

    return createSuccessResponse({ framework });
  } catch (error) {
    return handleAPIError(error, 'S1');
  }
}

// S2: 系统动力学生成
async function handleGenerateSystemDynamics(payload: { framework: KnowledgeFramework; decisionType?: string; runTier?: 'Lite'|'Pro'|'Review'; seed?: number; }) {
  const genAI = createGeminiClient();
  if (!genAI) {
    return NextResponse.json({ status: 'error', error: 'Gemini API key not configured' } as CoachResponse, { status: 500 });
  }

  try {
    // 使用 Gemini 2.5 Pro 生成系统动力学
    // 将框架转换为文本描述
    const frameworkDescription = payload.framework.map(node => {
      const childrenDesc = node.children?.map(child => `  - ${child.title}: ${child.summary}`).join('\n') || '';
      return `${node.title}: ${node.summary}\n${childrenDesc}`;
    }).join('\n\n');
    
    const prompt = `基于以下知识框架，创建一个系统动力学图表和一个生动的比喻，并补充“主路径/关键回路/节点类比”用于快速理解：

知识框架：
${frameworkDescription}

请完成以下任务：

1. 创建一个Mermaid流程图，展示这些知识点之间的关系和学习流程。
2. 创建一个生动形象的比喻，帮助理解整个学习过程（全局类比）。
3. 提取“主路径”（从入门到目标的最短可行路线，列出S1的id顺序）。
4. 提取“关键回路（Top 3）”：每个包含id、nodes（涉及的S1 id列表）与一句summary（≤20字）。
5. 为关键节点补充“节点类比”：nodeAnalogies（每条含 nodeId、1句 analogy、1句日常 example）。

请严格按照以下JSON格式返回（不要包含任何其他文字）：
{
  "mermaidChart": "以 graph TD 开头的 Mermaid 图，不要添加 <br/>",
  "metaphor": "一个生动的比喻（50-100字）",
  "nodes": [{ "id": "<与框架一致>", "title": "<中文>" }],
  "mainPath": ["<id1>", "<id2>", "<id3>"],
  "loops": [
    { "id": "loop-1", "title": "<中文>", "nodes": ["<idA>","<idB>"], "summary": "<≤20字>" }
  ],
  "nodeAnalogies": [
    { "nodeId": "<id>", "analogy": "<1句类比>", "example": "<1句日常示例>" }
  ],
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
- 与知识框架内容相关`;

    const g = await generateJson<{ mermaidChart: string; metaphor: string; nodes?: Array<{ id: string; title: string }>; mainPath?: string[]; loops?: Array<{ id: string; title: string; nodes: string[]; summary?: string }>; nodeAnalogies?: Array<{ nodeId: string; analogy: string; example?: string }> }>(
      prompt,
      { maxOutputTokens: 65536, temperature: payload.runTier === 'Lite' ? 0.5 : 0.8 },
      payload.runTier
    );
    if (!g.ok) return NextResponse.json({ status: 'error', error: 'AI响应解析失败，请重试', details: g.error } as CoachResponse, { status: 400 });
    try {
      const dynamics = g.data;
      const s2 = SystemDynamicsSchema.safeParse(dynamics);
      if (!s2.success) {
        return NextResponse.json({
          status: 'error',
          error: 'Schema validation failed for S2 output',
          data: dynamics,
        } as CoachResponse);
      }

      // Mermaid precheck and QA
      if (typeof dynamics.mermaidChart !== 'string' || !dynamics.mermaidChart.trim().startsWith('graph TD')) {
        return NextResponse.json({
          status: 'error',
          error: 'Invalid Mermaid chart: must start with "graph TD"',
          data: dynamics,
        } as CoachResponse);
      }
      const qa = runQualityGates('S2', dynamics, { framework: payload.framework });
      if (!qa.passed) {
        return NextResponse.json({
          status: 'error',
          error: 'Quality gates failed',
          data: { dynamics, issues: qa.issues },
        } as CoachResponse);
      }

      return NextResponse.json({
        status: 'success',
        data: dynamics
      } as CoachResponse);
    } catch (parseError) {
      logger.error('JSON解析错误:', parseError);
      
      // 如果解析失败，返回默认数据
      return NextResponse.json({
        status: 'error',
        error: 'AI响应解析失败，请重试',
        data: {
          mermaidChart: `graph TD\nA[开始] --> B[学习]\nB --> C[应用]\nC --> D[精通]`,
          metaphor: '学习过程出现了一些问题，请重试。'
        }
      } as CoachResponse);
    }
  } catch (error) {
    logger.error('Gemini API 错误:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to generate system dynamics' } as CoachResponse,
      { status: 500 }
    );
  }
}

// S3: 行动计划生成 - Enhanced with real AI generation
async function handleGenerateActionPlan(payload: { userGoal: string; framework: KnowledgeFramework; systemNodes?: Array<{ id: string; title?: string }>; decisionType?: string; runTier?: 'Lite'|'Pro'|'Review'; seed?: number; }) {
  const genAI = createGeminiClient();
  
  if (!genAI) {
    return NextResponse.json({ status: 'error', error: 'Gemini API key not configured' } as CoachResponse, { status: 500 });
  }

  try {
    // Convert knowledge framework to text description
    const frameworkDescription = payload.framework.map(node => {
      const childrenDesc = node.children?.map(child => `  - ${child.title}: ${child.summary}`).join('\n') || '';
      return `${node.title}: ${node.summary}\n${childrenDesc}`;
    }).join('\n\n');
    
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

    // n-best generation (v1: 2 variants) and QA select best; simple sequential to keep resource usage minimal
    const variants = [] as Array<{ text: string; qaScore: number; issues: unknown[] }>
    const n = payload.runTier === 'Pro' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const r = await generateJson<Record<string, unknown>>(prompt, { maxOutputTokens: 65536, temperature: i === 0 ? (payload.runTier === 'Lite' ? 0.5 : 0.8) : 0.6 }, payload.runTier);
      const text = r.ok ? JSON.stringify(r.data) : '';
      variants.push({ text, qaScore: 0, issues: [] });
    }
    // Evaluate variants via schema + QA; pick first passing with least issues
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
        const qa = runQualityGates('S3', planData, { nodes: ((payload as GenerateActionPlanPayload).systemNodes || []).map(n => ({ id: n.id })) });
        v.issues = qa.issues;
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
    if (best) {
      // add POV tags and human review flag based on simple heuristics
      const povTags = ['maximize_gain', 'minimize_risk'];
      const requiresHumanReview = Array.isArray((best as { strategySpec?: { metrics?: Array<{ confidence?: number; evidence?: unknown[] }> } }).strategySpec?.metrics)
        && ((((best as { strategySpec?: { metrics?: Array<{ confidence?: number; evidence?: unknown[] }> } }).strategySpec)?.metrics) || [])
          .some((m) => ((m.confidence ?? 1) < 0.4) || !m.evidence || ((m.evidence as unknown[])?.length ?? 0) === 0);
      const telemetry = { n_best_count: n };
      return NextResponse.json({ status: 'success', data: { ...(best as object), povTags, requiresHumanReview, telemetry } } as CoachResponse);
    }
    // Final attempt: temperature lowered retry once
    const retryR = await generateJson<Record<string, unknown>>(prompt, { temperature: 0.4, topK: 40, topP: 0.9, maxOutputTokens: 65536 }, payload.runTier);
    const retryText = retryR.ok ? JSON.stringify(retryR.data) : '';
    try {
      const planData = JSON.parse(retryText);
      
      // 补充可选字段的默认值，以兼容简化的响应格式
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
      if (!s3.success) throw new Error('schema');
      const qa = runQualityGates('S3', planData, { nodes: ((payload as GenerateActionPlanPayload).systemNodes || []).map(n => ({ id: n.id })) });
      if (!qa.passed) throw new Error('qa');
      const povTags = ['maximize_gain', 'minimize_risk'];
      const requiresHumanReview = Array.isArray(planData.strategySpec?.metrics)
        && ((planData.strategySpec?.metrics) || [])
          .some((m: { confidence?: number; evidence?: unknown[] }) => ((m.confidence ?? 1) < 0.4) || !m.evidence || ((m.evidence as unknown[])?.length ?? 0) === 0);
      const telemetry = { n_best_count: 1, retry: true };
      return NextResponse.json({ status: 'success', data: { ...planData, povTags, requiresHumanReview, telemetry } } as CoachResponse);
    } catch (retryError) {
      logger.error('Retry attempt failed during action plan generation:', retryError);
      return NextResponse.json({ 
        status: 'error', 
        error: 'Failed to generate action plan', 
        data: { 
          issues: variants.map(v => v.issues),
          retryError: retryError instanceof Error ? retryError.message : 'Unknown retry error'
        } 
      } as CoachResponse, { status: 500 });
    }
  } catch (error) {
    logger.error('Gemini API error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to generate action plan' } as CoachResponse,
      { status: 500 }
    );
  }
}

// S4: 进度分析 - Enhanced with real AI analysis
async function handleAnalyzeProgress(payload: {
  progressData: {
    completedTasks?: string[];
    confidenceScore?: number;
    hoursSpent?: number;
    challenges?: string;
  };
  userContext: {
    userGoal: string;
    actionPlan: ActionPlan;
    kpis: string[];
    strategySpec?: { metrics?: Array<{ metricId: string }> };
  }
}) {
  const genAI = createGeminiClient();
  
  if (!genAI) {
    // Fallback to simple analysis
    logger.warn('Using fallback logic: Gemini API key not configured');
    const analysis = '基于您的数据，您在理论学习方面进展良好，但实践应用还需要加强。建议增加动手练习的时间。';
    
    return NextResponse.json({
      status: 'success',
      data: {
        analysis,
        suggestions: ['增加实践时间', '寻找实际项目机会', '与他人交流学习经验']
      }
    } as CoachResponse);
  }

  try {
    // Prepare context for analysis
    const completedTasksCount = payload.progressData.completedTasks?.length || 0;
    const totalTasksCount = payload.userContext.actionPlan?.length || 0;
    const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
    
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

    const g = await generateJson<Record<string, unknown>>(prompt, { maxOutputTokens: 65536 }, 'Pro');
    if (!g.ok) {
      const errorMessage = g.error === 'EMPTY_RESPONSE' 
        ? '抱歉，AI暂时无法分析您的进度。请稍后重试。'
        : '进度分析遇到问题，请检查输入数据并重试。';
      
      return NextResponse.json({ 
        status: 'error', 
        error: errorMessage,
        details: serializeErrorDetailsSecurely(g.error)
      } as CoachResponse, { status: 400 });
    }
    try {
      const analysisData = g.data;
      const s4 = AnalyzeProgressSchema.safeParse(analysisData);
      if (!s4.success) {
        return NextResponse.json({
          status: 'error',
          error: 'Schema validation failed for S4 output',
          data: analysisData,
        } as CoachResponse);
      }

      // QA S3->S4 linkage
      const s4qa = runQualityGates('S4', analysisData, { strategyMetrics: payload.userContext.strategySpec?.metrics || [] });
      if (!s4qa.passed) {
        return NextResponse.json({ status: 'error', error: 'Quality gates failed', data: { issues: s4qa.issues } } as CoachResponse);
      }

      return NextResponse.json({
        status: 'success',
        data: analysisData
      } as CoachResponse);
    } catch (parseError) {
      logger.error('JSON parse error:', parseError);
      
      return NextResponse.json({
        status: 'error',
        error: 'AI响应解析失败，请重试',
        data: {
          analysis: '分析过程出现问题，请重试。',
          suggestions: ['请检查输入数据', '重新提交进度信息'],
          encouragement: '继续努力！'
        }
      } as CoachResponse);
    }
  } catch (error) {
    logger.error('Gemini API error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to analyze progress' } as CoachResponse,
      { status: 500 }
    );
  }
}

// S4: 咨询服务 - Enhanced with real AI consultation
async function handleConsult(payload: { 
  question: string; 
  userContext: {
    userGoal: string;
    knowledgeFramework: KnowledgeFramework;
    actionPlan: ActionPlan;
    systemDynamics?: {
      mermaidChart: string;
      metaphor: string;
    };
  }
}) {
  const genAI = createGeminiClient();
  
  if (!genAI) {
    // Fallback response
    logger.warn('Using fallback logic: Gemini API key not configured');
    const response = '这是一个很好的问题。让我基于您的学习历程来回答...';
    
    return NextResponse.json({
      status: 'success',
      data: {
        response
      }
    } as CoachResponse);
  }

  try {
    // Convert knowledge framework to text
    const frameworkSummary = payload.userContext.knowledgeFramework?.map(node => 
      `${node.title}: ${node.summary}`
    ).join('; ') || '无';
    
    // Get current action plan status
    const completedActions = payload.userContext.actionPlan?.filter(item => item.isCompleted).length || 0;
    const totalActions = payload.userContext.actionPlan?.length || 0;
    
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

    const g = await generateText(prompt, { maxOutputTokens: 65536, temperature: 0.8 }, 'Pro');
    if (!g.ok) return NextResponse.json({ status: 'error', error: 'Failed to get consultation response' } as CoachResponse, { status: 400 });
    return NextResponse.json({ status: 'success', data: { response: g.text } } as CoachResponse);
  } catch (error) {
    logger.error('Gemini API error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to process consultation' } as CoachResponse,
      { status: 500 }
    );
  }
}