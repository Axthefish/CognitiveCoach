# CognitiveCoach V2 - Architecture for LLM Agents

> AI-powered cognitive growth coach using "Universal Framework + Personalization" approach

**Version**: V2.0  
**Last Updated**: 2025-01-15

---

## 🎯 Product Philosophy (Core Concept)

**Universal Framework + Personalized Adaptation**

The product follows a medical diagnosis analogy:
- **Universal Framework**: Like standard medical protocols (how to diagnose a cold in general)
- **Personalization**: Adapted to individual circumstances (adjusting for age, allergies, medical history)

### Three-Stage Flow

```
Stage 0: Purpose Clarification
├─ Multi-turn dialogue
├─ Domain boundary definition (⭐️ critical)
└─ Output: PurposeDefinition (with keyConstraints)

Stage 1: Universal Framework Generation
├─ Generate framework based on DOMAIN ONLY
├─ Weights reflect universal importance (NOT individual circumstances)
├─ Output: UniversalFramework with weighted nodes
└─ User Decision Point:
    ├─ Option A: "This is sufficient" → Export & Complete
    └─ Option B: "I need personalization" → Stage 2

Stage 2: Personalized Adaptation (Optional)
├─ NOW use keyConstraints from Stage 0
├─ Ask 3-5 questions about user's situation
├─ Adjust node weights based on individual context
└─ Output: PersonalizedPlan with action steps
```

**Critical Design Decision**: Stage 1 deliberately ignores user constraints to create a truly universal framework. Personalization happens ONLY in Stage 2.

---

## 🏗️ Architecture Overview

### Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **State Management**: Zustand 5 (with persistence)
- **AI**: Google Gemini API (`gemini-2.5-pro` by default)
- **Validation**: Zod 4
- **Visualization**: ECharts 5.6 (logic flow chart)
- **Styling**: Tailwind CSS 4 (glassmorphism design)

### Data Flow

```
User Input
    ↓
Stage0Service.processInitialInput()
    ↓
Multi-turn dialogue (until boundary is clear)
    ↓
PurposeDefinition (confidence > 0.8)
    ↓
Stage1Service.generateFramework()
    ├─ Input: purpose (WITHOUT keyConstraints)
    └─ Output: UniversalFramework
    ↓
User Choice:
    ├─ Export → COMPLETED
    └─ Personalize → Stage2Service
    ↓
Stage2Service.analyzeMissingInfo()
    ├─ Input: framework + keyConstraints
    └─ Generate 3-5 questions
    ↓
Stage2Service.generatePersonalizedPlan()
    └─ Adjust weights, create action steps
```

---

## 📁 Code Structure (Navigation Map)

```
├── app/
│   ├── api/
│   │   ├── stage0/route.ts       # Purpose clarification endpoint
│   │   ├── stage1/route.ts       # Framework generation endpoint
│   │   └── stage2/route.ts       # Personalization endpoint
│   ├── client-page-v2.tsx        # Main UI coordinator
│   └── layout.tsx                # Root layout
│
├── components/
│   ├── stage0-view.tsx           # Chat interface for clarification
│   ├── stage1-view.tsx           # Framework visualization + choice UI ⭐️
│   ├── stage2-view.tsx           # Personalization interface
│   ├── chat-interface/           # Reusable chat components
│   ├── logic-flow-chart/         # ECharts visualization
│   │   ├── LogicFlowChart.tsx
│   │   └── graph-config.ts       # Node layout algorithm
│   └── ui/                       # Reusable UI components
│
├── lib/
│   ├── types-v2.ts               # Core type definitions ⭐️
│   ├── store-v2.ts               # Zustand state management
│   ├── prompts/                  # AI prompts (⭐️ CRITICAL)
│   │   ├── stage0-prompts.ts    # Clarification prompts
│   │   ├── stage1-prompts.ts    # Universal framework prompts
│   │   ├── stage2-prompts.ts    # Personalization prompts
│   │   └── example-selector.ts  # Dynamic example selection
│   ├── weight-calculator.ts      # Weight calculation logic
│   ├── context-manager.ts        # Context compression
│   ├── memory-store.ts           # Cross-stage memory
│   ├── token-budget-manager.ts   # Token usage tracking
│   └── export-utils.ts           # PDF/Markdown export
│
├── services/
│   ├── stage0-service.ts         # Purpose clarification logic
│   ├── stage1-service.ts         # Framework generation logic ⭐️
│   └── stage2-service.ts         # Personalization logic ⭐️
│
└── tests/
    ├── unit/                     # Unit tests
    └── integration/              # Integration tests
```

---

## 🔑 Key Mechanisms

### Weight Calculation System (Stage 1)

**Formula**:
```
weight = (necessity × 0.4) + (impact × 0.3) + (timeROI × 0.3)
```

**Three Dimensions** (each 0-1):
- **necessity**: "Will user get stuck if they skip this?"
- **impact**: "How much does this contribute to the goal?"
- **timeROI**: "Value / learning time ratio"

