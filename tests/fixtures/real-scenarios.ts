/**
 * 真实用户场景 - 用于测试Context Engineering优化效果
 * 
 * 包含5个典型场景，覆盖不同领域和复杂度
 */

import type { ChatMessage, PurposeDefinition, UniversalFramework } from '@/lib/types-v2';

// ============================================
// 场景1: 技能学习 - Python数据分析
// ============================================

export const scenario1_pythonDataAnalysis = {
  id: 'python-data-analysis',
  name: 'Python数据分析学习',
  description: '零基础学习Python进行业务数据分析',
  
  stage0: {
    initialInput: '我想学Python做数据分析',
    
    conversationHistory: [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: '我想学Python做数据分析',
        timestamp: Date.now(),
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: '很好的目标！能否告诉我，你为什么想学Python数据分析？是工作需要，还是兴趣探索，或者有其他原因？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-3',
        role: 'user' as const,
        content: '我现在是市场部的，经常需要处理Excel数据做报表，但数据量越来越大，Excel很慢。听说Python可以自动化处理，想提升工作效率。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-4',
        role: 'assistant' as const,
        content: '明白了，主要是为了提升数据处理效率。那你希望达到什么程度呢？比如，是想能够独立完成数据清洗和基础分析，还是希望能做更深入的数据挖掘？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-5',
        role: 'user' as const,
        content: '主要是能独立处理日常的销售数据、客户数据，做一些基础的统计分析和图表就够了。太高深的不需要。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-6',
        role: 'assistant' as const,
        content: '非常清晰。最后问一下，你的编程基础如何？有没有时间或其他限制？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-7',
        role: 'user' as const,
        content: '完全零基础，没写过代码。时间的话，每天下班后能抽1-2小时，希望3个月内能用起来。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-8',
        role: 'assistant' as const,
        content: '好的，让我总结确认一下：\n\n你希望学习Python数据分析，目的是提升工作中的数据处理效率，替代Excel处理大量销售和客户数据。目标是能够独立完成数据清洗、基础统计分析和图表制作。\n\n你目前是零编程基础，计划每天投入1-2小时，希望在3个月内掌握并应用到工作中。\n\n主要约束：\n- 零编程基础\n- 每天1-2小时\n- 3个月时间框\n- 应用场景：业务数据处理（非深度数据科学）\n\n这样理解准确吗？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-9',
        role: 'user' as const,
        content: '完全正确！',
        timestamp: Date.now(),
      },
    ] as ChatMessage[],
    
    purposeDefinition: {
      rawInput: '我想学Python做数据分析',
      clarifiedPurpose: '学习Python进行业务数据分析，能够独立完成Excel数据处理和基础报表生成，提升工作效率',
      problemDomain: 'Python编程学习（数据分析方向）',
      domainBoundary: '包括：Python基础语法、Pandas数据处理、基础可视化、SQL查询。不包括：机器学习、深度数据科学、Web开发。',
      keyConstraints: ['零编程基础', '每天1-2小时', '3个月时间框', '应用于业务数据处理场景'],
      confidence: 0.95,
      clarificationState: 'COMPLETED' as const,
      conversationHistory: [] as ChatMessage[],
    } as PurposeDefinition,
  },
  
  // 预期token消耗（优化前）
  expectedTokens_before: {
    stage0_conversation: 800,  // 9轮对话
    stage1_prompt: 3500,
    stage2_prompt: 2000,
    total: 6300,
  },
  
  // 预期token消耗（优化后）
  expectedTokens_after: {
    stage0_conversation: 800,  // 9轮无需压缩
    stage1_prompt: 1600,
    stage2_prompt: 1400,
    total: 3800,
  },
};

// ============================================
// 场景2: 职业转型 - 技术支持→产品经理
// ============================================

