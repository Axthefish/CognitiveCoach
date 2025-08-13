我先并行读取关键代码文件，确认当前实现与计划是否一致，然后基于确认结果把改进方案重写成适合 LLM 快速执行的“工程化任务清单”（包含路径、任务、验收标准、提示词约束）。随后直接在对话里输出，便于你复制。
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool

已完成对代码库的快速体检，并对现有聊天与计划进行对照。整体实现与计划方向一致，但还缺少“可信度与可执行闭环”的关键约束与若干基础设施（Schema/QA/策略DSL/版本化/遥测）。下面给出适合 LLM 快速执行的工程化任务清单（你可直接复制为 `ENGINEERING_EXECUTION_PLAN.md` 放在根目录）。

### 现状核对（与计划对照）
- 已有
  - API 路由 `app/api/coach/route.ts`：实现了 S0–S4 处理器（Gemini 2.5 Pro）[[memory:5384707]]
  - 前端视图：`S0–S4` 完整流程、`Mermaid` 渲染与基础 KPI/进度面板
  - 状态管理 `zustand`：`lib/store.ts` 维护 `userContext` 与 FSM
  - 健康检查 `app/api/health/route.ts`
- 缺口（对应你的计划）
  - 缺少强 Schema 校验（Zod/TypeBox）
  - 无 QA 闸门（Coverage/Coherence/Actionability/Evidence）
  - 无“策略 DSL”（指标-触发-诊断-选项-回收期）
  - 无证据/置信度/applicability 字段的提示词与 UI 呈现
  - 无版本快照与 diff
  - 无图-表一致性校验（S2 节点到策略表映射）
  - 无模式/风格开关与最小“遥测”

---

## ENGINEERING_EXECUTION_PLAN.md

### 目标
- 将现有 S0–S4 流程升级为“稳定、可验证、可执行、可复评”的闭环：强 Schema、QA 闸门、策略 DSL、证据/置信度、图-表一致性、基础版本化与轻遥测。
- 保持模型 `gemini-2.5-pro`，并做好 parse → validate → gate → respond 的 API 出片规范 [[memory:5384707]]。
- 新增产品化核心目标：按“决策类型（探索/比较/排障/规划）”路由流程与提示词；以“压缩不确定性到可决策”为准绳，显式跟踪并优化“不确定性压缩效率（步数/时长）”。

### 分阶段里程碑
- Phase 1（1–2 周）：可信 + 可执行 MVP（Schema/QA/DSL/证据/图表映射/轻量版本与遥测）
- Phase 2（3–4 周）：RAG、成本优化、版本 diff 与回退、模式自动化
- Phase 3（5 周+）：域包/策略包与评测体系

---

### 任务总览（可直接分派）
- 依赖
  - 安装：`zod`（运行时 Schema 校验）、可选 `fast-deep-equal`
- 新增文件
  - `lib/schemas.ts`：Zod 输出契约（S0–S4 + Evidence）
  - `lib/strategy-dsl.ts`：策略 DSL 类型定义（见下方模板）
  - `lib/qa.ts`：质量闸门（coverage/coherence/actionability/evidence）
  - `lib/versioning.ts`：版本快照与 diff
  - `app/api/rag/route.ts`：RAG 占位
- 修改文件
  - `app/api/coach/route.ts`：接入 parse→validate→gate；失败降温重试；补证据/置信度字段；S2/S3 输出对齐 DSL
  - `lib/store.ts`：新增 `versions[]/currentVersion`；写入快照
  - `app/page.tsx`：S1/S2/S3 未过 QA 时阻止流转并提示；传递模式/风格参数
  - `components/s3-action-plan-view.tsx`、`components/s4-autonomous-operation-view.tsx`：新增“策略表视图”与证据展示
  - `components/s2-system-dynamics-view.tsx`：显示与 DSL 映射的节点覆盖情况
  - `README.md`：更新使用说明与环境变量

---

### 实施细节与模板

