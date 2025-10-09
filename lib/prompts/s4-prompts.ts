// S4 阶段 Prompts - 进度分析和咨询

import type { KnowledgeFramework } from '@/lib/schemas';

export const S4_PROMPTS = {
  /**
   * 分析学习进度
   */
  analyzeProgress: (payload: {
    userGoal: string;
    completionRate: number;
    completedTasksCount: number;
    totalTasksCount: number;
    confidenceScore?: number;
    hoursSpent?: number;
    challenges?: string;
    kpis: string[];
  }) => `作为一名专业的学习教练，基于以下学习进度数据，提供深入的分析和建议。请尽量引用 S3 的策略指标（metrics.metricId）与复评指标（recovery.reviewMetricIds）进行参考。

学习目标：${payload.userGoal}

进度数据：
- 任务完成率：${payload.completionRate}% (${payload.completedTasksCount}/${payload.totalTasksCount})
- 自评信心分数：${payload.confidenceScore || '未提供'}/10
- 已投入时间：${payload.hoursSpent || '未提供'}小时
- 遇到的挑战：${payload.challenges || '未提供'}

关键绩效指标（KPIs）：
${payload.kpis?.join('\n') || '无'}

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
}`,

  /**
   * AI 咨询服务
   */
  consult: (payload: {
    question: string;
    userGoal: string;
    frameworkSummary: string;
    completedActions: number;
    totalActions: number;
    metaphor?: string;
  }) => `作为一名专业的认知教练和学习顾问，请回答学习者的问题。

学习者背景：
- 学习目标：${payload.userGoal}
- 知识框架：${payload.frameworkSummary}
- 行动计划进度：${payload.completedActions}/${payload.totalActions} 已完成
- 学习比喻：${payload.metaphor || '无'}

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

请直接返回你的回答内容（纯文本，不需要JSON格式）。`,

  /**
   * 格式化知识框架摘要
   */
  formatFrameworkSummary: (framework: KnowledgeFramework): string => {
    return framework?.map(node => 
      `${node.title}: ${node.summary}`
    ).join('; ') || '无';
  },

  /**
   * 获取 S4 生成配置
   */
  getGenerationConfig: () => ({
    maxOutputTokens: 65536,
    temperature: 0.8,
  }),
} as const;

