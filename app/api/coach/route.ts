import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeFramework, ActionPlan } from '@/lib/types';
import { createGeminiClient } from '@/lib/gemini-config';

// API请求的action类型
type CoachAction = 
  | 'refineGoal'
  | 'generateFramework'
  | 'generateSystemDynamics'
  | 'generateActionPlan'
  | 'analyzeProgress'
  | 'consult';

// 请求体接口
interface CoachRequest {
  action: CoachAction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

// 响应体接口
interface CoachResponse {
  status: 'success' | 'error';
  data?: unknown;
  error?: string;
}

// 主处理函数
export async function POST(request: NextRequest) {
  let body: CoachRequest | undefined;
  
  try {
    body = await request.json();
    
    if (!body) {
      return NextResponse.json(
        { status: 'error', error: 'Invalid request body' } as CoachResponse,
        { status: 400 }
      );
    }
    
    const { action, payload } = body;

    // 根据action调用对应的处理器
    switch (action) {
      case 'refineGoal':
        return handleRefineGoal(payload);
      
      case 'generateFramework':
        return handleGenerateFramework(payload);
      
      case 'generateSystemDynamics':
        return handleGenerateSystemDynamics(payload);
      
      case 'generateActionPlan':
        return handleGenerateActionPlan(payload);
      
      case 'analyzeProgress':
        return handleAnalyzeProgress(payload);
      
      case 'consult':
        return handleConsult(payload);
      
      default:
        return NextResponse.json(
          { status: 'error', error: 'Unknown action' } as CoachResponse,
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log detailed error in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Production error details:', {
        message: errorMessage,
        stack: errorStack,
        action: body?.action,
        hasApiKey: !!process.env.GEMINI_API_KEY
      });
    }
    
    return NextResponse.json(
      { 
        status: 'error', 
        error: errorMessage,
        details: process.env.NODE_ENV !== 'production' ? errorStack : undefined
      } as CoachResponse,
      { status: 500 }
    );
  }
}

// Action处理器

// S0: 目标精炼 - Enhanced with multi-turn conversation support
async function handleRefineGoal(payload: { 
  userInput: string; 
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }> 
}) {
  const genAI = createGeminiClient();
  
  if (!genAI) {
    // Fallback to simple clarification if no API key
    console.warn('Using fallback logic: Gemini API key not configured');
    const refinedGoal = `Master the core concepts and practical skills of ${payload.userInput}, and be able to complete related projects independently`;
    
    return NextResponse.json({
      status: 'success',
      data: {
        status: 'clarified',
        goal: refinedGoal,
        originalInput: payload.userInput
      }
    } as CoachResponse);
  }

  try {
    // Build conversation context
    const conversationHistory = payload.conversationHistory || [];
    const isFirstInteraction = conversationHistory.length === 0;
    
    // Create the prompt for goal refinement
    const systemPrompt = `You are an expert Cognitive Coach specializing in helping people clarify and refine their learning goals. Your role is to:

1. Analyze the user's input to determine if their goal is specific, measurable, and actionable.
2. If the goal is vague or too broad, ask ONE clarifying question to help them be more specific.
3. If the goal is clear enough, synthesize it into a concise, actionable statement.

IMPORTANT GUIDELINES:
- Always respond in Simplified Chinese (简体中文)
- Be encouraging and supportive
- Ask only ONE question at a time
- Focus on making the goal specific and actionable
- Consider aspects like: scope, timeline, specific outcomes, and measurable results

Respond in JSON format:
{
  "status": "clarification_needed" or "clarified",
  "ai_question": "Your clarifying question (only if status is clarification_needed)",
  "goal": "The refined goal statement (only if status is clarified)"
}`;

    // Build the full conversation
    let conversationContent = '';
    if (isFirstInteraction) {
      conversationContent = `User's initial goal: ${payload.userInput}`;
    } else {
      // Include conversation history
      conversationContent = conversationHistory.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.content}`
      ).join('\n');
      conversationContent += `\n\nUser's latest response: ${payload.userInput}`;
    }

    const prompt = `${systemPrompt}\n\nConversation:\n${conversationContent}\n\nAnalyze the user's goal and provide your response:`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const text = result.text;
    
    if (!text) {
      throw new Error('No response from AI model');
    }
    
    try {
      const refinementResult = JSON.parse(text);
      
      return NextResponse.json({
        status: 'success',
        data: refinementResult
      } as CoachResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response:', text);
      
      // Fallback response
      return NextResponse.json({
        status: 'error',
        error: 'Failed to parse AI response',
        data: {
          status: 'clarified',
          goal: payload.userInput
        }
      } as CoachResponse);
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to refine goal' } as CoachResponse,
      { status: 500 }
    );
  }
}

