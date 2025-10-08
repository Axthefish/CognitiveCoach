// S3 阶段 Prompts - 行动计划生成

import type { KnowledgeFramework } from '@/lib/schemas';

export const S3_PROMPTS = {
  /**
   * 生成行动计划
   */
  generateActionPlan: (payload: {
    userGoal: string;
    framework: KnowledgeFramework;
    frameworkDescription: string;
  }) => `作为一名专业的学习规划专家，基于以下学习目标和知识框架，为学习者创建一个个性化的行动计划。

学习目标：${payload.userGoal}

知识框架：
${payload.frameworkDescription}

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
4. KPIs简洁明了（10-20字）`,

  /**
   * 格式化知识框架为文本描述（与 S2 相同的格式化逻辑）
   */
  formatFrameworkDescription: (framework: KnowledgeFramework): string => {
    return framework.map(node => {
      const childrenDesc = node.children?.map(child => 
        `  - ${child.title}: ${child.summary}`
      ).join('\n') || '';
      return `${node.title}: ${node.summary}\n${childrenDesc}`;
    }).join('\n\n');
  },

  /**
   * 获取 S3 生成配置
   */
  getGenerationConfig: (
    runTier?: 'Lite' | 'Pro' | 'Review',
    variantIndex: number = 0
  ) => ({
    maxOutputTokens: 65536,
    temperature: variantIndex === 0 
      ? (runTier === 'Lite' ? 0.5 : 0.8) 
      : 0.6, // 第二个变体使用中等温度
  }),

  /**
   * 获取重试配置（温度降低）
   */
  getRetryConfig: () => ({
    temperature: 0.4,
    topK: 40,
    topP: 0.9,
    maxOutputTokens: 65536,
  }),
} as const;