#### 1) Schema（`lib/schemas.ts`）
- 目的：确保所有 AI 输出结构稳定；强制包含 `evidence[]/confidence/applicability`
- 需覆盖：
  - S0 refineGoal 输出
  - S1 framework 节点
  - S2 system dynamics：`{ mermaidChart, metaphor, nodes: [{id,title}] }`（新增 nodes 用于覆盖与一致性）
  - S3 action plan：保留现有 steps/KPIs，并新增 `strategySpec`（策略 DSL 过渡字段，允许为空）
  - S4 analyzeProgress 输出
- 验收：解析失败返回 400/500；成功时 JSON 结构满足 Zod 校验

示例字段要点（非完整代码）：
```ts
// zod schema 键要点
evidence: z.array(z.object({
  source: z.string(),
  url: z.string().url().optional(),
  date: z.string().optional(),
  scope: z.string().optional(),
})).optional(),
confidence: z.number().min(0).max(1).optional(),
applicability: z.string().optional()
```

- 还需覆盖（输入契约）：
  - `TaskSpec`/`Mode`/`Profile` 的输入 Schema（主题/目标/模式/风格滑杆/禁区/决策类型 `decisionType`/运行档位 `runTier`/风险偏好 `riskPreference`/可选 `seed`）；解析失败直接 400。
  - 统一 ID/单位/时间窗规范：`metricId/nodeId` 统一 slug 化（小写、去空格、符号→`-`），`unit` 使用白名单（如 `kg`/`%`/`count`/`ms`），时间窗使用 ISO 8601 Duration（如 `P7D`）。
  - 在解析后对 `nodes[].id` 与 `metrics[].metricId` 执行相同的标准化函数以避免“字符串差异导致假失配”。
  - S2 增加语义规范：在 Schema 中为系统图节点与关系预留 `edgeType`（白名单：`causal_positive`/`causal_negative`/`inhibit`/`condition`/`constraint`），用于后续一致性与可解释性校验（初期可由 Mermaid 解析结果推断或留空）。
  - `Profile` 持久化字段：`language`/`terminologyStyle`/`encouragementWeight`（默认低）/`riskPreference`/`visualPreference`。

#### 2) 策略 DSL（`lib/strategy-dsl.ts`）
- 目的：统一“指标-触发-诊断-选项-回收期/止损”的执行合约
- 参考（你计划的附录 A），保持与前端渲染需求一致
- 验收：类型被 `lib/schemas.ts` 的 `StrategySpec` 引用；S3 可选生成该结构

 模板（节选）：
```ts
export interface Evidence { source: string; url?: string; date?: string; scope?: string }
export interface Trigger { metricId: string; comparator: '>' | '>=' | '<' | '<=' | '==' | 'trend_down' | 'trend_up'; threshold: number | string; window: string }
export interface DiagnosisStep { id: string; description: string; check?: string }
export interface StrategyOption { id: 'A'|'B'|'C'; steps: string[]; benefits: string[]; risks?: string[]; suitableFor?: string[] }
export interface RecoveryWindow { window: string; reviewMetricIds: string[] }
export interface StopLoss { condition: string; action: string }
export interface MetricSpec { metricId: string; what: string; why: string; triggers: Trigger[]; diagnosis: DiagnosisStep[]; options: StrategyOption[]; recovery: RecoveryWindow; stopLoss: StopLoss; evidence?: Evidence[]; confidence?: number; applicability?: string }
export interface StrategySpec { metrics: MetricSpec[]; evidence?: Evidence[]; confidence?: number }
```

- 字段增强（建议纳入类型定义并在 QA 校验）：
  - `MetricSpec.unit: 'kg'|'%'|'count'|'ms'|...`（与采集方式一致）
  - `MetricSpec.assumptions?: string[]`、`MetricSpec.constraints?: string[]`（显式假设与边界）
  - `StopLoss` 改为必填；若确实无法定义，需在 `issues` 中给出 blocker 级原因与修复建议。

