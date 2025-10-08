import { z } from 'zod';
// zod schemas for API contracts

// Common fragments
export const EvidenceSchema = z.object({
  source: z.string(),
  url: z.string().url().optional(),
  date: z.string().optional(),
  scope: z.string().optional(),
}).strict();

export const EvidenceArraySchema = z.array(EvidenceSchema).optional();

export const ConfidenceSchema = z.number().min(0).max(1).optional();
export const ApplicabilitySchema = z.string().optional();

// Telemetry schema for tracking generation process
export const TelemetrySchema = z.object({
  n_best_count: z.number().int().min(1).optional(),
  retry: z.boolean().optional(),
  generation_time_ms: z.number().min(0).optional(),
  token_count: z.number().int().min(0).optional(),
  model_used: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  quality_score: z.number().min(0).max(1).optional(),
}).strict().optional();

// S0 refineGoal output
export const S0RefineGoalSchema = z.object({
  status: z.enum(['clarification_needed', 'clarified', 'recommendations_provided']),
  ai_question: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  recommendations: z.array(z.object({
    category: z.string(),
    examples: z.array(z.string()),
    description: z.string()
    // TODO: 扩展点 - 可添加 allow_multiple: z.boolean().optional(), is_other: z.boolean().optional()
  })).optional(),
  // Make metadata fields optional to match AI output capabilities
  evidence: EvidenceArraySchema.optional(),
  confidence: ConfidenceSchema.optional(),
  applicability: ApplicabilitySchema.optional(),
  // TODO: 扩展点 - 可添加以下字段以支持更丰富的交互：
  // question_type: z.enum(['form', 'choice', 'confirmation']).optional(),
  // missing_fields: z.array(z.string()).optional(),
  // assumptions: z.array(z.string()).optional(),
  // draft_goal: z.string().optional(),
}).strict();

// S1 knowledge framework node
type FrameworkNode = {
  id: string;
  title: string;
  summary: string;
  children?: FrameworkNode[];
  evidence?: z.infer<typeof EvidenceArraySchema>;
  confidence?: z.infer<typeof ConfidenceSchema>;
  applicability?: z.infer<typeof ApplicabilitySchema>;
};
export const FrameworkNodeSchema: z.ZodType<FrameworkNode> = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  children: z.array(z.lazy(() => FrameworkNodeSchema)).optional(),
  evidence: EvidenceArraySchema.optional().default([]),
  confidence: ConfidenceSchema.optional().default(0.6),
  applicability: ApplicabilitySchema.optional().default(""),
}).strict();

export const KnowledgeFrameworkSchema = z.array(FrameworkNodeSchema);

// 导出推断类型
export type FrameworkNode = z.infer<typeof FrameworkNodeSchema>;
export type KnowledgeFramework = z.infer<typeof KnowledgeFrameworkSchema>;

// S2 system dynamics output
export const SystemNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
}).strict();

export const SystemDynamicsSchema = z.object({
  mermaidChart: z.string(),
  metaphor: z.string(),
  nodes: z.array(SystemNodeSchema).optional(),
  // S2 extensions for clarity and applicability
  mainPath: z.array(z.string()).optional().default([]), // ordered list of node ids
  loops: z.array(z.object({
    id: z.string(),
    title: z.string(),
    nodes: z.array(z.string()),
    summary: z.string().optional().default("")
  })).optional().default([]),
  nodeAnalogies: z.array(z.object({
    nodeId: z.string(),
    analogy: z.string(),
    example: z.string().optional().default("")
  })).optional().default([]),
  evidence: EvidenceArraySchema.optional().default([]),
  confidence: ConfidenceSchema.optional().default(0.6),
  applicability: ApplicabilitySchema.optional().default(""),
}).strict();

// Strategy DSL (zod) — validate S3.strategySpec
export const TriggerSchema = z.object({
  metricId: z.string(),
  comparator: z.enum(['>', '>=', '<', '<=', '==', 'trend_down', 'trend_up']),
  threshold: z.union([z.number(), z.string()]),
  window: z.string(),
}).strict();

