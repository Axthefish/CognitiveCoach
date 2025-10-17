# Agent A: UI组件重构任务

## 🎯 产品背景与目的

### CognitiveCoach 产品概述
CognitiveCoach是一个AI驱动的认知成长教练系统，专门针对**学习/理解某事件域/情况的客观embodied knowledge实践起点**。

**核心理念：** 通用框架 + 个性化补充
- **通用框架**：基于领域知识生成的标准行动系统（适用于典型学习者）
- **个性化补充**：基于用户具体情况调整权重和路径，生成专属方案

### 7阶段流程
我们从3阶段架构升级为更细致的7阶段流程，每个阶段都有明确的用户控制点：

1. **Stage 0: 产品介绍** - 简洁chatbox + 产品用途说明，引导用户正确输入
2. **Stage 1: 目标澄清** - 使用"初始问题识别prompt"将模糊输入提炼为清晰的Mission Statement
3. **Stage 2: 用户确认** - 展示提炼结果，用户确认或提供反馈
4. **Stage 3: 通用框架生成** - 使用"通用框架prompt"生成Universal Action System，**3D可视化展示**
5. **Stage 4: 个性化选择** - 询问用户是否需要个性化（pause点）
6. **Stage 5-6: 权重分析+诊断提问** - 左侧**3D权重可视化**（70%），右侧AI提问（30%），问题旁显示影响的节点
7. **Stage 7: 个性化方案** - 生成Personal Action Framework，**3D对比视图**展示通用vs个性化

### 技术栈
- **前端**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **状态管理**: Zustand (已升级为V3，包含session持久化)
- **动画**: Framer Motion
- **3D可视化**: Three.js (通过`@react-three/fiber`和`@react-three/drei`)
- **AI**: Gemini 2.5 Pro

---

## 📋 你的任务：UI组件重构

### 任务目标
重构和新建7个stage的view组件，实现新的7阶段用户交互界面。

### 已完成的基础设施（你可以直接使用）

✅ **类型系统** (`lib/types-v2.ts`)
- 完整的7阶段类型定义
- `StageState`枚举（8个状态：7个stage + COMPLETED）
- `ClarifiedMission`, `UniversalFramework`, `PersonalizedActionFramework`等

✅ **状态管理** (`lib/store-v2.ts`)
- Zustand store已更新为7阶段
- `version: 2`强制清除旧session
- 所有stage的actions和状态字段

✅ **API Routes**（6个endpoints）
- `/api/stage1-clarification` - 目标澄清
- `/api/stage2-confirmation` - 确认
- `/api/stage3-framework` - 通用框架生成
- `/api/stage4-choice` - 个性化选择
- `/api/stage5-6-diagnostic` - 权重分析+提问
- `/api/stage7-personalization` - 个性化方案

✅ **3D组件契约** (`components/weight-visualization-3d/index.ts`)
- `WeightTerrain3D` - 主3D权重地形图（空实现，Agent B会填充）
- `ComparisonView` - 对比视图（空实现）
- `NodeDetailPanel`, `QuestionNodeLink` - 辅助组件

✅ **国际化skeleton** (`locales/{lang}/stage*.json`)
- 所有key已定义在`locales/i18n-keys.md`
- 空值文件已创建，Agent C会填充

✅ **进度条组件** (`components/ui/stage-progress-bar.tsx`)
- 已更新为7阶段显示

### 需要修改/创建的文件

#### 1. 修改现有组件（3个）

**`components/stage0-view.tsx`**
- **现状**: 旧3阶段的目的澄清对话界面
- **目标**: 简化为产品介绍 + 简洁chatbox
- **新功能**:
  - 顶部：产品标题 + 用途说明（使用`stage0.*` i18n keys）
  - 中间：简洁的输入框（placeholder引导正确输入）
  - 底部："Get Started"按钮
  - 点击后调用`initStage0(userInput)`，进入Stage 1

**`components/stage1-view.tsx`**
- **现状**: 旧的通用框架可视化（ECharts流程图）
- **目标**: 改造为Stage 1目标澄清对话界面
- **新功能**:
  - 对话式界面（类似旧的stage0-view）
  - 显示AI提问和用户回答
  - 调用`/api/stage1-clarification`
  - 完成后展示Mission Statement
  - "Confirm"按钮 → `completeStage1(mission)`进入Stage 2