export const scenario2_careerTransition = {
  id: 'career-transition-pm',
  name: '职业转型（技术支持→产品经理）',
  description: '从技术支持转型为B端产品经理',
  
  stage0: {
    initialInput: '我想从技术支持转做产品经理',
    
    // 10轮对话（会触发压缩）
    conversationHistory: [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: '我想从技术支持转做产品经理',
        timestamp: Date.now(),
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: '很有挑战的转型目标！能说说你为什么想做这个转变吗？是什么吸引你转向产品经理？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-3',
        role: 'user' as const,
        content: '我做技术支持3年了，经常和客户沟通，发现很多产品功能设计不合理。我有很多改进想法，但没有决策权。想转产品经理，能真正影响产品设计。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-4',
        role: 'assistant' as const,
        content: '你有丰富的客户接触经验，这是很大的优势。那你对B端产品还是C端产品更感兴趣？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-5',
        role: 'user' as const,
        content: '我们公司做的就是企业软件，我想继续做B端。我觉得自己对企业客户需求理解比较深。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-6',
        role: 'assistant' as const,
        content: '非常好，B端产品经理确实需要深厚的业务理解。你目前对产品管理的技能掌握如何？比如需求分析、产品设计、项目管理这些？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-7',
        role: 'user' as const,
        content: '几乎没有系统学过，都是碎片化了解。我会写简单的SQL查数据，也参加过一些产品讨论会，但不懂PRD怎么写，原型图也不会画。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-8',
        role: 'assistant' as const,
        content: '明白了。那你计划什么时候转型？是边学边找机会，还是有具体时间表？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-9',
        role: 'user' as const,
        content: '我想半年后转，现在部门有个产品助理的内部机会，但需要展示产品能力。所以我想先系统学习，准备作品集。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-10',
        role: 'assistant' as const,
        content: '时间线很清晰。最后一个问题，你每周能投入多少时间学习？有什么特殊限制吗？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-11',
        role: 'user' as const,
        content: '工作日晚上2小时，周末能拿出一天。没有其他大的限制，就是希望学的东西实用，能直接用来准备作品集。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-12',
        role: 'assistant' as const,
        content: '完美。让我总结确认：\n\n你目标是从技术支持转型为B端产品经理，核心动机是想用自己对客户需求的理解来影响产品设计。你有3年技术支持经验，熟悉企业软件领域，有客户沟通优势。\n\n当前技能：SQL基础、参与过产品讨论，但缺乏系统的产品管理技能（需求分析、PRD、原型设计）。\n\n时间规划：6个月内完成转型，准备内部产品助理岗位，需要准备作品集展示能力。\n\n学习时间：工作日每晚2小时 + 周末1天，强调实用性和可落地。\n\n准确吗？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-13',
        role: 'user' as const,
        content: '非常准确！',
        timestamp: Date.now(),
      },
    ] as ChatMessage[],
    
    purposeDefinition: {
      rawInput: '我想从技术支持转做产品经理',
      clarifiedPurpose: '从技术支持转型为B端产品经理，利用现有企业软件经验，系统掌握产品设计和管理能力，6个月内完成转型',
      problemDomain: '职业转型（技术支持→B端产品经理）',
      domainBoundary: '包括：产品思维培养、需求分析、PRD撰写、原型设计、B端产品特性。不包括：C端产品、技术开发、数据科学。',
      keyConstraints: ['3年技术支持经验', '6个月转型时间表', '需要准备作品集', '每周约12小时学习时间', '强调实用性'],
      confidence: 0.95,
      clarificationState: 'COMPLETED' as const,
      conversationHistory: [] as ChatMessage[],
    } as PurposeDefinition,
  },
  
  expectedTokens_before: {
    stage0_conversation: 1200,  // 13轮对话
    stage1_prompt: 3500,
    stage2_prompt: 2000,
    total: 6700,
  },
  
  expectedTokens_after: {
    stage0_conversation: 600,  // 压缩后
    stage1_prompt: 1600,
    stage2_prompt: 1400,
    total: 3600,
  },
};

// ============================================
// 场景3: 问题解决 - 提升个人工作效率
// ============================================

export const scenario3_productivityImprovement = {
  id: 'productivity-improvement',
  name: '提升个人工作效率',
  description: '系统化提升工作效率和时间管理能力',
  
  stage0: {
    initialInput: '感觉每天都很忙但效率不高，想改善',
    
    conversationHistory: [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: '感觉每天都很忙但效率不高，想改善',
        timestamp: Date.now(),
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: '我理解这种感觉。能具体说说你觉得哪些方面效率不高吗？是时间管理、任务优先级、还是工作方法的问题？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-3',
        role: 'user' as const,
        content: '主要是事情太杂了，经常被打断。早上计划好要做的事，到晚上发现没完成多少，都被临时任务占用了。而且总觉得在做不重要的事。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-4',
        role: 'assistant' as const,
        content: '听起来有任务优先级和时间分配的问题。你希望达到什么状态？比如，每天能高效完成核心任务？还是希望有更好的工作生活平衡？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-5',
        role: 'user' as const,
        content: '两个都想要。我希望能掌控自己的时间，知道什么重要什么不重要，不被琐事淹没。工作时高效专注，下班能准时走，不用加班。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-6',
        role: 'assistant' as const,
        content: '很明确的目标。你现在有尝试过什么方法吗？比如待办清单、时间规划工具之类的？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-7',
        role: 'user' as const,
        content: '试过很多待办APP，但坚持不下来。感觉缺少一套系统的方法，不知道怎么真正用起来。',
        timestamp: Date.now(),
      },
    ] as ChatMessage[],
    
    purposeDefinition: {
      rawInput: '感觉每天都很忙但效率不高，想改善',
      clarifiedPurpose: '系统化提升个人工作效率，掌握时间管理和任务优先级方法，实现工作高效专注、准时下班、避免被琐事淹没',
      problemDomain: '个人效率提升与时间管理',
      domainBoundary: '包括：时间管理方法、任务优先级判断、专注力提升、工具使用。不包括：团队管理、项目管理、深度工作技能培养。',
      keyConstraints: ['经常被打断', '临时任务多', '尝试过工具但未坚持', '希望快速见效'],
      confidence: 0.90,
      clarificationState: 'COMPLETED' as const,
      conversationHistory: [] as ChatMessage[],
    } as PurposeDefinition,
  },
  
  expectedTokens_before: {
    stage0_conversation: 650,
    stage1_prompt: 3500,
    stage2_prompt: 2000,
    total: 6150,
  },
  
  expectedTokens_after: {
    stage0_conversation: 650,  // 7轮无需压缩
    stage1_prompt: 1600,
    stage2_prompt: 1400,
    total: 3650,
  },
};

