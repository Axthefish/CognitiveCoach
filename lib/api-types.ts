/**
 * API类型定义 - API层专用类型
 * 
 * 职责范围：
 * - API请求/响应类型（CoachRequest, CoachResponse）
 * - Payload类型（各阶段的输入参数）
 * - 流式消息类型（SSE相关）
 * - API层特定的辅助类型
 * 
 * 导入指引：
 * - API Route层 (app/api/*) 应优先导入此文件
 * - 核心业务类型（FSMState、UserContext等）请从 types.ts 导入
 * - Service层应导入 types.ts 以保持业务逻辑独立性
 * 
 * 避免循环依赖：
 * - 此文件从 types.ts 导入 ConversationMessage（唯一定义）
 * - 此文件从 schemas.ts 导入数据Schema类型
 * - 不要在 types.ts 中导入此文件
 */

import type { KnowledgeFramework, ActionPlan } from './schemas';
import type { ConversationMessage } from './types';

// API请求的action类型
export type CoachAction = 
  | 'refineGoal'
  | 'generateFramework'
  | 'generateSystemDynamics'
  | 'generateActionPlan'
  | 'analyzeProgress'
  | 'consult';

// 任务规格配置
export interface TaskSpec {
  decisionType?: 'explore' | 'compare' | 'troubleshoot' | 'plan';
  runTier?: 'Pro' | 'Review';
  riskPreference?: 'low' | 'medium' | 'high';
  seed?: number;
}

// 对话消息 - 从 types.ts 重新导出
export type { ConversationMessage };

// ============================================
// Service 响应类型定义（统一定义处）
// ============================================

/**
 * S0: 目标精炼响应
 */
export interface RefineGoalResponse {
  status: 'clarification_needed' | 'clarified' | 'recommendations_provided';
  ai_question?: string;
  goal?: string;
  recommendations?: Array<{
    category: string;
    examples: string[];
    description: string;
  }>;
}

/**
 * S1: 知识框架生成响应
 */
export interface GenerateFrameworkResponse {
  framework: KnowledgeFramework;
}

/**
 * S2: 系统动力学生成响应
 */
export interface GenerateSystemDynamicsResponse {
  systemDynamics: {
    mermaidChart: string;
    metaphor: string;
    nodes?: Array<{ id: string; title: string }>;
  };
}

/**
 * S3: 行动计划生成响应
 */
export interface GenerateActionPlanResponse {
  actionPlan: ActionPlan;
  kpis: string[];
  strategySpec: unknown;
}

/**
 * S4: 进度分析响应
 */
export interface AnalyzeProgressResponse {
  analysis: string;
  suggestions: string[];
  confidence: number;
}

/**
 * S4: 咨询服务响应
 */
export interface ConsultResponse {
  response: string;
  relevantNodes?: string[];
}

// ============================================
// Payload 类型定义
// ============================================

export interface RefineGoalPayload {
  userInput: string;
  conversationHistory?: ConversationMessage[];
}

export interface GenerateFrameworkPayload extends TaskSpec {
  userGoal: string;
}

export interface GenerateSystemDynamicsPayload extends TaskSpec {
  framework: KnowledgeFramework;
}

export interface GenerateActionPlanPayload extends TaskSpec {
  userGoal: string;
  framework: KnowledgeFramework;
  systemNodes?: Array<{ id: string; title?: string }>;
}

export interface AnalyzeProgressPayload {
  progressData: {
    completedTasks?: string[];
    confidenceScore?: number;
    hoursSpent?: number;
    challenges?: string;
  };
  userContext: {
    userGoal: string;
    actionPlan: ActionPlan;
    kpis: string[];
    strategySpec?: {
      metrics?: Array<{
        metricId: string;
        confidence?: number;
        evidence?: unknown[];
      }>;
    };
  };
}

export interface ConsultPayload {
  question: string;
  userContext: {
    userGoal: string;
    knowledgeFramework: KnowledgeFramework;
    actionPlan: ActionPlan;
    systemDynamics?: {
      mermaidChart: string;
      metaphor: string;
    };
  };
}

// 联合类型
export type CoachPayload = 
  | RefineGoalPayload 
  | GenerateFrameworkPayload 
  | GenerateSystemDynamicsPayload 
  | GenerateActionPlanPayload 
  | AnalyzeProgressPayload 
  | ConsultPayload;

// 请求体接口
export interface CoachRequest {
  action: CoachAction;
  payload: CoachPayload;
}

// ============================================
// Response 类型定义（统一响应格式 - 唯一定义处）
// ============================================

export interface ApiSuccessResponse<T = unknown> {
  status: 'success';
  data: T;
}

export interface ApiErrorResponse {
  status: 'error';
  error: string;
  code?: string;
  details?: unknown;
  fixHints?: string[];
  stage?: string;
  timestamp?: string;
}

export type CoachResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// 导出别名以保持向后兼容
export type { ApiSuccessResponse as SuccessResponse };
export type { ApiErrorResponse as ErrorResponseData };

// ============================================
// 流式响应类型
// ============================================

export type StreamMessageType = 
  | 'cognitive_step' 
  | 'content_chunk' 
  | 'data_structure' 
  | 'error' 
  | 'done';

export interface StreamMessage<T = unknown> {
  type: StreamMessageType;
  payload: T;
}

export type CognitiveStepStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export interface CognitiveStep {
  id: string;
  message: string;
  status: CognitiveStepStatus;
  timestamp?: number;
}

export interface CognitiveStepsPayload {
  steps: CognitiveStep[];
  tip?: string;
  traceId: string; // 必需：用于请求追踪
  message?: string;
}

export interface ErrorPayload {
  code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN';
  message: string;
  traceId: string; // 必需：用于错误追踪和关联日志
}

// ============================================
// 辅助函数类型
// ============================================

export type SendErrorSafeFn = (
  code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN',
  message: string,
  traceId?: string
) => void;

