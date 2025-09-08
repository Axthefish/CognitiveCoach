### CognitiveCoach 重构与优化 - LLM 执行计划

本文件描述一组可直接由 LLM 执行的编辑任务，用于修正 UI/UX、降低模型成本、修复流式 Bug、优化 Prompt，并对 S3/S4 交互与安全性进行升级。请严格按任务顺序与验收标准执行，避免无关改动。

---

## 全局约束
- 仅修改本文列出的文件与位置；保持现有代码风格与格式化，不重排无关代码。
- 所有新文案使用简体中文，避免“AI 正在…”表述，改为“为你…”。
- 严禁扩大权限范围；CORS 仅允许白名单域。
- 每个任务完成后运行类型检查/构建并自测相关页面。

---

## 执行顺序与并行策略
- 可并行：UI 快修（T1/T2/T4）、Prompt（T6）、CORS（T5）。
- 需顺序：成本策略（T3）→ 流式网络容错（T4）→ S3/S4 交互改造（T7）。

---

## 任务列表

### T1. 修复加载圆圈偏左与布局抖动（UI 快修）
- 修改位置：`components/ui/enhanced-progress-indicator.tsx`
  - circular 模式的最外层容器 `<div className="relative w-32 h-32">` 增加 `mx-auto` 实现水平居中。
  - linear/wave 模式外围容器补 `text-center` 以统一对齐。
- 修改位置：`components/ui/loading-overlay.tsx`
  - 将进度显示包裹在固定宽度壳（如 `max-w-xs mx-auto`）内，避免重排抖动。
  - 错误提示改为浮层式提示（不替换主容器），保留已计算的进度与步骤显示。
- 验收：S1/S2 加载时进度圈完全居中；重试/错误时进度不回到 0，布局稳定无跳动。

### T2. 降低认知负担：隐藏高级选项
- 修改位置：`components/s0-intent-view.tsx`
  - 将“决策类型/运行档位”的 `<select>` 收起至“高级设置”折叠区（默认收起）。
  - 去除 seed 的任何可见输入（若存在），仅在 `store` 中保留字段。
  - 默认值：`decisionType='plan'`、`runTier` 不再由用户选择（见 T3 策略），仅在高级区显示当前策略说明。
- 验收：默认界面仅保留目标输入与开始按钮；展开“高级设置”后可查看但不强制选择。

### T3. 模型成本策略：默认 Lite，必要时 Pro 复算
- 修改位置：`app/api/coach-stream/route.ts`
  - S0/S1/S2 初次调用 `generateJson/ generateText` 的 `runTier` 固定为 `'Lite'`（忽略 `payload.runTier`）。
  - 若发生 TIMEOUT → 已有降级逻辑保留；若 QA 失败或关键字段缺失：触发一次 `'Pro'` 复算（保持现有 steps 更新），仅复算当前关键步骤。
  - S3：先 `'Lite'` 生成 1 个方案；若 QA 不通过或缺字段，再 `'Pro'` 生成 1 个对照方案择优（保留现有 n-best 逻辑但 `n` 最多为 1+1）。
  - S4：默认 `'Lite'`；如需跨策略指标深链分析再 `'Pro'` 复算一次。
- 修改位置：`lib/gemini-config.ts`
  - 无需改动模型名函数；确保 `getModelName('Lite')` 返回 `gemini-2.5-flash-lite`，`'Pro'` 返回 `gemini-2.5-pro`（已满足）。
- 验收：完整 S0→S4 路径在正常输入下仅消耗 Lite；边界/失败时才触发 Pro；日志可见“降级/复算”痕迹。

### T4. 流式网络错误容错与一次自动重试
- 修改位置：`components/cognitive-stream-animator.tsx`
  - 扩展“可忽略/可重试”错误判定：匹配 `ERR_NETWORK_CHANGED`、`NetworkError when attempting to fetch resource`、`TypeError: Failed to fetch`。
  - 新增 `hasRetriedRef = useRef(false)`。当上述网络错误发生且：
    - 未收到 `done` 且 `finalData` 为空；
    - 当前为活动流（`currentStreamIdRef` 相符）且组件仍挂载；
    则自动调用一次 `startStreaming()` 重试，并保持现有 `steps`（不要清空进度）。
  - 如已收到 `done` 或已有 `finalData`，静默忽略错误日志，不展示错误卡片。
