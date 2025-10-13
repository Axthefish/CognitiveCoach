/**
 * Stage 1 Prompt 模板 - 通用框架生成
 * 
 * 基于Anthropic Right Altitude原则：
 * - 给判断框架，不给具体答案
 * - 相信gemini-2.5-pro的判断能力
 * - 职责分离：只基于问题域，不考虑个人约束
 */

import type { UniversalPurposeContext } from '@/lib/types-v2';

/**
 * Stage1 专用的输入上下文（扩展版，支持边界约束）
 */
interface Stage1Context extends UniversalPurposeContext {
  boundaryConstraints?: string[];
}

// ============================================
// 框架生成 Prompt（激进简化版）
// ============================================

export function getFrameworkGenerationPrompt(purpose: Stage1Context): string {
  const boundaryInfo = purpose.boundaryConstraints && purpose.boundaryConstraints.length > 0
    ? `\n边界约束: ${purpose.boundaryConstraints.join('; ')}`
    : '';
  
  return `<workflow_context>
你在三阶段认知教练系统的 Stage 1 - 通用框架生成阶段

前置阶段（Stage 0已完成）：
- 用户目的：「${purpose.clarifiedPurpose}」
- 问题域边界：「${purpose.domainBoundary}」${boundaryInfo}
- ⚠️ Stage 0还识别了个人约束（如"零基础"、"每周X小时"），但这些在Stage 2才使用，你现在应该忽略它们

你的职责：
- 生成该领域的**通用框架**（适用于标准学习者）
- 权重反映**客观重要性**，不考虑个人因素（如"零基础"、"每周2小时"）
- 类比：像医学教科书的标准诊断流程，不针对特定患者

你的输出将被用于：
- Stage 2：基于个人约束调整你的权重，生成个性化行动计划
- 用户决策点：用户可能直接使用通用框架，也可能继续个性化

因此：框架必须清晰、完整，权重判断基于领域知识而非个人情况。
</workflow_context>

<context>
目的: ${purpose.clarifiedPurpose}
问题域: ${purpose.problemDomain}
边界: ${purpose.domainBoundary}${boundaryInfo}
</context>

<task>
基于上述问题域，设计一个学习/成长框架。这个框架应该：

1. **模块化拆解**：将目标拆解为5-12个关键节点（模块/里程碑）
2. **权重评估**：为每个节点评估其客观重要性
3. **依赖关系**：明确节点间的前置关系
4. **路径规划**：标识出核心主路径

这是为**典型学习者**设计的通用框架，不考虑个人情况。
</task>

<weight_evaluation>
为每个节点评估重要性，考虑三个维度（0-1）：

- **necessity**: 典型学习者跳过此节点的后果？（必要性）
- **impact**: 此节点对最终目标的贡献？（影响力）
- **timeROI**: 时间投入与价值获得的比例？（效率）

最终权重 = (necessity × 0.4) + (impact × 0.3) + (timeROI × 0.3)

期望分布：2-4个核心节点(90%+)，大部分重要节点(70-89%)，少量可选节点(50-69%)。
</weight_evaluation>

<output_requirements>
以JSON格式输出框架，包含：
- nodes: 节点数组（id, title, description, weightBreakdown含necessity/impact/timeROI/reasoning, estimatedTime）
- edges: 边数组（from, to, type, strength）
- mainPath: 核心路径节点ID数组
- weightingLogic: 简要说明权重分布的设计思路

用你的专业判断决定：
- 具体节点数量（5-12个为宜）
- 每个节点的具体权重（基于三维度评估）
- 依赖关系的类型和强度
</output_requirements>`;
}

// ============================================
// AI 配置
// ============================================

export function getStage1GenerationConfig(runTier: 'Lite' | 'Pro' = 'Pro') {
  return {
    temperature: runTier === 'Lite' ? 0.6 : 0.8,
    maxOutputTokens: runTier === 'Lite' ? 8000 : 16000,
    topP: 0.95,
    topK: 40,
  };
}

