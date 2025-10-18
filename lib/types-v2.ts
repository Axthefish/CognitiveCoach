/**
 * 新产品架构的核心类型定义 (V3 - 7阶段架构)
 * 
 * 设计理念：通用框架 + 个性化补充
 * 
 * 七阶段流程：
 * - Stage 0: 产品介绍 + 用户输入引导
 * - Stage 1: 目标澄清（使用初始问题识别prompt）
 * - Stage 2: 用户确认提炼结果
 * - Stage 3: 通用框架生成（3D可视化）
 * - Stage 4: 询问是否需要个性化
 * - Stage 5-6: 权重分析 + 诊断提问（3D交互）
 * - Stage 7: 个性化方案生成（3D对比视图）
 */

// ============================================
// FSM 状态定义
// ============================================

export type StageState = 
  | 'STAGE_0_INTRODUCTION'           // Stage 0: 产品介绍 + 输入引导
  | 'STAGE_1_CLARIFICATION'          // Stage 1: 目标澄清对话
  | 'STAGE_2_CONFIRMATION'           // Stage 2: 用户确认提炼结果
  | 'STAGE_3_FRAMEWORK'              // Stage 3: 通用框架生成与3D展示
  | 'STAGE_4_PERSONALIZATION_CHOICE' // Stage 4: 询问是否需要个性化
  | 'STAGE_5_6_DIAGNOSTIC'           // Stage 5-6: 权重分析 + 诊断提问
  | 'STAGE_7_PERSONALIZED_PLAN'      // Stage 7: 个性化方案生成
  | 'COMPLETED';                      // 完成

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
// Stage 0-1: 输入和澄清
// ============================================

/**
 * Stage 0: 用户初始输入
 */
export interface UserInitialInput {
  rawInput: string;
  timestamp: number;
}

/**
 * Stage 1输出：澄清后的核心定义（来自初始问题识别prompt）
 * 
 * 这是对用户模糊输入的提炼，提取核心点和边界
 */
export interface ClarifiedMission {
  // 原始输入
  rawInput: string;
  
  // 提炼后的使命陈述（Mission Statement）
  missionStatement: string;
  
  // 核心主题
  subject: string;
  
  // 期望结果
  desiredOutcome: string;
  
  // 上下文环境
  context: string;
  
  // 关键杠杆点
  keyLevers: string[];
  
  // 对话历史
  conversationHistory: ChatMessage[];
  
  // 置信度
  confidence: number;
  
  // 生成时间
  generatedAt: number;
}

/**
 * Stage 2: 用户确认状态
 */
export interface ConfirmationState {
  clarifiedMission: ClarifiedMission;
  userConfirmed: boolean;
  feedback?: string; // 如果用户不确认，可以提供反馈
}

/**
 * Stage3专用的purpose context（用于生成通用框架）
 */
export interface UniversalPurposeContext {
  clarifiedPurpose: string;
  problemDomain: string;
  domainBoundary: string;
  boundaryConstraints?: string[];
}

/**
 * @deprecated 保留用于兼容性，新架构使用ClarifiedMission
 * 
 * 旧的PurposeDefinition（3阶段架构使用）
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
  data?: PurposeDefinition | ClarifiedMission;
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
  stages: Array<'stage0' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5-6' | 'stage7'>;
  summary: string;  // <100 tokens的简洁摘要
}

// ============================================
// Stage 4: 个性化选择
// ============================================

/**
 * Stage 4: 用户对个性化的选择
 */
export interface PersonalizationChoice {
  wantsPersonalization: boolean;
  timestamp: number;
  reason?: string; // 可选：用户选择的原因
}

// ============================================
// Stage 5-6: 权重分析和诊断提问
// ============================================

/**
 * Stage 5输出：权重分析结果（来自框架提取提问prompt）
 */
export interface WeightAnalysis {
  // 分析的框架
  framework: UniversalFramework;
  
  // 识别的高杠杆点（2-3个）
  highLeveragePoints: HighLeveragePoint[];
  
  // 分析逻辑说明
  analysisRationale: string;
  
  // 生成时间
  generatedAt: number;
}

/**
 * 高杠杆诊断点
 */
export interface HighLeveragePoint {
  // 诊断点ID
  id: string;
  
  // 技术名称（分析师视角）
  technicalName: string;
  
  // 教练式标题（用户友好）
  coachTitle: string;
  
  // 教练式解释
  coachExplanation: string;
  
  // 相关的诊断问题
  question: string;
  
  // 影响的节点ID列表
  affectedNodeIds: string[];
  
  // 分析推理
  reasoning: string;
}

/**
 * Stage 6: 诊断问题（扩展自DynamicQuestion，增加与权重分析的关联）
 */