// ============================================
// 场景4: 知识体系构建 - 掌握机器学习
// ============================================

export const scenario4_mlLearning = {
  id: 'machine-learning-mastery',
  name: '机器学习知识体系构建',
  description: '有编程基础，想系统掌握机器学习',
  
  stage0: {
    initialInput: '想学机器学习，但不知道从哪开始',
    
    conversationHistory: [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: '想学机器学习，但不知道从哪开始',
        timestamp: Date.now(),
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: '机器学习是个大领域。你学习机器学习的目的是什么？是为了工作应用、学术研究，还是兴趣探索？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-3',
        role: 'user' as const,
        content: '我是软件工程师，想转型做算法工程师。公司有AI团队，我想加入，但需要证明自己有机器学习能力。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-4',
        role: 'assistant' as const,
        content: '明白了，是职业发展需求。你的编程和数学基础如何？机器学习对这两方面都有要求。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-5',
        role: 'user' as const,
        content: 'Python很熟练，做过3年Web开发。数学的话，大学学过高数和线代，但很多忘了，概率统计比较薄弱。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-6',
        role: 'assistant' as const,
        content: '编程基础很好。你希望达到什么水平？能独立完成项目？还是理解原理就够？公司的AI团队主要做什么方向？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-7',
        role: 'user' as const,
        content: '他们主要做推荐系统和NLP。我希望能理解常见算法原理，并且能用框架（TensorFlow或PyTorch）实现模型，做一些项目证明能力。',
        timestamp: Date.now(),
      },
      {
        id: 'msg-8',
        role: 'assistant' as const,
        content: '目标很具体。时间上有什么计划？多久希望达成这个转型？',
        timestamp: Date.now(),
      },
      {
        id: 'msg-9',
        role: 'user' as const,
        content: '计划1年内转型。前半年系统学习，后半年做项目积累。每天能投入2-3小时。',
        timestamp: Date.now(),
      },
    ] as ChatMessage[],
    
    purposeDefinition: {
      rawInput: '想学机器学习，但不知道从哪开始',
      clarifiedPurpose: '系统掌握机器学习知识体系，从软件工程师转型为算法工程师，重点掌握推荐系统和NLP，能够使用深度学习框架实现模型',
      problemDomain: '机器学习知识体系构建（偏向推荐系统和NLP）',
      domainBoundary: '包括：机器学习基础理论、常见算法、深度学习、TensorFlow/PyTorch、推荐系统、NLP基础。不包括：理论数学证明、强化学习、计算机视觉深度内容。',
      keyConstraints: ['有Python基础', '数学需要补强', '1年转型时间表', '每天2-3小时', '目标是算法工程师岗位'],
      confidence: 0.93,
      clarificationState: 'COMPLETED' as const,
      conversationHistory: [] as ChatMessage[],
    } as PurposeDefinition,
  },
  
  expectedTokens_before: {
    stage0_conversation: 850,
    stage1_prompt: 3500,
    stage2_prompt: 2000,
    total: 6350,
  },
  
  expectedTokens_after: {
    stage0_conversation: 850,
    stage1_prompt: 1600,
    stage2_prompt: 1400,
    total: 3850,
  },
};

// ============================================
// 场景5: 长期规划 - 3年职业发展计划
// ============================================

