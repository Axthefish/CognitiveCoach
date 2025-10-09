// S3 阶段 Prompts - 行动计划生成

import { formatFrameworkDescription } from '@/lib/framework-utils';
import type { KnowledgeFramework } from '@/lib/schemas';

export interface S3PromptContext {
  userGoal: string;
  framework: KnowledgeFramework;
  systemNodes?: Array<{ id: string; title?: string }>;
  decisionType?: 'explore' | 'compare' | 'troubleshoot' | 'plan';
}

/**
 * 构建 S3 行动计划生成的 Prompt
 */
function buildActionPlanPrompt(context: S3PromptContext): string {
  const frameworkDescription = formatFrameworkDescription(context.framework);
  const systemNodes = context.systemNodes
    ? context.systemNodes.map(n => n.title || n.id).join(', ')
    : '';

  return `作为一名专业的学习规划专家，基于以下学习目标和知识框架，为学习者创建一个个性化的行动计划。

学习目标：${context.userGoal}

知识框架：
${frameworkDescription}

系统节点：${systemNodes || '未提供'}

请完成两个任务：

1. 创建一个具体、可执行的行动计划（5-8个步骤）
2. 设计3-5个关键绩效指标（KPIs）来跟踪学习进度

要求：
- 行动计划应该循序渐进，从基础到高级
- 每个步骤都应该具体且可执行
- 步骤应该与知识框架紧密相关
- 使用第一人称（"我"）来描述行动步骤
- 行动语句采用"微承诺 + 时间窗"（如"今天/本周内…"），总时长≤30分钟
- KPIs应该可量化或可评估（3-5条、10-20字）
- 追加1条"抗阻力替代方案"

请严格按照以下JSON格式返回（不要包含任何其他文字）：
{
  "actionPlan": [
    {
      "id": "step-1",
      "text": "具体的行动步骤描述（使用第一人称，包含时间窗）",
      "isCompleted": false
    }
  ],
  "kpis": [
    "KPI描述1（10-20字）",
    "KPI描述2（10-20字）"
  ],
  "resistanceAlternative": "一条抗阻力替代行动方案",
  "strategySpec": null,
  "missingEvidenceTop3": [],
  "reviewWindow": "P14D",
  "evidence": [],
  "confidence": 0.6,
  "applicability": "适用于${context.decisionType || 'plan'}决策类型"
}

注意：
1. id使用 "step-1", "step-2" 等格式
2. text是具体的行动描述（20-50字）
3. 所有isCompleted都设为false
4. KPIs简洁明了（10-20字）
5. resistanceAlternative 提供一个简单的替代方案`;
}

/**
 * S3 Prompts 模块
 * 提供行动计划生成的 prompt 构建功能
 */
export const S3_PROMPTS = {
  /**
   * 生成行动计划的 prompt
   */
  generateActionPlan: (context: S3PromptContext): string => {
    return buildActionPlanPrompt(context);
  },
  
  /**
   * 获取生成配置
   */
  getGenerationConfig: (runTier?: 'Lite' | 'Pro' | 'Review', variantIndex: number = 0) => {
    return {
      maxOutputTokens: 65536,
      temperature: variantIndex === 0
        ? (runTier === 'Lite' ? 0.5 : 0.8)
        : 0.6,
      topP: 0.9,
      topK: 40,
    };
  },
};