**Color Coding**:
- Deep Blue (90-100%): Core essential (2-4 nodes)
- Blue (70-89%): Important (majority of nodes)
- Light Blue (50-69%): Optional enhancement
- Gray (<50%): Low priority

**⚠️ IMPORTANT**: Weights in Stage 1 are based on UNIVERSAL importance for the domain, NOT individual circumstances.

---

### Context Management (⭐️ 2025-01-15优化)

**Cross-Stage Memory**:
- Stage 0 → Stage 1: 
  * Purpose (clarifiedPurpose)
  * Domain boundary (domainBoundary)
  * Boundary constraints (boundaryConstraints) - 界定框架范围
  * 🆕 Conversation insights (conversationInsights) - 保存但不传Stage1
- Stage 1 → Stage 2: 
  * Framework structure (nodes, edges, mainPath)
  * 🆕 Weighting logic (weightingLogic) - 帮助Stage2理解权重设计思路
  * Personal constraints (personalConstraints) - Stage0传递来的
  * 🆕 Conversation insights (conversationInsights) - Stage0传递来的
- Stage 2: 
  * 使用personalConstraints + conversationInsights进行个性化
  * 基于weightingLogic理解通用框架的设计意图

**Token Budget Management**:
- Automatic context compaction when approaching limits
- Quality-based compression (attention score < 0.6)
- Smart summarization preserving key decisions
- 🆕 Compaction summary保存到conversationInsights，跨stage传递

**Context Engineering Best Practices** (基于Anthropic):
- 每个stage的prompt包含清晰的workflow context
- 明确说明"前置阶段完成了什么"和"我的输出将被如何使用"
- 跨stage信息流转完整且高效（不丢失关键insights）
- Context作为稀缺资源，只传递必要的高信号信息

---

### Prompt Strategy (⭐️ CRITICAL)

**Right Altitude Principle** (from Anthropic Context Engineering):
```
❌ Too Low: "If necessity > 0.9 and impact > 0.8, then weight = 90%"
          硬编码JSON格式示例
❌ Too High: "Generate a good framework"
✅ Just Right: "Evaluate necessity: will user get stuck if they skip this?"
           定义目标和评估框架，让模型自主决策
```

**实施原则**（2025-01-15 Context Engineering优化后）:
1. **信任模型判断**: Gemini 2.5 Pro有强大的判断能力，无需过度指导
2. **目标导向而非流程导向**: 说明"要什么"而非"怎么做"
3. **零样本策略**: 不使用few-shot examples，完全信任模型的zero-shot能力
4. **轻量级验证**: 只检查真正的错误，不强制格式
5. **职责分离**: 
   - Stage 1: 只用boundaryConstraints界定范围
   - Stage 2: 才使用personalConstraints调整
6. **模型自主权**: 节点数量、权重值、问题数量由模型决定
7. **🆕 Workflow Context**: 每个stage的prompt清楚说明"我在哪"、"从哪来"、"到哪去"
8. **🆕 Context Flow**: 跨stage信息完整传递（conversationInsights, weightingLogic）

---

## 🛠️ Making Changes

### To Modify Weight Calculation Logic
1. Edit `lib/weight-calculator.ts` (calculation)
2. Edit `lib/prompts/stage1-prompts.ts` (prompt guidance)
3. Test with diverse domains

### To Modify Personalization Logic
1. Edit `lib/prompts/stage2-prompts.ts`
2. Ensure keyConstraints are properly used
3. Edit `services/stage2-service.ts` if logic changes

### To Modify UI Flow
1. Edit `components/stage{0,1,2}-view.tsx`
2. Edit `lib/store-v2.ts` for state transitions
3. Consider impact on user decision point (Stage 1 → Stage 2)

### To Add New Features
- Ask: "Does this belong to Stage 0, 1, or 2?"
- Maintain separation of concerns
- Update this document

---

## 🐛 Common Pitfalls (Avoid These)

### ❌ Pitfall 1: 在Stage 1使用personalConstraints
**错误**:
```typescript
// stage1-prompts.ts
"考虑用户每周只有5小时..."  // ❌ 个人约束不应该在Stage 1
```

**正确**:
```typescript
// stage1-prompts.ts
"基于问题域生成通用框架"
// 只使用boundaryConstraints界定范围，不用personalConstraints
```

### ❌ Pitfall 2: 过度指导模型
**错误**: 硬编码JSON格式、强制节点数量、详细的if-else逻辑

**正确**: 定义目标和评估框架，让模型自主决策具体实现

### ❌ Pitfall 3: 过度验证
**错误**: 
```typescript
if (questions.length !== 5) throw new Error("Must have exactly 5 questions");
if (node.description.length < 50) throw new Error("Description too short");
```

**正确**: 只检查真正的错误（如引用不存在的节点ID），其他给模型自由

