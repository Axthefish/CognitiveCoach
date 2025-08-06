import { create } from 'zustand';

// FSM状态定义
export type FSMState = 
  | 'S0_INTENT_CALIBRATION'
  | 'S1_KNOWLEDGE_FRAMEWORK'
  | 'S2_SYSTEM_DYNAMICS'
  | 'S3_ACTION_PLAN'
  | 'S4_AUTONOMOUS_OPERATION';

// 知识框架节点接口（根据ReconstructReport.md中的定义）
export interface FrameworkNode {
  id: string;
  title: string;
  summary: string;
  children?: FrameworkNode[];
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
  } | null;
  actionPlan: ActionPlan | null;
  kpis: string[] | null;
  goalConversationHistory: ConversationMessage[]; // Added for S0 conversation tracking
}

// Store接口
interface CognitiveCoachStore {
  // 状态
  currentState: FSMState;
  userContext: UserContext;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentState: (state: FSMState) => void;
  updateUserContext: (updates: Partial<UserContext>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetStore: () => void;
}

// 初始状态
const initialUserContext: UserContext = {
  userGoal: '',
  knowledgeFramework: null,
  systemDynamics: null,
  actionPlan: null,
  kpis: null,
  goalConversationHistory: [],
};

// 创建Zustand store
export const useCognitiveCoachStore = create<CognitiveCoachStore>((set) => ({
  // 初始状态
  currentState: 'S0_INTENT_CALIBRATION',
  userContext: initialUserContext,
  isLoading: false,
  error: null,
  
  // Actions
  setCurrentState: (state) => set({ currentState: state }),
  
  updateUserContext: (updates) => 
    set((state) => ({
      userContext: { ...state.userContext, ...updates }
    })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  resetStore: () => 
    set({
      currentState: 'S0_INTENT_CALIBRATION',
      userContext: initialUserContext,
      isLoading: false,
      error: null
    }),
}));