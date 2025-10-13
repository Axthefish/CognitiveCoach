/**
 * Stage 0 Few-shot Examples
 * 
 * 高质量对话示例，用于calibrate AI的澄清行为
 */

export interface Stage0Example {
  id: string;
  domain: string;
  userInput: string;
  conversationFlow: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  finalOutput: {
    clarifiedPurpose: string;
    problemDomain: string;
    domainBoundary: string;
    keyConstraints: string[];
  };
  reasoning: string;
}

export const STAGE0_EXAMPLES: Stage0Example[] = [
  {
    id: 'data-analysis-learning',
    domain: '技能学习',
    userInput: '我想学Python',
    conversationFlow: [
      {
        role: 'assistant',
        content: '很好！学Python有很多不同的方向。能说说你打算用Python做什么吗？比如数据分析、Web开发、自动化脚本等？'
      },
      {
        role: 'user',
        content: '主要是工作需要，我们部门经常需要处理Excel数据，做一些报表'
      },
      {
        role: 'assistant',
        content: '明白了。那你目前有编程基础吗？处理的数据大概是什么规模？另外，你希望多久能够上手处理实际工作？'
      },
      {
        role: 'user',
        content: '完全零基础。数据量不大，一般就几千到几万行。希望能在2-3个月内可以独立做一些简单分析'
      }
    ],
    finalOutput: {
      clarifiedPurpose: '学习Python进行业务数据分析，能够独立完成Excel数据处理和基础报表生成',
      problemDomain: 'Python编程学习（数据分析方向）',
      domainBoundary: '包括：Python基础语法、Pandas数据处理、基础可视化。不包括：机器学习、大数据处理、Web开发',
      keyConstraints: [
        '零编程基础',
        '数据规模：几千到几万行',
        '时间限制：2-3个月',
        '应用场景：工作中的Excel数据处理'
      ]
    },
    reasoning: '通过3轮对话明确了：(1)WHY-工作需要 (2)WHAT-数据分析不是开发 (3)约束-零基础、小数据、3个月时限'
  },
  
  {
    id: 'career-transition',
    domain: '职业发展',
    userInput: '我想转行做产品经理',
    conversationFlow: [
      {
        role: 'assistant',
        content: '转行做产品经理是个不错的选择。能说说你为什么想做这个转变吗？是当前工作不满意，还是对产品工作特别感兴趣？'
      },
      {
        role: 'user',
        content: '我现在做技术支持，感觉没什么成长空间。之前参与过一些产品讨论，觉得产品思维很有意思，而且我比较喜欢和人打交道'
      },
      {
        role: 'assistant',
        content: '明白了。那你打算转向什么类型的产品？比如B端企业软件、C端消费产品、还是技术类产品？另外，你有多少时间可以投入准备？'
      },
      {
        role: 'user',
        content: '我比较熟悉企业软件，想继续做B端。现在每周大概能抽出10-15小时学习，希望半年到一年内能找到机会'
      }
    ],
    finalOutput: {
      clarifiedPurpose: '从技术支持转型为B端产品经理，利用现有企业软件经验，系统掌握产品设计和管理能力',
      problemDomain: '职业转型（技术支持→B端产品经理）',
      domainBoundary: '包括：产品思维培养、需求分析、原型设计、项目管理。不包括：C端产品、营销推广、编程开发',
      keyConstraints: [
        '现有背景：技术支持，熟悉企业软件',
        '学习时间：每周10-15小时',
        '转型时限：6-12个月',
        '目标方向：B端SaaS产品'
      ]
    },
    reasoning: '核心动机是成长而非逃避，有相关经验基础，目标明确（B端），时间规划合理'
  },
  
  {
    id: 'personal-project',
    domain: '项目规划',
    userInput: '我想做一个个人博客',
    conversationFlow: [
      {
        role: 'assistant',
        content: '搭建个人博客很有意义！能说说你主要想用博客做什么吗？是分享技术文章、生活记录、还是展示作品集？'
      },
      {
        role: 'user',
        content: '主要是写技术文章，记录自己的学习过程。顺便也想学学前端开发'
      },
      {
        role: 'assistant',
        content: '很好的想法。那你对博客有什么特殊要求吗？比如自定义程度、SEO、评论功能等？另外，你目前的前端基础如何？'
      },
      {
        role: 'user',
        content: '希望能自由定制样式，SEO对我很重要因为想让更多人看到。我只会一点HTML/CSS，JS基本不会。对了，最好不要太复杂，我想快点上线开始写文章'
      }
    ],
    finalOutput: {
      clarifiedPurpose: '搭建一个可定制的技术博客，同时学习前端开发，优先快速上线能够发布内容',
      problemDomain: '个人博客搭建（技术分享+前端学习）',
      domainBoundary: '包括：静态网站搭建、基础前端技术、Markdown写作、SEO优化。不包括：后端开发、复杂交互、数据库设计',
      keyConstraints: [
        '前端基础：HTML/CSS入门，JS零基础',
        '核心诉求：快速上线 > 功能完善',
        '必需功能：内容发布、样式自定义、SEO',
        '双重目标：博客上线 + 技能学习'
      ]
    },
    reasoning: '识别出双重目标（博客+学习），优先级明确（快速上线），技术选型需平衡学习和效率'
  },
  
  {
    id: 'skill-improvement',
    domain: '能力提升',
    userInput: '我想提升沟通能力',
    conversationFlow: [
      {
        role: 'assistant',
        content: '提升沟通能力是很重要的投资。能具体说说你在哪些场景下感觉沟通不够好吗？是工作汇报、团队协作、还是客户交流？'
      },
      {
        role: 'user',
        content: '主要是开会的时候。我是技术背景，经常需要给业务同事讲技术方案，但他们总说听不懂，我也不知道怎么讲更清楚'
      },
      {
        role: 'assistant',
        content: '这是很多技术人员都会遇到的挑战。那你希望达到什么程度？另外，你有机会练习吗？比如团队内部分享、或者其他场合？'
      },
      {
        role: 'user',
        content: '希望能让非技术人员听懂我的方案，不要总是沟通卡壳。我们每周有技术评审会，每个月有一次跨部门汇报，可以利用这些机会练习'
      }
    ],
    finalOutput: {
      clarifiedPurpose: '提升技术方案的跨部门沟通能力，能够让非技术背景的业务同事理解技术方案和决策',
      problemDomain: '跨领域沟通能力提升（技术→业务）',
      domainBoundary: '包括：技术翻译能力、结构化表达、听众分析、可视化呈现。不包括：演讲技巧、谈判技巧、文字写作',
      keyConstraints: [
        '场景限定：会议中的技术方案讲解',
        '听众特征：非技术背景的业务同事',
        '练习机会：每周技术评审+每月跨部门汇报',
        '核心痛点：技术术语翻译、复杂概念简化'
      ]
    },
    reasoning: '问题具体（不是泛泛的"沟通能力"），场景明确（会议），有实践机会，目标可衡量'
  }
];

