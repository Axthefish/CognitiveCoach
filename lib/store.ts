/**
 * CognitiveCoach 全局状态管理 - Zustand Store
 * 
 * 管理内容：
 * - FSM 状态（S0 → S1 → S2 → S3 → S4）
 * - 用户上下文（目标、框架、系统动力学、行动计划等）
 * - 流式处理状态（进度、步骤、错误等）
 * - 版本快照（时间旅行、撤销功能）
 * - 迭代模式（允许返回修改之前的阶段）
 * 
 * FSM 状态转换图：
 * ```
 * S0_INTENT_CALIBRATION (目标校准)
 *          │
 *          │ generateFramework()
 *          ↓
 * S1_KNOWLEDGE_FRAMEWORK (知识框架)
 *          │                ↑
 *          │                │ navigateToStage() - 迭代模式
 *          │ generateSystemDynamics()
 *          ↓                │
 * S2_SYSTEM_DYNAMICS (系统动力学)
 *          │                ↑
 *          │                │ navigateToStage() - 迭代模式
 *          │ generateActionPlan()
 *          ↓                │
 * S3_ACTION_PLAN (行动计划)
 *          │                ↑
 *          │                │ navigateToStage() - 迭代模式
 *          │ analyzeProgress()
 *          ↓                │
 * S4_AUTONOMOUS_OPERATION (自主运营)
 * ```
 * 
 * 流式状态转换：
 * ```
 * 非流式 (isStreaming: false)
 *          │
 *          │ startStreaming(stage)
 *          ↓
 * 流式中 (isStreaming: true)
 *    │    │    cognitiveSteps 更新
 *    │    │    streamContent 累积
 *    │    │
 *    │    ├──> stopStreaming() ──> 完成
 *    │    │
 *    │    └──> setStreamError() ──> 错误状态
 *    │
 *    └──> navigateToStage() ──> 中止当前流 ──> 切换阶段
 * ```
 * 
 * 导航安全机制：
 * - isNavigating 标志防止导航期间启动新流
 * - 导航时自动中止当前流（通过 StreamManager）
 * - 错误处理确保 isNavigating 总是被重置
 * 
 * 版本快照机制：
 * - 每次关键操作后可创建快照
 * - 最多保存10个版本（LRU策略）
 * - 只在客户端创建（防止 hydration 不匹配）
 * 
 * 使用示例：
 * ```typescript
 * // 获取状态
 * const { currentState, userContext, streaming } = useCognitiveCoachStore();
 * 
 * // 更新状态
 * const { updateUserContext, setCurrentState } = useCognitiveCoachStore();
 * updateUserContext({ userGoal: 'Learn React' });
 * 
 * // 导航到新阶段
 * const { navigateToStage } = useCognitiveCoachStore();
 * await navigateToStage('S2_SYSTEM_DYNAMICS');
 * 
 * // 流式处理
 * const { startStreaming, stopStreaming } = useCognitiveCoachStore();
 * startStreaming('S1');
 * // ... 流式处理完成后
 * stopStreaming();
 * ```
 */

import { create } from 'zustand';
import type { FSMState, UserContext } from './types'; // 从 types 导入
import { hydrationSafeLog } from './hydration-safe';
import { globalStreamManager } from './stream-manager';

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
  abortController: AbortController | null; // 用于中断正在进行的请求
  isNavigating: boolean; // 标志位：防止在导航期间启动新请求
}

// Store接口
interface CognitiveCoachStore {
  // 状态
  currentState: FSMState;
  userContext: UserContext;
  selectedNodeId?: string | null;
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
  setQaIssues: (stage: 'S1' | 'S2' | 'S3' | null, issues: CognitiveCoachStore['qaIssues']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetStore: () => void;
  
  // Iterative actions
  markStageCompleted: (stage: FSMState) => void;
  navigateToStage: (targetState: FSMState) => Promise<void>;
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
  abortController: null,
  isNavigating: false,
};

// 创建Zustand store
export const useCognitiveCoachStore = create<CognitiveCoachStore>((set, get) => ({
  // 初始状态
  currentState: 'S0_INTENT_CALIBRATION',
  userContext: initialUserContext,
  selectedNodeId: null,
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

  setQaIssues: (stage, issues) => set({ lastFailedStage: stage, qaIssues: issues }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  resetStore: () => {
    hydrationSafeLog('🔄 Store: Resetting all store state');
    
    // 使用 StreamManager 重置流状态
    globalStreamManager.reset();
    
    set({
      currentState: 'S0_INTENT_CALIBRATION',
      userContext: { ...initialUserContext },
      qaIssues: [],
      lastFailedStage: null,
      isLoading: false,
      error: null,
      completedStages: [],
      iterationCount: {},
      isIterativeMode: false,
      streaming: { ...initialStreamingState },
    });
  },

  // Iterative actions implementation
  markStageCompleted: (stage) => 
    set((state) => ({
      completedStages: state.completedStages.includes(stage) 
        ? state.completedStages 
        : [...state.completedStages, stage]
    })),

  navigateToStage: async (targetState) => {
    hydrationSafeLog(`🧭 Store: Navigating to stage ${targetState}`);
    
    try {
      // 先设置导航标志
      set((state) => ({
        streaming: {
          ...state.streaming,
          isNavigating: true,
        }
      }));
      
      // 使用 StreamManager 中止当前流
      globalStreamManager.abort('Navigation to new stage');
      
      // 等待 abort 事件传播
      await Promise.resolve();
      
      // 统一更新状态
      set((state) => ({
        currentState: targetState,
        isIterativeMode: state.completedStages.includes(targetState),
        isLoading: false,
        error: null,
        streaming: {
          ...initialStreamingState,
          isNavigating: false,
          abortController: null,
        },
      }));
    } catch (error) {
      // 确保即使发生错误也重置 isNavigating 标志
      hydrationSafeLog('❌ Store: Error during navigation, resetting isNavigating flag', error);
      set((state) => ({
        streaming: {
          ...state.streaming,
          isNavigating: false,
        },
        error: error instanceof Error ? error.message : 'Navigation failed',
      }));
    }
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

  // 流式相关 Actions - 使用 StreamManager
  startStreaming: (stage) => {
    hydrationSafeLog(`🚀 Starting streaming for stage: ${stage}`);
    
    // 检查是否正在导航
    const currentStreaming = get().streaming;
    if (currentStreaming.isNavigating) {
      hydrationSafeLog('⚠️ Rejected streaming request: navigation in progress');
      return;
    }
    
    // 使用 StreamManager 启动流
    const abortController = globalStreamManager.start(stage);
    
    if (!abortController) {
      hydrationSafeLog('⚠️ Failed to start stream via StreamManager');
      return;
    }
    
    // 标记为正在流式处理
    globalStreamManager.markStreaming();
    
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
          abortController, // 保存 controller 引用（向后兼容）
          isNavigating: false,
        },
        isLoading: true,
        error: null,
      };
      return newState;
    });
  },

  stopStreaming: () => {
    hydrationSafeLog('🛑 Store: Stopping streaming');
    
    // 使用 StreamManager 完成流
    globalStreamManager.complete();
    
    set((state) => ({
      streaming: {
        ...initialStreamingState,
        // 保持已完成的内容，但清除流状态
        streamContent: state.streaming.streamContent,
        cognitiveSteps: state.streaming.cognitiveSteps,
        abortController: null,
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
    
    // 使用 StreamManager 标记错误
    globalStreamManager.error(error || 'Unknown error');
    
    set((state) => ({
      streaming: {
        ...state.streaming,
        streamError: error,
        isStreaming: false,
        currentStage: null,
        abortController: null,
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