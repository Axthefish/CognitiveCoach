/**
 * 新产品架构的状态管理 (V2)
 * 使用 Zustand 管理全局状态
 * 集成persist中间件实现会话持久化
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  StageState,
  ChatMessage,
  PurposeDefinition,
  UniversalFramework,
  PersonalizedPlan,
  DynamicQuestion,
  UserContextInfo,
  Stage2State,
} from './types-v2';
import { logger } from './logger';

// ============================================
// Store 接口定义
// ============================================

interface CognitiveCoachStoreV2 {
  // ========== 状态 ==========
  
  // 当前阶段
  currentStage: StageState;
  
  // Stage 0: 目的澄清
  purposeDefinition: PurposeDefinition | null;
  stage0Messages: ChatMessage[];
  
  // Stage 1: 通用框架
  universalFramework: UniversalFramework | null;
  stage1Paused: boolean; // 是否在思考暂停中
  
  // Stage 2: 个性化
  stage2State: Stage2State;
  dynamicQuestions: DynamicQuestion[];
  collectedInfo: UserContextInfo[];
  stage2Messages: ChatMessage[];
  personalizedPlan: PersonalizedPlan | null;
  
  // 通用状态
  isLoading: boolean;
  error: string | null;
  
  // 会话状态
  hasRestoredSession: boolean;
  sessionSavedAt: number | null;
  
  // ========== Stage 0 Actions ==========
  
  // 初始化 Stage 0
  initStage0: (initialInput: string) => void;
  
  // 添加消息到 Stage 0
  addStage0Message: (message: ChatMessage) => void;
  
  // 更新目的定义
  updatePurposeDefinition: (definition: Partial<PurposeDefinition>) => void;
  
  // 完成 Stage 0，进入 Stage 1
  completeStage0: (finalDefinition: PurposeDefinition) => void;
  
  // ========== Stage 1 Actions ==========
  
  // 设置通用框架
  setUniversalFramework: (framework: UniversalFramework) => void;
  
  // 暂停在 Stage 1（给用户思考时间）
  pauseAtStage1: () => void;
  
  // 从 Stage 1 继续到 Stage 2
  continueFromStage1: () => void;
  
  // ========== Stage 2 Actions ==========
  
  // 设置 Stage 2 状态
  setStage2State: (state: Stage2State) => void;
  
  // 设置动态问题
  setDynamicQuestions: (questions: DynamicQuestion[]) => void;
  
  // 添加用户回答
  addUserAnswer: (info: UserContextInfo) => void;
  
  // 添加 Stage 2 消息
  addStage2Message: (message: ChatMessage) => void;
  
  // 设置个性化方案
  setPersonalizedPlan: (plan: PersonalizedPlan) => void;
  
  // 完成整个流程
  completeFlow: () => void;
  
  // 不进入Stage2直接完成
  completeWithoutStage2: () => void;
  
  // ========== 通用 Actions ==========
  
  // 设置加载状态
  setLoading: (loading: boolean) => void;
  
  // 设置错误
  setError: (error: string | null) => void;
  
  // 重置所有状态
  reset: () => void;
  
  // 返回上一阶段
  goBack: () => void;
  
  // 会话管理
  acknowledgeSessionRestore: () => void;
  clearSession: () => void;
}

// ============================================
// 初始状态
// ============================================

const initialState = {
  currentStage: 'STAGE_0_PURPOSE_CLARIFICATION' as StageState,
  purposeDefinition: null,
  stage0Messages: [],
  universalFramework: null,
  stage1Paused: false,
  stage2State: 'ANALYZING' as Stage2State,
  dynamicQuestions: [],
  collectedInfo: [],
  stage2Messages: [],
  personalizedPlan: null,
  isLoading: false,
  error: null,
  hasRestoredSession: false,
  sessionSavedAt: null,
};

// ============================================
// Store 实现
// ============================================

export const useCognitiveCoachStoreV2 = create<CognitiveCoachStoreV2>()(
  persist(
    (set, get) => ({
  ...initialState,
  
  // ========== Stage 0 Actions ==========
  
  initStage0: (initialInput: string) => {
    const systemMessage: ChatMessage = {
      id: `msg-${Date.now()}-system`,
      role: 'system',
      content: '欢迎使用 CognitiveCoach！我会通过对话帮你澄清目标和需求。',
      timestamp: Date.now(),
      metadata: { stage: 'STAGE_0_PURPOSE_CLARIFICATION', type: 'info' },
    };
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: initialInput,
      timestamp: Date.now(),
      metadata: { stage: 'STAGE_0_PURPOSE_CLARIFICATION', type: 'answer' },
    };
    
    set({
      currentStage: 'STAGE_0_PURPOSE_CLARIFICATION',
      stage0Messages: [systemMessage, userMessage],
      purposeDefinition: {
        rawInput: initialInput,
        clarifiedPurpose: '',
        problemDomain: '',
        domainBoundary: '',
        boundaryConstraints: [],
        personalConstraints: [],
        keyConstraints: [], // 保留向后兼容
        conversationHistory: [userMessage],
        confidence: 0,
        clarificationState: 'INIT',
      },
    });
  },
  
  addStage0Message: (message: ChatMessage) => {
    set((state) => ({
      stage0Messages: [...state.stage0Messages, message],
      purposeDefinition: state.purposeDefinition ? {
        ...state.purposeDefinition,
        conversationHistory: [...state.purposeDefinition.conversationHistory, message],
      } : null,
    }));
  },
  
  updatePurposeDefinition: (definition: Partial<PurposeDefinition>) => {
    set((state) => ({
      purposeDefinition: state.purposeDefinition ? {
        ...state.purposeDefinition,
        ...definition,
      } : null,
    }));
  },
  
  completeStage0: (finalDefinition: PurposeDefinition) => {
    set({
      purposeDefinition: { ...finalDefinition, clarificationState: 'COMPLETED' },
      currentStage: 'STAGE_1_FRAMEWORK_GENERATION',
    });
  },
  
  // ========== Stage 1 Actions ==========
  
  setUniversalFramework: (framework: UniversalFramework) => {
    set({
      universalFramework: framework,
      stage1Paused: true, // 自动进入暂停状态
    });
  },
  
  pauseAtStage1: () => {
    set({ stage1Paused: true });
  },
  
  continueFromStage1: () => {
    set({
      stage1Paused: false,
      currentStage: 'STAGE_2_PERSONALIZATION',
      stage2State: 'ANALYZING',
    });
  },
  
  // ========== Stage 2 Actions ==========
  
  setStage2State: (state: Stage2State) => {
    set({ stage2State: state });
  },
  
  setDynamicQuestions: (questions: DynamicQuestion[]) => {
    set({
      dynamicQuestions: questions,
      stage2State: 'QUESTIONING',
    });
  },
  
  addUserAnswer: (info: UserContextInfo) => {
    set((state) => ({
      collectedInfo: [...state.collectedInfo, info],
    }));
  },
  
  addStage2Message: (message: ChatMessage) => {
    set((state) => ({
      stage2Messages: [...state.stage2Messages, message],
    }));
  },
  
  setPersonalizedPlan: (plan: PersonalizedPlan) => {
    set({
      personalizedPlan: plan,
      stage2State: 'COMPLETED',
    });
  },
  
  completeFlow: () => {
    set({
      currentStage: 'COMPLETED',
      stage2State: 'COMPLETED',
    });
  },
  
  completeWithoutStage2: () => {
    set({
      currentStage: 'COMPLETED',
      // 保留framework，但标记为未经过Stage2个性化
    });
  },
  
  // ========== 通用 Actions ==========
  
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
  
  setError: (error: string | null) => {
    set({ error });
  },
  
  reset: () => {
    set(initialState);
  },
  
  goBack: () => {
    const currentStage = get().currentStage;
    
    if (currentStage === 'STAGE_1_FRAMEWORK_GENERATION') {
      set({ currentStage: 'STAGE_0_PURPOSE_CLARIFICATION' });
    } else if (currentStage === 'STAGE_2_PERSONALIZATION') {
      set({
        currentStage: 'STAGE_1_FRAMEWORK_GENERATION',
        stage1Paused: true,
      });
    }
  },
  
  acknowledgeSessionRestore: () => {
    set({ hasRestoredSession: false });
  },
  
  clearSession: () => {
    set(initialState);
  },
}),
    {
      name: 'cognitive-coach-session-v2',
      storage: createJSONStorage(() => {
        // 仅在浏览器环境使用localStorage
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        // 服务端返回null存储（不持久化）
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      // 过滤掉不需要持久化的字段
      partialize: (state) => ({
        currentStage: state.currentStage,
        purposeDefinition: state.purposeDefinition,
        stage0Messages: state.stage0Messages,
        universalFramework: state.universalFramework,
        stage1Paused: state.stage1Paused,
        stage2State: state.stage2State,
        dynamicQuestions: state.dynamicQuestions,
        collectedInfo: state.collectedInfo,
        stage2Messages: state.stage2Messages,
        personalizedPlan: state.personalizedPlan,
        sessionSavedAt: Date.now(),
        // 不持久化临时状态
        // isLoading: false,
        // error: null,
      }),
      // 会话恢复后的回调
      onRehydrateStorage: () => (state) => {
        if (state && state.sessionSavedAt) {
          const hoursSinceLastSave = (Date.now() - state.sessionSavedAt) / (1000 * 60 * 60);
          
          // 如果超过24小时，清除会话
          if (hoursSinceLastSave > 24) {
            logger.info('[Store] Session expired, clearing');
            state.clearSession();
            return;
          }
          
          // 标记会话已恢复
          state.hasRestoredSession = true;
          logger.info('[Store] Session restored', {
            stage: state.currentStage,
            hoursSinceLastSave: hoursSinceLastSave.toFixed(1),
          });
        }
      },
    }
  )
);

// ============================================
// 选择器 Hooks（优化性能）
// ============================================

export const useCurrentStage = () => 
  useCognitiveCoachStoreV2((state) => state.currentStage);

export const usePurposeDefinition = () => 
  useCognitiveCoachStoreV2((state) => state.purposeDefinition);

export const useUniversalFramework = () => 
  useCognitiveCoachStoreV2((state) => state.universalFramework);

export const usePersonalizedPlan = () => 
  useCognitiveCoachStoreV2((state) => state.personalizedPlan);

export const useIsLoading = () => 
  useCognitiveCoachStoreV2((state) => state.isLoading);

export const useError = () => 
  useCognitiveCoachStoreV2((state) => state.error);

