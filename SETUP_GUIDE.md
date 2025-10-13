# CognitiveCoach 配置指南

## 环境变量配置

### 步骤 1: 创建本地环境文件

在项目根目录创建 `.env.local` 文件：

```bash
touch .env.local
```

### 步骤 2: 配置必需的 API 密钥

打开 `.env.local` 文件并添加以下内容：

```env
# ==============================================
# AI API Configuration (必需)
# ==============================================
# 获取 API Key: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_actual_api_key_here

# ==============================================
# Environment (可选)
# ==============================================
NODE_ENV=development

# ==============================================
# Logging (可选)
# ==============================================
# 选项: debug, info, warn, error
LOG_LEVEL=info
```

### 步骤 3: 获取 Gemini API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 登录你的 Google 账号
3. 点击 "Create API Key" 或 "Get API Key"
4. 复制生成的 API key (格式: `AIza...`)
5. 将其粘贴到 `.env.local` 文件中的 `GEMINI_API_KEY=` 后面

### 步骤 4: 验证配置

启动开发服务器：

```bash
npm run dev
```

打开浏览器控制台，检查是否有以下日志：

✅ **配置成功** - 你应该看到：
```
✅ Environment variables validated successfully
```

❌ **配置失败** - 如果看到以下警告：
```
⚠️ No AI API keys configured. AI features will use fallback data.
```

这说明 API key 未正确配置。请检查：
- `.env.local` 文件是否在项目根目录
- API key 是否正确复制（没有多余空格）
- 是否重启了开发服务器

## 常见问题排查

### 问题 1: API Key 配置后仍然显示警告

**原因**：可能是以下之一
- `.env.local` 文件位置不正确
- API key 格式错误
- 开发服务器未重启

**解决方法**：
1. 确认 `.env.local` 文件在项目根目录（与 `package.json` 同级）
2. 确认 API key 以 `AIza` 开头，长度约 39 字符
3. 完全重启开发服务器：
   ```bash
   # 按 Ctrl+C 停止服务器
   # 然后重新启动
   npm run dev
   ```

### 问题 2: 浏览器显示 "Error sending message"

**原因**：API 调用失败

**解决方法**：
1. 打开浏览器控制台 (F12)
2. 查看 Console 标签中的详细错误信息
3. 如果错误信息包含 JSON 对象，说明 logger 现在可以正确显示错误详情
4. 常见错误类型：
   - `NO_API_KEY`: API key 未配置 → 检查 `.env.local`
   - `TIMEOUT`: 请求超时 → 网络问题或 API 服务慢
   - `API_ERROR`: API 调用失败 → 检查 API key 是否有效
   - `RATE_LIMIT`: 请求过于频繁 → 等待一段时间后重试

### 问题 3: API Key 无效

**症状**：配置了 API key 但仍然无法使用

**解决方法**：
1. 确认 API key 格式正确：
   - 应该以 `AIza` 开头
   - 长度约 35-45 字符
   - 只包含字母、数字、连字符和下划线

2. 检查 API key 是否启用：
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 检查 API key 是否被限制或禁用
   - 确认 Gemini API 已启用

3. 尝试生成新的 API key

## 调试技巧

### 启用详细日志

在 `.env.local` 中设置：

```env
LOG_LEVEL=debug
```

这将输出更详细的调试信息，帮助定位问题。

### 查看网络请求

1. 打开浏览器开发者工具 (F12)
2. 切换到 "Network" 标签
3. 筛选 XHR/Fetch 请求
4. 查看 API 请求和响应的详细信息

### 检查环境变量

在代码中临时添加日志（仅用于调试，不要提交）：

```typescript
// 在任意 service 文件中
console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
```

## 生产环境配置

在 Vercel 或其他托管平台上部署时：

1. 在平台的环境变量设置中添加：
   ```
   GEMINI_API_KEY=your_api_key
   NODE_ENV=production
   ALLOWED_ORIGINS=https://yourdomain.com
   ```

2. **注意**：不要在代码中硬编码 API key
3. **注意**：不要将 `.env.local` 提交到 git

## 高级配置（可选）

### 自定义模型

```env
# 使用不同的 Gemini 模型
GEMINI_MODEL=gemini-2.5-pro
GEMINI_LITE_MODEL=gemini-2.5-flash-lite
```

### 自定义超时时间

```env
# 各阶段超时配置（毫秒）
GENERATION_TIMEOUT_MS_PRO_S0=45000
GENERATION_TIMEOUT_MS_PRO_S1=90000
GENERATION_TIMEOUT_MS_PRO_S2=108000
```

### 速率限制

```env
# 每分钟最大请求数
MAX_REQUESTS_PER_MINUTE=60
```

## 获取帮助

如果问题仍然存在：

1. 检查浏览器控制台的完整错误信息
2. 查看 [GitHub Issues](https://github.com/axthefish/CognitiveCoach/issues)
3. 提交新的 issue，附上：
   - 错误截图（遮盖敏感信息）
   - 浏览器控制台日志
   - 环境信息（Node.js 版本、操作系统等）