#### 3) QA 闸门（`lib/qa.ts`）
- 目的：未达标不出片；返回可修复提示
- 检查项：
  - Schema 校验
  - 覆盖率：S2 的 `nodes[].id` 必须被 S3 的 `StrategySpec.metrics[].metricId` 覆盖
  - 一致性：同名节点/术语一致（大小写/空格规范化后比较）
  - 可执行性：每个 `metric` 至少 1 个 `trigger + diagnosis + option + recovery`
  - 证据：关键项需 `evidence` 或给出 `unknown` 原因
  - VOI：`missingEvidenceTop3` 必须存在且每条包含 `voi_reason`；按启发式（影响决策概率 × 决策价值差 × 采集成本倒数）排序的理由简述
  - 多 POV：S3 至少输出 2 种 POV 的策略卡并列（如收益最大化/风险最小化），且每个 POV 含 A/B/C 选项
  - StopLoss：缺失视为 blocker；`stopLoss` 与 `recovery.window` 需在逻辑上匹配
  - 图-表语义：`edgeType` 使用白名单；S2 图节点到 S3 指标覆盖率 100% 未达则阻断
- 三向一致：
  - S1→S2：框架中的关键节点必须出现在系统图 `nodes[]` 中
  - S2→S3：系统图节点必须被 `StrategySpec.metrics[].metricId` 覆盖（覆盖率 100%）
  - S3→S4：S4 的复评建议必须引用 S3 的 `metrics[].metricId` 与其 `recovery.reviewMetricIds`
- 分级输出：将 issues 按严重级输出，便于“定向修复而非整段重跑”
  - 结构：`{ severity:'blocker'|'warn', area:'schema'|'coverage'|'consistency'|'evidence'|'actionability', hint:string, targetPath:string }[]`
- 输出：`{ passed: boolean; issues: string[] }`
- 验收：S1/S2/S3 后端通过 `qa.run(...)` 决定是否放行；未通过时前端阻止下一步

函数骨架：
```ts
export function runQualityGates(output: unknown, context?: any): { passed: boolean; issues: string[] } { /* ... */ }
```

#### 4) API 更新（`app/api/coach/route.ts`）
- 通用策略
  - 生成后：`parse(JSON) → zod.validate → qa.run → if fail: retry with lower temperature → still fail: return error + fix hints`
  - 所有 prompt 要求严格 JSON + `evidence/confidence/applicability`
  - 重试策略分型：根据 `qa.issues[].area` 触发“局部补全重试”（仅让模型修复目标 `targetPath` 段），避免全量重跑；记录 `retry_path` 于日志
  - n-best 生成：关键步骤（S2/S3）并发生成 N 份（如 2–3），经 QA 打分择优；写入遥测
  - Mermaid 预检：渲染前做语法校验与安全过滤，失败则回退到列表视图并返回 fix_hints
  - 决策类型路由：S0 解析 `decisionType` 并在后续 handler 的 Prompt 中切换模板（探索/比较/排障/规划）与 QA 规则
  - 运行档位：`runTier` 控制生成深度（Lite 省略证据/POV，Pro 全量生成并强 QA，Review 进入人审）
  - 种子复现：S2/S3 支持可选 `seed`，在日志中记录 `seed/selected_variant/retry_count`
  - 人审闸门：当 `confidence < 阈值` 或 `evidence` 不足且领域为敏感域（健康/金融等），返回 `requires_human_review: true` 并阻断 S4 自动流转
- 分 handler 要点
  - S0 refineGoal：结构不变，补 `responseMimeType: 'application/json'` 已有；可加入 `applicability`?
  - S1 generateFramework：为 `children` 节点也增加可选 `evidence` 字段
  - S2 generateSystemDynamics：新增 `nodes` 字段（从 framework 抽取的节点列表，`id/title`），并要求 mermaid 行尾不强制 `<br/>`（当前约束会破坏渲染）；输出严格 JSON：
    ```json
    { "mermaidChart": "...graph TD...", "metaphor": "...", "nodes": [{ "id": "fundamental-concepts-1", "title": "..." }] }
    ```
  - S3 generateActionPlan：保留 `actionPlan/kpis`，新增可选 `strategySpec`（策略 DSL）。Prompt 指示 metricId 必须对齐 S2 节点 id；强制输出至少 2 个 POV（如 `maximize_gain`/`minimize_risk`）的策略并列展示；每个 metric 必须包含 `stopLoss`。
  - S4 analyzeProgress：结构 OK，补充 `evidence` 与 `confidence` 可选字段（分析来源/置信度）