export const DiagnosisStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  check: z.string().optional(),
}).strict();

export const StrategyOptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  steps: z.array(z.string()),
  benefits: z.array(z.string()),
  risks: z.array(z.string()).optional(),
  suitableFor: z.array(z.string()).optional(),
}).strict();

export const RecoveryWindowSchema = z.object({
  window: z.string(),
  reviewMetricIds: z.array(z.string()),
}).strict();

export const StopLossSchema = z.object({
  condition: z.string(),
  action: z.string(),
}).strict();

export const MetricSpecSchema = z.object({
  metricId: z.string(),
  what: z.string(),
  why: z.string(),
  triggers: z.array(TriggerSchema).min(1).optional(),
  diagnosis: z.array(DiagnosisStepSchema).min(1).optional(),
  options: z.array(StrategyOptionSchema).min(1).optional(),
  recovery: RecoveryWindowSchema.optional(),
  stopLoss: StopLossSchema.optional(), // optional to support simpler responses
  evidence: EvidenceArraySchema.optional().default([]),
  confidence: ConfidenceSchema.optional().default(0.6),
  applicability: ApplicabilitySchema.optional().default(""),
}).strict();

export const StrategySpecSchema = z.object({
  metrics: z.array(MetricSpecSchema).min(1).optional(),
  evidence: EvidenceArraySchema.optional().default([]),
  confidence: ConfidenceSchema.optional().default(0.6),
}).strict();

// S3 action plan primitive
export const ActionItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  isCompleted: z.boolean(),
}).strict();

export const ActionPlanSchema = z.array(ActionItemSchema);

// 导出推断类型
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type ActionPlan = z.infer<typeof ActionPlanSchema>;

export const ActionPlanResponseSchema = z.object({
  actionPlan: ActionPlanSchema,
  kpis: z.array(z.string()),
  strategySpec: StrategySpecSchema.optional(),
  povTags: z.array(z.string()).optional(),
  requiresHumanReview: z.boolean().optional(),
  telemetry: TelemetrySchema,
  missingEvidenceTop3: z.array(z.object({
    metricId: z.string(),
    what: z.string(),
    voi_reason: z.string(),
  })).optional().default([]),
  reviewWindow: z.string().optional().default("P14D"),
  evidence: EvidenceArraySchema.optional().default([]),
  confidence: ConfidenceSchema.optional().default(0.6),
  applicability: ApplicabilitySchema.optional().default(""),
}).strict();

// S4 analyze progress output
export const AnalyzeProgressSchema = z.object({
  analysis: z.string(),
  suggestions: z.array(z.string()),
  encouragement: z.string().optional(),
  referencedMetricIds: z.array(z.string()).max(20).optional().default([]), // T8: 添加最大长度限制
  evidence: EvidenceArraySchema.optional().default([]),
  confidence: ConfidenceSchema.optional().default(0.6),
  applicability: ApplicabilitySchema.optional().default(""),
}).strict();

// Input schemas
export const TaskSpecSchema = z.object({
  decisionType: z.enum(['explore', 'compare', 'troubleshoot', 'plan']).optional(),
  runTier: z.enum(['Lite', 'Pro', 'Review']).optional(),
  riskPreference: z.enum(['low', 'medium', 'high']).optional(),
  seed: z.number().int().optional(),
});

export type S0RefineGoal = z.infer<typeof S0RefineGoalSchema>;
export type SystemDynamics = z.infer<typeof SystemDynamicsSchema>;
export type ActionPlanResponse = z.infer<typeof ActionPlanResponseSchema>;
export type AnalyzeProgress = z.infer<typeof AnalyzeProgressSchema>;
export type StrategySpecZod = z.infer<typeof StrategySpecSchema>;
export type Telemetry = z.infer<typeof TelemetrySchema>;

