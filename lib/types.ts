export interface State {
  id: "S0" | "S1" | "S2" | "S3" | "S4"
  name: string
}

// 从 schemas 和 store 导出的类型（统一来源）
export type { 
  FSMState,
  UserContext 
} from './store';

export type {
  FrameworkNode,
  KnowledgeFramework,
  ActionItem,
  ActionPlan
} from './schemas';
