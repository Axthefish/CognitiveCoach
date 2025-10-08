# 🧠 Cognitive Coach

一个基于AI的学习助手，通过S0-S4框架引导你完成结构化的学习旅程。

## ✨ 核心功能

- **S0: 目标校准** — 明确和精炼学习目标
- **S1: 知识框架** — 生成结构化知识图谱
- **S2: 系统动力学** — 可视化知识关系图
- **S3: 行动计划** — 创建可执行的行动步骤和KPI
- **S4: 自主运营** — 监控进度并获得AI指导

### 运行模式

- **Lite**: 快速响应（gemini-2.5-flash-lite）
- **Pro**: 全面分析（gemini-2.5-pro，默认）
- **Review**: Pro模式 + 人工审核

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
# 必需：Google Gemini API密钥
GEMINI_API_KEY=your_api_key_here

# 可选配置
NODE_ENV=development
LOG_LEVEL=info
ALLOWED_ORIGINS=http://localhost:3000
```

### 3. 启动开发服务器

```bash
npm run dev
# 打开 http://localhost:3000
```

## 🛠 技术栈

- **前端**: Next.js 15.2.4, React 19, TypeScript, Tailwind CSS
- **AI**: Google Gemini (gemini-2.5-pro)
- **状态管理**: Zustand
- **图表**: Mermaid, ECharts
- **验证**: Zod

## 📝 项目结构

```
├── app/              # Next.js应用路由
│   ├── api/         # API端点
│   └── *.tsx        # 页面组件
├── components/       # React组件
│   ├── s0-s4/       # 各阶段视图
│   └── ui/          # 通用UI组件
├── lib/             # 工具函数和配置
│   ├── schemas.ts   # Zod schema定义
│   ├── store.ts     # Zustand状态管理
│   └── *.ts         # 其他工具
├── services/        # S0-S4业务服务层
└── tests/           # 测试文件
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 生成覆盖率报告
npm test -- --coverage
```

## 📦 构建和部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

### Vercel部署

项目已配置好Vercel部署，推送到main分支会自动部署。

## 📚 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API密钥 |
| `NODE_ENV` | - | 运行环境 (development/production) |
| `LOG_LEVEL` | - | 日志级别 (debug/info/warn/error) |
| `ALLOWED_ORIGINS` | - | CORS允许的来源 |
| `MAX_REQUESTS_PER_MINUTE` | - | 速率限制（默认60） |

## 🔒 安全特性

- ✅ CORS跨域保护
- ✅ 内容安全策略(CSP)
- ✅ 速率限制
- ✅ API密钥掩码
- ✅ 安全响应头

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 License

MIT