/**
 * 根据关键词匹配相关示例
 */
export function findRelevantStage0Examples(
  userInput: string,
  maxExamples: number = 2
): Stage0Example[] {
  const input = userInput.toLowerCase();
  
  // 关键词匹配得分
  const scores = STAGE0_EXAMPLES.map(example => {
    let score = 0;
    
    // 领域匹配
    if (input.includes(example.domain)) score += 3;
    
    // 用户输入相似度
    const exampleKeywords = example.userInput.toLowerCase().split(' ');
    exampleKeywords.forEach(keyword => {
      if (input.includes(keyword)) score += 1;
    });
    
    return { example, score };
  });
  
  // 排序并返回top N，但只返回有匹配的（score > 0）
  return scores
    .filter(item => item.score > 0)  // 只保留有匹配的
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExamples)
    .map(item => item.example);
}

/**
 * 格式化示例用于prompt注入
 */
export function formatStage0Example(example: Stage0Example): string {
  const conversation = example.conversationFlow
    .map(turn => `${turn.role === 'user' ? '用户' : 'AI'}: ${turn.content}`)
    .join('\n\n');
  
  return `**示例：${example.domain} - "${example.userInput}"**

对话过程：
${conversation}

最终澄清结果：
- 目的：${example.finalOutput.clarifiedPurpose}
- 问题域：${example.finalOutput.problemDomain}
- 边界：${example.finalOutput.domainBoundary}
- 约束：${example.finalOutput.keyConstraints.join('；')}

关键点：${example.reasoning}`;
}