**`components/stage2-view.tsx`**
- **现状**: 旧的个性化方案展示
- **目标**: 改造为Stage 2确认界面
- **新功能**:
  - 展示`clarifiedMission`的内容（missionStatement, keyLevers等）
  - 两个按钮：
    - "✅ Confirm" → 调用`/api/stage2-confirmation`，进入Stage 3
    - "🔄 Refine" → 返回Stage 1，可选提供feedback

#### 2. 新建组件（4个）

**`components/stage3-view.tsx`**
- **目标**: Stage 3通用框架展示（3D可视化）
- **布局**:
  - 顶部：标题 + 说明
  - 中间：`<WeightTerrain3D framework={universalFramework} />`（全屏）
  - 右侧浮动：视角控制按钮（俯视/侧视/默认）
  - 底部："Continue"按钮 → `completeStage3()`进入Stage 4
- **数据流**:
  - `useEffect`在mount时调用`/api/stage3-framework`
  - loading状态使用`SmartLoading`组件
- **注意**: `WeightTerrain3D`当前是空实现，会显示placeholder

**`components/stage4-view.tsx`**
- **目标**: Stage 4个性化选择界面
- **布局**:
  - 顶部：问题"Would you like to personalize this framework for your specific situation?"
  - 中间：两个选项卡片
    - "Yes, personalize it" → `choosePersonalization()`进入Stage 5-6
    - "No, I'll use the universal framework" → `skipPersonalization()`直接完成
  - 可选：textarea让用户说明原因
- **设计**: 使用`GlassCard`，突出两个选项

**`components/stage5-6-view.tsx`**
- **目标**: Stage 5-6权重分析+诊断提问（最复杂）
- **布局**: 左右分栏
  ```
  ┌─────────────────────────────────┬──────────────┐
  │                                 │              │
  │  3D Weight Visualization (70%)  │  Questions   │
  │  <WeightTerrain3D               │  (30%)       │
  │    framework={framework}        │              │
  │    questions={diagnosticQs}     │  - Q1        │
  │    highlightedQuestionIds=...   │  - Q2        │
  │  />                             │  - Q3        │
  │                                 │              │
  └─────────────────────────────────┴──────────────┘
  ```
- **右侧问答区**:
  - 每个问题卡片包含:
    - 🎯 Focus Area标题
    - 💡 Why this matters解释
    - ❓ Question
    - 📍 Affects: [节点标签]（点击可在3D中高亮）
    - 输入框
  - "Submit Answer"按钮
  - 所有问题回答后，"Generate My Plan"按钮 → `completeStage56()`
- **交互**:
  - 点击"Affects"节点标签 → 调用`onNodeSelect(nodeId)`，左侧3D高亮
  - 用户输入答案 → `addStage56Answer({questionId, answer, answeredAt})`
- **数据流**:
  - `useEffect`在mount时调用`/api/stage5-6-diagnostic` action='analyze'
  - 收集答案完成后调用action='collect'

**`components/stage7-view.tsx`**
- **目标**: Stage 7个性化方案展示（3D对比视图）
- **布局**:
  - 顶部：
    - 标题："Your Personal Action Framework"
    - 视图切换按钮：[2D Flow] [3D Terrain] [Split View]
  - 中间：根据viewMode显示
    - `'3d'`: `<ComparisonView universalFramework={...} personalizedFramework={...} viewMode="3d" />`
    - `'split'`: 左右对比
  - 底部：
    - Personal Insights摘要
    - Emerging Superpower
    - First Step建议
    - "🎉 Complete"按钮 → `completeFlow()`
- **数据流**:
  - `useEffect`在mount时调用`/api/stage7-personalization`
  - 传入`framework`, `diagnosticPoints`, `userAnswers`

#### 3. 更新主页面

**`app/client-page-v2.tsx`**
- **修改**: `renderStage()`中的switch case
- 当前是临时复用，需要改为正确的组件映射：
  ```tsx
  case 'STAGE_0_INTRODUCTION': return <Stage0View />;
  case 'STAGE_1_CLARIFICATION': return <Stage1View />;
  case 'STAGE_2_CONFIRMATION': return <Stage2View />;
  case 'STAGE_3_FRAMEWORK': return <Stage3View />;
  case 'STAGE_4_PERSONALIZATION_CHOICE': return <Stage4View />;
  case 'STAGE_5_6_DIAGNOSTIC': return <Stage56View />;
  case 'STAGE_7_PERSONALIZED_PLAN': return <Stage7View />;
  ```

