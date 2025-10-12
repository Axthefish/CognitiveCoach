'use client';

import React from 'react';
import type { FrameworkNode } from '@/lib/types-v2';
import { getWeightLabel, getWeightIcon, getColorScheme } from './color-scheme';

interface NodeTooltipProps {
  node: FrameworkNode;
  visible: boolean;
  position?: { x: number; y: number };
}

/**
 * 节点详情提示组件
 * 
 * 可以作为自定义 tooltip 使用，提供比 ECharts 默认 tooltip 更丰富的展示
 */
export function NodeTooltip({ node, visible, position }: NodeTooltipProps) {
  if (!visible) return null;
  
  const colorScheme = getColorScheme(node.color);
  const weightLabel = getWeightLabel(node.weight);
  const icon = getWeightIcon(node.weight);
  
  const style: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: position.x + 20,
        top: position.y - 50,
        zIndex: 9999,
      }
    : {};
  
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-w-sm animate-fade-in"
      style={style}
    >
      {/* 标题栏 */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: colorScheme.primary }}
        />
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900">{node.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">{icon} {weightLabel}</span>
            <span className="text-sm font-medium" style={{ color: colorScheme.primary }}>
              {node.weight}%
            </span>
          </div>
        </div>
      </div>
      
      {/* 描述 */}
      <p className="text-sm text-gray-700 mb-3 leading-relaxed">
        {node.description}
      </p>
      
      {/* 元数据 */}
      <div className="space-y-2 text-sm">
        {/* 预计时间 */}
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-gray-600">预计时间: {node.estimatedTime}</span>
        </div>
        
        {/* 权重明细 */}
        {node.weightBreakdown && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="text-xs text-gray-500 mb-1">权重构成:</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-gray-400">必要性</div>
                <div className="font-medium">{Math.round(node.weightBreakdown.necessity * 100)}%</div>
              </div>
              <div>
                <div className="text-gray-400">影响力</div>
                <div className="font-medium">{Math.round(node.weightBreakdown.impact * 100)}%</div>
              </div>
              <div>
                <div className="text-gray-400">性价比</div>
                <div className="font-medium">{Math.round(node.weightBreakdown.timeROI * 100)}%</div>
              </div>
            </div>
          </div>
        )}
        
        {/* 前置依赖 */}
        {node.dependencies.length > 0 && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="text-xs text-gray-500 mb-1">前置依赖:</div>
            <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
              {node.dependencies.map((dep, index) => (
                <li key={index}>{dep}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 简化版提示气泡
 */
export function SimpleNodeTooltip({ node }: { node: FrameworkNode }) {
  const colorScheme = getColorScheme(node.color);
  const icon = getWeightIcon(node.weight);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: colorScheme.primary }}>{icon}</span>
        <h4 className="font-semibold text-sm">{node.title}</h4>
      </div>
      <p className="text-xs text-gray-600">{node.description}</p>
      <div className="mt-2 text-xs text-gray-400">
        预计: {node.estimatedTime} | 权重: {node.weight}%
      </div>
    </div>
  );
}

