// S0 阶段 Prompt - 目标精炼

import type { ConversationMessage } from '../types';

/**
 * S0 响应类型
 */
export interface S0Response {
  status: 'clarification_needed' | 'clarified' | 'recommendations_provided';
  ai_question?: string;
  goal?: string;
  recommendations?: Array<{
    category: string;
    examples: string[];
    description: string;
  }>;
}

/**
 * S0 Prompt 上下文
 */
export interface S0PromptContext {
  userInput: string;
  conversationHistory: ConversationMessage[];
  interactionCount: number;
  isVagueInput?: boolean;
}

/**
 * 格式化对话历史
 */
function formatConversationHistory(history: ConversationMessage[]): string {
  if (history.length === 0) return '无对话历史';
  
  // 智能压缩：保留首次和最近3条
  if (history.length > 4) {
    return [
      `${history[0].role === 'user' ? '用户' : '教练'}: ${history[0].content}`,
      '[...中间对话已省略...]',
      ...history.slice(-3).map(msg => 
        `${msg.role === 'user' ? '用户' : '教练'}: ${msg.content}`
      )
    ].join('\n');
  }
  
  return history
    .map(msg => `${msg.role === 'user' ? '用户' : '教练'}: ${msg.content}`)
    .join('\n');
}

/**
 * 判断用户输入是否模糊
 */
export function isVagueInput(input: string): boolean {
  const lowerInput = input.toLowerCase().trim();
  
  // 模糊指示词
  const vaguePatterns = [
    /不知道/, /不确定/, /帮我/, /推荐/, /建议/,
    /什么/, /怎么/, /没有/, /暂时/
  ];
  
  // 具体实体（如果包含这些则不视为模糊）
  const specificEntityPatterns = [
    /React|Vue|Angular|JavaScript|TypeScript|Python|Java|C\+\+|Go/i,
    /雅思|托福|CFA|PMP|CISSP|AWS|Azure|GCP/i,
    /产品经理|数据分析师|UI设计师|前端|后端|全栈/i,
    /机器学习|人工智能|区块链|云计算|大数据/i,
    /英语|日语|韩语|德语|法语|西班牙语/i,
    /\d+个?月|\d+周|\d+天/
  ];
  
  const hasVagueWords = vaguePatterns.some(pattern => pattern.test(lowerInput));
  const hasSpecificEntities = specificEntityPatterns.some(pattern => pattern.test(input));
  const isTooShort = lowerInput.length < 5;
  
  return (hasVagueWords && !hasSpecificEntities) || isTooShort;
}

/**
 * 构建 S0 Prompt
 */
export function buildS0Prompt(context: S0PromptContext): string {
  const { userInput, conversationHistory, interactionCount, isVagueInput: isVague } = context;
  
  const formattedHistory = formatConversationHistory(conversationHistory);
  const clarificationRounds = conversationHistory.filter(msg => msg.role === 'user').length;
  
  // 基础角色定义
  let prompt = `你是一位专业的认知教练（Cognitive Coach），专门帮助人们明确和精炼学习目标。

当前用户输入：${userInput}

对话历史：
${formattedHistory}

这是第 ${interactionCount} 次交互，已进行 ${clarificationRounds} 轮用户澄清。

核心要求：
1. **总是用简体中文回复**
2. **保持友好和鼓励的语气**
3. **优先一次性补齐关键信息**（主题/期望产出/时间范围），总澄清不超过2轮
4. **仅针对未确认字段发问**；不得重复询问已确认维度
5. **追问与建议必须显式引用已确认字段**，严禁偏题
6. **目标必须具体、可衡量、可达成**
7. **明确的目标必须包含具体主题和期望产出**

响应状态说明：
- **clarification_needed**: 需要进一步澄清，提供 ai_question 字段
- **clarified**: 目标已明确，提供 goal 字段
- **recommendations_provided**: 用户请求推荐，提供 recommendations 和 ai_question 字段

`;

  // 根据场景添加特殊指导
  if (isVague) {
    prompt += `\n【特殊情况】用户输入较为模糊：
- 提供3-5个多样化选项，并包含"其他/自定义"
- 避免二选一措辞
- 允许用户补充文本
- 使用结构化一次性表单式澄清

`;
  }
  
  if (clarificationRounds >= 2) {
    prompt += `\n【达到澄清上限】已进行 ${clarificationRounds} 轮澄清：
- 生成含合理假设的草拟目标
- 请用户一次性确认或指出需要修改的最多2处

`;
  }

  // 示例
  prompt += `\n示例1 - 模糊输入需要澄清：
用户："我想学编程"
响应：
{
  "status": "clarification_needed",
  "ai_question": "为加速明确目标，请一次性回答：1) 具体编程主题（如Web开发、Python数据分析、移动应用开发）；2) 期望产出（作品/证书/岗位能力）；3) 时间范围（如3个月内）。若已有部分明确，仅补充缺失项即可。"
}

示例2 - 目标已明确：
用户："学习 React 构建现代 Web 应用，在3个月内完成一个完整项目"
响应：
{
  "status": "clarified",
  "goal": "在3个月内掌握 React 框架，并独立完成一个包含用户认证、数据管理和响应式设计的现代 Web 应用项目"
}

示例3 - 用户请求推荐：
用户："不知道学什么，请推荐"
响应：
{
  "status": "recommendations_provided",
  "ai_question": "基于不同发展方向，我为您推荐以下学习领域。您可以选择1-2个感兴趣的方向，或者在"其他/自定义"中描述您的具体需求：",
  "recommendations": [
    {
      "category": "技术开发",
      "examples": ["Web开发", "Python编程", "移动应用开发"],
      "description": "掌握编程技能，构建软件产品"
    },
    {
      "category": "数据分析",
      "examples": ["数据科学", "Excel高级应用", "Power BI"],
      "description": "学习数据处理与商业洞察分析"
    },
    {
      "category": "设计创作",
      "examples": ["UI/UX设计", "平面设计", "视频剪辑"],
      "description": "培养视觉设计与创意表达能力"
    },
    {
      "category": "职业技能",
      "examples": ["项目管理", "演讲表达", "英语口语"],
      "description": "提升职场竞争力和沟通协作能力"
    },
    {
      "category": "其他/自定义",
      "examples": ["请描述您的具体学习需求"],
      "description": "如果以上都不合适，请告诉我您想学习的具体内容"
    }
  ]
}

输出格式：
- 必须返回有效的JSON格式
- 只包含与所选status相关的字段
- 不包含null值 - 省略不必要的字段
- 提供推荐时，始终包含ai_question来引导用户选择
- 确保JSON格式正确，使用正确的引号和括号

请基于以上信息和要求，生成你的响应（仅返回JSON，不要包含其他文字）：`;

  return prompt;
}

/**
 * S0 Prompts 导出
 */
export const S0_PROMPTS = {
  /**
   * 生成目标精炼 Prompt
   */
  refineGoal: (context: S0PromptContext): string => {
    return buildS0Prompt(context);
  },

  /**
   * 获取生成配置
   */
  getGenerationConfig: (tier: 'Lite' | 'Pro' | 'Review' = 'Pro') => {
    return {
      temperature: tier === 'Lite' ? 0.3 : 0.5,
      maxOutputTokens: 4096,
      topP: 0.9,
      topK: 40,
    };
  },
};

