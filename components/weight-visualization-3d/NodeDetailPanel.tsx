'use client';

/**
 * NodeDetailPanel: 节点详情面板
 * 
 * 显示节点的详细信息：
 * - 标题、描述
 * - 权重及其维度分解
 * - 预计时间
 * - 依赖关系
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeDetailPanelProps } from './types';
import { getColorFromWeight } from './layout-algorithm';

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  node,
  isOpen,
  onClose,
  className,
}) => {
  if (!isOpen || !node) return null;
  
  const baseNode = node.baseNode;
  const color = getColorFromWeight(baseNode.weight);
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed right-0 top-0 h-full w-96 bg-gray-900/95 backdrop-blur-lg border-l border-gray-700 shadow-2xl overflow-y-auto z-50",
          className
        )}
      >
        <div className="p-6">
          {/* 关闭按钮 */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
          
          {/* 标题 */}
          <h3 className="text-2xl font-bold text-white mb-2 pr-10">
            {baseNode.title}
          </h3>
          
          {/* 节点类型标签 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">
              {baseNode.nodeType}
            </span>
            <span 
              className="px-2 py-1 text-xs rounded font-semibold"
              style={{ 
                backgroundColor: `${color}40`, 
                color: color 
              }}
            >
              {baseNode.color}
            </span>
          </div>
          
          {/* 权重 */}
          <div className="mb-6 p-4 bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-lg border border-blue-500/30">
            <label className="text-gray-400 text-sm block mb-2">权重 Weight</label>
            <div className="flex items-end gap-2">
              <div 
                className="text-5xl font-bold"
                style={{ color }}
              >
                {baseNode.weight}
              </div>
              <div className="text-2xl text-gray-400 mb-1">%</div>
            </div>
            
            {/* 权重条 */}
            <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${baseNode.weight}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
          
          {/* 权重维度分解 */}
          {baseNode.weightBreakdown && (
            <div className="mb-6">
              <label className="text-gray-400 text-sm block mb-3">权重维度分解</label>
              <div className="space-y-3">
                <WeightDimension
                  label="Necessity"
                  labelCN="必要性"
                  value={baseNode.weightBreakdown.necessity}
                  color="#3b82f6"
                />
                <WeightDimension
                  label="Impact"
                  labelCN="影响力"
                  value={baseNode.weightBreakdown.impact}
                  color="#8b5cf6"
                />
                <WeightDimension
                  label="Time ROI"
                  labelCN="时间投资回报"
                  value={baseNode.weightBreakdown.timeROI}
                  color="#10b981"
                />
              </div>
            </div>
          )}
          
          {/* 描述 */}
          <div className="mb-6">
            <label className="text-gray-400 text-sm block mb-2">描述 Description</label>
            <p className="text-white leading-relaxed">{baseNode.description}</p>
          </div>
          
          {/* 预计时间 */}
          <div className="mb-6">
            <label className="text-gray-400 text-sm block mb-2">预计时间 Estimated Time</label>
            <div className="flex items-center gap-2 text-white">
              <span className="text-2xl">⏱️</span>
              <span className="text-lg font-semibold">{baseNode.estimatedTime}</span>
            </div>
          </div>
          
          {/* 依赖关系 */}
          {baseNode.dependencies.length > 0 && (
            <div className="mb-6">
              <label className="text-gray-400 text-sm block mb-3">
                依赖节点 Dependencies ({baseNode.dependencies.length})
              </label>
              <div className="space-y-2">
                {baseNode.dependencies.map(depId => (
                  <div 
                    key={depId}
                    className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center gap-2"
                  >
                    <span className="text-blue-400">→</span>
                    {depId}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 3D位置信息（调试用） */}
          {node.position3D && (
            <div className="mt-8 pt-6 border-t border-gray-800">
              <label className="text-gray-500 text-xs block mb-2">3D Position (Debug)</label>
              <div className="text-xs text-gray-600 font-mono">
                X: {node.position3D.x.toFixed(2)}, 
                Y: {node.position3D.y.toFixed(2)}, 
                Z: {node.position3D.z.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * WeightDimension: 权重维度条
 */
const WeightDimension: React.FC<{
  label: string;
  labelCN: string;
  value: number;
  color: string;
}> = ({ label, labelCN, value, color }) => {
  const percentage = Math.round(value * 100);
  
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-300">
          {label} <span className="text-gray-500">({labelCN})</span>
        </span>
        <span className="text-sm font-semibold" style={{ color }}>
          {percentage}%
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
};

