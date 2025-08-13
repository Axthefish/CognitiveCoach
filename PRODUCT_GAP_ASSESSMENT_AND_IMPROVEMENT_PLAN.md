## PRODUCT_GAP_ASSESSMENT_AND_IMPROVEMENT_PLAN

### Executive summary
- 当前产品已具备 S0–S4 基本编排、API 联通、前端可视化（Mermaid）与基础行动计划能力，但缺少“可信度与可执行闭环”的关键约束（证据/置信度、策略DSL、QA闸门、版本化/差异、模式自动化、遥测评估）。
- 理想状态是一个“稳定、可验证、可执行且可复评”的决策助理：同题多次运行结构稳定；每个图谱节点落到具体指标-触发-诊断-选项-回收期；关键结论有来源与置信度；有质量闸门与版本差异；成本与时延可控；且按“决策类型（探索/比较/排障/规划）”路由流程，优化不确定性压缩效率。
  - 为了从“信息呈现器”升级为“决策助理”，需要新增：VOI（价值-信息）驱动且带理由的最小证据采集与复评窗口、多POV 对拍输出（收益/风险/适用性对照）、S1→S2→S3→S4 三向一致校验、输入契约与 ID/单位/时间窗规范、QA 分级可修、n-best 生成择优、自动回放评测与 Mermaid 语义预检、运行档位（Lite/Pro/Review）、种子复现，以及隐私与人审闸门。

---

## 1. 现状盘点（Codebase Inventory）

- 前后端与状态
  - Next.js + React + TypeScript + Tailwind，状态管理 `zustand`（`lib/store.ts`）
  - 核心页面 `app/page.tsx`：S0–S4 流程编排、调用 API、维护 `userContext`
  - 可视化 `components/mermaid.tsx`：Mermaid 渲染
  - 导航 `components/fsm-navigator.tsx`：展示 S0–S4 进度

- API 能力（`app/api/coach/route.ts`）
  - `refineGoal`：目标澄清（多轮问答、JSON 返回）
  - `generateFramework`：知识框架（JSON）
  - `generateSystemDynamics`：Mermaid 图 + Metaphor
  - `generateActionPlan`：行动计划（steps + KPIs）
  - `analyzeProgress`：进度分析（analysis + suggestions）
  - `consult`：自由咨询
  - 模型：`gemini-2.5-pro`；配置 `lib/gemini-config.ts` 支持 `GOOGLE_AI_API_KEY`/`GEMINI_API_KEY`

- UI 视图
  - `components/s0-intent-view.tsx`：S0 目标澄清（多轮）
  - `components/s1-knowledge-framework-view.tsx`：框架树（可折叠）
  - `components/s2-system-dynamics-view.tsx`：系统图 + 核心比喻
  - `components/s3-action-plan-view.tsx`：行动计划 + KPI 初级仪表
  - `components/s4-autonomous-operation-view.tsx`：进度记录 + 分析 + 咨询弹窗

- 运行健康检查
  - `app/api/health/route.ts`：返回 key 配置、Node/Next 版本

- 已具备的优点
  - 端到端流程通路清晰（S0→S4）
  - API 提示词已做结构化 JSON 响应与解析
  - 具备“核心隐喻 + 图谱”与行动计划生成的雏形
  - 有“多轮澄清”与“进度分析”的基本形态

---

## 2. 理想状态定义（目标画像）

