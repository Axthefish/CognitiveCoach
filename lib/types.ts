/**
 * 核心业务类型定义 - 业务领域的唯一真实来源（Single Source of Truth）
 * 
 * 职责范围：
 * - FSM状态类型（FSMState）
 * - 用户上下文（UserContext）
 * - 对话消息（ConversationMessage）
 * - 业务核心类型的重新导出
 * 
 * 导入指引：
 * - Service层 (services/*) 应优先导入此文件
 * - Store层 (lib/store.ts) 应导入此文件
 * - 组件层需要业务类型时应导入此文件
 * - API层的Payload定义请使用 api-types.ts
 * 
 * 设计原则：
 * - 此文件是核心类型的唯一定义处，避免在其他地方重复定义
 * - 保持此文件独立，只从 schemas.ts 导入数据Schema
 * - 不要从 api-types.ts 导入，以避免循环依赖
 */

// ============================================
// FSM 和状态定义
// ============================================

export interface State {
  id: "S0" | "S1" | "S2" | "S3" | "S4"
  name: string
}

// FSM 状态类型 - 唯一定义处
export type FSMState = 
  | 'S0_INTENT_CALIBRATION'
  | 'S1_KNOWLEDGE_FRAMEWORK'
  | 'S2_SYSTEM_DYNAMICS'
  | 'S3_ACTION_PLAN'
  | 'S4_AUTONOMOUS_OPERATION';

// ============================================
// 核心业务类型
// ============================================

// 对话消息接口 - 唯一定义处
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Schema 相关类型（从 schemas 模块重新导出）
export type {
  FrameworkNode,
  KnowledgeFramework,
  ActionItem,
  ActionPlan,
  SystemDynamics,
  ActionPlanResponse,
  AnalyzeProgress,
  StrategySpecZod as StrategySpec,
  S0RefineGoal,
} from './schemas';

// 从 schemas 导入类型用于 UserContext（内部使用）
import type { 
  KnowledgeFramework, 
  ActionPlan, 
  StrategySpecZod as StrategySpec 
} from './schemas';

// 用户上下文对象 - 唯一定义处
export interface UserContext {
  userGoal: string;
  knowledgeFramework: KnowledgeFramework | null;
  systemDynamics: {
    mermaidChart: string;
    metaphor: string;
    nodes?: Array<{ id: string; title: string }>;
    // S2 clarity extensions
    mainPath?: string[];
    loops?: Array<{ id: string; title: string; nodes: string[]; summary?: string }>;
    nodeAnalogies?: Array<{ nodeId: string; analogy: string; example?: string }>;
    requiresHumanReview?: boolean;
    qaIssues?: Array<{ severity: string; area: string; hint: string; targetPath: string }>;
  } | null;
  actionPlan: ActionPlan | null;
  kpis: string[] | null;
  strategySpec: StrategySpec | null;
  missingEvidenceTop3?: Array<{ metricId: string; what: string; voi_reason: string }>;
  reviewWindow?: string;
  // Task spec / preferences
  decisionType?: 'explore' | 'compare' | 'troubleshoot' | 'plan';
  runTier?: 'Pro' | 'Review';
  // @deprecated Low usage - planned for removal in v2.0
  riskPreference?: 'low' | 'medium' | 'high';
  // @deprecated Low usage - planned for removal in v2.0
  seed?: number;
  // Flags & telemetry
  requiresHumanReview?: boolean;
  // Required by QA validation (lib/qa.ts) and S2 stage (lib/s2-utils.ts)
  povTags?: string[];
  // @deprecated Unused - planned for removal in v2.0
  lastTelemetry?: unknown;
  goalConversationHistory: ConversationMessage[];
  goalRecommendations?: Array<{
    category: string;
    examples: string[];
    description: string;
  }>;
}