### ❌ Pitfall 4: 强制用户进入Stage 2
**错误**: "点击继续完成个性化"（无其他选项）

**正确**: 两个平等选择 - "通用框架已足够" 或 "需要个性化"

### ❌ Pitfall 5: 无脑塞示例
**错误**: 每个prompt都包含5个完整示例

**正确**: 根据domain动态选择相关示例，必要时可以0示例

---

## 🧪 Testing Strategy

### Stage 1 Quality Checks
- [ ] Framework covers domain appropriately
- [ ] Weights are based on universal importance (not user-specific)
- [ ] Weight distribution: 2-4 nodes at 90%+, majority at 70-89%
- [ ] No circular dependencies
- [ ] mainPath is logical

### Stage 2 Quality Checks
- [ ] Questions actually use keyConstraints as context
- [ ] Weight adjustments make sense given user answers
- [ ] Action steps are specific and timeline-based

### Integration Tests
- [ ] User can complete flow without Stage 2
- [ ] Memory persists across stage transitions
- [ ] Token budget doesn't exceed limits

---

## 🎨 UI/UX优化 (2025-01-15)

### Stage 1决策点优化
**问题**：用户需要滚动很久才能看到决策按钮

**解决方案**：
- **移动端**: Sticky bottom bar，始终可见，快速决策
- **桌面端**: Floating decision card（右侧固定），包含：
  * 核心节点快速预览（≥70%的前3个）
  * 两个决策按钮（个性化调整 / 直接使用）
  * Helper提示
- **保留**: 原有详细决策区域（滚动后可见）

### Stage 2问题呈现优化
**问题**：所有问题看起来同等重要，缺乏优先级视觉提示

**解决方案**：
- **问题卡片**: 在对话区上方显示当前问题
- **视觉层次**: 根据impactLevel显示不同颜色和样式
  * 高优先级（≥4）：蓝色border + 蓝色badge
  * 中优先级（≥3）：紫色border + 紫色badge
  * 低优先级（<3）：灰色border + 灰色badge
- **进度指示**: 显示"问题 X/N"
- **展开说明**: details/summary显示"为什么问这个"
- **双端支持**: 桌面端和移动端都有优化

---

## 📊 API Endpoints

| Endpoint | Method | Purpose | Timeout |
|----------|--------|---------|---------|
| `/api/stage0` | POST | Purpose clarification | 45s (Pro) |
| `/api/stage1` | POST | Framework generation | 90s (Pro) |
| `/api/stage2` | POST | Personalization | 108s (Pro) |
| `/api/health` | GET | Health check | 5s |

**Request Format**: See `lib/types-v2.ts` for complete type definitions.

---

## 🚀 Development Workflow

```bash
# Start development server
npm run dev

# Run tests
npm test

# Type check
npm run build

# Lint
npm run lint
```

---

## 📚 Additional Resources

- **Anthropic Context Engineering**: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **Gemini API Docs**: https://ai.google.dev/docs
- **Implementation Plan**: See `/context-engineering-overhaul.plan.md`

---

## 📦 组件状态说明

### Example Selector (`lib/prompts/example-selector.ts`)
**状态**: 已实现但未启用（Zero-shot策略）

**理由**:
- Gemini-2.5-pro的zero-shot能力已足够强大
- 动态示例选择会增加token消耗和latency
- 产品哲学强调"给模型判断空间"而非"塞示例"

**保留原因**: 
- 完整的实现可作为参考
- 未来如需启用可快速恢复
- Token Budget Manager中相关逻辑已禁用（exampleCount = 0）

### Memory Store (`lib/memory-store.ts`)
**状态**: 已实现，部分使用

**当前用途**:
- Stage0完成时保存purpose definition
- Stage1完成时保存framework
- Stage2完成时保存personalized plan
- 主要用于debug/audit trail

**优化后的实际机制**:
- 跨stage信息传递通过types直接传递（不依赖memory store）
- conversationInsights通过PurposeDefinition直接传递
- weightingLogic通过UniversalFramework直接传递
- Memory store作为辅助机制保留

---

## 🔄 Version History

- **V2.0.1** (2025-01-15): Context Engineering优化
  * 添加workflow context到所有stage prompts
  * 修复conversationInsights跨stage传递
  * 增强Stage2的personalConstraints使用指导
  * UI优化（Stage1决策点 + Stage2问题展示）
- **V2.0** (2025-01-15): Complete rewrite with universal/personalization separation
- **V1.x** (2024): Initial implementation (archived)

---

**For LLM Coding Agents**: This document is optimized for your understanding. Key files to examine:
1. `lib/prompts/stage{0,1,2}-prompts.ts` - Workflow context和prompt设计
2. `services/stage{0,1,2}-service.ts` - 跨stage信息传递实现
3. `lib/types-v2.ts` - conversationInsights等新增字段
4. `components/stage{1,2}-view.tsx` - UI优化实现

