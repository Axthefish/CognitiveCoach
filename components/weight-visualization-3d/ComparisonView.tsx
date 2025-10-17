'use client';

/**
 * ComparisonView: 通用框架 vs 个性化框架对比视图
 * 
 * 使用场景：Stage 7
 * 
 * 支持三种视图模式：
 * - 2D: 2D流程图对比
 * - 3D: 3D场景对比
 * - split: 上下分屏
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { ComparisonViewProps } from './types';
import { WeightTerrain3D } from './WeightTerrain3D';

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  universalFramework,
  personalizedFramework,
  viewMode,
  onViewModeChange: _onViewModeChange,
  className,
}) => {
  // 2D视图模式
  if (viewMode === '2d') {
    return (
      <div className={cn("w-full h-full flex gap-4 p-4", className)}>
        {/* 左侧：通用框架 */}
        <div className="flex-1 flex flex-col bg-gray-900/50 rounded-lg border border-gray-700 p-4">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            通用框架
          </h3>
          <div className="flex-1 overflow-auto">
            <FrameworkNodeList framework={universalFramework} />
          </div>
        </div>
        
        {/* 右侧：个性化框架 */}
        <div className="flex-1 flex flex-col bg-gray-900/50 rounded-lg border border-gray-700 p-4">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
            个性化框架
          </h3>
          <div className="flex-1 overflow-auto">
            <FrameworkNodeList framework={personalizedFramework} />
          </div>
        </div>
      </div>
    );
  }
  
  // 3D视图模式（左右分屏）
  if (viewMode === '3d') {
    return (
      <div className={cn("w-full h-full flex gap-4", className)}>
        {/* 左侧：通用框架3D */}
        <div className="flex-1 flex flex-col">
          <div className="text-center py-2 bg-blue-500/20 border-b border-blue-500/50">
            <h3 className="text-sm font-bold text-blue-300">通用框架</h3>
          </div>
          <div className="flex-1">
            <WeightTerrain3D 
              framework={universalFramework} 
              config={{ autoRotate: false, showGrid: true }}
            />
          </div>
        </div>
        
        {/* 右侧：个性化框架3D */}
        <div className="flex-1 flex flex-col">
          <div className="text-center py-2 bg-purple-500/20 border-b border-purple-500/50">
            <h3 className="text-sm font-bold text-purple-300">个性化框架</h3>
          </div>
          <div className="flex-1">
            <WeightTerrain3D 
              framework={personalizedFramework}
              config={{ autoRotate: false, showGrid: true }}
            />
          </div>
        </div>
      </div>
    );
  }
  
  // split模式（上下分屏）
  return (
    <div className={cn("w-full h-full flex flex-col gap-4", className)}>
      {/* 上方：通用框架 */}
      <div className="flex-1 flex flex-col">
        <div className="text-center py-2 bg-blue-500/20 border-b border-blue-500/50">
          <h3 className="text-sm font-bold text-blue-300">通用框架</h3>
        </div>
        <div className="flex-1">
          <WeightTerrain3D 
            framework={universalFramework}
            config={{ autoRotate: false, showGrid: true }}
          />
        </div>
      </div>
      
      {/* 下方：个性化框架 */}
      <div className="flex-1 flex flex-col">
        <div className="text-center py-2 bg-purple-500/20 border-b border-purple-500/50">
          <h3 className="text-sm font-bold text-purple-300">个性化框架</h3>
        </div>
        <div className="flex-1">
          <WeightTerrain3D 
            framework={personalizedFramework}
            config={{ autoRotate: false, showGrid: true }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * FrameworkNodeList: 2D模式下的节点列表显示
 */
const FrameworkNodeList: React.FC<{ framework: import('@/lib/types-v2').UniversalFramework }> = ({ 
  framework 
}) => {
  // 按权重排序
  const sortedNodes = [...framework.nodes].sort((a, b) => b.weight - a.weight);
  
  return (
    <div className="space-y-3">
      {sortedNodes.map(node => {
        const color = node.weight >= 90 ? 'bg-blue-900/50 border-blue-500' :
                      node.weight >= 70 ? 'bg-blue-800/30 border-blue-600' :
                      node.weight >= 50 ? 'bg-blue-700/20 border-blue-700' :
                      'bg-gray-800/30 border-gray-600';
        
        return (
          <div 
            key={node.id} 
            className={cn(
              "p-3 rounded-lg border transition-all hover:scale-[1.02]",
              color
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-white">{node.title}</h4>
              <span className="text-sm font-bold text-blue-400 ml-2">{node.weight}%</span>
            </div>
            <p className="text-sm text-gray-300 mb-2">{node.description}</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>⏱️ {node.estimatedTime}</span>
              {node.dependencies.length > 0 && (
                <span>🔗 {node.dependencies.length} 依赖</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