- 验收：后端日志可看到 QA 闸门结果；失败会返回 issues 与修复指令（给模型的二次提示）

Prompt 片段（示例约束）
```text
严格以 JSON 返回，字段必须包含（若未知可留空）：
- evidence[{source,url,date,scope}], confidence(0–1), applicability
失败时请返回可修复建议的字段 "fix_hints"（数组）
```

#### 5) 版本化（`lib/versioning.ts` + `lib/store.ts`）
- `lib/store.ts` 新增
  - `versions: Array<{ id: string; timestamp: string; state: UserContext }>`
  - `currentVersion: string | null`
  - 写快照方法：在 S1/S2/S3 成功出片后写入一次
- `lib/versioning.ts`
  - `createSnapshot(userContext): Snapshot`
  - `diffSnapshots(a, b): { added: string[]; changed: string[]; removed: string[] }`
- 前端简化展示
  - 在 `S3/S4` 提供“查看差异”抽屉，显示 `added/changed/removed`
- 验收：能看到版本列表；相邻版本差异可读

#### 6) UI 更新（`components` + `app/page.tsx`）
- 在 S1/S2/S3 完成后，调用后端 QA 结果；未通过则 toast/卡片红色提示并阻止流转
- S3/S4：新增“策略表”视图
  - 表格列：metricId | what | trigger(s) | diagnosis | options A/B/C | recovery | stopLoss | evidence | confidence
  - 与 S2 `nodes` 覆盖情况显示（缺失标红）
- S2：在系统图右侧，下方显示 `nodes` 清单与覆盖对齐状态
- S0：新增“决策类型”选择（探索/比较/排障/规划），并保留“模式/风格滑杆”（知识/执行/排障；知识-实操-鼓励）；透传至 API 提示
- 验收：未过 QA 无法进入下一状态；策略表可读、可滚动、证据可展开

- 卡片化输出（提升可操作与局部重算能力）
  - 新增“决策卡/证据卡/策略卡/复评卡”四类卡片视图，S3/S4 以卡片为主、长文为辅
  - 在 S3 展示 `missingEvidenceTop3`（VOI Top-3 最小采集项）与 `reviewWindow`
  - 在 S3/S4 显示 POV 标签与“人审”徽标（当触发人审闸门）
  - Debug 面板增加 seed 固定开关、所选 `variant`、`retry_count` 与时延/成本信息

#### 7) 轻遥测
- 在 API 侧记录：时延、token 量（如可得）、QA 失败次数
- 前端开发模式右下角展示（已有 Debug 面板，可扩展 2–3 行）

- 扩展：记录 `n_best_count`、`selected_variant`、`retry_count`、`retry_path`、`seed`（如可控），用于离线回放与稳定性评估

#### 8) RAG 占位（`app/api/rag/route.ts`）

#### 9) 自动回放与一致性评测（`scripts/eval/*`）
- 目的：将“一致性≥0.8/覆盖率/QA 通过率”变为可回放脚本与 CI
- 内容：固定 `TaskSpec` + 随机种子，多次跑 S0–S3 统计一致性分与失败分布；输出报表 JSON
- 验收：本地一键脚本可运行，输出包含分项指标；关键改动后用于回归
- 返回 `{ status: 'ok', items: [] }` + TODO 说明
- 验收：S2/S3 prompt 支持注入 `references[]`（未来来自 RAG）

---

### 关键 Prompt 更新样例（可直接替换到对应 handler）

