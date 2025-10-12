/**
 * Stage 1 Prompt 模板 - 通用框架生成
 * 
 * 基于用户目的生成带权重的通用解决框架
 */

import type { PurposeDefinition } from '@/lib/types-v2';

// ============================================
// 框架生成 Prompt
// ============================================

export function getFrameworkGenerationPrompt(purpose: PurposeDefinition): string {
  return `你是一个专业的知识架构师和学习专家。基于用户的明确目的，你需要生成一个通用的解决框架。

**用户目的：**
${purpose.clarifiedPurpose}

**问题域：**
${purpose.problemDomain}

**问题域边界：**
${purpose.domainBoundary}

**关键约束：**
${purpose.keyConstraints.map(c => `- ${c}`).join('\n')}

---

**你的任务：**

生成一个结构化的通用框架，包含解决这个问题域所需的关键模块/要素。

**框架要求：**

1. **节点设计** (5-12个节点)
   - 每个节点代表一个关键模块/要素
   - 包括：输入节点（起点）、过程节点（核心步骤）、输出节点（目标）
   - 清晰的标题和描述

2. **权重计算** (这是最关键的部分)
   对每个节点，基于用户的目的，评估三个维度：
   
   a) **必要性 (necessity)**: 0-1
      - 这个节点是否是达成目的的前置必需？
      - 没有它能否继续？
   
   b) **影响力 (impact)**: 0-1
      - 这个节点对最终目的的贡献度有多大？
      - 它直接影响核心目标还是辅助作用？
   
   c) **时间投资回报率 (timeROI)**: 0-1
      - 投入时间与产出价值的比率
      - 性价比高的节点应该得分高

   **权重计算公式：**
   weight = (necessity × 0.4) + (impact × 0.3) + (timeROI × 0.3)

3. **依赖关系**
   - 明确哪些节点必须在其他节点之前完成
   - 构建清晰的学习/执行路径

4. **主路径 (mainPath)**
   - 从输入到输出的最关键路径
   - 按顺序列出节点ID

**重要原则：**
- 权重必须基于**用户的具体目的**计算，不是通用的
- 例如：同样是"Python语法"，对于"数据分析"和"游戏开发"的权重完全不同
- 核心必修(90-100%)应该控制在2-4个
- 大部分节点应该是重要推荐(70-89%)

---

请严格按照以下JSON格式输出：

\`\`\`json
{
  "framework": {
    "purpose": "${purpose.clarifiedPurpose}",
    "domain": "${purpose.problemDomain}",
    "nodes": [
      {
        "id": "unique-node-id",
        "title": "节点标题",
        "description": "详细描述（50-100字）",
        "estimatedTime": "预计时间（如：2-3周）",
        "nodeType": "input | process | output",
        "dependencies": ["前置节点id"],
        "weightBreakdown": {
          "necessity": 0.9,
          "impact": 0.85,
          "timeROI": 0.8
        }
      }
    ],
    "edges": [
      {
        "from": "node-id-1",
        "to": "node-id-2",
        "type": "required | recommended | optional",
        "strength": 0.9
      }
    ],
    "mainPath": ["node-1", "node-2", "node-3"],
    "weightingLogic": "简要说明权重是如何基于用户目的计算的"
  }
}
\`\`\``;
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

// ============================================
// 示例框架（用于测试）
// ============================================

export const EXAMPLE_FRAMEWORK = {
  purpose: "学习Python用于数据分析",
  domain: "Python编程学习（数据分析方向）",
  nodes: [
    {
      id: "start",
      title: "起点：明确目标",
      description: "明确学习Python数据分析的具体应用场景和最终目标",
      estimatedTime: "1天",
      nodeType: "input" as const,
      dependencies: [],
      weightBreakdown: {
        necessity: 1.0,
        impact: 0.7,
        timeROI: 1.0,
      },
    },
    {
      id: "python-basics",
      title: "Python基础语法",
      description: "变量、数据类型、控制流、函数等基础概念",
      estimatedTime: "2-3周",
      nodeType: "process" as const,
      dependencies: ["start"],
      weightBreakdown: {
        necessity: 1.0,
        impact: 0.9,
        timeROI: 0.95,
      },
    },
    {
      id: "numpy-pandas",
      title: "NumPy & Pandas",
      description: "数据处理的核心库，数组操作和DataFrame",
      estimatedTime: "3-4周",
      nodeType: "process" as const,
      dependencies: ["python-basics"],
      weightBreakdown: {
        necessity: 0.95,
        impact: 1.0,
        timeROI: 0.95,
      },
    },
    {
      id: "visualization",
      title: "数据可视化",
      description: "Matplotlib, Seaborn等可视化库",
      estimatedTime: "2周",
      nodeType: "process" as const,
      dependencies: ["numpy-pandas"],
      weightBreakdown: {
        necessity: 0.7,
        impact: 0.85,
        timeROI: 0.85,
      },
    },
    {
      id: "projects",
      title: "实际项目练习",
      description: "真实数据集的分析项目，整合所有技能",
      estimatedTime: "持续",
      nodeType: "process" as const,
      dependencies: ["numpy-pandas", "visualization"],
      weightBreakdown: {
        necessity: 0.9,
        impact: 0.95,
        timeROI: 0.85,
      },
    },
    {
      id: "goal-achieved",
      title: "目标达成",
      description: "具备独立进行数据分析的能力",
      estimatedTime: "-",
      nodeType: "output" as const,
      dependencies: ["projects"],
      weightBreakdown: {
        necessity: 1.0,
        impact: 1.0,
        timeROI: 1.0,
      },
    },
  ],
  edges: [
    { from: "start", to: "python-basics", type: "required" as const, strength: 1.0 },
    { from: "python-basics", to: "numpy-pandas", type: "required" as const, strength: 1.0 },
    { from: "numpy-pandas", to: "visualization", type: "recommended" as const, strength: 0.8 },
    { from: "numpy-pandas", to: "projects", type: "required" as const, strength: 0.9 },
    { from: "visualization", to: "projects", type: "recommended" as const, strength: 0.7 },
    { from: "projects", to: "goal-achieved", type: "required" as const, strength: 1.0 },
  ],
  mainPath: ["start", "python-basics", "numpy-pandas", "projects", "goal-achieved"],
  weightingLogic: "权重基于数据分析目的：NumPy/Pandas是核心(95%+)，Python基础是前置必需(90%+)，可视化是重要辅助(80%+)",
};

