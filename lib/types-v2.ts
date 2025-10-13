/**
 * 新产品架构的核心类型定义 (V2)
 * 
 * 设计理念：通用框架 + 个性化补充
 * 
 * 三阶段流程：
 * - Stage 0: 目的澄清与问题域框定（对话式）
 * - Stage 1: 通用框架生成与可视化（逻辑流程图+权重）
 * - Stage 2: 动态信息收集与个性化方案生成
 */

// ============================================
// FSM 状态定义
// ============================================

export type StageState = 
  | 'STAGE_0_PURPOSE_CLARIFICATION'
  | 'STAGE_1_FRAMEWORK_GENERATION'
  | 'STAGE_2_PERSONALIZATION'
  | 'COMPLETED';

// ============================================
// 对话消息类型
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    stage?: StageState;
    type?: 'question' | 'answer' | 'confirmation' | 'info';
  };
}

// ============================================
// Stage 0: 目的澄清
// ============================================

/**
 * Stage1专用的purpose context（不含用户约束）
 * 用于生成真正的通用框架
 */
export interface UniversalPurposeContext {
  clarifiedPurpose: string;
  problemDomain: string;
  domainBoundary: string;
  // ❌ 不包含keyConstraints - Stage1不考虑个人约束
}

/**
 * Stage 0 输出：目的澄清结果
 * 
 * 关键设计理念：区分边界约束和个人约束
 * - 边界约束：定义问题域范围（如"不学机器学习"） → 传给 Stage1
 * - 个人约束：定义执行条件（如"每周2小时"） → 传给 Stage2
 */
export interface PurposeDefinition {
  // 原始输入
  rawInput: string;
  
  /**
   * 澄清后的目的
   * ⚠️ 必须是通用描述，不包含个人情况
   * 例如："学习 Python 进行数据分析" ✓
   * 例如："零基础学习 Python" ✗（"零基础"是个人约束）
   */
  clarifiedPurpose: string;
  
  // 问题域
  problemDomain: string;
  
  // 问题域边界描述
  domainBoundary: string;
  
  /**
   * 边界约束：影响问题域范围的约束
   * 用途：传递给 Stage1，界定通用框架的范围
   * 示例：["不学机器学习", "只关注前端开发"]
   */
  boundaryConstraints: string[];
  
  /**
   * 个人约束：影响执行方式的个人情况
   * 用途：保留到 Stage2，用于个性化调整
   * 示例：["每周5小时", "零基础", "倾向视频学习"]
   */
  personalConstraints: string[];
  
  /**
   * @deprecated 仅用于向后兼容，合并了 boundaryConstraints 和 personalConstraints
   * 新代码应该使用 boundaryConstraints 和 personalConstraints
   */
  keyConstraints: string[];
  
  // 对话历史
  conversationHistory: ChatMessage[];
  
  /**
   * 对话关键洞察（压缩后）
   * 从conversationHistory中提取的关键信息摘要
   * 用于传递给Stage 2进行个性化调整
   */
  conversationInsights?: string;
  
  // 置信度 (0-1)
  confidence: number;
  
  // 澄清状态
  clarificationState: 'INIT' | 'COLLECTING' | 'REFINING' | 'CONFIRMING' | 'COMPLETED';
}

// ============================================
// Stage 1: 通用框架
// ============================================

export type NodeType = 'input' | 'process' | 'output' | 'parallel';
export type EdgeType = 'required' | 'recommended' | 'optional';
export type NodeColor = 'DEEP_BLUE' | 'BLUE' | 'LIGHT_BLUE' | 'GRAY';

export interface FrameworkNode {
  // 唯一标识
  id: string;
  
  // 节点标题
  title: string;
  
  // 详细描述
  description: string;
  
  // 权重 (0-100)
  weight: number;
  
  // 预计时间投入
  estimatedTime: string; // e.g., "2-3周", "持续"
  
  // 节点类型
  nodeType: NodeType;
  
  // 颜色（基于权重自动计算）
  color: NodeColor;
  
  // 前置依赖（其他节点的ID）
  dependencies: string[];
  
  // 权重计算的详细维度
  weightBreakdown?: {
    necessity: number;    // 必要性 (0-1)
    impact: number;       // 影响力 (0-1)
    timeROI: number;      // 时间投资回报率 (0-1)
  };
  
  // 位置信息（用于渲染）
  position?: {
    x?: number;
    y?: number;
    layer?: number; // 在垂直布局中的层级
  };
}

export interface FrameworkEdge {
  // 起点节点ID
  from: string;
  
  // 终点节点ID
  to: string;
  
  // 关系类型
  type: EdgeType;
  
  // 关联强度 (0-1)
  strength: number;
  
  // 关系描述（可选）
  description?: string;
}

export interface UniversalFramework {
  // 对应的目的
  purpose: string;
  
  // 问题域
  domain: string;
  
  // 节点列表
  nodes: FrameworkNode[];
  
  // 边列表
  edges: FrameworkEdge[];
  
  // 权重计算逻辑说明
  weightingLogic: string;
  
  // 主路径（从输入到输出的关键路径节点ID）
  mainPath: string[];
  
  // 生成时间戳
  generatedAt: number;
}

// ============================================
// Stage 2: 个性化方案
// ============================================

