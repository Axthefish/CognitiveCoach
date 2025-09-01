"use client";

import React from 'react';
import { FrameworkNode } from '@/lib/types';

interface SimpleFrameworkProps {
  framework: FrameworkNode[];
}

// 极简的框架展示组件 - 完全避免任何可能导致hydration问题的复杂逻辑
export function SimpleFramework({ framework }: SimpleFrameworkProps) {
  if (!framework || framework.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>正在生成知识框架...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {framework.map((node, index) => (
        <FrameworkNodeDisplay key={`root-${index}`} node={node} depth={0} />
      ))}
    </div>
  );
}

// 单个节点的显示组件 - 使用details/summary原生HTML元素
function FrameworkNodeDisplay({ node, depth }: { node: FrameworkNode; depth: number }) {
  // 防止过深嵌套
  if (depth > 5) {
    return (
      <div className="text-sm text-gray-500 italic pl-4">
        (更多内容...)
      </div>
    );
  }
  
  const hasChildren = node.children && node.children.length > 0;
  
  return (
    <details className="group">
      <summary className="cursor-pointer select-none p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <span className="font-medium">{node.title || '未命名节点'}</span>
      </summary>
      <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {node.summary || '暂无描述'}
        </p>
        {hasChildren && (
          <div className="space-y-2">
            {node.children!.map((child, idx) => (
              <FrameworkNodeDisplay 
                key={`${node.id}-child-${idx}`} 
                node={child} 
                depth={depth + 1} 
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
