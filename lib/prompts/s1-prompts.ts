// S1 阶段 Prompts - 知识框架生成

export const S1_PROMPTS = {
  /**
   * 生成知识框架的主 prompt
   */
  generateFramework: (payload: { userGoal: string }) => `作为一名专业的教育专家，请为以下学习目标创建一个结构化的知识框架：

目标：${payload.userGoal}

请生成一个分层的知识结构，包含2-3个主要类别，每个类别下有2-4个子项目。

请严格按照以下JSON格式返回（不要包含任何其他文字）：
[
  {
    "id": "唯一标识符",
    "title": "类别标题",
    "summary": "简短描述（20-40字）",
    "children": [
      {
        "id": "子项唯一标识符",
        "title": "子项标题",
        "summary": "子项描述（20-40字）"
      }
    ],
    "evidence": [],
    "confidence": 0.6,
    "applicability": ""
  }
]

确保：
1. id使用英文和数字的组合（如 "fundamental-concepts-1"）
2. title简洁明了
3. summary提供有价值的描述
4. 内容与学习目标高度相关`,

  /**
   * 获取 S1 生成配置
   */
  getGenerationConfig: (runTier?: 'Lite' | 'Pro' | 'Review') => ({
    maxOutputTokens: 65536, // 为 gemini-2.5-pro 的思考过程预留充足空间
    temperature: runTier === 'Lite' ? 0.5 : 0.8, // Lite 模式更保守，Pro 模式更有创造性
  }),
} as const;

