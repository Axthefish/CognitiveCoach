/**
 * Stage 0 Prompt 模板 - 目的澄清与问题域框定
 * 
 * 这是整个产品的起点，通过多轮对话从用户的模糊输入中提取：
 * 1. 真实目的 (Why)
 * 2. 问题域边界 (What & Scope)
 * 3. 关键约束 (Constraints)
 */

import type { ChatMessage, PurposeDefinition } from '@/lib/types-v2';

// ============================================
// Round 1: 初始收集
// ============================================

export function getInitialCollectionPrompt(userInput: string): string {
  return `<workflow_context>
你在三阶段认知教练系统的 Stage 0 - 目的澄清阶段

你的职责：
- 通过对话深入理解用户的真实目的（WHY）而非表面内容（WHAT）
- 明确问题域边界（包括什么、排除什么）
- 区分两类约束：
  * 边界约束：影响问题域范围（如"不学机器学习"、"只关注前端"）
  * 个人约束：影响执行方式（如"每周5小时"、"零基础"、"偏好视频"）

你的输出将被用于：
- Stage 1：使用clarifiedPurpose + boundaryConstraints生成通用框架
- Stage 2：使用personalConstraints进行个性化调整

因此：准确分类约束至关重要，这直接影响后续两个stage的质量。
</workflow_context>

用户输入：${userInput}

<task>
生成一个开放式问题，引导用户说出：
- 深层动机（WHY）而非表面内容（WHAT）
- 具体场景和范围

问题设计原则：
- 开放式，给用户表达空间
- 自然友好，避免审问感
- 优先问"为什么"和"希望达到什么"
</task>

<analysis>
先快速分析（内部思考）：
- 可能属于什么领域？
- 用户最可能的动机？
- 初步线索？
</analysis>

输出JSON：包含analysis（possible_domains, possible_purposes, initial_clues）和next_question`;
}

// ============================================
// Round 2+: 深入追问
// ============================================

export function getDeepDivePrompt(
  conversationHistory: ChatMessage[],
  currentDefinition: Partial<PurposeDefinition>
): string {
  // 处理可能包含压缩摘要的历史记录
  const historyText = conversationHistory
    .map(msg => {
      // 保留系统消息中的summary标签
      if (msg.role === 'system') {
        return msg.content;
      }
      return `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`;
    })
    .join('\n\n');
  
  return `<workflow_context>
你在三阶段认知教练系统的 Stage 0 - 目的澄清阶段

你的职责：
- 通过对话深入理解用户的真实目的（WHY）
- 明确问题域边界（包括什么、排除什么）
- 区分边界约束（影响问题范围）vs 个人约束（影响执行方式）

你的输出将被用于：
- Stage 1：使用clarifiedPurpose + boundaryConstraints生成通用框架
- Stage 2：使用personalConstraints进行个性化调整

因此：准确分类约束至关重要，这直接影响后续两个stage的质量。
</workflow_context>

<conversation>
${historyText}
</conversation>

<current_understanding>
原始输入：${currentDefinition.rawInput || '未知'}
问题域推测：${currentDefinition.problemDomain || '待确定'}
目的推测：${currentDefinition.clarifiedPurpose || '待明确'}
已识别约束：${currentDefinition.keyConstraints?.join(', ') || '无'}
</current_understanding>

<goal>
通过对话达成：
1. 深层动机清晰（WHY重要）
2. 问题域边界明确（包括/排除什么）
3. 约束明确（边界约束 vs 个人约束）

优先追问WHY（动机）而非HOW（执行）。
</goal>

<decision_criteria>
评估clarity_score（0-1）:
- ≥0.85 且missing_info为空 → action: "confirm"
- <0.85 → action: "continue"，生成next_question
</decision_criteria>

输出JSON：
- assessment（clarity_score, missing_info, confidence）
- action（"continue"或"confirm"）
- next_question（如果continue）`;
}

// ============================================
// 最终确认
// ============================================

export function getConfirmationPrompt(
  conversationHistory: ChatMessage[]
): string {
  const historyText = conversationHistory
    .map(msg => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
    .join('\n');
  
  return `<workflow_context>
你在三阶段认知教练系统的 Stage 0 - 目的澄清阶段（最终确认）

你的职责：
- 基于完整对话，生成结构化的目的定义
- **准确分类约束**：边界约束 vs 个人约束（这是关键！）

你的输出将被用于：
- Stage 1：使用clarifiedPurpose + boundaryConstraints生成通用框架
  * 通用框架适用于该领域的"标准学习者"
  * 权重反映客观重要性，不考虑个人因素
- Stage 2：使用personalConstraints进行个性化调整
  * 基于用户的具体情况调整权重和路径
  * 生成针对性的行动计划

因此：约束分类的准确性直接决定后续两个stage的质量。
</workflow_context>

<conversation>
${historyText}
</conversation>

<task>
综合对话，提取关键信息并分类：

**1. 澄清后的目的** (clarified_purpose)
- 用户的核心目标是什么？为什么重要？
- ⚠️ 必须是通用描述，剥离个人情况（不含"零基础"/"每周X小时"等）
- 示例好："掌握Python进行数据分析" ✓
- 示例差："零基础学Python每周2小时" ✗

**2. 问题域** (problem_domain)
- 用一个专业术语精确描述领域

**3. 问题域边界** (domain_boundary) ⭐
明确范围：
- 包括哪些子领域？
- 明确排除什么？
- 为什么这样划分？

这个边界定义了Stage 1通用框架的生成范围。

**4. 约束分类** ⚠️ 关键区分

分为两类：

**边界约束** (boundary_constraints):
- 定义问题域范围的硬性限制
- 例如："不涉及机器学习"、"仅前端不含后端"
- 作用：缩小通用框架的覆盖范围
- 传递：Stage 1会用这些约束界定框架边界

**个人约束** (personal_constraints):
- 影响执行方式的个人情况
- 例如："每周5小时"、"零基础"、"偏好视频"
- 作用：个性化调整优先级和路径
- 传递：Stage 2才使用，不影响通用框架

**区分标准**：
- 问自己：这个约束是"改变问题本身"还是"改变解决方式"？
- 前者→边界约束，后者→个人约束

**5. 确认消息** (confirmation_message)
- 友好地总结理解，供用户确认
- 包含目的、边界、关键约束
</task>

输出JSON格式，包含上述所有字段。用你的判断决定每个约束应归入哪一类。`;
}

// ============================================
// AI 配置
// ============================================

export function getStage0GenerationConfig() {
  return {
    temperature: 0.7, // 适中的创造性，保持对话自然
    maxOutputTokens: 2000,
    topP: 0.95,
    topK: 40,
  };
}

// ============================================
// 辅助函数：判断输入是否过于模糊
// ============================================

export function isVagueInput(input: string): boolean {
  const trimmed = input.trim();
  
  // 过短
  if (trimmed.length < 5) return true;
  
  // 只有单个词
  if (!trimmed.includes(' ') && trimmed.length < 10) return true;
  
  // 常见的模糊表达
  const vaguePatterns = [
    /^我想学/,
    /^帮我/,
    /^如何/,
    /不知道/,
  ];
  
  return vaguePatterns.some(pattern => pattern.test(trimmed));
}

// ============================================
// 辅助函数：生成友好的引导提示
// ============================================

export function getGuidanceForVagueInput(): string {
  return `看起来你的目标还比较笼统。没关系！我会通过几个问题来帮你理清思路。

首先，能否说说：
- 你为什么想做这件事？
- 有什么具体的场景或需求吗？
- 你希望达到什么样的效果？`;
}

