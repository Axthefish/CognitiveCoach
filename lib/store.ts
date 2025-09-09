import { create } from 'zustand';
import type { StrategySpecZod as StrategySpec } from './schemas';
import { getHydrationSafeTimestamp, getHydrationSafeRandom, hydrationSafeLog } from './hydration-safe';

// FSM状态定义
export type FSMState = 
  | 'S0_INTENT_CALIBRATION'
  | 'S1_KNOWLEDGE_FRAMEWORK'
  | 'S2_SYSTEM_DYNAMICS'
  | 'S3_ACTION_PLAN'
  | 'S4_AUTONOMOUS_OPERATION';

// 知识框架节点接口（与 schemas.ts 保持一致）
export interface FrameworkNode {
  id: string;
  title: string;
  summary: string;
  children?: FrameworkNode[];
  evidence?: Array<{
    source: string;
    url?: string;
    date?: string;
    scope?: string;
  }>;
  confidence?: number; // 0-1
  applicability?: string;
}

export type KnowledgeFramework = FrameworkNode[];

// 行动计划项接口（根据ReconstructReport.md中的定义）
export interface ActionItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

export type ActionPlan = ActionItem[];

// Conversation message interface
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 用户上下文对象
export interface UserContext {
  userGoal: string;
  knowledgeFramework: KnowledgeFramework | null;
  systemDynamics: {
    mermaidChart: string;
    metaphor: string;
    nodes?: Array<{ id: string; title: string }>;
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
  runTier?: 'Lite' | 'Pro' | 'Review';
  riskPreference?: 'low' | 'medium' | 'high';
  seed?: number;
  // Flags & telemetry
  requiresHumanReview?: boolean;
  povTags?: string[];
  lastTelemetry?: unknown;
  goalConversationHistory: ConversationMessage[]; // Added for S0 conversation tracking
  goalRecommendations?: Array<{
    category: string;
    examples: string[];
    description: string;
  }>; // Added for S0 recommendations
}

// 流式状态接口
interface StreamingState {
  isStreaming: boolean;
  currentStage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | null;
  cognitiveSteps: Array<{
    id: string;
    message: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
    timestamp?: number;
  }>;
  streamContent: string;
  microLearningTip: string | null;
  streamError: string | null;
}

// Store接口
interface CognitiveCoachStore {
  // 状态
  currentState: FSMState;
  userContext: UserContext;
  selectedNodeId?: string | null;
  versions: Array<{ id: string; timestamp: string; state: UserContext }>;
  currentVersion: string | null;
  qaIssues: Array<{ severity: 'blocker' | 'warn'; area: 'schema' | 'coverage' | 'consistency' | 'evidence' | 'actionability'; hint: string; targetPath: string }>; 
  lastFailedStage: 'S1' | 'S2' | 'S3' | null;
  isLoading: boolean;
  error: string | null;
  
  // Iterative state
  completedStages: FSMState[];
  iterationCount: Partial<Record<FSMState, number>>;
  isIterativeMode: boolean;
  
  // 流式状态
  streaming: StreamingState;
  