// S1: 知识框架生成
async function handleGenerateFramework(payload: { userGoal: string }) {
  const genAI = createGeminiClient();
  
  if (!genAI) {
    // 如果没有配置 API key，返回模拟数据
    console.warn('使用模拟数据：Gemini API key 未配置');
    const mockFramework: KnowledgeFramework = [
      {
        id: 'core-concepts',
        title: '核心概念',
        summary: '理解基础概念和术语',
        children: []
      }
    ];
    
    return NextResponse.json({
      status: 'success',
      data: {
        framework: mockFramework
      }
    } as CoachResponse);
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
    ]
  }
]

确保：
1. id使用英文和数字的组合（如 "fundamental-concepts-1"）
2. title简洁明了
3. summary提供有价值的描述
4. 内容与学习目标高度相关`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const text = result.text;
    
    if (!text) {
      throw new Error('No response from AI model');
    }
    
    try {
      const framework = JSON.parse(text) as KnowledgeFramework;
      
      return NextResponse.json({
        status: 'success',
        data: {
          framework
        }
      } as CoachResponse);
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      console.error('原始响应:', text);
      
      // 如果解析失败，返回一个默认框架
      return NextResponse.json({
        status: 'error',
        error: 'Failed to parse AI response',
        data: {
          framework: [{
            id: 'error-fallback',
            title: '知识框架生成失败',
            summary: '请重试或检查输入',
            children: []
          }]
        }
      } as CoachResponse);
    }
  } catch (error) {
    console.error('Gemini API 错误:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to generate knowledge framework' } as CoachResponse,
      { status: 500 }
    );
  }
}

// S2: 系统动力学生成
async function handleGenerateSystemDynamics(payload: { framework: KnowledgeFramework }) {
  const genAI = createGeminiClient();
  
  if (!genAI) {
    // 如果没有配置 API key，返回模拟数据
    console.warn('使用模拟数据：Gemini API key 未配置');
    const mockMermaidChart = `graph TD
    A[开始学习] --> B[理解概念]
    B --> C[实践应用]
    C --> D[获得反馈]
    D --> B`;
    
    const mockMetaphor = '学习就像建造房屋：先打地基（基础概念），再搭建框架（核心技能），最后装修完善（实践应用）。';
    
    return NextResponse.json({
      status: 'success',
      data: {
        mermaidChart: mockMermaidChart,
        metaphor: mockMetaphor
      }
    } as CoachResponse);
  }

  try {
    // 使用 Gemini 2.5 Pro 生成系统动力学
    // 将框架转换为文本描述
    const frameworkDescription = payload.framework.map(node => {
      const childrenDesc = node.children?.map(child => `  - ${child.title}: ${child.summary}`).join('\n') || '';
      return `${node.title}: ${node.summary}\n${childrenDesc}`;
    }).join('\n\n');
    
    const prompt = `基于以下知识框架，创建一个系统动力学图表和一个生动的比喻：

知识框架：
${frameworkDescription}

请完成两个任务：

1. 创建一个Mermaid流程图，展示这些知识点之间的关系和学习流程。
2. 创建一个生动形象的比喻，帮助理解整个学习过程。

请严格按照以下JSON格式返回（不要包含任何其他文字）：
{
  "mermaidChart": "graph TD开头的Mermaid图表代码",
  "metaphor": "一个生动的比喻（50-100字）"
}

