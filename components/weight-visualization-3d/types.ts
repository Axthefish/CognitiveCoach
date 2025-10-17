/**
 * 3D可视化组件的契约定义
 * 
 * 这个文件定义了所有3D可视化组件的Props接口
 * Agent B负责实现，Agent A负责调用
 */

import type React from 'react';
import type { 
  UniversalFramework, 
  DiagnosticQuestion, 
  Node3DRenderData,
  Scene3DConfig,
} from '@/lib/types-v2';

// ============================================
// 主组件Props
// ============================================

/**
 * WeightTerrain3D: 主3D可视化组件
 * 
 * 使用场景：
 * - Stage 3: 纯展示模式（自动旋转）
 * - Stage 5-6: 交互模式（高亮关联节点）
 * - Stage 7: 对比模式（双场景）
 */
export interface WeightTerrain3DProps {
  // 框架数据
  framework: UniversalFramework;
  
  // 诊断问题列表（Stage 5-6使用）
  questions?: DiagnosticQuestion[];
  
  // 节点选中回调
  onNodeSelect?: (nodeId: string) => void;
  
  // 高亮的问题ID列表（Stage 5-6使用）
  highlightedQuestionIds?: string[];
  
  // 场景配置（可选）
  config?: Partial<Scene3DConfig>;
  
  // 样式类名
  className?: string;
}

/**
 * ComparisonView: 对比视图（Stage 7使用）
 * 
 * 支持：
 * - 2D流程图对比
 * - 3D场景对比
 * - 分屏模式
 */
export interface ComparisonViewProps {
  // 通用框架
  universalFramework: UniversalFramework;
  
  // 个性化框架
  personalizedFramework: UniversalFramework;
  
  // 视图模式
  viewMode: '2d' | '3d' | 'split';
  
  // 视图模式切换回调
  onViewModeChange?: (mode: '2d' | '3d' | 'split') => void;
  
  // 样式类名
  className?: string;
}

/**
 * NodeDetailPanel: 节点详情面板
 * 
 * 显示：
 * - 节点标题、描述
 * - 权重详情
 * - 权重维度分解
 * - 预计时间
 */
export interface NodeDetailPanelProps {
  // 节点数据（null表示无选中）
  node: Node3DRenderData | null;
  
  // 是否打开
  isOpen: boolean;
  
  // 关闭回调
  onClose: () => void;
  
  // 样式类名
  className?: string;
}

/**
 * QuestionNodeLink: 问题-节点关联可视化
 * 
 * 用于Stage 5-6右侧问题列表，显示每个问题影响的节点
 */
export interface QuestionNodeLinkProps {
  // 问题ID
  questionId: string;
  
  // 影响的节点ID列表
  affectedNodeIds: string[];
  
  // 节点点击回调（触发3D场景高亮）
  onNodeClick?: (nodeId: string) => void;
  
  // 样式类名
  className?: string;
}

// ============================================
// 内部子组件Props（供实现时使用）
// ============================================

/**
 * Node3DMesh: 3D节点网格
 */
export interface Node3DMeshProps {
  // 节点数据
  data: Node3DRenderData;
  
  // 是否高亮
  isHighlighted?: boolean;
  
  // 是否选中
  isSelected?: boolean;
  
  // 选中回调
  onSelect?: () => void;
}

/**
 * EdgeLine: 边连接线
 */
export interface EdgeLineProps {
  // 边数据
  edge: {
    from: string;
    to: string;
    type: 'required' | 'recommended' | 'optional';
    strength: number;
  };
  
  // 起点节点
  fromNode?: Node3DRenderData;
  
  // 终点节点
  toNode?: Node3DRenderData;
}

/**
 * Scene3DContainer: 3D场景容器
 */
export interface Scene3DContainerProps {
  // 子元素
  children?: React.ReactNode;
  
  // 场景配置
  config?: Partial<Scene3DConfig>;
  
  // 样式类名
  className?: string;
}

