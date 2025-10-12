# Prompt 模板文档

这份文档包含 CognitiveCoach 所有阶段的完整 Prompt 模板和使用指南。

## Stage 0: 目的澄清 Prompts

### 1. 初始收集 Prompt

**目标**：从用户的模糊输入中识别可能的问题域和目的

**模板位置**：`lib/prompts/stage0-prompts.ts` → `getInitialCollectionPrompt()`

**关键变量**：
- `{userInput}`: 用户的初始输入

**输出结构**：
```json
{
  "analysis": {
    "possible_domains": ["领域1", "领域2", "领域3"],
    "possible_purposes": ["目的1", "目的2", "目的3"],
    "initial_clues": ["线索1", "线索2"]
  },
  "next_question": "开放式追问"
}
```

**设计原则**：
1. 识别多个可能的问题域（2-3个）
2. 推测背后的动机
3. 生成开放式、友好的问题
4. 避免让用户感到被审问

**测试用例示例**：
- 输入："我想学Python"
- 预期输出：识别出"技能学习"域，推测"职业转型/数据分析/自动化"等目的

---

### 2. 深入追问 Prompt

**目标**：基于对话历史，判断是否需要继续追问或进入确认阶段

**模板位置**：`lib/prompts/stage0-prompts.ts` → `getDeepDivePrompt()`

**关键变量**：
- `{conversationHistory}`: 完整的对话历史
- `{currentDefinition}`: 当前的目的定义状态

**输出结构（continue）**：
```json
{
  "assessment": {
    "clarity_score": 0.7,
    "missing_info": ["缺失信息1", "缺失信息2"],
    "confidence": 0.8
  },
  "action": "continue",
  "next_question": "追问"
}
```

**输出结构（confirm）**：
```json
{
  "assessment": {
    "clarity_score": 0.95,
    "missing_info": [],
    "confidence": 0.9
  },
  "action": "confirm"
}
```

**追问策略**：
- 如果目的模糊 → 追问"为什么"
- 如果范围不清 → 追问"具体包括/不包括什么"
- 如果约束未知 → 追问"有什么限制"
- 如果动机浅层 → 追问更深层的期望

---

### 3. 最终确认 Prompt

**目标**：总结完整对话，生成结构化的目的定义

**模板位置**：`lib/prompts/stage0-prompts.ts` → `getConfirmationPrompt()`

**输出结构**：
```json
{
  "clarified_purpose": "1-2句话，清晰可操作",
  "problem_domain": "专业术语描述",
  "domain_boundary": "明确包括什么、不包括什么",
  "key_constraints": ["约束1", "约束2"],
  "confidence": 0.9,
  "confirmation_message": "友好的总结文本"
}
```

**质量标准**：
- `clarified_purpose`: 必须可操作，包含"为什么"
- `problem_domain`: 使用专业术语，精确
- `domain_boundary`: 2-3句话，明确边界
- `key_constraints`: 列表形式，具体可量化

---

## Stage 1: 框架生成 Prompts

### 框架生成 Prompt

**目标**：基于目的生成带权重的通用框架

**模板位置**：`lib/prompts/stage1-prompts.ts` → `getFrameworkGenerationPrompt()`

**关键变量**：
- `{purpose}`: PurposeDefinition 对象
  - `clarifiedPurpose`
  - `problemDomain`
  - `domainBoundary`
  - `keyConstraints`

**输出结构**：
```json
{
  "framework": {
    "purpose": "...",
    "domain": "...",
    "nodes": [
      {
        "id": "unique-id",
        "title": "节点标题",
        "description": "50-100字描述",
        "estimatedTime": "2-3周",
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
        "from": "node-1",
        "to": "node-2",
        "type": "required | recommended | optional",
        "strength": 0.9
      }
    ],
    "mainPath": ["node-1", "node-2"],
    "weightingLogic": "权重计算说明"
  }
}
```

**权重计算公式**：
```
weight = (necessity × 0.4) + (impact × 0.3) + (timeROI × 0.3)
```