- 产出稳定：同题多次运行结构一致、冗余低
- 可信可验：每个关键结论带来源/时间戳/适用范围/置信度
- 可执行闭环：每个图谱节点在表格中可定位到指标→触发阈值→诊断顺序→A/B/C 选项→回收期/止损
- 质量闸门：覆盖度/一致性/可执行性/证据齐备度未达标不出片
- 模式自适应：知识建模/执行计划/排障复评三模式自动选择（可切换）
- 版本化和差异：每次重算给出 diff 与原因，支持回退
- 评估与遥测：过程与成本可观测，离线黄金样本与在线反馈回写
- 成本与时延：语义/Prompt 缓存、局部重算、异步重任务
- 域包与策略包：跨领域可复用模板（原则/指标/阈值/策略）
  - 多视角对拍：同一问题至少输出两种 POV（如收益最大化/风险最小化/资源最省/长期稳健），并呈现各自策略的收益/风险/适用条件/止损。
  - VOI 最小证据：每次运行产出 `VOI Top-3` 最小证据采集与 `reviewWindow`（复评期），并给出 VOI 排序理由（影响决策概率 × 价值差 × 采集成本倒数）。
  - 三向一致：S1（框架）→S2（图谱节点）→S3（策略指标）→S4（复评引用）严格映射与校验。
  - 输入契约：TaskSpec/Mode/Profile 结构化，metricId/nodeId slug 化与单位/时间窗规范统一；支持 `decisionType`（探索/比较/排障/规划）、`runTier`（Lite/Pro/Review）、`riskPreference` 与可选 `seed`。

---

## 3. 差距分析（Gaps）

- 证据与置信度：缺（无来源/日期/适用范围/置信度字段）
- 可执行闭环：弱（无指标-触发-诊断-选项-回收期的统一DSL）
- 质量闸门：缺（未对 AI JSON 结果做 Schema 校验与覆盖检查）
- 图-表一致性：缺（Mermaid 节点未强制映射到策略表）
- 模式/风格控制：弱（无“纯知识/实操/鼓励”滑杆与模式自动选择）
- 版本化与差异：缺（无版本号/差异视图/回退）
- 评估与遥测：弱（仅基本日志，无质量指标/成本与时延监控）
- 成本与时延控制：缺（无缓存/局部重算/早停回退）
- 个性化记忆：缺（无偏好/阈值容忍度/禁区/可视化偏好等 Profile）
- RAG 支撑：缺（无引用召回与时效提示）
- 安全与合规：基础（无高风险域的人审闸门/适用范围提示）
  - VOI 与复评：缺（未输出最小证据与复评窗口，难以压缩不确定性；无 VOI 排序理由）
  - 多POV：缺（无对拍与策略对照，难以控制偏见）
  - 三向一致：弱（仅 S2→S3 映射，缺 S1→S2 与 S3→S4）
  - 输入契约：缺（未对 TaskSpec/Mode/Profile 做 Schema 校验；metricId/nodeId/单位/时间窗未统一；无 `decisionType/runTier/riskPreference/seed`）
  - QA 分级与定向修复：缺（无法只修有问题的段落）
  - 自动回放评测：缺（无黄金样本与一致性/覆盖/QA 通过率的自动化回放；无 seed 复现）
  - Mermaid 语义预检：缺（渲染安全与语法预检/失败回退；无 `edgeType` 语义约束）
  - 隐私与日志：弱（缺脱敏、证据域名白名单/黑名单配置；无敏感域“人审闸门”）

---

## 4. 改进路线图（Roadmap）

### Phase 1（1–2 周）：可信+可执行的 MVP
- 强 Schema 与 QA 闸门
  - 新增 `lib/schemas.ts`：定义输出契约（见附录）
  - 新增 `lib/qa.ts`：校验 Coverage/Coherence/Actionability/Evidence 四项
  - API 层在 `parse → validate → gate → respond` 流程中接入 QA；未过则降温重试或返回可修复提示

- 策略 DSL（统一“指标-触发-诊断-选项-回收期”）
  - 新增 `lib/strategy-dsl.ts` 类型 + 运行时校验
  - `generateActionPlan` 改为返回 `StrategySpec`（同时保留 steps 与 KPIs，逐步过渡）
  - 前端在 S3/S4 增加“策略表”视图

- 证据与置信度
  - 修改 `generateFramework`/`generateSystemDynamics`/`generateActionPlan`/`analyzeProgress` 的提示词：强制返回 `evidence[]/confidence/applicability`
  - UI 在节点与策略旁展示来源与时效