- S2 System Dynamics（新增 nodes 且去除 `<br/>` 约束）
```text
基于以下知识框架，生成系统图与核心比喻，并返回 JSON：
{
  "mermaidChart": "以 graph TD 开头的 Mermaid 图，不要添加 <br/>",
  "metaphor": "50-100 字中文比喻",
  "nodes": [{ "id": "<与框架一致>", "title": "<中文>" }]
}
要求：
- nodes[].id 必须来自给定框架的 id
- mermaid 展示关键交互与至少一个反馈回路
- 附带字段：evidence[], confidence, applicability
- 严格 JSON，无额外说明
```

- S3 Action Plan（引入策略 DSL）
```text
返回 JSON：
{
  "actionPlan": [{ "id": "step-1", "text": "..." , "isCompleted": false }, ...],
  "kpis": ["...", "..."],
  "strategySpec": {
    "metrics": [
      {
        "metricId": "<必须对齐 S2.nodes[].id>",
        "what": "...", "why": "...",
        "triggers": [{ "metricId": "...", "comparator": ">=", "threshold": 3, "window": "7d" }],
        "diagnosis": [{ "id": "d1", "description": "..." }],
        "options": [{ "id": "A", "steps": ["..."], "benefits": ["..."], "risks": [] }],
        "recovery": { "window": "14d", "reviewMetricIds": ["..."] },
        "stopLoss": { "condition": "...", "action": "..." },
        "evidence": [{ "source": "...", "url": "..." }],
        "confidence": 0.7,
        "applicability": "..."
      }
    ],
    "evidence": [],
    "confidence": 0.6
  }
  ,
  "missingEvidenceTop3": [
    { "metricId": "<相关指标>", "what": "需要采集的最小证据", "voi_reason": "为什么这条能改变决策" }
  ],
  "reviewWindow": "P14D"
}
严格 JSON；若无法提供完整策略，请输出最小可用骨架并在 fix_hints 提示缺失内容。
```

---

### 命令与变更点提示
- 安装依赖（由你手动运行）：
```bash
npm i zod
```
- 代码修改优先顺序
  1) 新增 `lib/schemas.ts` / `lib/strategy-dsl.ts` / `lib/qa.ts`
  2) 改 `app/api/coach/route.ts`（S2/S3 Prompt + validate + QA + retry）
  3) 改 `lib/store.ts` 与 `lib/versioning.ts`；前端加版本按钮
  4) 前端 UI：S2/S3/S4 视图与 QA 阻断
  5) 轻遥测与 RAG 占位

---

### 验收标准（MVP）
- 同一输入多次运行结构一致性 ≥ 0.8（字段与节点稳定）
- 每个 S2 节点均映射到策略表（S3 `strategySpec.metrics.metricId` 覆盖率 100%）
- 关键条目含 `evidence/confidence/applicability`
- QA 未过不出片，错误提示包含 fix_hints
- 生成耗时均值可控（本地开发可观测）

- 新增硬指标：
  - 三向一致校验覆盖 ≥ 95%（S1→S2、S2→S3、S3→S4）
  - VOI 出片率 ≥ 90%（`missingEvidenceTop3` 与 `reviewWindow` 存在且语义完整）
  - 多 POV 完整率 100%（S3 至少 2 个 POV 并列且含 A/B/C 选项）
  - StopLoss 存在率 100%（所有 metric 必有 `stopLoss`）
  - 不确定性压缩效率：相对基线（无优化版）步数/时长下降 ≥ 20%
  - 敏感域低置信/证据不足场景“人审闸门触发率”达到 100%

---

简短说明
- 代码库健康，S0–S4 基本链路已通。核心缺口集中在“证据与可执行闭环”与“图表到策略表的硬约束”；本计划已将其拆为 LLM 可执行的工程任务与具体 Prompt 约束，直接按顺序改即可 [[memory:5384707]]。

- 我已完成代码扫描与差距确认。接下来如需，我可以按该计划逐步提交具体编辑。