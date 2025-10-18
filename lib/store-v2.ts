/**
 * 新产品架构的状态管理 (V3 - 7阶段架构)
 * 使用 Zustand 管理全局状态
 * 集成persist中间件实现会话持久化
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  StageState,
  ChatMessage,
  ClarifiedMission,
  ConfirmationState,
  UniversalFramework,
  PersonalizationChoice,
  WeightAnalysis,
  DiagnosticQuestion,
  UserContextInfo,
  PersonalizedActionFramework,
  Stage56State,
  // 保留向后兼容
  PurposeDefinition,
  PersonalizedPlan,
  DynamicQuestion,
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
  
  // Stage 0: 产品介绍和用户输入
  userInitialInput: string;
  stage0Messages: ChatMessage[];
  
  // Stage 1: 目标澄清
  clarifiedMission: ClarifiedMission | null;
  stage1Messages: ChatMessage[];
  
  // Stage 2: 用户确认
  confirmationState: ConfirmationState | null;
  
  // Stage 3: 通用框架生成
  universalFramework: UniversalFramework | null;
  stage3Loading: boolean;
  
  // Stage 4: 个性化选择
  personalizationChoice: PersonalizationChoice | null;
  
  // Stage 5-6: 权重分析和诊断提问
  stage56State: Stage56State;
  weightAnalysis: WeightAnalysis | null;
  diagnosticQuestions: DiagnosticQuestion[];
  stage56Messages: ChatMessage[];
  stage56CollectedInfo: UserContextInfo[];
  
  // Stage 7: 个性化行动框架
  personalizedActionFramework: PersonalizedActionFramework | null;
  
  // 通用状态
  isLoading: boolean;
  error: string | null;
  
  // 会话状态
  hasRestoredSession: boolean;
  sessionSavedAt: number | null;
  
  // ========== 向后兼容字段（废弃） ==========
  // @deprecated 仅用于迁移，将在未来版本删除
  purposeDefinition: PurposeDefinition | null;
  stage1Paused: boolean;
  stage2State: Stage2State;
  dynamicQuestions: DynamicQuestion[];
  collectedInfo: UserContextInfo[];
  stage2Messages: ChatMessage[];
  personalizedPlan: PersonalizedPlan | null;
  
  // ========== Stage 0 Actions ==========
  
  // 初始化 Stage 0（用户输入）
  initStage0: (initialInput: string) => void;
  
  // 添加消息到 Stage 0
  addStage0Message: (message: ChatMessage) => void;
  
  // 完成 Stage 0，进入 Stage 1
  completeStage0: () => void;
  
  // 完成 Stage 0 并带上AI提炼的结果，进入 Stage 1展示
  completeStage0WithMission: (mission: ClarifiedMission, aiMessage?: string) => void;
  
  // ========== Stage 1 Actions ==========
  
  // 添加消息到 Stage 1
  addStage1Message: (message: ChatMessage) => void;
  
  // 更新澄清的使命
  updateClarifiedMission: (mission: Partial<ClarifiedMission>) => void;
  
  // 完成 Stage 1，进入 Stage 2确认
  completeStage1: (mission: ClarifiedMission) => void;
  
  // ========== Stage 2 Actions ==========
  
  // 设置确认状态
  setConfirmationState: (state: ConfirmationState) => void;
  
  // 用户确认，进入 Stage 3
  confirmAndProceed: () => void;
  
  // 用户不确认，返回 Stage 1
  rejectAndRefine: (feedback?: string) => void;
  
  // ========== Stage 3 Actions ==========
  
  // 设置通用框架
  setUniversalFramework: (framework: UniversalFramework) => void;
  
  // 完成 Stage 3，进入 Stage 4
  completeStage3: () => void;
  
  // ========== Stage 4 Actions ==========
  
  // 设置个性化选择
  setPersonalizationChoice: (choice: PersonalizationChoice) => void;
  
  // 选择继续个性化
  choosePersonalization: () => void;
  
  // 选择跳过个性化，直接完成
  skipPersonalization: () => void;
  
  // ========== Stage 5-6 Actions ==========
  
  // 设置 Stage 5-6 状态
  setStage56State: (state: Stage56State) => void;
  
  // 设置权重分析
  setWeightAnalysis: (analysis: WeightAnalysis) => void;
  
  // 设置诊断问题
  setDiagnosticQuestions: (questions: DiagnosticQuestion[]) => void;
  
  // 添加消息到 Stage 5-6
  addStage56Message: (message: ChatMessage) => void;
  
  // 添加用户回答（Stage 5-6）
  addStage56Answer: (info: UserContextInfo) => void;
  
  // 完成 Stage 5-6，进入 Stage 7
  completeStage56: () => void;
  
  // ========== Stage 7 Actions ==========
  
  // 设置个性化行动框架
  setPersonalizedActionFramework: (framework: PersonalizedActionFramework) => void;
  
  // 完成整个流程
  completeFlow: () => void;
  
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
  
  // ========== 向后兼容 Actions（废弃） ==========
  // @deprecated 仅用于过渡期，新代码不应使用
  updatePurposeDefinition: (definition: Partial<PurposeDefinition>) => void;
  pauseAtStage1: () => void;
  continueFromStage1: () => void;
  setStage2State: (state: Stage2State) => void;
  setDynamicQuestions: (questions: DynamicQuestion[]) => void;
  addUserAnswer: (info: UserContextInfo) => void;
  addStage2Message: (message: ChatMessage) => void;
  setPersonalizedPlan: (plan: PersonalizedPlan) => void;
  completeWithoutStage2: () => void;
}

// ============================================
// 初始状态
// ============================================

const initialState = {
  currentStage: 'STAGE_0_INTRODUCTION' as StageState,
  
  // Stage 0
  userInitialInput: '',
  stage0Messages: [],
  
  // Stage 1
  clarifiedMission: null,
  stage1Messages: [],
  
  // Stage 2
  confirmationState: null,
  
  // Stage 3
  universalFramework: null,
  stage3Loading: false,
  
  // Stage 4
  personalizationChoice: null,
  
  // Stage 5-6
  stage56State: 'ANALYZING_WEIGHTS' as Stage56State,
  weightAnalysis: null,
  diagnosticQuestions: [],
  stage56Messages: [],
  stage56CollectedInfo: [],
  
  // Stage 7
  personalizedActionFramework: null,
  
  // 通用
  isLoading: false,
  error: null,
  hasRestoredSession: false,
  sessionSavedAt: null,
  
  // 向后兼容（废弃）
  purposeDefinition: null,
  stage1Paused: false,
  stage2State: 'ANALYZING' as Stage2State,
  dynamicQuestions: [],
  collectedInfo: [],
  stage2Messages: [],
  personalizedPlan: null,
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
    set({
      currentStage: 'STAGE_0_INTRODUCTION', // 保持在Stage 0，不要立即跳转
      userInitialInput: initialInput,
      stage0Messages: [],
      isLoading: true, // 显示loading状态
    });
  },
  
  addStage0Message: (message: ChatMessage) => {
    set((state) => ({
      stage0Messages: [...state.stage0Messages, message],
    }));
  },
  
  completeStage0: () => {
    set({
      currentStage: 'STAGE_1_CLARIFICATION',
    });
  },
  
  completeStage0WithMission: (mission: ClarifiedMission, aiMessage?: string) => {
    set({
      currentStage: 'STAGE_1_CLARIFICATION',
      clarifiedMission: mission,
      stage1Messages: aiMessage ? [{
        id: `msg-${Date.now()}-ai`,
        role: 'assistant' as const,
        content: aiMessage,
        timestamp: Date.now(),
        metadata: { stage: 'STAGE_1_CLARIFICATION' as const, type: 'info' as const },
      }] : [],
      isLoading: false,
    });
  },
  
  // ========== Stage 1 Actions ==========
  
  addStage1Message: (message: ChatMessage) => {
    set((state) => ({
      stage1Messages: [...state.stage1Messages, message],
    }));
  },
  
  updateClarifiedMission: (mission: Partial<ClarifiedMission>) => {
    set((state) => ({
      clarifiedMission: state.clarifiedMission ? {
        ...state.clarifiedMission,
        ...mission,
      } : null,
    }));
  },
  
  completeStage1: (mission: ClarifiedMission) => {
    set({
      clarifiedMission: mission,
      currentStage: 'STAGE_2_CONFIRMATION',
    });
  },
  
  // ========== Stage 2 Actions ==========
  
  setConfirmationState: (state: ConfirmationState) => {
    set({ confirmationState: state });
  },
  
  confirmAndProceed: () => {
    set({
      currentStage: 'STAGE_3_FRAMEWORK',
      stage3Loading: true,
    });
  },
  
  rejectAndRefine: (feedback?: string) => {
    set({
      currentStage: 'STAGE_1_CLARIFICATION',
      confirmationState: feedback ? {
        ...get().confirmationState!,
        userConfirmed: false,
        feedback,
      } : null,
    });
  },
  
  // ========== Stage 3 Actions ==========
  
  setUniversalFramework: (framework: UniversalFramework) => {
    set({
      universalFramework: framework,
      stage3Loading: false,
    });
  },
  
  completeStage3: () => {
    set({
      currentStage: 'STAGE_4_PERSONALIZATION_CHOICE',
    });
  },
  
  // ========== Stage 4 Actions ==========
  
  setPersonalizationChoice: (choice: PersonalizationChoice) => {
    set({ personalizationChoice: choice });
  },
  
  choosePersonalization: () => {
    set({
      currentStage: 'STAGE_5_6_DIAGNOSTIC',
      stage56State: 'ANALYZING_WEIGHTS',
    });
  },
  
  skipPersonalization: () => {
    set({
      currentStage: 'COMPLETED',
    });
  },
  
  // ========== Stage 5-6 Actions ==========
  
  setStage56State: (state: Stage56State) => {
    set({ stage56State: state });
  },
  
  setWeightAnalysis: (analysis: WeightAnalysis) => {
    set({
      weightAnalysis: analysis,
      stage56State: 'QUESTIONING',
    });
  },
  
  setDiagnosticQuestions: (questions: DiagnosticQuestion[]) => {
    set({ diagnosticQuestions: questions });
  },
  
  addStage56Message: (message: ChatMessage) => {
    set((state) => ({
      stage56Messages: [...state.stage56Messages, message],
    }));
  },
  
  addStage56Answer: (info: UserContextInfo) => {
    set((state) => ({
      stage56CollectedInfo: [...state.stage56CollectedInfo, info],
    }));
  },
  
  completeStage56: () => {
    set({
      currentStage: 'STAGE_7_PERSONALIZED_PLAN',
      stage56State: 'COMPLETED',
    });
  },
  
  // ========== Stage 7 Actions ==========
  
  setPersonalizedActionFramework: (framework: PersonalizedActionFramework) => {
    set({ personalizedActionFramework: framework });
  },
  
  completeFlow: () => {
    set({
      currentStage: 'COMPLETED',
    });
  },
  
  // ========== 向后兼容 Actions（废弃，仅用于过渡） ==========
  
  updatePurposeDefinition: (definition: Partial<PurposeDefinition>) => {
    set((state) => ({
      purposeDefinition: state.purposeDefinition ? {
        ...state.purposeDefinition,
        ...definition,
      } : null,
    }));
  },
  
  pauseAtStage1: () => {
    // 在新架构中不需要pause
  },
  
  continueFromStage1: () => {
    set({
      currentStage: 'STAGE_4_PERSONALIZATION_CHOICE',
    });
  },
  
  setStage2State: (state: Stage2State) => {
    set({ stage2State: state });
  },
  
  setDynamicQuestions: (questions: DynamicQuestion[]) => {
    set({ dynamicQuestions: questions });
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
    set({ personalizedPlan: plan });
  },
  
  completeWithoutStage2: () => {
    set({
      currentStage: 'COMPLETED',
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
    
    switch (currentStage) {
      case 'STAGE_1_CLARIFICATION':
        set({ currentStage: 'STAGE_0_INTRODUCTION' });
        break;
      case 'STAGE_2_CONFIRMATION':
        set({ currentStage: 'STAGE_1_CLARIFICATION' });
        break;
      case 'STAGE_3_FRAMEWORK':
        set({ currentStage: 'STAGE_2_CONFIRMATION' });
        break;
      case 'STAGE_4_PERSONALIZATION_CHOICE':
        set({ currentStage: 'STAGE_3_FRAMEWORK' });
        break;
      case 'STAGE_5_6_DIAGNOSTIC':
        set({ currentStage: 'STAGE_4_PERSONALIZATION_CHOICE' });
        break;
      case 'STAGE_7_PERSONALIZED_PLAN':
        set({ currentStage: 'STAGE_5_6_DIAGNOSTIC' });
        break;
      default:
        break;
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
      name: 'cognitive-coach-session-v3',
      version: 2, // 🔥 强制清除旧session数据
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
        
        // Stage 0-7 状态
        userInitialInput: state.userInitialInput,
        stage0Messages: state.stage0Messages,
        clarifiedMission: state.clarifiedMission,
        stage1Messages: state.stage1Messages,
        confirmationState: state.confirmationState,
        universalFramework: state.universalFramework,
        personalizationChoice: state.personalizationChoice,
        stage56State: state.stage56State,
        weightAnalysis: state.weightAnalysis,
        diagnosticQuestions: state.diagnosticQuestions,
        stage56Messages: state.stage56Messages,
        stage56CollectedInfo: state.stage56CollectedInfo,
        personalizedActionFramework: state.personalizedActionFramework,
        
        sessionSavedAt: Date.now(),
        // 不持久化临时状态
        // isLoading: false,
        // error: null,
        // stage3Loading: false
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