- 图-表一致性
  - S2 生成时强制节点 `id` 与策略表 `metricId` 对齐；S3 校验覆盖率
  - QA 未覆盖的节点标红并阻止进入下一状态
  - 语义规范：引入 `edgeType` 白名单（因果正/因果负/抑制/条件/约束），为后续一致性/可解释性打基础

- 模式与风格控制（轻量）
  - S0 增加“决策类型（探索/比较/排障/规划）”“模式选择（知识/执行/排障）”“运行档位（Lite/Pro/Review）”与“风格滑杆（纯知识/实操/鼓励）”
  - 将决策类型/档位/风格作为 API 提示参数透传；Pro 档强 QA，多 POV，VOI 理由必填；Lite 档输出骨架

- 多 POV 对拍与 StopLoss 强制
  - S3 至少 2 个 POV 的策略卡并列（如收益最大化/风险最小化），各含 A/B/C 选项与 `stopLoss`；缺失为 blocker

- 人审闸门与敏感域边界
  - 健康/金融等敏感域在 `confidence` 低或 `evidence` 不足时触发“人审闸门”，阻断自动流转；UI 显示“非医疗/投资建议”与 `applicability`

- 种子复现与遥测
  - S2/S3 支持可选 `seed`；遥测记录 `seed/selected_variant/retry_count`

- 基础版本化
  - `lib/store.ts` 增加 `versions[]` 与 `currentVersion`；每次生成写快照；S3/S4 支持对比 diff（新增/修改/删除）

- 基础遥测
  - 记录 API 时延、Token 量、QA 失败次数；开发模式在页面右下角展示

验收标准（MVP）
- 同题多次运行结构一致性 ≥ 0.8（节点/字段稳定）
- 每个图节点均映射到策略表；未覆盖即报错
- 每个关键条目均含 evidence/confidence/applicability
- QA 门槛未过不出片；失败有可修复指引
- 生成耗时平均可控（< N 秒，视模型与上下文）

  - 新增（MVP 同步交付）
    - VOI 最小证据与复评：输出 `missingEvidenceTop3` 与 `reviewWindow`，并给出 VOI 排序理由
    - 多POV 对拍：至少 2 种 POV 的策略卡并列（含收益/风险/适用范围/止损），QA 校验通过率 100%
    - 三向一致：S1→S2、S2→S3、S3→S4 映射与 QA 阻断
    - 输入契约：TaskSpec/Mode/Profile Schema + metricId/nodeId slug 化 + 单位/时间窗规范 + `decisionType/runTier/riskPreference/seed`
    - QA 分级：issues 带 `severity/area/targetPath/hint`，支持定向修复与局部重算
    - n-best 与重试：S2/S3 采用 2–3 路候选 + QA 择优；按 issue area 触发定向重试
    - Mermaid 语义预检：语法与安全预检，失败回退列表视图；`edgeType` 白名单
    - 人审闸门：敏感域低置信/证据不足时强制触发

---

### Phase 2（第 3–4 周）：专业化与持续改进
- RAG 与引用
  - 新增 `app/api/rag/route.ts`（占位）：关键词召回 + 去重 + 日期戳（在证据质量不足、QA 频繁失败的场景优先启用）
  - 将召回的引用注入提示词，返回可点链接与摘要

- 模式自动识别与骨架先行
  - S0 使用意图检测自动选择模式；先出“骨架蓝图”，用户点确认后深填
  - 未提供关键必填参数时，最小化追问

- 成本与时延优化
  - 语义缓存与 Prompt 缓存（Key = TaskSpec + Context 哈希）
  - 局部重算（只重跑失败块）
  - 早停与回退（模型路由与模板回退）
  - n-best 与采样参数自动调优（根据 QA 通过率/一致性分自适应）

- 版本差异与回退
  - 新增 `lib/versioning.ts`：计算 diff + 标签；支持一键回退
  - UI 显示“改了什么、为什么”（来源/策略变化），并分类原因（新证据/参数变更/模型不确定/模板更新）

