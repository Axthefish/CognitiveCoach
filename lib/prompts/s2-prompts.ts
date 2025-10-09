// S2 阶段 Prompts - 系统动力学生成

import type { KnowledgeFramework } from '@/lib/schemas';

export const S2_PROMPTS = {
  /**
   * 生成系统动力学图表和比喻
   */
  generateSystemDynamics: (payload: { 
    framework: KnowledgeFramework;
    frameworkDescription: string;
  }) => `基于以下知识框架，创建一个系统动力学图表和一个生动的比喻，并补充"主路径/关键回路/节点类比"用于快速理解：

知识框架：
${payload.frameworkDescription}

请完成以下任务：

1. 创建一个Mermaid流程图，展示这些知识点之间的关系和学习流程。
2. 创建一个生动形象的比喻，帮助理解整个学习过程（全局类比）。
3. 提取"主路径"（从入门到目标的最短可行路线，列出S1的id顺序）。
4. 提取"关键回路（Top 3）"：每个包含id、nodes（涉及的S1 id列表）与一句summary（≤20字）。
5. 为关键节点补充"节点类比"：nodeAnalogies（每条含 nodeId、1句 analogy、1句日常 example）。

请严格按照以下JSON格式返回（不要包含任何其他文字）：
{
  "mermaidChart": "以 graph TD 开头的 Mermaid 图，不要添加 <br/>",
  "metaphor": "一个生动的比喻（50-100字）",
  "nodes": [{ "id": "<与框架一致>", "title": "<中文>" }],
  "mainPath": ["<id1>", "<id2>", "<id3>"],
  "loops": [
    { "id": "loop-1", "title": "<中文>", "nodes": ["<idA>","<idB>"], "summary": "<≤20字>" }
  ],
  "nodeAnalogies": [
    { "nodeId": "<id>", "analogy": "<1句类比>", "example": "<1句日常示例>" }
  ],
  "evidence": [],
  "confidence": 0.6,
  "applicability": ""
}

Mermaid图表要求：
- 使用graph TD（从上到下）
- 节点使用中文标签
- 展示学习路径和知识点之间的关系
- 包含反馈循环或进阶路径

比喻要求：
- 使用日常生活中的事物
- 能够形象地说明学习过程
- 与知识框架内容相关`,

  /**
   * 获取 S2 生成配置
   */
  getGenerationConfig: (runTier?: 'Lite' | 'Pro' | 'Review') => ({
    maxOutputTokens: 65536,
    temperature: runTier === 'Lite' ? 0.5 : 0.8,
  }),
} as const;

