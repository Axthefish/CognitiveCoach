# CognitiveCoach

一个基于AI的认知成长教练应用，帮助用户澄清目标、构建通用框架并生成个性化成长方案。

## 🌟 特性

- **三阶段智能流程**
  - Stage 0: 目的澄清 - 通过对话式交互深入理解用户目标
  - Stage 1: 通用框架生成 - 创建逻辑流程图和关键要素分析
  - Stage 2: 个性化方案 - 动态收集信息并实时生成定制化方案

- **现代化技术栈**
  - Next.js 15 + React 19 + TypeScript
  - Tailwind CSS 4 玻璃态设计
  - Google Gemini AI 驱动
  - 完整的类型安全和验证

- **优秀的用户体验**
  - 响应式设计，支持移动端和桌面端
  - 实时可视化流程图
  - 会话持久化，支持断点续传
  - 多语言支持（中文/英文）

## 🚀 快速开始

### 环境要求

- Node.js 18.0 或更高版本
- npm 或 pnpm 包管理器

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd axthefish-CognitiveCoach

# 安装依赖
npm install
```

### 配置环境变量

复制 `.env.example` 到 `.env.local` 并配置必要的环境变量：

```bash
cp .env.example .env.local
```

必需的环境变量：

- `GEMINI_API_KEY` 或 `GOOGLE_AI_API_KEY`: Google Gemini API 密钥
  - 获取地址: https://makersuite.google.com/app/apikey

可选的环境变量：

- `HEALTH_TOKEN`: 健康检查端点的认证令牌（生产环境推荐）
- `ALLOWED_ORIGINS`: CORS 允许的源（生产环境必需）
- `GEMINI_MODEL`: 自定义 Gemini 模型名称（默认: gemini-2.5-pro）
- `GEMINI_LITE_MODEL`: 轻量级模型名称（默认: gemini-2.5-flash-lite）

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 在浏览器中打开
# http://localhost:3000
```

### 构建生产版本

```bash
# 构建应用
npm run build

# 启动生产服务器
npm start
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并监听文件变化
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 代码质量检查

```bash
# 运行 ESLint
npm run lint

# 类型检查
npm run build
```

## 📁 项目结构

```
├── app/                        # Next.js App Router
│   ├── api/                   # API 路由
│   │   ├── stage0/           # Stage 0: 目的澄清
│   │   ├── stage1/           # Stage 1: 框架生成
│   │   ├── stage2/           # Stage 2: 个性化方案
│   │   └── health/           # 健康检查
│   ├── client-page-v2.tsx    # 主客户端页面
│   ├── page.tsx              # 服务端入口
│   └── layout.tsx            # 根布局
│
├── components/                # React 组件
│   ├── chat-interface/       # 聊天界面组件
│   ├── logic-flow-chart/     # 流程图可视化
│   ├── ui/                   # UI 基础组件
│   ├── stage0-view.tsx       # Stage 0 视图
│   ├── stage1-view.tsx       # Stage 1 视图
│   └── stage2-view.tsx       # Stage 2 视图
│
├── lib/                       # 核心库和工具
│   ├── prompts/              # AI Prompt 模板
│   ├── api-client.ts         # API 客户端
│   ├── store-v2.ts           # Zustand 状态管理
│   ├── types-v2.ts           # TypeScript 类型定义
│   ├── gemini-config.ts      # Gemini AI 配置
│   └── logger.ts             # 日志工具
│
├── services/                  # 业务逻辑层
│   ├── stage0-service.ts     # Stage 0 服务
│   ├── stage1-service.ts     # Stage 1 服务
│   └── stage2-service.ts     # Stage 2 服务
│
├── locales/                   # 国际化翻译
│   ├── zh/                   # 中文
│   └── en/                   # 英文
│
└── tests/                     # 测试文件
    ├── unit/                 # 单元测试
    └── integration/          # 集成测试
```

## 🏗️ 架构设计

本项目采用现代化的三层架构：

1. **表现层 (Components)**
   - React 组件负责 UI 渲染和用户交互
   - Zustand 管理全局状态
   - 响应式设计，支持移动端和桌面端

2. **服务层 (Services)**
   - 业务逻辑封装
   - AI Prompt 管理和优化
   - 数据验证和错误处理

3. **数据层 (API Routes)**
   - Next.js API Routes 处理请求
   - Google Gemini AI 集成
   - 类型安全的数据流

详细架构文档请参考 [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🔧 技术栈

### 核心框架
- **Next.js 15.2.4** - React 框架
- **React 19.0.0** - UI 库
- **TypeScript 5.x** - 类型安全
- **Tailwind CSS 4.x** - 样式框架

### 状态管理
- **Zustand 5.0.7** - 轻量级状态管理
- 支持持久化和会话恢复

### AI 集成
- **Google Generative AI** - Gemini API
- **Zod 4.0.17** - Schema 验证

### 可视化
- **Mermaid 11.9.0** - 流程图渲染
- **ECharts 5.6.0** - 数据图表
- **Framer Motion 12.x** - 动画效果

### UI 组件
- **Radix UI** - 无障碍组件库
- **Lucide React** - 图标库
- **clsx** - 条件样式工具

## 🚀 部署

### Vercel 部署（推荐）

1. 在 Vercel 中导入项目
2. 配置环境变量（参考 `.env.example`）
3. 部署

### 其他平台

确保平台支持 Next.js 15 和 Node.js 18+

```bash
# 构建
npm run build

# 启动
npm start
```

## 🔒 安全性

- ✅ 所有 API 密钥存储在环境变量中
- ✅ CORS 配置保护生产环境
- ✅ 输入验证和数据清理
- ✅ 类型安全的数据流
- ✅ 健康检查端点认证

## 📝 许可证

本项目采用 MIT 许可证

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

如有问题或建议，请通过 Issue 联系我们。

---

Made with ❤️ by CognitiveCoach Team

