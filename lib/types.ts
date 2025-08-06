export interface State {
  id: "S0" | "S1" | "S2" | "S3" | "S4"
  name: string
}

// 从store导出的类型
export type { 
  FSMState, 
  FrameworkNode, 
  KnowledgeFramework, 
  ActionItem, 
  ActionPlan,
  UserContext 
} from './store';