  // Actions
  setCurrentState: (state: FSMState) => void;
  updateUserContext: (updates: Partial<UserContext>) => void;
  setSelectedNodeId: (id: string | null) => void;
  batchUpdate: (updates: Partial<CognitiveCoachStore>) => void;
  addVersionSnapshot: () => void;
  setQaIssues: (stage: 'S1' | 'S2' | 'S3' | null, issues: CognitiveCoachStore['qaIssues']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetStore: () => void;
  
  // Iterative actions
  markStageCompleted: (stage: FSMState) => void;
  navigateToStage: (targetState: FSMState) => void;
  startIterativeRefinement: (targetState: FSMState) => void;
  incrementIteration: (stage: FSMState) => void;
  
  // 流式相关 Actions
  startStreaming: (stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4') => void;
  stopStreaming: () => void;
  updateCognitiveSteps: (steps: StreamingState['cognitiveSteps']) => void;
  appendStreamContent: (content: string) => void;
  setStreamContent: (content: string) => void;
  setMicroLearningTip: (tip: string | null) => void;
  setStreamError: (error: string | null) => void;
  resetStreamingState: () => void;
}

// 初始状态
const initialUserContext: UserContext = {
  userGoal: '',
  knowledgeFramework: null,
  systemDynamics: null,
  actionPlan: null,
  kpis: null,
  strategySpec: null,
  decisionType: 'plan',
  runTier: 'Pro',
  riskPreference: 'medium',
  seed: undefined,
  requiresHumanReview: undefined,
  povTags: undefined,
  lastTelemetry: undefined,
  goalConversationHistory: [],
  goalRecommendations: undefined,
};

const initialStreamingState: StreamingState = {
  isStreaming: false,
  currentStage: null,
  cognitiveSteps: [],
  streamContent: '',
  microLearningTip: null,
  streamError: null,
};

// 创建Zustand store
export const useCognitiveCoachStore = create<CognitiveCoachStore>((set, get) => ({
  // 初始状态
  currentState: 'S0_INTENT_CALIBRATION',
  userContext: initialUserContext,
  selectedNodeId: null,
  versions: [],
  currentVersion: null,
  qaIssues: [],
  lastFailedStage: null,
  isLoading: false,
  error: null,
  
  // Iterative state
  completedStages: [],
  iterationCount: {},
  isIterativeMode: false,
  
  streaming: initialStreamingState,
  
  // Actions
  setCurrentState: (state) => set({ currentState: state }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  
  updateUserContext: (updates) => 
    set((state) => ({
      userContext: { ...state.userContext, ...updates }
    })),
  
  // 批量更新方法 - 确保原子性操作
  batchUpdate: (updates) => {
    set((state) => ({
      ...state,
      ...updates,
    }));
  },
  
  addVersionSnapshot: () => {
    const MAX_VERSIONS = 10; // 限制保存的版本数量
    const userContext = get().userContext;
    const timestamp = getHydrationSafeTimestamp();
    const randomSuffix = (getHydrationSafeRandom() * 1000000).toFixed(0).padStart(6, '0');
    const id = `v-${timestamp}-${randomSuffix}`;
    // Inline snapshot creation to avoid circular deps
    const snapshot = { 
      id, 
      timestamp, 
      state: JSON.parse(JSON.stringify(userContext)) // Deep clone
    };
    
    set((state) => ({
      // 保持版本数量在限制内，移除最旧的版本
      versions: [...state.versions.slice(-MAX_VERSIONS + 1), snapshot],
      currentVersion: snapshot.id,
    }));
  },

  setQaIssues: (stage, issues) => set({ lastFailedStage: stage, qaIssues: issues }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  resetStore: () => {
    hydrationSafeLog('🔄 Store: Resetting all store state');
    set({
      currentState: 'S0_INTENT_CALIBRATION',
      userContext: { ...initialUserContext }, // 使用展开操作符创建新实例
      versions: [],
      currentVersion: null,
      qaIssues: [],
      lastFailedStage: null,
      isLoading: false,
      error: null,
      completedStages: [],
      iterationCount: {},
      isIterativeMode: false,
      streaming: { ...initialStreamingState }, // 使用展开操作符创建新实例
    });
  },

  // Iterative actions implementation
  markStageCompleted: (stage) => 
    set((state) => ({
      completedStages: state.completedStages.includes(stage) 
        ? state.completedStages 
        : [...state.completedStages, stage]
    })),

  navigateToStage: (targetState) => {
    hydrationSafeLog(`🧭 Store: Navigating to stage ${targetState}, canceling active streams`);
    
    // 获取当前状态
    const currentStreaming = get().streaming;
    
    // 如果当前正在流式处理，需要先停止
    if (currentStreaming.isStreaming) {
      hydrationSafeLog('🛑 Store: Stopping active streaming before navigation');
    }
    
    set((state) => ({
      currentState: targetState,
      isIterativeMode: state.completedStages.includes(targetState),
      isLoading: false,
      error: null,
      // 完全重置流状态，防止任何竞态条件
      streaming: {
        ...initialStreamingState
      },
    }));
  },

  startIterativeRefinement: (targetState) => {
    hydrationSafeLog(`🔄 Store: Starting iterative refinement for ${targetState}`);
    set((state) => ({
      currentState: targetState,
      isIterativeMode: true,
      isLoading: true,
      error: null,
      iterationCount: {
        ...state.iterationCount,
        [targetState]: (state.iterationCount[targetState] || 0) + 1
      },
      // 清除之前的流状态，准备新的迭代
      streaming: {
        ...initialStreamingState,
        streamContent: '',
        cognitiveSteps: [],
        microLearningTip: null,
      },
    }));
  },

  incrementIteration: (stage) => 
    set((state) => ({
      iterationCount: {
        ...state.iterationCount,
        [stage]: (state.iterationCount[stage] || 0) + 1
      }
    })),

  // 流式相关 Actions
  startStreaming: (stage) => {
    hydrationSafeLog(`🚀 Starting streaming for stage: ${stage}`);
    set((state) => {
      const newState = {
        streaming: {
          ...state.streaming,
          isStreaming: true,
          currentStage: stage,
          cognitiveSteps: [],
          streamContent: '',
          microLearningTip: null,
          streamError: null,
        },
        isLoading: true,
        error: null,
      };
      hydrationSafeLog('🔄 State updated:', {
        isLoading: newState.isLoading,
        isStreaming: newState.streaming.isStreaming,
        currentStage: newState.streaming.currentStage
      });
      return newState;
    });
  },

  stopStreaming: () => {
    hydrationSafeLog('🛑 Store: Stopping streaming and clearing all stream state');
    set((state) => ({
      streaming: {
        ...initialStreamingState,
        // 保持已完成的内容，但清除流状态
        streamContent: state.streaming.streamContent,
        cognitiveSteps: state.streaming.cognitiveSteps,
      },
      isLoading: false,
    }));
  },

  updateCognitiveSteps: (steps) => 
    set((state) => ({
      streaming: {
        ...state.streaming,
        cognitiveSteps: steps,
      },
    })),

  appendStreamContent: (content) => 
    set((state) => ({
      streaming: {
        ...state.streaming,
        streamContent: state.streaming.streamContent + content,
      },
    })),

  setStreamContent: (content) => 
    set((state) => ({
      streaming: {
        ...state.streaming,
        streamContent: content,
      },
    })),

  setMicroLearningTip: (tip) => 
    set((state) => ({
      streaming: {
        ...state.streaming,
        microLearningTip: tip,
      },
    })),

  setStreamError: (error) => {
    hydrationSafeLog('❌ Store: Setting stream error:', error);
    set((state) => ({
      streaming: {
        ...state.streaming,
        streamError: error,
        isStreaming: false,
        // 清除当前阶段，避免混乱
        currentStage: null,
      },
      error,
      isLoading: false,
    }));
  },

  resetStreamingState: () => 
    set(() => ({
      streaming: initialStreamingState,
    })),
}));