/**
 * Stage 1 Few-shot Examples
 * 
 * 高质量框架示例，展示如何基于用户目的计算权重
 */

export interface Stage1Example {
  id: string;
  domain: string;
  purpose: string;
  frameworkSample: {
    nodes: Array<{
      id: string;
      title: string;
      description: string;
      necessity: number;
      impact: number;
      timeROI: number;
      weight: number;
      reasoning: string;
    }>;
    weightingLogic: string;
  };
}

export const STAGE1_EXAMPLES: Stage1Example[] = [
  {
    id: 'python-data-analysis',
    domain: 'Python编程学习（数据分析方向）',
    purpose: '学习Python进行业务数据分析，能够独立完成Excel数据处理和基础报表生成',
    frameworkSample: {
      nodes: [
        {
          id: 'python-basics',
          title: 'Python基础语法',
          description: '变量、数据类型、控制流、函数等核心概念',
          necessity: 1.0,
          impact: 0.7,
          timeROI: 0.95,
          weight: 87,
          reasoning: 'necessity=1.0: 没有基础语法完全无法开始；impact=0.7: 对最终目标是基础性支撑而非核心；timeROI=0.95: 2-3周投入，终身受用，性价比极高'
        },
        {
          id: 'pandas-dataframe',
          title: 'Pandas数据处理',
          description: 'DataFrame操作、数据清洗、筛选、聚合分析',
          necessity: 0.95,
          impact: 1.0,
          timeROI: 0.9,
          weight: 95,
          reasoning: 'necessity=0.95: 理论上可以用numpy但效率低10倍；impact=1.0: 这是数据分析的核心工具，直接构成目标能力；timeROI=0.9: 3-4周投入，覆盖90%的实际工作'
        },
        {
          id: 'visualization-basic',
          title: '基础数据可视化',
          description: 'Matplotlib/Seaborn绘制图表',
          necessity: 0.7,
          impact: 0.85,
          timeROI: 0.85,
          weight: 78,
          reasoning: 'necessity=0.7: 报表可以用Excel补充，但数据分析报告通常需要图表；impact=0.85: 显著提升报表质量和说服力；timeROI=0.85: 1-2周快速上手'
        },
        {
          id: 'sql-basics',
          title: 'SQL数据查询',
          description: '基础SQL语法，从数据库获取数据',
          necessity: 0.6,
          impact: 0.8,
          timeROI: 0.85,
          weight: 72,
          reasoning: 'necessity=0.6: 数据可以从CSV获取，但实际工作中多数来自数据库；impact=0.8: 影响数据获取效率；timeROI=0.85: 基础SQL很快学会'
        },
        {
          id: 'statistics-basic',
          title: '基础统计概念',
          description: '均值、方差、相关性等基础统计量',
          necessity: 0.5,
          impact: 0.7,
          timeROI: 0.4,
          weight: 54,
          reasoning: 'necessity=0.5: 不懂统计也能做数据处理；impact=0.7: 影响分析深度但不影响基本功能；timeROI=0.4: 需要较长时间系统学习，但日常使用频率不高'
        }
      ],
      weightingLogic: '权重基于"业务数据分析"目的：Pandas是核心(95%)，Python基础是必需前置(87%)，可视化重要(78%)，SQL推荐(72%)，统计可选(54%)'
    }
  },
  
  {
    id: 'career-transition-pm',
    domain: '职业转型（技术支持→B端产品经理）',
    purpose: '从技术支持转型为B端产品经理，利用现有企业软件经验，系统掌握产品设计和管理能力',
    frameworkSample: {
      nodes: [
        {
          id: 'product-thinking',
          title: '产品思维培养',
          description: '用户价值、商业价值、需求本质分析',
          necessity: 1.0,
          impact: 1.0,
          timeROI: 0.8,
          weight: 93,
          reasoning: 'necessity=1.0: 产品思维是PM的底层能力；impact=1.0: 直接决定产品决策质量；timeROI=0.8: 需要持续培养，但回报巨大'
        },
        {
          id: 'requirements-analysis',
          title: '需求分析与管理',
          description: 'B端需求收集、优先级判断、需求文档撰写',
          necessity: 0.95,
          impact: 0.95,
          timeROI: 0.9,
          weight: 93,
          reasoning: 'necessity=0.95: PM的核心工作技能；impact=0.95: 直接影响产品方向；timeROI=0.9: 可以在实践中快速提升'
        },
        {
          id: 'prototyping',
          title: '原型设计',
          description: 'Axure/Figma工具使用，低中保真原型制作',
          necessity: 0.85,
          impact: 0.85,
          timeROI: 0.85,
          weight: 85,
          reasoning: 'necessity=0.85: B端PM必需技能，沟通的语言；impact=0.85: 提升需求沟通效率；timeROI=0.85: 工具学习快，1-2周上手'
        },
        {
          id: 'business-knowledge',
          title: '企业软件业务知识',
          description: 'SaaS模式、B端采购流程、ROI计算',
          necessity: 0.7,
          impact: 0.9,
          timeROI: 0.7,
          weight: 77,
          reasoning: 'necessity=0.7: 有技术支持经验可以部分补充；impact=0.9: 对B端PM很重要；timeROI=0.7: 需要持续积累'
        },
        {
          id: 'data-analysis-pm',
          title: '数据分析能力',
          description: '产品数据指标、用户行为分析、A/B测试',
          necessity: 0.6,
          impact: 0.8,
          timeROI: 0.75,
          weight: 70,
          reasoning: 'necessity=0.6: 初级PM可以不深入；impact=0.8: 对产品迭代决策很重要；timeROI=0.75: 学习成本适中'
        },
        {
          id: 'project-management',
          title: '项目管理基础',
          description: 'Scrum/敏捷方法、项目排期、风险管理',
          necessity: 0.5,
          impact: 0.7,
          timeROI: 0.8,
          weight: 63,
          reasoning: 'necessity=0.5: 有专职项目经理时不是必需；impact=0.7: 有助于推进项目；timeROI=0.8: 理论学习快'
        }
      ],
      weightingLogic: '权重基于"B端PM转型"目的：产品思维(93%)和需求分析(93%)是核心，原型设计(85%)是基础技能，业务知识(77%)利用现有经验，数据分析(70%)和项目管理(63%)是增强技能'
    }
  },
  
  {
    id: 'personal-blog-tech',
    domain: '个人博客搭建（技术分享+前端学习）',
    purpose: '搭建一个可定制的技术博客，同时学习前端开发，优先快速上线能够发布内容',
    frameworkSample: {
      nodes: [
        {
          id: 'html-css-core',
          title: 'HTML/CSS核心',
          description: '语义化标签、布局（Flexbox/Grid）、响应式设计',
          necessity: 1.0,
          impact: 0.9,
          timeROI: 0.95,
          weight: 95,
          reasoning: 'necessity=1.0: 做网站的绝对基础；impact=0.9: 直接决定博客外观和体验；timeROI=0.95: 1-2周可以掌握核心，立即见效'
        },
        {
          id: 'markdown-writing',
          title: 'Markdown写作',
          description: 'Markdown语法、文章组织、代码高亮',
          necessity: 0.95,
          impact: 0.85,
          timeROI: 1.0,
          weight: 92,
          reasoning: 'necessity=0.95: 技术博客标准写作格式；impact=0.85: 影响写作效率和内容质量；timeROI=1.0: 半天学会，终身受用'
        },
        {
          id: 'static-site-generator',
          title: '静态网站生成器',
          description: 'Hugo/Hexo/Gatsby选型和使用',
          necessity: 0.9,
          impact: 0.8,
          timeROI: 0.9,
          weight: 87,
          reasoning: 'necessity=0.9: 实现"快速上线"的最佳方案；impact=0.8: 提供主题和插件生态；timeROI=0.9: 几天上手，避免造轮子'
        },
        {
          id: 'git-github',
          title: 'Git版本控制',
          description: 'Git基础操作、GitHub Pages部署',
          necessity: 0.85,
          impact: 0.7,
          timeROI: 0.95,
          weight: 84,
          reasoning: 'necessity=0.85: 部署和内容管理的标准方式；impact=0.7: 不影响博客本身但影响维护；timeROI=0.95: 投入小，收益大'
        },
        {
          id: 'seo-basics',
          title: 'SEO基础优化',
          description: 'meta标签、sitemap、搜索引擎提交',
          necessity: 0.7,
          impact: 0.8,
          timeROI: 0.8,
          weight: 76,
          reasoning: 'necessity=0.7: 用户明确提出SEO需求；impact=0.8: 影响文章曝光度；timeROI=0.8: 基础SEO很快学会'
        },
        {
          id: 'javascript-basics',
          title: 'JavaScript基础',
          description: '变量、函数、DOM操作',
          necessity: 0.4,
          impact: 0.6,
          timeROI: 0.5,
          weight: 48,
          reasoning: 'necessity=0.4: 静态博客可以不用JS；impact=0.6: 增强交互但非必需；timeROI=0.5: 考虑到"快速上线"优先级，JS可以后续学'
        }
      ],
      weightingLogic: '权重基于"快速上线技术博客"：HTML/CSS(95%)和Markdown(92%)是核心，SSG(87%)和Git(84%)实现快速部署，SEO(76%)满足曝光需求，JS(48%)优先级最低'
    }
  },
  
  {
    id: 'technical-communication',
    domain: '跨领域沟通能力提升（技术→业务）',
    purpose: '提升技术方案的跨部门沟通能力，能够让非技术背景的业务同事理解技术方案和决策',
    frameworkSample: {
      nodes: [
        {
          id: 'audience-analysis',
          title: '听众分析',
          description: '识别听众背景、知识水平、关注点',
          necessity: 1.0,
          impact: 1.0,
          timeROI: 0.9,
          weight: 97,
          reasoning: 'necessity=1.0: 跨领域沟通的前提；impact=1.0: 直接决定沟通策略；timeROI=0.9: 快速掌握且立即见效'
        },
        {
          id: 'technical-translation',
          title: '技术术语翻译',
          description: '将技术概念转化为业务语言和类比',
          necessity: 0.95,
          impact: 0.95,
          timeROI: 0.85,
          weight: 92,
          reasoning: 'necessity=0.95: 解决"听不懂"的核心问题；impact=0.95: 直接影响理解度；timeROI=0.85: 需要积累常用翻译模式'
        },
        {
          id: 'structured-expression',
          title: '结构化表达',
          description: '金字塔原理、SCQA框架、先结论后细节',
          necessity: 0.9,
          impact: 0.9,
          timeROI: 0.9,
          weight: 90,
          reasoning: 'necessity=0.9: 清晰沟通的基础；impact=0.9: 提升信息传递效率；timeROI=0.9: 框架易学，实践出效果'
        },
        {
          id: 'visual-presentation',
          title: '可视化呈现',
          description: '架构图、流程图、数据图表制作',
          necessity: 0.8,
          impact: 0.85,
          timeROI: 0.85,
          weight: 83,
          reasoning: 'necessity=0.8: 对于复杂方案很重要；impact=0.85: "一图胜千言"；timeROI=0.85: 工具学习成本低'
        },
        {
          id: 'story-telling',
          title: '故事化叙述',
          description: '用案例和故事包装技术方案',
          necessity: 0.6,
          impact: 0.75,
          timeROI: 0.7,
          weight: 68,
          reasoning: 'necessity=0.6: 不是必需但很有用；impact=0.75: 提升说服力和记忆度；timeROI=0.7: 需要创意和练习'
        },
        {
          id: 'feedback-iteration',
          title: '反馈收集与迭代',
          description: '识别困惑点、调整表达方式',
          necessity: 0.7,
          impact: 0.8,
          timeROI: 0.85,
          weight: 77,
          reasoning: 'necessity=0.7: 持续改进的方法；impact=0.8: 帮助发现盲区；timeROI=0.85: 每次会议后复盘即可'
        }
      ],
      weightingLogic: '权重基于"技术→业务沟通"场景：听众分析(97%)和术语翻译(92%)是核心，结构化表达(90%)和可视化(83%)是关键技能，故事化(68%)和反馈迭代(77%)是增强技能'
    }
  }
];