export const scenario5_careerPlanning = {
  id: 'career-planning-3years',
  name: '3年职业发展规划',
  description: '制定清晰的3年职业发展路径',
  
  stage0: {
    initialInput: '想做一个3年的职业规划',
    
    // 较长对话（15轮）
    conversationHistory: Array.from({ length: 15 }, (_, i) => {
      const turnNumber = Math.floor(i / 2) + 1;
      const isUser = i % 2 === 0;
      
      const userMessages = [
        '想做一个3年的职业规划',
        '我现在是初级前端开发，工作2年了，感觉需要明确未来方向，不想一直停留在初级水平',
        '技术路线。我比较喜欢写代码，但也想有更大的影响力，不确定是走技术专家还是技术管理',
        '技术栈的话，React和TypeScript比较熟，Node.js一般，其他都不太懂。软技能可能比较弱，不太会带人',
        '希望3年后能成为团队的技术骨干，可以独立负责核心模块，薪资能翻倍',
        '大厂，我在一家创业公司，想去大厂镀金，但不确定现在水平能不能进',
        '试过，但大厂面试挂了两次，主要是算法和系统设计不过关',
        '还没有明确计划，所以想做个3年规划。希望第一年补基础，第二年进大厂，第三年做到高级工程师',
      ];
      
      const aiMessages = [
        '很好的自我投资！能说说你目前的职业状态吗？比如工作年限、当前岗位、遇到什么瓶颈？',
        '2年经验是个很好的阶段做规划。你希望往技术路线发展，还是管理路线？或者还没想清楚？',
        '这个阶段确实需要选择。你目前的技术栈和软技能如何？这能帮助判断更适合哪个方向',
        '明白了，技术基础不错但还有成长空间。你说的"更大影响力"具体指什么？领导团队，还是做更核心的技术工作？',
        '目标很清晰。这个"团队技术骨干"是在当前公司，还是希望去更大的平台？',
        '想去大厂是很多人的目标。你尝试过面试吗？知道差距在哪吗？',
        '大厂面试确实难。那你对这3年有初步时间分配的想法吗？',
      ];
      
      return {
        id: `msg-${i + 1}`,
        role: isUser ? 'user' as const : 'assistant' as const,
        content: isUser 
          ? userMessages[turnNumber - 1] || `用户回复 ${turnNumber}`
          : aiMessages[turnNumber - 1] || `AI提问 ${turnNumber}`,
        timestamp: Date.now() + i * 1000,
      };
    }),
    
    purposeDefinition: {
      rawInput: '想做一个3年的职业规划',
      clarifiedPurpose: '制定3年职业发展路径：从初级前端到高级工程师，第一年补强算法和系统设计，第二年进入大厂，第三年成为团队技术骨干，实现薪资翻倍',
      problemDomain: '职业规划（前端工程师技术路线）',
      domainBoundary: '包括：技术能力提升路径、面试准备策略、职业选择决策、软技能培养。不包括：具体技术教学、管理路线规划、创业指导。',
      keyConstraints: ['2年前端经验', '算法和系统设计薄弱', '目标是大厂高级工程师', '3年时间框架', '希望薪资翻倍'],
      confidence: 0.92,
      clarificationState: 'COMPLETED' as const,
      conversationHistory: [] as ChatMessage[],
    } as PurposeDefinition,
  },
  
  expectedTokens_before: {
    stage0_conversation: 1500,  // 15轮长对话
    stage1_prompt: 3500,
    stage2_prompt: 2000,
    total: 7000,
  },
  
  expectedTokens_after: {
    stage0_conversation: 700,  // 压缩后
    stage1_prompt: 1600,
    stage2_prompt: 1400,
    total: 3700,
  },
};

// ============================================
// 导出所有场景
// ============================================

export const ALL_SCENARIOS = [
  scenario1_pythonDataAnalysis,
  scenario2_careerTransition,
  scenario3_productivityImprovement,
  scenario4_mlLearning,
  scenario5_careerPlanning,
];

// ============================================
// 辅助函数
// ============================================

/**
 * 获取场景的汇总统计
 */
export function getScenarioStats() {
  return {
    totalScenarios: ALL_SCENARIOS.length,
    avgConversationTurns: ALL_SCENARIOS.reduce(
      (sum, s) => sum + s.stage0.conversationHistory.length,
      0
    ) / ALL_SCENARIOS.length,
    expectedTotalSavings: ALL_SCENARIOS.reduce(
      (sum, s) => sum + (s.expectedTokens_before.total - s.expectedTokens_after.total),
      0
    ),
    expectedAvgSavingsPercent: ALL_SCENARIOS.reduce(
      (sum, s) => sum + ((s.expectedTokens_before.total - s.expectedTokens_after.total) / s.expectedTokens_before.total * 100),
      0
    ) / ALL_SCENARIOS.length,
  };
}

/**
 * 按ID获取场景
 */
export function getScenarioById(id: string) {
  return ALL_SCENARIOS.find(s => s.id === id);
}

/**
 * 获取需要压缩测试的场景（对话轮数>10）
 */
export function getCompactionScenarios() {
  return ALL_SCENARIOS.filter(
    s => s.stage0.conversationHistory.length > 10
  );
}

