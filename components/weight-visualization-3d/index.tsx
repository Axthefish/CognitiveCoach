/**
 * 3D可视化组件导出（契约文件 - 空实现）
 * 
 * 这些组件由Agent B实现，此处提供空实现供Agent A使用
 */

'use client';

import React from 'react';
import type { 
  WeightTerrain3DProps, 
  ComparisonViewProps,
  NodeDetailPanelProps,
  QuestionNodeLinkProps 
} from './types';

// 导出类型
export type { 
  WeightTerrain3DProps, 
  ComparisonViewProps,
  NodeDetailPanelProps,
  QuestionNodeLinkProps 
};

/**
 * 主3D权重地形图组件（空实现）
 */
export const WeightTerrain3D: React.FC<WeightTerrain3DProps> = () => {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900/50 rounded-lg border border-gray-700">
      <p className="text-gray-400">3D Visualization Loading...</p>
    </div>
  );
};

/**
 * 对比视图组件（空实现）
 */
export const ComparisonView: React.FC<ComparisonViewProps> = () => {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900/50 rounded-lg border border-gray-700">
      <p className="text-gray-400">Comparison View Loading...</p>
    </div>
  );
};

/**
 * 节点详情面板（空实现）
 */
export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = () => {
  return null;
};

/**
 * 问题-节点关联（空实现）
 */
export const QuestionNodeLink: React.FC<QuestionNodeLinkProps> = () => {
  return null;
};