### 设计规范

**UI风格**: 玻璃态设计 (Glassmorphism)
- 使用`GlassCard`组件 (已有)
- 背景：`gradient-background` class
- 动画：Framer Motion的`motion`组件
- 配色：深色主题，蓝紫渐变

**已有UI组件**（可直接使用）:
- `GlassCard` - 玻璃态卡片
- `Button` - 按钮
- `Input` - 输入框
- `SmartLoading` - 智能loading
- `SmartError` - 错误提示
- `ThinkingIndicator` - AI思考指示器
- `MessageBubble` - 对话气泡
- `ChatBox` - 对话容器

**响应式**: 
- 移动端优先
- Stage 5-6在手机上改为垂直布局（3D在上，问题在下）
- 使用`useBreakpoint` hook

### 国际化使用

```tsx
import { useTranslations } from 'next-intl';

const t = useTranslations('stage3'); // 对应locales/{lang}/stage3.json
<h1>{t('title')}</h1>
```

**注意**: Agent C正在填充i18n内容，如果key为空，暂时用placeholder英文文本。

### API调用示例

```tsx
// Stage 1 clarification
const response = await fetch('/api/stage1-clarification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userInput: input,
    conversationHistory: messages,
    currentMission: clarifiedMission,
  }),
});
const result = await response.json();

// Stage 3 framework generation
const response = await fetch('/api/stage3-framework', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mission: clarifiedMission,
  }),
});
```

### Zustand Store使用

```tsx
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';

const {
  currentStage,
  clarifiedMission,
  universalFramework,
  // actions
  completeStage1,
  setUniversalFramework,
  completeStage3,
} = useCognitiveCoachStoreV2();
```

### 错误处理

所有API调用都使用已有的错误处理：
- 使用`SmartError`组件显示错误
- API返回格式：`{ success: boolean, data?: any, message?: string }`
- 网络错误、超时都已在`api-client.ts`中处理

---

## ✅ 完成标准

1. **功能完整**:
   - ✅ 所有7个stage都能正常切换
   - ✅ 每个stage的核心交互都实现
   - ✅ API调用正确，数据流通畅

2. **代码质量**:
   - ✅ TypeScript无错误
   - ✅ 遵循现有代码风格
   - ✅ 合理使用已有组件和hooks

3. **用户体验**:
   - ✅ 加载状态清晰
   - ✅ 错误提示友好
   - ✅ 动画流畅自然
   - ✅ 响应式布局正常

4. **Build测试**:
   - ✅ `npm run build`无错误
   - ✅ 无TypeScript编译错误
   - ✅ 无ESLint警告

---

## 🚀 开始工作

### 步骤1: 理解现有代码
1. 阅读`lib/types-v2.ts`了解数据结构
2. 阅读`lib/store-v2.ts`了解状态管理
3. 查看现有的`components/stage0-view.tsx`作为参考

### 步骤2: 按顺序重构
建议顺序：
1. Stage 0 (最简单，熟悉流程)
2. Stage 1 (对话式，有参考)
3. Stage 2 (简单确认)
4. Stage 4 (简单选择)
5. Stage 3 (需要3D组件)
6. Stage 5-6 (最复杂)
7. Stage 7 (需要3D组件)

### 步骤3: 测试
每完成一个stage，在浏览器中测试切换流程。

### 步骤4: 最终Build
所有组件完成后，运行`npm run build`确认无错误。

---

## 💡 提示

- **3D组件空实现**: `WeightTerrain3D`和`ComparisonView`当前是placeholder，这是正常的
- **i18n空值**: 如果遇到空的i18n key，使用英文placeholder
- **状态持久化**: Zustand会自动保存到localStorage
- **Session清除**: 新架构会自动清除旧session（version: 2）

---

## 📞 协调

- **Agent B**: 正在实现3D可视化组件
- **Agent C**: 正在填充国际化文本
- **最终整合**: 我会整合三方代码并测试

Good luck! 💪