- 安全与合规
  - 高风险域的人审闸门；适用范围/禁忌提示标准化
  - 日志脱敏、证据链接域名白名单；个人数据最小化与保留期策略

验收标准（Pro）
- 事实引用覆盖率 ≥ 70% 的关键论断
- 平均响应时延下降 20%+
- 骨架先行带来的“用户编辑率”下降（≥ 20%）
 - 不确定性压缩效率提升（从问题到“可执行策略+复评”的平均步数/时长下降 ≥ 20%）

---

### Phase 3（第 5 周+）：域包/策略包与评测体系
- 域包（Domain Packs）
  - 将“原则/指标/阈值/策略范式/图模板”打包；灰度上线

- 策略包（保守/标准/激进）
  - 同一问题提供 A/B/C 档策略，标注收益/风险/适用人群/回收期

- 评估体系与 A/B
  - 离线黄金样本（覆盖/一致/可执行/证据分）+ 在线用户反馈（复评回填率、排障一次通过率）
  - AB 实验与模板权重更新
   - 自动回放评测管线（scripts/eval）：一致性/覆盖/QA 通过率报表；关键变更自动回归

---

## 5. 代码级落地任务（指引）

- 新增
  - `lib/schemas.ts`：所有 API 的输出契约（Zod/TypeBox）
  - `lib/strategy-dsl.ts`：策略 DSL 类型与校验
  - `lib/qa.ts`：QA 闸门（coverage/coherence/actionability/evidence）
  - `lib/versioning.ts`：版本快照与 diff 工具
  - `app/api/rag/route.ts`：RAG 占位（后续接入真实检索）

- 修改
  - `app/api/coach/route.ts`
    - 各 handler 的 Prompt：加入 evidence/confidence/applicability 字段约束
    - 解析后先过 `schemas` 与 `qa`；失败则降温重试或错误带修复建议；支持 `decisionType/runTier/seed`
    - `generateActionPlan` 逐步过渡到 `StrategySpec` 返回，且强制 ≥2 POV、每个 metric 必有 `stopLoss`
  - `app/page.tsx`
    - S1/S2/S3 的 QA 未通过时在 UI 明确反馈并阻止流转
    - S3/S4 新增“策略表”视图（Strategy DSL）
    - 引入“决策类型/运行档位/模式/风格滑杆”并透传给 API
    - 版本快照与 diff 展示（简化 UI），并显示“原因分类”
    - 卡片化输出：决策卡/证据卡/策略卡/复评卡；展示 `missingEvidenceTop3` 与 `reviewWindow` 与 VOI 理由；显示 POV 标签与“人审”徽标

- 提示词（示例片段）
  - “严格以 JSON 返回，字段：id/title/summary/evidence[{source,url,date,scope}], confidence(0–1), applicability, …；若无依据则留空并给出 ‘unknown’ 与 cause。”
  - “为每个 metric 绑定：what/why/trigger{comparator,threshold,window}/diagnosis[...]/options[A|B|C]{steps,benefits,risks,who}/recovery{window,review_metric}/stopLoss{condition}。”
   - “输出 `missingEvidenceTop3`（按 VOI 排序，≤3 条）与 `reviewWindow`（ISO 8601，如 `P14D`）。”
   - “至少提供两种 POV 的策略并列，标注收益/风险/适用条件/止损；若无法，给出 fix_hints。”

---

## 6. 风险与缓解
- 幻觉与不稳定：强 Schema + QA + 引用；未知时允许“明确说不知道”
- 成本与时延：缓存/局部重算/模型路由；重任务异步化
- 风格跑偏：模式/风格滑杆 + 模板锁定 + QA 出界检查
- 过度工程：先从 MVP 的证据与策略 DSL 入手，后续迭代增强
 - 隐私与安全：日志脱敏、证据域白名单、人审闸门、渲染预检；对敏感域默认不开启自动执行

---

