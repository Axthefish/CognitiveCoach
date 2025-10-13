/**
 * Stage 2 Prompt 模板 - 个性化方案生成（优化版）
 * 
 * 基于Anthropic最佳实践：
 * - 简化问题生成指导
 * - 信任模型判断
 * - 明确决策标准
 */

import type { UniversalFramework } from '@/lib/types-v2';

// ============================================
// 信息缺口分析（优化版）
// ============================================

export function getMissingInfoAnalysisPrompt(
  framework: UniversalFramework,
  personalConstraints: string[],
  conversationInsights?: string
): string {
  return `<workflow_context>
你在三阶段认知教练系统的 Stage 2 - 个性化适配阶段（问题设计）

前置阶段（Stage 0和1已完成）：

<stage0_context>
用户目的：「${framework.purpose}」
问题域：「${framework.domain}」

个人约束：
${personalConstraints.length > 0 ? personalConstraints.map(c => `- ${c}`).join('\n') : '（暂无）'}

${conversationInsights ? `对话关键洞察：
${conversationInsights}` : ''}
</stage0_context>

<stage1_framework>
通用框架已生成，包含${framework.nodes.length}个节点
权重设计思路：${framework.weightingLogic}

核心节点（权重≥70%）：
${framework.nodes
  .filter(n => n.weight >= 70)
  .map(n => `- ${n.title} (${n.weight}%): ${n.description.substring(0, 100)}...`)
  .join('\n')}
</stage1_framework>

你的职责：
- 设计3-5个高质量问题，收集个性化信息
- 基于用户回答，后续将调整通用框架的权重
- 生成具体的行动步骤和时间线

关键要求：
- 问题必须能直接影响权重调整决策
- 避免询问Stage 0已经确认的信息
- 每个问题应该影响多个节点（高信息密度）
</workflow_context>

<personal_constraints_usage>
**如何基于个人约束设计高质量问题**：

设计原则：
1. **深入挖掘**：不要重复问已知信息，而是基于已知约束问"如何应对"
   - 已知"零基础" → 问"你倾向通过什么方式学习新知识？（视频/文字/实践）"
   - 已知"每周5小时" → 问"如果某个核心模块需要10小时，你愿意延长时间线还是降低深度？"
   - 已知"工作需要" → 问"你希望在多久内能应用到工作中？有具体的应用场景吗？"

2. **影响权重调整**：每个问题必须能直接指导权重调整
   - 好问题："你的首要目标是快速上手还是系统掌握？" → 影响timeROI的权重系数
   - 好问题："你已有哪些相关知识或技能？" → 可以降低某些前置节点的权重
   - 差问题："你叫什么名字？" → 无法影响任何决策

3. **高信息密度**：一个问题影响多个节点
   - "你更看重理论理解还是实践能力？" → 影响多个节点的学习深度
   - "你有多少时间可以持续投入？" → 影响所有节点的feasibility

你的问题应该"深入"这些约束，挖掘背后的决策信息。
</personal_constraints_usage>

<task>
基于上述context，设计3-5个高质量问题。

问题应该帮助你：
- 评估用户当前水平（已有基础→降低某些节点权重）
- 了解资源限制（时间/精力→调整优先级）
- 识别学习偏好（深度/广度→调整路径）
- 明确应用场景（实际需求→聚焦关键模块）

好问题的特征：
✓ 回答能直接指导权重调整或路径选择
✓ 一个问题影响多个节点（高信息密度）
✓ 开放但有清晰的决策空间

避免：
✗ Stage 0已经问过的信息
✗ 纯粹信息收集而无法指导调整
</task>

输出JSON：questions数组（每个问题含id, question, whyMatters, affects, impactLevel, questionType）`;
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
  
  return `<workflow_context>
你在三阶段认知教练系统的 Stage 2 - 个性化适配阶段（方案生成）

前置阶段（Stage 0和1已完成，用户已回答个性化问题）：

<stage1_universal_framework>
通用框架（为标准学习者设计）：
- 目的：${framework.purpose}
- 节点数：${framework.nodes.length}
- 权重基于客观重要性，未考虑个人因素

核心节点（权重≥70%）：
${framework.nodes
  .filter(n => n.weight >= 70)
  .map(n => `- ${n.title} (${n.weight}%): ${n.weightBreakdown?.necessity ? `necessity=${n.weightBreakdown.necessity.toFixed(2)}` : ''}`)
  .join('\n')}
</stage1_universal_framework>

你的职责：
- 基于用户的个人情况，调整通用框架的权重
- 生成具体可执行的行动步骤
- 提供个性化建议和里程碑

关键原则：
- 权重调整必须有明确的reasoning（基于用户回答）
- 行动步骤必须具体、可执行、有时间线
- 保持框架的整体逻辑，只调整优先级和路径
</workflow_context>

<universal_framework>
${JSON.stringify(framework, null, 2)}
</universal_framework>

<user_info>
用户个性化信息（基于问题回答）：
${infoText}
</user_info>

<principles>
# 设计原则（参考Anthropic的Context Engineering和产品理念）

1. **Right Altitude（合适的抽象高度）**：
   - 不要过度具体化（如"第1天做X，第2天做Y"），给用户灵活空间
   - 也不要过于笼统（如"好好学习Python"），要有可执行性
   - 目标：像专家顾问给建议，而非保姆式指导
   
2. **Just-in-time信息**：
   - 行动步骤应该"刚好够用"，不要过度规划未来
   - 聚焦前3-5个关键步骤，后续步骤可以更概括
   
3. **Attention Budget**：
   - 里程碑不要过多（3-5个足够），太多会分散注意力
   - 个性化建议要高信息密度（每条建议都能产生具体行动）
   
4. **自主判断空间**：
   - 权重调整幅度由你根据用户情况判断（不是固定公式）
   - 行动步骤的颗粒度根据用户水平自主决定
</principles>

<task>
基于用户的实际情况，调整通用框架并生成具体行动计划。

**1. 调整节点权重**
根据用户情况重新评估每个节点的necessity/impact/timeROI：
- 用户已有基础的部分 → 降低necessity和weight
- 用户特别需要的部分 → 提升impact和weight
- 资源受限时 → 提高timeROI权重，优先高效模块

**调整示例**：
- 用户回答"已掌握Python基础" → 降低"Python语法基础"节点weight（如90%→60%）
- 用户回答"主要用于工作数据分析" → 提升"实战项目"节点weight（如75%→85%）
- 用户回答"每周只有5小时" → 重新计算timeROI，优先高ROI节点

**关键**：权重调整幅度由你根据具体情况判断，没有固定公式。

**2. 生成行动步骤**
将框架节点转化为具体可执行步骤：
- 关联到具体节点
- 包含时间线和优先级
- 考虑依赖关系
- 具体到"做什么"而非"学什么"
- 前3-5步要详细，后续可以更概括

**颗粒度示例**：
- 好："\u5b8c\u6210Python官方教程1-5章，重点理解列表和字典"
- 差（过粗）："\u5b66\u4e60Python基础"
- 差（过细）："\u7b2c1\u5929\u65e9\u4e0a8\u70b9\u770b\u7b2c1\u7ae0\uff0c\u665a\u4e0a7\u70b9\u7b2c2\u7ae0"

**3. 设置里程碑**
标识关键检查点和成功标准（3-5个即可）

**4. 个性化建议**
3-5条针对用户情况的具体tips（基于用户回答）
- 每条建议都应该能直接转化为行动
- 不要空泛的鼓励话语
</task>

输出JSON格式，包含：
- adjustedFramework（调整后的框架，nodes的weight和weightBreakdown会变化）
- actionSteps（行动步骤数组）
- milestones（里程碑数组）
- personalizedTips（建议数组）
- adjustmentRationale（调整说明，必须提到具体的用户回答和权重变化）

用你的专业判断决定具体的权重调整幅度和行动步骤设计。`;
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

