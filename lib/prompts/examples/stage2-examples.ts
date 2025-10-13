/**
 * Stage 2 Few-shot Examples
 * 
 * 高质量问题和个性化方案示例
 */

export interface Stage2QuestionExample {
  id: string;
  domain: string;
  frameworkSummary: string;
  goodQuestions: Array<{
    question: string;
    whyGood: string;
    affects: string[];
  }>;
  badQuestions: Array<{
    question: string;
    whyBad: string;
  }>;
}

export const STAGE2_QUESTION_EXAMPLES: Stage2QuestionExample[] = [
  {
    id: 'python-data-analysis-questions',
    domain: 'Python数据分析学习',
    frameworkSummary: '核心节点：Python基础(87%), Pandas(95%), 可视化(78%), SQL(72%)',
    goodQuestions: [
      {
        question: '在Python基础、Pandas、可视化这三个模块中，如果时间有限，你希望深入掌握哪1-2个，其他的快速了解即可？',
        whyGood: '直接对应权重调整决策，用户的回答会明确改变节点优先级',
        affects: ['python-basics', 'pandas-dataframe', 'visualization-basic']
      },
      {
        question: '你目前对Excel函数（如VLOOKUP、数据透视表）熟悉吗？如果很熟练，我们可以类比着学Pandas，会快很多',
        whyGood: '评估baseline，决定是否可以加速Pandas学习，影响时间估算',
        affects: ['pandas-dataframe']
      },
      {
        question: '你的工作数据主要来自Excel文件，还是需要连接数据库？这决定了SQL的重要程度',
        whyGood: '直接影响SQL节点的权重，有明确的调整逻辑',
        affects: ['sql-basics']
      }
    ],
    badQuestions: [
      {
        question: '你多大了？',
        whyBad: '纯信息收集，无法直接影响框架调整或行动步骤生成'
      },
      {
        question: '你对Python感兴趣吗？',
        whyBad: '在Stage 0已经确认过动机，重复询问没有价值'
      },
      {
        question: '你每天有多少时间学习？',
        whyBad: '太宽泛，"2小时"这个答案无法指导具体调整。更好的问法是"这3个模块中优先哪个"'
      }
    ]
  },
  
  {
    id: 'career-transition-questions',
    domain: 'B端产品经理转型',
    frameworkSummary: '核心节点：产品思维(93%), 需求分析(93%), 原型设计(85%)',
    goodQuestions: [
      {
        question: '你在技术支持工作中，是否参与过需求收集或产品讨论？如果有，大概占你工作时间的多少？',
        whyGood: '评估baseline，如果有经验，"需求分析"节点可以调整权重和学习路径',
        affects: ['requirements-analysis']
      },
      {
        question: '你打算通过做side project来练习产品技能，还是希望在现有工作中寻找机会？这会影响学习路径的设计',
        whyGood: '影响行动步骤的具体设计（理论学习 vs 实践机会）',
        affects: ['all-nodes']
      },
      {
        question: '原型设计工具中，你倾向于快速上手的简单工具（如Balsamiq），还是学习行业标准工具（如Figma）？前者快但功能限，后者强但学习曲线陡',
        whyGood: '有明确的trade-off，用户选择直接影响工具选型和时间安排',
        affects: ['prototyping']
      }
    ],
    badQuestions: [
      {
        question: '你想转行的决心有多大？',
        whyBad: '主观感受，无法转化为框架调整'
      },
      {
        question: '你了解产品经理的职责吗？',
        whyBad: '如果用户不了解，应该在Stage 0就发现了'
      }
    ]
  },
  
  {
    id: 'tech-blog-questions',
    domain: '技术博客搭建',
    frameworkSummary: '核心节点：HTML/CSS(95%), Markdown(92%), SSG(87%), Git(84%)',
    goodQuestions: [
      {
        question: '你更看重"完全掌握底层原理"还是"快速上线开始写作"？如果是后者，我会推荐现成的主题和模板，如果是前者，我们从零开始自定义',
        whyGood: '用户目标的优先级trade-off，直接影响学习深度和路径',
        affects: ['html-css-core', 'static-site-generator']
      },
      {
        question: '你的博客主要面向国内还是国际读者？这决定了部署平台的选择（国内访问速度差异很大）',
        whyGood: '影响具体的技术选型和部署步骤',
        affects: ['deployment']
      },
      {
        question: '你已经有一些文章草稿准备发布吗？如果有，我们可以优先搞定最小可用版本；如果没有，可以边搭建边学习写作',
        whyGood: '影响里程碑设计和时间安排',
        affects: ['markdown-writing']
      }
    ],
    badQuestions: [
      {
        question: '你喜欢什么颜色？',
        whyBad: '设计细节，不影响学习框架'
      },
      {
        question: '你用Mac还是Windows？',
        whyBad: '除非涉及特定工具兼容性，否则不影响框架'
      }
    ]
  }
];

/**
 * 格式化问题示例用于prompt注入
 */
export function formatStage2QuestionExamples(maxExamples: number = 2): string {
  const examples = STAGE2_QUESTION_EXAMPLES.slice(0, maxExamples);
  
  return examples.map(example => `
### 示例：${example.domain}

**好问题示例**：
${example.goodQuestions.map((q, i) => `
${i + 1}. "${q.question}"
   为什么好：${q.whyGood}
   影响节点：${q.affects.join(', ')}
`).join('\n')}

**避免的问题类型**：
${example.badQuestions.map((q) => `
- "${q.question}" → ${q.whyBad}
`).join('\n')}
`).join('\n---\n');
}

/**
 * 根据domain选择相关示例
 */
export function findRelevantStage2Examples(
  domain: string,
  maxExamples: number = 1
): Stage2QuestionExample[] {
  const domainLower = domain.toLowerCase();
  
  const scores = STAGE2_QUESTION_EXAMPLES.map(example => {
    let score = 0;
    const exampleDomainLower = example.domain.toLowerCase();
    
    if (domainLower.includes(exampleDomainLower) || exampleDomainLower.includes(domainLower)) {
      score += 5;
    }
    
    const keywords = domainLower.split(/[、，,\s]+/);
    keywords.forEach(keyword => {
      if (keyword.length > 1 && exampleDomainLower.includes(keyword)) {
        score += 1;
      }
    });
    
    return { example, score };
  });
  
  const filtered = scores.filter(s => s.score > 0);
  if (filtered.length === 0) {
    return [STAGE2_QUESTION_EXAMPLES[0]];
  }
  
  return filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExamples)
    .map(item => item.example);
}