Mermaid图表要求：
- 使用graph TD（从上到下）
- 节点使用中文标签
- 展示学习路径和知识点之间的关系
- 包含反馈循环或进阶路径
- 每行都要以<br/>结尾，包括最后一行

比喻要求：
- 使用日常生活中的事物
- 能够形象地说明学习过程
- 与知识框架内容相关`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const text = result.text;
    
    if (!text) {
      throw new Error('No response from AI model');
    }
    
    try {
      const dynamics = JSON.parse(text) as { mermaidChart: string; metaphor: string };
      
      return NextResponse.json({
        status: 'success',
        data: dynamics
      } as CoachResponse);
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      console.error('原始响应:', text);
      
      // 如果解析失败，返回默认数据
      return NextResponse.json({
        status: 'error',
        error: 'Failed to parse AI response',
        data: {
          mermaidChart: `graph TD<br/>A[开始] --> B[学习]<br/>B --> C[应用]<br/>C --> D[精通]<br/>`,
          metaphor: '学习过程出现了一些问题，请重试。'
        }
      } as CoachResponse);
    }
  } catch (error) {
    console.error('Gemini API 错误:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to generate system dynamics' } as CoachResponse,
      { status: 500 }
    );
  }
}

// S3: 行动计划生成 - Enhanced with real AI generation
async function handleGenerateActionPlan(payload: { userGoal: string; framework: KnowledgeFramework }) {
  const genAI = createGeminiClient();
  
  if (!genAI) {
    // Fallback to mock data if no API key
    console.warn('Using mock data: Gemini API key not configured');
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
    
    return NextResponse.json({
      status: 'success',
      data: {
        actionPlan: mockActionPlan,
        kpis: mockKPIs
      }
    } as CoachResponse);
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

确保：
1. id使用 "step-1", "step-2" 等格式
2. text是具体的行动描述（20-50字）
3. 所有isCompleted都设为false
4. KPIs简洁明了（10-20字）`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const text = result.text;
    
    if (!text) {
      throw new Error('No response from AI model');
    }
    
    try {
      const planData = JSON.parse(text) as { actionPlan: ActionPlan; kpis: string[] };
      
      return NextResponse.json({
        status: 'success',
        data: planData
      } as CoachResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response:', text);
      
      // Fallback to default data
      return NextResponse.json({
        status: 'error',
        error: 'Failed to parse AI response',
        data: {
          actionPlan: [{
            id: 'error-fallback',
            text: '行动计划生成失败，请重试',
            isCompleted: false
          }],
          kpis: ['生成失败']
        }
      } as CoachResponse);
    }
  } catch (error) {
    console.error('Gemini API error:', error);
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
  }
}) {
  const genAI = createGeminiClient();
  
  if (!genAI) {
    // Fallback to simple analysis
    console.warn('Using fallback logic: Gemini API key not configured');
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
    
    const prompt = `作为一名专业的学习教练，基于以下学习进度数据，提供深入的分析和建议。

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
  "encouragement": "鼓励性的结语（30-50字）"
}`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const text = result.text;
    
    if (!text) {
      throw new Error('No response from AI model');
    }
    
    try {
      const analysisData = JSON.parse(text);
      
      return NextResponse.json({
        status: 'success',
        data: analysisData
      } as CoachResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response:', text);
      
      return NextResponse.json({
        status: 'error',
        error: 'Failed to parse AI response',
        data: {
          analysis: '分析过程出现问题，请重试。',
          suggestions: ['请检查输入数据', '重新提交进度信息'],
          encouragement: '继续努力！'
        }
      } as CoachResponse);
    }
  } catch (error) {
    console.error('Gemini API error:', error);
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
    console.warn('Using fallback logic: Gemini API key not configured');
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

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    const consultResponse = result.text;
    
    if (!consultResponse) {
      throw new Error('No response from AI model');
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        response: consultResponse
      }
    } as CoachResponse);
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to process consultation' } as CoachResponse,
      { status: 500 }
    );
  }
}