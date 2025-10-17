/**
 * 3D可视化系统导出
 * 
 * Agent B实现的3D可视化组件
 * Agent A调用这些组件构建UI
 */

// 核心组件
export { WeightTerrain3D } from './WeightTerrain3D';
export { ComparisonView } from './ComparisonView';
export { NodeDetailPanel } from './NodeDetailPanel';
export { QuestionNodeLink } from './QuestionNodeLink';

// 辅助工具
export { 
  calculateNode3DPositions, 
  getColorFromWeight,
  calculateBezierControlPoint 
} from './layout-algorithm';

export { SceneManager } from './three-scene-manager';
export { 
  createEntryAnimation, 
  AnimationTimeline,
  type AnimationStep 
} from './animation-timeline';
export { 
  InteractionHandler,
  type InteractionEvent,
  type InteractionEventType 
} from './interaction-handlers';

// 类型导出
export type {
  WeightTerrain3DProps,
  ComparisonViewProps,
  NodeDetailPanelProps,
  QuestionNodeLinkProps,
  Node3DMeshProps,
  EdgeLineProps,
  Scene3DContainerProps,
} from './types';