**设计原则**：
1. 节点数量：5-12个
2. 核心必修(90-100%)：2-4个
3. 重要推荐(70-89%)：占大多数
4. 权重必须基于用户的**具体目的**，不是通用的
5. 主路径清晰，从输入到输出

**测试用例**：
- 目的："学习Python用于数据分析"
- 预期：NumPy/Pandas 高权重(95%)，Python基础高权重(90%)，可视化中等(80%)

---

## Stage 2: 个性化方案 Prompts

### 1. 信息缺口分析 Prompt

**目标**：分析需要收集的关键用户信息

**模板位置**：`lib/prompts/stage2-prompts.ts` → `getMissingInfoAnalysisPrompt()`

**输出结构**：
```json
{
  "questions": [
    {
      "id": "q1",
      "question": "具体问题文本",
      "whyMatters": "为什么重要",
      "affects": ["node-id-1", "node-id-2"],
      "impactLevel": 5,
      "questionType": "baseline | resource | context | motivation"
    }
  ],
  "rationale": "选择这些问题的理由"
}
```

**问题类型**：
- **baseline**: 基础水平
- **resource**: 资源约束
- **context**: 情境信息
- **motivation**: 动机深度

---

### 2. 个性化方案生成 Prompt

**目标**：基于收集的信息，调整框架并生成具体行动计划

**模板位置**：`lib/prompts/stage2-prompts.ts` → `getPersonalizedPlanPrompt()`

**输出结构**：
```json
{
  "adjustedFramework": {
    "nodes": [
      {
        "id": "...",
        "weight": 85,
        "weightBreakdown": {
          "necessity": 0.9,
          "impact": 0.8,
          "timeROI": 0.85
        }
      }
    ]
  },
  "actionSteps": [...],
  "milestones": [...],
  "personalizedTips": [...],
  "adjustmentRationale": "调整说明"
}
```

---

## Prompt 工程最佳实践

### 1. 结构化输出
- 始终使用 JSON 格式
- 包裹在 ```json 代码块中
- 提供清晰的 schema 示例

### 2. 上下文管理
- 包含必要的历史信息
- 明确当前状态
- 说明任务目标

### 3. 指令清晰度
- 分点说明任务
- 提供具体示例
- 明确输出格式

### 4. 质量控制
- 说明评估标准
- 提供降级策略
- 包含验证逻辑

### 5. 用户体验
- 语气友好自然
- 避免技术术语（对用户）
- 提供思考引导

---

## 测试方法

### 单元测试
1. 使用固定输入测试 Prompt
2. 验证输出格式
3. 检查边界情况

### A/B 测试
1. 设计变体 Prompt
2. 对比输出质量
3. 收集用户反馈

### 迭代优化
1. 记录失败案例
2. 分析原因
3. 调整 Prompt
4. 重新测试

---

## 变量说明

### PurposeDefinition
```typescript
{
  rawInput: string;              // 用户原始输入
  clarifiedPurpose: string;      // 澄清后的目的
  problemDomain: string;         // 问题域
  domainBoundary: string;        // 边界描述
  keyConstraints: string[];      // 关键约束
  conversationHistory: ChatMessage[];
  confidence: number;            // 0-1
  clarificationState: string;    // INIT | COLLECTING | REFINING | CONFIRMING | COMPLETED
}
```

### UniversalFramework
```typescript
{
  purpose: string;
  domain: string;
  nodes: FrameworkNode[];
  edges: FrameworkEdge[];
  weightingLogic: string;
  mainPath: string[];
  generatedAt: number;
}
```

---

## 附录：常见问题

### Q: Prompt 太长会影响性能吗？
A: 适度的长度可以提高质量。控制在 2000-4000 tokens 是合理的。

### Q: 如何处理 AI 不遵循格式？
A: 1) 使用代码块包裹 2) 提供明确示例 3) 添加格式验证 4) 实现降级解析

### Q: 如何提高权重计算的准确性？
A: 1) 明确目的相关性 2) 提供计算示例 3) 说明评估维度 4) 要求输出计算过程