## 7. 验收指标（全局）
- 结构稳定性（同题多次、一致性评分）
- 可执行性命中率（触发→诊断→调整后达成比例）
- 证据覆盖率与置信度可读性
- 用户编辑率与复评回填率
- 时延与成本曲线
- 排障一次通过率
  - 不确定性压缩效率（从提问到“可执行策略+复评”的平均步数/时长）
  - 止损触发率（异常及时止损的安全性指标）
  - 多POV 完整率（≥2 POV 的对拍出片比例）
  - 人审覆盖率（敏感域低置信/证据不足时触发率）
  - 复现实验通过率（固定 seed 下结果结构一致性≥目标）

---

## 附录 A：Strategy DSL（TypeScript）

```ts
// lib/strategy-dsl.ts
export interface Evidence {
  source: string;   // 论文/指南/书籍/可信网站
  url?: string;
  date?: string;    // ISO
  scope?: string;   // 适用条件/人群/限制
}

export interface Trigger {
  metricId: string;
  comparator: '>' | '>=' | '<' | '<=' | '==' | 'trend_down' | 'trend_up';
  threshold: number | string;   // 可支持区间或趋势描述
  window: string;               // 观察期，如 "7d"
}

export interface DiagnosisStep {
  id: string;
  description: string;
  check?: string;               // 要验证的数据或条件
}

export interface StrategyOption {
  id: 'A' | 'B' | 'C';
  steps: string[];              // 执行动作
  benefits: string[];
  risks?: string[];
  suitableFor?: string[];       // 适用人群/场景
}

export interface RecoveryWindow {
  window: string;               // 如 "14d"
  reviewMetricIds: string[];    // 复评关注指标
}

export interface StopLoss {
  condition: string;            // 何时止损回退
  action: string;               // 回退动作
}

export interface MetricSpec {
  metricId: string;             // 与图谱节点对齐
  what: string;                 // 定义/采集方式
  why: string;                  // 作用机制
  triggers: Trigger[];
  diagnosis: DiagnosisStep[];
  options: StrategyOption[];    // A/B/C
  recovery: RecoveryWindow;
  stopLoss?: StopLoss;
  evidence?: Evidence[];
  confidence?: number;          // 0–1
  applicability?: string;       // 适用范围/例外
}

export interface StrategySpec {
  metrics: MetricSpec[];
  evidence?: Evidence[];
  confidence?: number;
}
```

补充说明：
- `metricId/nodeId` 建议统一 slug 化（小写、去空格、非字母数字转 `-`）并在 QA 前做标准化比对。
- `unit` 建议使用白名单；时间窗 `window` 使用 ISO 8601 Duration（例如 `P7D`）。

---

## 附录 B：QA 闸门（示意）

```ts
// lib/qa.ts
export function runQualityGates(output: unknown): {
  passed: boolean;
  issues: Array<{
    severity: 'blocker' | 'warn';
    area: 'schema' | 'coverage' | 'consistency' | 'evidence' | 'actionability';
    hint: string;
    targetPath: string;
  }>;
} {
  // 1) Schema 验证
  // 2) S1→S2：框架关键节点必须在系统图 nodes[] 出现
  // 3) S2→S3：S2 节点 id 必须被 StrategySpec.metrics[].metricId 覆盖
  // 4) S3→S4：S4 复评建议必须引用 S3 指标/窗口
  // 5) 一致性：同名节点/术语一致（标准化后比对）
  // 6) 可执行性：每个 metric 至少 1 个 trigger + diagnosis + option + recovery + stopLoss
  // 7) 证据：关键项需 evidence 或给出未知原因
  // 8) VOI：存在 missingEvidenceTop3 且≤3条；reviewWindow 合法
  return { passed: true, issues: [] };
}
```

---

小结
- 当前已具备端到端雏形；核心缺口集中在“可信度与可执行闭环”。  
- 先落地 Schema+QA+策略DSL+证据/置信度与图表映射，2 周内达到可用 MVP；再做 RAG、版本差异、成本优化与评测体系。  
- 完成后，产品将从“信息呈现器”跃迁为“可验证、可执行、可复评的决策助理”。