- 验收：复现场景（切换网络/断开再恢复）不再出现“network error”红卡；最多一次自动重试，失败后才显示非阻断错误。

### T5. CORS 收敛与安全响应头
- 修改位置：`app/api/coach-stream/route.ts`
  - 用 `withCors(origin)` 替代当前 `Access-Control-Allow-Origin: origin || '*'`，遵循 `lib/cors.ts` 白名单策略（请求/错误返回/429 等所有分支一致）。
- 修改位置：`next.config.ts`
  - 在 `headers()` 中添加：`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy`（禁用不需要的特性）、简化版 CSP（仅允许自域与必要第三方域）。
- 验收：跨域访问仅限白名单；安全头正确下发，无控制台警告。

### T6. Prompt 优化：S2 生活化比喻、S3 微承诺
- 修改位置：`lib/prompt-templates.ts`
  - S2_TEMPLATE.constraints 增补：
    - “选一个用户日常熟悉的场景（如通勤/做饭/健身/搬家等）进行映射；比喻长度 50–80 字；避免空泛术语；需与 S1 节点主路径与反馈环一一对应。”
  - S3_TEMPLATE.constraints 增补：
    - 行动语句采用“微承诺 + 时间窗”（如“今天/本周内…”），总时长≤30 分钟；
    - 追加 1 条“抗阻力替代方案”；
    - KPIs 保持 3–5 条、10–20 字。
- 验收：S2 输出的比喻接近日常具体场景；S3 输出以“下一步小行动”为主，语言为第一人称微承诺。

### T7. S3/S4 交互重设计（轻量版本）
- 修改位置：`components/s3-action-plan-view.tsx`
  - 将列表式 To-do 改为“下一步 + 备选一步”卡片；提供“完成”与“换一个建议”按钮；保留历史记录折叠区。
- 修改位置：`components/s4-autonomous-operation-view.tsx`
  - 新增 check-in 轻表单（三问：做了什么/遇到什么/下一步），提交后触发 S4 流式分析，展示 1–2 条微矫正建议；移除冗余仪表盘，仅保留趋势火花线。
- 验收：用户完成一次 S3 建议后能直接进行 S4 check-in 并得到精炼建议；界面无繁重面板与统计。

### T8. 可观测性与质量门升级
- 修改位置：`app/api/coach-stream/route.ts`
  - 已存在的 `traceId` 统一注入到所有 `sendErrorSafe` 与成功 `data_structure` 的 payload 中。
  - 记录：`tier_used`（Lite/Pro）、`qa_passed`、`auto_repair_applied` 等关键信息；仅日志输出，不返回给前端。
- 修改位置：`lib/schemas.ts`
  - S4 `referencedMetricIds` 增加最大长度限制（如 ≤ 20），并限定元素为字符串。
- 验收：日志出现 traceId 且可串联每次复算；QA 失败时能看到 auto-repair 应用记录。

---

## 文案统一（示例替换）
- 将“AI 正在…”类提示替换为：“正在为你… / 正在帮你… / 正在生成…”。
- 文件涉及：`loading-overlay.tsx`、`prompt-templates.ts` 中的用户可见说明。

---

## 回归与测试用例
- 交互路径
  - S0 仅输入目标 → S1/S2/S3/S4 走通，无手动选择档位。
  - 断网/切网后继续：不出现红色错误卡，自动一次重试，最终能拿到结果或给出非阻断提示。
- 输出质量
  - S2 比喻包含明确生活场景，能对应 S1 的主路径。
  - S3 仅给 1 个“下一步”和 1 个“备选一步”，均≤50 字，包含时间窗。
- 安全
  - 非白名单域请求被拒；安全头齐全；无混用 `*` 的 CORS。
  - 限流仍生效；无内存泄漏或并发未清理的流。

---

## 变更影响与回滚
- 风险较小的 UI 改动先行；服务端仅调整默认档位与复算逻辑，失败时回退到原有行为（已有超时降级）。
- 若遇严重问题，可临时还原：
  - 将 `coach-stream` 中初次调用的 `runTier` 从 `'Lite'` 改回 `payload.runTier ?? 'Pro'`；
  - 关闭自动重试分支（保留 AbortError 忽略逻辑）。

---

## 提交规则
- 每个任务单独提交，提交信息包含：任务编号、文件名、行为动词与影响摘要。
- 通过后在本文档勾选完成项并附带截图/日志要点。


