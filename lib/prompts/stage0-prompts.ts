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
// 阶段1: 思考过程生成（Streaming展示）
// ============================================

/**
 * 生成思考过程的prompt
 * 参考Cursor设计：展示真实推理，增强可信度
 */
export function getThinkingPrompt(
  action: 'initial' | 'continue',
  userInput?: string,
  conversationHistory?: ChatMessage[],
  currentDefinition?: Partial<PurposeDefinition>
): string {
  if (action === 'initial') {
    return `你是专业的需求分析师。用户刚提交了一个问题，请简短地描述你的思考过程（2-3句话）。

用户输入："${userInput}"

请用第一人称简短描述你的分析思路，例如：
- 我注意到用户提到了[X]，这可能意味着...
- 这个问题涉及[Y]领域，我需要了解...
- 为了更好理解需求，我应该询问...

保持简洁，直接输出你的思考（不要包含"思考："等前缀）。`;
  } else {
    const historyText = conversationHistory
      ?.map(msg => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
      .join('\n') || '';
    
    return `基于对话历史，请简短描述你现在的思考（2-3句话）。

<对话历史>
${historyText}
</对话历史>

<当前理解>
目的：${currentDefinition?.clarifiedPurpose || '待明确'}
领域：${currentDefinition?.problemDomain || '待确定'}
信心度：${currentDefinition?.confidence || 0}
</当前理解>

请用第一人称描述你的分析，例如：
- 从对话来看，用户真正关心的是...
- 我注意到还缺少[X]信息...
- 现在清晰度达到[Y]%，我需要进一步了解...

保持简洁，直接输出你的思考。`;
  }
}

// ============================================
// 阶段2: 结构化输出生成（JSON格式）
// ============================================

/**
 * 基于思考过程生成结构化输出
 * 这个prompt更简洁，因为思考已经完成
 * 注：thinkingContext暂时保留用于未来可能的优化
 */
export function getStructuredOutputPrompt(
  action: 'initial' | 'continue',
  userInput?: string,
  conversationHistory?: ChatMessage[],
  currentDefinition?: Partial<PurposeDefinition>,
  _thinkingContext?: string // 前缀下划线标记为预留参数
): string {
  if (action === 'initial') {
    return getInitialCollectionPrompt(userInput || '');
  } else {
    return getDeepDivePrompt(
      conversationHistory || [],
      currentDefinition || {}
    );
  }
}

// ============================================
// Round 1: 初始收集
// ============================================

export function getInitialCollectionPrompt(userInput: string): string {
  return `你是专业的目的澄清专家（三阶段认知教练系统 Stage 0/3）。

<context>
你的角色：通过精准对话深入理解用户真实需求
后续使用：Stage1用你的输出生成通用框架，Stage2进行个性化调整
关键职责：区分边界约束（影响问题范围）vs 个人约束（影响执行方式）
</context>

用户输入：${userInput}

<principles>
# 核心原则（参考Anthropic的Context Engineering）
1. 给模型自主判断空间：不要过度硬编码规则，通过清晰的目标引导
2. 保持上下文精简：只问最关键的问题
3. 优先WHY而非WHAT：理解深层动机比表面需求更重要
</principles>

<task>
生成一个开放、精准的问题，引导用户说出：
1. **深层动机（WHY）**：为什么想做这件事？背后的真实需求是什么？
2. **具体场景**：在什么情况下需要？有什么具体触发点？
3. **初步边界**：想包括什么、排除什么？

问题设计要求：
- 简洁直接（1-2句话）
- 开放式，给用户充分表达空间
- 避免假设和猜测
- 优先探索WHY而非HOW
</task>

输出JSON格式：
{
  "analysis": {
    "possible_domains": ["领域1", "领域2"],
    "possible_purposes": ["目的1", "目的2"],
    "initial_clues": ["线索1", "线索2"]
  },
  "next_question": "你的问题"
}`;
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
  
  return `你是专业的需求分析师（三阶段认知教练系统 Stage 0/3）。

<workflow_context>
你的职责：通过对话澄清用户的真实目的和问题域边界
后续流程：
- Stage 1将使用clarifiedPurpose + boundaryConstraints生成通用框架
- Stage 2将使用personalConstraints进行个性化调整
因此：你必须准确区分边界约束（影响问题范围）vs 个人约束（影响执行方式）
</workflow_context>

<principles>
# 设计原则（参考Anthropic的Context Engineering实践）
1. **Attention Budget管理**：
   - 保持问题简洁（1-2句），减少认知负担
   - 每轮只聚焦1个核心问题，避免信息过载
   
2. **给予自主判断空间**：
   - 不硬编码规则，用清晰目标引导
   - 相信自己的推理能力，灵活应对用户的多样性
   
3. **Just-in-time信息检索**：
   - 优先探索WHY（深层动机）而非HOW（执行细节）
   - 当信心度<0.85时才继续追问
</principles>

<conversation_history>
${historyText}
</conversation_history>

<current_understanding>
原始输入：${currentDefinition.rawInput || '未知'}
问题域推测：${currentDefinition.problemDomain || '待确定'}
目的推测：${currentDefinition.clarifiedPurpose || '待明确'}
已识别约束：${currentDefinition.keyConstraints?.join(', ') || '无'}
当前信心度：${currentDefinition.confidence || 0}
</current_understanding>

<goal>
通过对话达成三个目标：
1. **深层动机清晰**：理解WHY（为什么重要），而非只知道WHAT
2. **问题域边界明确**：清楚包括什么、排除什么
3. **约束准确分类**：区分边界约束 vs 个人约束

追问原则：
- 优先追问WHY（动机）而非HOW（执行）
- 问题简洁直接（1-2句话）
- 避免啰嗦和重复已知信息
- 每轮聚焦1个核心点
</goal>

<decision_criteria>
评估clarity_score（0-1）：
- ≥0.85 且missing_info为空 → action: "confirm"（进入最终确认）
- <0.85 → action: "continue"（继续追问）

缺失信息示例：
- 不清楚WHY → 继续问动机
- 边界模糊 → 继续问范围
- 约束未分类 → 继续澄清约束性质
</decision_criteria>

输出JSON格式：
{
  "assessment": {
    "clarity_score": 0.0-1.0,
    "missing_info": ["缺失的信息点"],
    "confidence": 0.0-1.0
  },
  "action": "continue" 或 "confirm",
  "next_question": "你的问题（如果action是continue）"
}`;
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