export interface DynamicQuestion {
  // 问题ID
  id: string;
  
  // 问题文本
  question: string;
  
  // 为什么这个问题重要
  whyMatters: string;
  
  // 影响的框架节点ID列表
  affects: string[];
  
  // 影响力等级 (1-5)
  impactLevel: number;
  
  // 问题类型
  questionType: 'baseline' | 'resource' | 'context' | 'motivation';
}

export interface UserContextInfo {
  // 问题ID
  questionId: string;
  
  // 用户回答
  answer: string;
  
  // 回答时间
  answeredAt: number;
}

export interface PersonalizedPlan {
  // 调整后的框架（权重和路径可能改变）
  adjustedFramework: UniversalFramework;
  
  // 具体行动步骤
  actionSteps: ActionStep[];
  
  // 里程碑
  milestones: Milestone[];
  
  // 个性化建议
  personalizedTips: string[];
  
  // 收集的用户信息
  collectedInfo: UserContextInfo[];
  
  // 调整说明
  adjustmentRationale: string;
  
  // 生成时间
  generatedAt: number;
}

export interface ActionStep {
  // 步骤ID
  id: string;
  
  // 步骤标题
  title: string;
  
  // 详细说明
  description: string;
  
  // 关联的框架节点
  relatedNodeId: string;
  
  // 预计开始时间（相对时间，如"第1周"）
  startTime: string;
  
  // 预计完成时间
  endTime: string;
  
  // 优先级
  priority: 'high' | 'medium' | 'low';
  
  // 前置步骤
  prerequisites: string[];
}

export interface Milestone {
  // 里程碑ID
  id: string;
  
  // 里程碑标题
  title: string;
  
  // 成功标准
  successCriteria: string[];
  
  // 预期时间点
  expectedTime: string;
  
  // 关联的步骤
  relatedSteps: string[];
}

// ============================================
// Stage 2 对话状态
// ============================================

export type Stage2State = 
  | 'ANALYZING'     // 分析缺失信息
  | 'QUESTIONING'   // 提问阶段
  | 'ADJUSTING'     // 调整框架
  | 'GENERATING'    // 生成方案
  | 'COMPLETED';

// ============================================
// 权重计算相关
// ============================================

export interface WeightDimensions {
  necessity: number;   // 必要性 (0-1)
  impact: number;      // 影响力 (0-1)
  timeROI: number;     // 时间投资回报率 (0-1)
}

export interface WeightConfig {
  necessityWeight: number;   // 默认 0.4
  impactWeight: number;      // 默认 0.3
  timeROIWeight: number;     // 默认 0.3
}

// ============================================
// 颜色编码
// ============================================

export const COLOR_SCHEME = {
  DEEP_BLUE: '#1e40af',    // 90-100%: 核心必修
  BLUE: '#3b82f6',         // 70-89%: 重要推荐
  LIGHT_BLUE: '#60a5fa',   // 50-69%: 可选增强（改善对比度）
  GRAY: '#6b7280',         // <50%: 低优先级（改善对比度）
} as const;

export function getColorForWeight(weight: number): NodeColor {
  if (weight >= 90) return 'DEEP_BLUE';
  if (weight >= 70) return 'BLUE';
  if (weight >= 50) return 'LIGHT_BLUE';
  return 'GRAY';
}

// ============================================
// API 响应类型
// ============================================

export interface Stage0Response {
  success: boolean;
  data?: PurposeDefinition;
  message?: string;
  nextAction?: 'continue_dialogue' | 'confirm' | 'complete';
}

export interface Stage1Response {
  success: boolean;
  data?: UniversalFramework;
  message?: string;
}

export interface Stage2Response {
  success: boolean;
  data?: {
    questions?: DynamicQuestion[];
    plan?: PersonalizedPlan;
  };
  message?: string;
  nextAction?: 'collect_info' | 'generate_plan' | 'complete';
}

// ============================================
// 流式事件类型
// ============================================

export type StreamEventType = 
  | 'message'           // 对话消息
  | 'thinking'          // AI思考中
  | 'framework_update'  // 框架更新
  | 'progress'          // 进度更新
  | 'complete'          // 完成
  | 'error';            // 错误

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: number;
}

// ============================================
// Cross-Stage Memory System
// ============================================

export interface Decision {
  what: string;      // 做了什么决策
  why: string;       // 为什么这样决策
  timestamp: number;
}

export interface StageMemory {
  sessionId: string;
  stage: 'stage0' | 'stage1' | 'stage2';
  keyInsights: string[];           // 关键洞察
  decisions: Decision[];           // 重要决策
  constraints: string[];           // 约束条件
  compactedHistory?: string;       // 压缩后的历史（如果有）
  rawData?: unknown;               // 原始数据（可选）
  timestamp: number;
  expiresAt?: number;              // 过期时间（可选）
}

export interface MemoryQuery {
  sessionId: string;
  stage?: 'stage0' | 'stage1' | 'stage2';
  keywords?: string[];
  limit?: number;
}

export interface MemorySummary {
  sessionId: string;
  totalInsights: number;
  totalDecisions: number;
  stages: Array<'stage0' | 'stage1' | 'stage2'>;
  summary: string;  // <100 tokens的简洁摘要
}

