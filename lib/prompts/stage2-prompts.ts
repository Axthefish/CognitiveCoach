/**
 * Stage 2 Prompt 模板 - 个性化方案生成
 * 
 * 动态收集信息并生成个性化方案
 */

import type { UniversalFramework } from '@/lib/types-v2';

// ============================================
// 信息缺口分析
// ============================================

export function getMissingInfoAnalysisPrompt(framework: UniversalFramework): string {
  return `你是一个专业的需求分析师。基于已生成的通用框架，分析"要生成个性化方案，还缺少哪些关键用户信息"。

**通用框架：**
目的：${framework.purpose}
问题域：${framework.domain}

节点列表：
${framework.nodes.map(n => `- ${n.title} (权重: ${n.weight}%)`).join('\n')}

**你的任务：**
分析需要收集的关键信息，生成3-5个问题。

**信息类型：**
1. **baseline**: 基础水平（用户当前在哪些节点已有基础？）
2. **resource**: 资源约束（时间、金钱、工具等限制？）
3. **context**: 情境信息（特殊情况、优先级、偏好？）
4. **motivation**: 动机深度（为什么做、紧迫度、期望？）

**问题设计原则：**
- 每个问题都要说明"为什么这个信息重要"
- 问题要开放式，让用户有表达空间
- 按影响力排序（影响最大的排在前面）

请严格按照以下JSON格式输出：
\`\`\`json
{
  "questions": [
    {
      "id": "q1",
      "question": "具体问题文本",
      "whyMatters": "为什么这个问题重要，会如何影响方案",
      "affects": ["node-id-1", "node-id-2"],
      "impactLevel": 5,
      "questionType": "baseline"
    }
  ],
  "rationale": "为什么选择这些问题的简要说明"
}
\`\`\``;
}

// ============================================
// 个性化方案生成
// ============================================

export function getPersonalizedPlanPrompt(
  framework: UniversalFramework,
  collectedInfo: Array<{ questionId: string; answer: string }>
): string {
  const infoText = collectedInfo
    .map(info => `Q: ${info.questionId}\nA: ${info.answer}`)
    .join('\n\n');
  
  return `你是一个专业的方案规划师。基于通用框架和用户的个性化信息，生成定制化方案。

**通用框架：**
${JSON.stringify(framework, null, 2)}

**用户信息：**
${infoText}

**你的任务：**
1. **调整框架权重**
   - 基于用户的实际情况，重新评估每个节点的必要性、影响力、时间ROI
   - 某些节点可能因为用户已有基础而降低权重
   - 某些节点可能因为用户的特殊需求而提升权重

2. **生成行动步骤**
   - 将框架转化为具体的、可执行的步骤
   - 每个步骤关联到框架节点
   - 包含时间安排和优先级

3. **设置里程碑**
   - 关键的检查点和成功标准
   - 帮助用户追踪进度

4. **个性化建议**
   - 基于用户情况的针对性tips
   - 3-5条具体建议

请严格按照以下JSON格式输出：
\`\`\`json
{
  "adjustedFramework": {
    "purpose": "...",
    "domain": "...",
    "nodes": [
      {
        "id": "...",
        "title": "...",
        "weight": 85,
        "weightBreakdown": {
          "necessity": 0.9,
          "impact": 0.8,
          "timeROI": 0.85
        },
        "... (其他字段保持原样)"
      }
    ],
    "... (edges, mainPath等保持原样)"
  },
  "actionSteps": [
    {
      "id": "step-1",
      "title": "步骤标题",
      "description": "详细说明",
      "relatedNodeId": "node-id",
      "startTime": "第1周",
      "endTime": "第2周",
      "priority": "high",
      "prerequisites": []
    }
  ],
  "milestones": [
    {
      "id": "milestone-1",
      "title": "里程碑标题",
      "successCriteria": ["标准1", "标准2"],
      "expectedTime": "第4周",
      "relatedSteps": ["step-1", "step-2"]
    }
  ],
  "personalizedTips": [
    "针对性建议1",
    "针对性建议2"
  ],
  "adjustmentRationale": "简要说明为什么这样调整"
}
\`\`\``;
}

// ============================================
// AI 配置
// ============================================

export function getStage2GenerationConfig() {
  return {
    temperature: 0.7,
    maxOutputTokens: 16000,
    topP: 0.95,
    topK: 40,
  };
}

