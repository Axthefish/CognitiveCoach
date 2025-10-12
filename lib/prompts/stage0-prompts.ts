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
  return `你是一个专业的问题澄清专家。用户给了你一个初步的问题或目标，你的任务是通过对话深入理解他们的真实需求。

用户输入：${userInput}

请分析：
1. **可能的问题域**：这个问题可能属于哪2-3个领域？（如：技能学习、职业发展、问题解决、决策支持等）
2. **可能的目的**：用户为什么想做这件事？列出3种最可能的动机
3. **初步线索**：从输入中能看出什么约束条件或特殊情况吗？

然后，生成一个**自然、友好的问题**来进一步了解用户的需求。这个问题应该：
- 聚焦在"为什么"（动机）或"具体是什么"（范围）
- 开放式，让用户有空间详细说明
- 避免让用户感到被审问

请严格按照以下JSON格式输出：
\`\`\`json
{
  "analysis": {
    "possible_domains": ["领域1", "领域2", "领域3"],
    "possible_purposes": ["目的1", "目的2", "目的3"],
    "initial_clues": ["线索1", "线索2"]
  },
  "next_question": "你的开放式问题"
}
\`\`\``;
}

// ============================================
// Round 2+: 深入追问
// ============================================

export function getDeepDivePrompt(
  conversationHistory: ChatMessage[],
  currentDefinition: Partial<PurposeDefinition>
): string {
  const historyText = conversationHistory
    .map(msg => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
    .join('\n');
  
  return `你是一个专业的问题澄清专家。你正在与用户对话，深入了解他们的需求。

**对话历史：**
${historyText}

**当前理解：**
- 原始输入：${currentDefinition.rawInput || '未知'}
- 问题域推测：${currentDefinition.problemDomain || '尚未确定'}
- 目的推测：${currentDefinition.clarifiedPurpose || '尚未明确'}
- 已识别约束：${currentDefinition.keyConstraints?.join(', ') || '无'}

**你的任务：**
评估当前信息的完整度，然后决定：
1. 如果信息已经足够（目的清晰、范围明确、约束已知），输出 action: "confirm"
2. 如果还需要更多信息，生成下一个追问，输出 action: "continue"

追问策略：
- **如果目的模糊**：追问"为什么想做这件事？达成这个目标对你意味着什么？"
- **如果范围不清**：追问"具体包括哪些方面？不包括哪些？"
- **如果约束未知**：追问"有什么限制或特殊情况？时间、资源、背景等"
- **如果动机浅层**：追问更深层的动机和期望

请严格按照以下JSON格式输出：
\`\`\`json
{
  "assessment": {
    "clarity_score": 0.7,
    "missing_info": ["缺失信息1", "缺失信息2"],
    "confidence": 0.8
  },
  "action": "continue",
  "next_question": "你的追问"
}
\`\`\`

或者：

\`\`\`json
{
  "assessment": {
    "clarity_score": 0.95,
    "missing_info": [],
    "confidence": 0.9
  },
  "action": "confirm"
}
\`\`\``;
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
  
  return `你是一个专业的问题澄清专家。基于完整的对话历史，现在需要生成最终的总结和确认。

**完整对话历史：**
${historyText}

**你的任务：**
综合所有对话，提取并总结：

1. **澄清后的目的** (clarified_purpose)
   - 用户的真实目标是什么？
   - 为什么要做这件事？（核心动机）
   - 1-2句话，清晰、可操作

2. **问题域** (problem_domain)
   - 这个问题属于什么领域？
   - 用专业术语精确描述
   - 1句话

3. **问题域边界** (domain_boundary)
   - 明确包括什么、不包括什么
   - 具体的范围界定
   - 2-3句话

4. **关键约束** (key_constraints)
   - 时间、资源、背景等限制
   - 影响方案的重要因素
   - 列表形式

5. **确认消息** (confirmation_message)
   - 一段友好的总结，用于向用户确认理解是否准确
   - 包含以上所有要点
   - 自然、专业的语气

请严格按照以下JSON格式输出：
\`\`\`json
{
  "clarified_purpose": "...",
  "problem_domain": "...",
  "domain_boundary": "...",
  "key_constraints": ["约束1", "约束2", "约束3"],
  "confidence": 0.9,
  "confirmation_message": "根据我们的对话，我理解你的情况是：\\n\\n..."
}
\`\`\``;
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