/**
 * 根据问题域匹配相关示例
 */
export function findRelevantStage1Examples(
  domain: string,
  maxExamples: number = 2
): Stage1Example[] {
  const domainLower = domain.toLowerCase();
  
  // 简单的关键词匹配
  const scores = STAGE1_EXAMPLES.map(example => {
    let score = 0;
    const exampleDomainLower = example.domain.toLowerCase();
    
    // 完全匹配
    if (domainLower === exampleDomainLower) {
      score += 10;
    }
    
    // 包含关键词
    const keywords = domainLower.split(/[、，,\s]+/);
    keywords.forEach(keyword => {
      if (keyword.length > 1 && exampleDomainLower.includes(keyword)) {
        score += 2;
      }
    });
    
    return { example, score };
  });
  
  // 只返回有匹配的示例，不自动fallback（让调用方决定）
  return scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExamples)
    .map(item => item.example);
}

/**
 * 格式化示例用于prompt注入
 */
export function formatStage1Example(example: Stage1Example): string {
  const nodesSample = example.frameworkSample.nodes
    .slice(0, 3)  // 只展示前3个节点作为示例
    .map(node => `
**${node.title}** (权重: ${node.weight}%)
- necessity: ${node.necessity} | impact: ${node.impact} | timeROI: ${node.timeROI}
- 推理: ${node.reasoning}`)
    .join('\n');
  
  return `## 示例：${example.domain}

**目的**: ${example.purpose}

**节点权重示例**:
${nodesSample}

**整体权重逻辑**: ${example.frameworkSample.weightingLogic}

---`;
}