// Streaming response data types
export type StreamResponseData = 
  | { framework: KnowledgeFramework }
  | { mermaidChart: string; metaphor: string; nodes?: Array<{ id: string; title: string }>; mainPath?: string[]; loops?: Array<{ id: string; title: string; nodes: string[]; summary?: string }>; nodeAnalogies?: Array<{ nodeId: string; analogy: string; example?: string }> }
  | ActionPlanResponse
  | AnalyzeProgress
  | { response: string };

// Additional streaming payload types for cognitive steps
export type StreamPayload = StreamResponseData | string | { 
  step: string; 
  progress: number; 
} | { 
  steps: Array<{ id: string; message: string; status: string }>; 
  tip?: string;
  traceId?: string;
} | {
  status: 'success' | 'error';
  data?: unknown;
  error?: string;
} | {
  code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN';
  message: string;
} | null;

// Request schemas for /api/coach
export const RefineGoalPayloadSchema = z.object({
  userInput: z.string(),
  conversationHistory: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).optional(),
}).strict();

export const GenerateFrameworkPayloadSchema = z.object({
  userGoal: z.string(),
  decisionType: z.enum(['explore', 'compare', 'troubleshoot', 'plan']).optional(),
  runTier: z.enum(['Lite', 'Pro', 'Review']).optional(),
  riskPreference: z.enum(['low', 'medium', 'high']).optional(),
  seed: z.number().int().optional(),
}).strict();

export const GenerateSystemDynamicsPayloadSchema = z.object({
  framework: KnowledgeFrameworkSchema,
  decisionType: z.enum(['explore', 'compare', 'troubleshoot', 'plan']).optional(),
  runTier: z.enum(['Lite', 'Pro', 'Review']).optional(),
  riskPreference: z.enum(['low', 'medium', 'high']).optional(),
  seed: z.number().int().optional(),
}).strict();

export const GenerateActionPlanPayloadSchema = z.object({
  userGoal: z.string(),
  framework: KnowledgeFrameworkSchema,
  systemNodes: z.array(z.object({ id: z.string(), title: z.string().optional() })).optional(),
  decisionType: z.enum(['explore', 'compare', 'troubleshoot', 'plan']).optional(),
  runTier: z.enum(['Lite', 'Pro', 'Review']).optional(),
  riskPreference: z.enum(['low', 'medium', 'high']).optional(),
  seed: z.number().int().optional(),
}).strict();

export const AnalyzeProgressPayloadSchema = z.object({
  progressData: z.object({
    completedTasks: z.array(z.string()).optional(),
    confidenceScore: z.number().int().min(0).max(10).optional(),
    hoursSpent: z.number().int().min(0).optional(),
    challenges: z.string().optional(),
  }),
  userContext: z.object({
    userGoal: z.string(),
    actionPlan: ActionPlanSchema,
    kpis: z.array(z.string()),
    strategySpec: z.object({ metrics: z.array(z.object({ metricId: z.string() })) }).optional(),
  }),
}).strict();

export const ConsultPayloadSchema = z.object({
  question: z.string(),
  userContext: z.object({
    userGoal: z.string(),
    knowledgeFramework: KnowledgeFrameworkSchema,
    actionPlan: ActionPlanSchema,
    systemDynamics: z.object({ mermaidChart: z.string(), metaphor: z.string() }).optional(),
  })
}).strict();

export const CoachRequestSchema = z.object({
  action: z.enum(['refineGoal','generateFramework','generateSystemDynamics','generateActionPlan','analyzeProgress','consult']),
  payload: z.union([
    RefineGoalPayloadSchema,
    GenerateFrameworkPayloadSchema,
    GenerateSystemDynamicsPayloadSchema,
    GenerateActionPlanPayloadSchema,
    AnalyzeProgressPayloadSchema,
    ConsultPayloadSchema,
  ]),
}).strict();


