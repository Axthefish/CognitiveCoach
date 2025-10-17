'use client';

/**
 * QuestionNodeLink: 问题-节点关联可视化
 * 
 * 使用场景：Stage 5-6右侧问题列表
 * 显示每个问题影响的节点，点击后在3D场景中高亮
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { QuestionNodeLinkProps } from './types';

export const QuestionNodeLink: React.FC<QuestionNodeLinkProps> = ({
  questionId: _questionId,
  affectedNodeIds,
  onNodeClick,
  className,
}) => {
  if (affectedNodeIds.length === 0) return null;
  
  return (
    <div className={cn("flex flex-wrap gap-2 items-center", className)}>
      <span className="text-gray-400 text-sm flex items-center gap-1">
        <span className="text-blue-400">📍</span> 
        Affects:
      </span>
      <div className="flex flex-wrap gap-2">
        {affectedNodeIds.map(nodeId => (
          <button
            key={nodeId}
            onClick={() => onNodeClick?.(nodeId)}
            className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50 rounded-md text-blue-300 text-sm transition-all hover:scale-105 active:scale-95"
            title={`点击在3D场景中高亮节点: ${nodeId}`}
          >
            {nodeId}
          </button>
        ))}
      </div>
    </div>
  );
};