export interface DiagnosticQuestion extends DynamicQuestion {
  // 关联的高杠杆点ID
  leveragePointId: string;
  
  // 教练式解释
  coachExplanation: string;
}

/**
 * Stage 5-6的状态
 */
export type Stage56State = 
  | 'ANALYZING_WEIGHTS'  // 分析权重
  | 'QUESTIONING'        // 提问阶段
  | 'COMPLETED';         // 完成

// ============================================
// Stage 7: 个性化方案（扩展）
// ============================================

/**
 * Stage 7输出：个性化行动框架（来自特殊性整合prompt）
 */
export interface PersonalizedActionFramework {
  // 个人核心洞察
  personalInsights: PersonalInsight[];
  
  // 个性化后的框架（权重和路径可能调整）
  personalizedFramework: UniversalFramework;
  
  // 具体行动地图
  actionMap: PersonalizedActionMap;
  
  // 新兴超能力总结
  emergingSuperpower: string;
  
  // 第一步行动
  firstStep: string;
  
  // 生成时间
  generatedAt: number;
}

/**
 * 个人洞察
 */
export interface PersonalInsight {
  // 诊断点标题
  diagnosticPoint: string;
  
  // 衍生洞察
  derivedInsight: string;
}

/**
 * 个性化行动地图
 */
export interface PersonalizedActionMap {
  // 模块列表
  modules: PersonalizedModule[];
}

/**
 * 个性化模块
 */
export interface PersonalizedModule {
  // 模块名称
  moduleName: string;
  
  // 行动列表
  actions: PersonalizedAction[];
}

/**
 * 个性化行动
 */
export interface PersonalizedAction {
  // 行动描述
  action: string;
  
  // 状态标签
  status: 'strength' | 'opportunity' | 'maintenance';
  
  // 教练备注
  coachNote: string;
  
  // 下一步建议（仅当status='opportunity'时）
  nextMoves?: string[];
}

// ============================================
// 3D可视化相关类型
// ============================================

/**
 * 3D节点渲染数据
 */
export interface Node3DRenderData {
  // 基础节点数据
  baseNode: FrameworkNode;
  
  // 3D位置
  position3D: {
    x: number;
    y: number; // Y轴 = weight / 10
    z: number;
  };
  
  // 高度倍数（用于动画）
  heightMultiplier: number;
  
  // 发光强度（基于权重）
  glowIntensity: number;
  
  // 关联的问题ID列表（Stage 5-6使用）
  relatedQuestionIds?: string[];
  
  // 是否高亮
  isHighlighted?: boolean;
  
  // 是否选中
  isSelected?: boolean;
}

/**
 * 3D场景配置
 */
export interface Scene3DConfig {
  // 自动旋转
  autoRotate: boolean;
  
  // 旋转速度
  rotationSpeed: number;
  
  // 相机位置
  cameraPosition: {
    x: number;
    y: number;
    z: number;
  };
  
  // 是否显示网格
  showGrid: boolean;
  
  // 是否启用阴影
  enableShadows: boolean;
  
  // 粒子效果密度
  particleDensity: 'low' | 'medium' | 'high';
}

/**
 * 3D交互事件
 */
export interface Node3DInteractionEvent {
  // 事件类型
  type: 'hover' | 'click' | 'unhover';
  
  // 节点ID
  nodeId: string;
  
  // 节点数据
  node: Node3DRenderData;
  
  // 时间戳
  timestamp: number;
}

/**
 * 3D视角预设
 */
export type ViewPreset = 'default' | 'top' | 'side' | 'front';

// ============================================
// 更新的API响应类型（7阶段）
// ============================================

export interface Stage1ClarificationResponse {
  success: boolean;
  data?: ClarifiedMission;
  message?: string;
  nextAction?: 'continue_dialogue' | 'confirm' | 'complete';
}

export interface Stage2ConfirmationResponse {
  success: boolean;
  data?: ConfirmationState;
  message?: string;
  nextAction?: 'proceed' | 'refine';
}

export interface Stage3FrameworkResponse {
  success: boolean;
  data?: UniversalFramework;
  message?: string;
}

export interface Stage4ChoiceResponse {
  success: boolean;
  data?: PersonalizationChoice;
  message?: string;
  nextAction?: 'personalize' | 'complete';
}

export interface Stage56DiagnosticResponse {
  success: boolean;
  data?: {
    analysis?: WeightAnalysis;
    questions?: DiagnosticQuestion[];
  };
  message?: string;
  nextAction?: 'questioning' | 'generate_plan';
}

export interface Stage7PersonalizedResponse {
  success: boolean;
  data?: PersonalizedActionFramework;
  message?: string;
}

