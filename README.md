# 🧠 CognitiveCoach - 认知教练 V2

一个基于 Next.js 和 Gemini 2.5 Pro 的智能学习助手，通过 FSM（有限状态机）引导您完成从目标设定到知识掌握的完整学习旅程。

## ✨ 核心特性

- **🎯 智能目标精炼**：将模糊的学习意图转化为清晰的学习目标
- **📚 知识框架生成**：AI 自动构建结构化的知识体系
- **🔄 系统动力学可视化**：通过 Mermaid 图表展示知识点之间的关系
- **🎨 生动的学习比喻**：用日常事物类比复杂概念，提升理解效率
- **📊 FSM 状态管理**：清晰的学习进度跟踪和阶段管理

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Gemini API

**获取 API Key**：
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 使用 Google 账号登录
3. 创建新的 API Key

**配置环境变量**：
```bash
# 创建 .env.local 文件
cp env.example .env.local

# 编辑文件，添加您的 API Key
GOOGLE_AI_API_KEY=your_actual_api_key_here
```

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 🏗️ 项目架构

```
axthefish-CognitiveCoach/
├── app/                    # Next.js 应用目录
│   ├── api/coach/         # AI API 端点
│   └── page.tsx           # 主控制器
├── components/            # UI 组件
│   ├── s0-intent-view.tsx # 意图校准视图
│   ├── s1-knowledge-framework-view.tsx
│   ├── s2-system-dynamics-view.tsx
│   └── ...
├── lib/                   # 核心逻辑
│   ├── store.ts          # Zustand 状态管理
│   ├── types.ts          # TypeScript 类型定义
│   └── gemini-config.ts  # Gemini AI 配置
└── Docs/                 # 项目文档
```

## 🔧 技术栈

- **框架**: Next.js 15.2.4
- **AI 模型**: Gemini 2.5 Pro (Google AI)
- **状态管理**: Zustand
- **UI 组件**: shadcn/ui + Tailwind CSS
- **图表渲染**: Mermaid
- **类型系统**: TypeScript

## 📖 使用指南

1. **S0 - 意图校准**
   - 输入您的学习目标（例如："学习 React 框架"）
   - AI 会精炼并明确您的学习意图

2. **S1 - 知识框架**
   - AI 生成结构化的知识体系
   - 包含主要概念和子主题

3. **S2 - 系统动力学**
   - 可视化知识点之间的关系
   - 提供生动的学习比喻

4. **S3 - 行动计划**（待实现）
   - 制定具体的学习步骤

5. **S4 - 自主运行**（待实现）
   - 持续跟踪和优化学习进度

## 🔍 API 配置详情

查看 [API_KEY_TODO.md](./API_KEY_TODO.md) 了解详细的配置步骤和故障排除指南。

## 🛠️ 开发指南

### 添加新功能

1. 在 `lib/types.ts` 中定义数据类型
2. 在 `lib/store.ts` 中扩展状态管理
3. 在 `app/api/coach/route.ts` 中实现 API 逻辑
4. 创建或更新相应的视图组件

### 调试模式

开发环境下，页面右下角会显示调试信息：
- 当前 FSM 状态
- 用户目标
- 加载状态
- 错误信息

## 📝 项目文档

- [PRD.md](./Docs/PRD.md) - 产品需求文档
- [ReconstructReport.md](./Docs/ReconstructReport.md) - 重构报告

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目基于 MIT 许可证开源。

---

Built with ❤️ using Next.js and Gemini AI
