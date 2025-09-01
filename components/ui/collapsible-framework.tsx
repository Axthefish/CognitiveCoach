"use client"

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FrameworkNode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CollapsibleFrameworkProps {
  framework: FrameworkNode[];
  className?: string;
}

interface CollapsibleNodeProps {
  node: FrameworkNode;
  depth?: number;
  pathPrefix?: string;
}

// 全局唯一ID生成器 - 使用闭包确保唯一性
const createIdGenerator = () => {
  let counter = 0;
  const sessionId = typeof window !== 'undefined' 
    ? `${Date.now()}_${Math.random().toString(36).slice(2)}`
    : 'ssr';
  
  return (prefix: string) => {
    return `${prefix}_${sessionId}_${++counter}`;
  };
};

const generateId = createIdGenerator();

// 单个可折叠节点组件 - 不使用任何Accordion组件
const CollapsibleNode: React.FC<CollapsibleNodeProps> = ({ 
  node, 
  depth = 0, 
  pathPrefix = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const nodeId = generateId(`node_${node.id}_d${depth}`);
  const currentPath = pathPrefix ? `${pathPrefix}/${node.id}` : node.id;
  
  // 防止过深的嵌套
  if (depth > 8) {
    return (
      <div className="p-3 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded">
        <em>内容层级过深，已省略显示</em>
      </div>
    );
  }
  
  // 安全的文本转换
  const toText = (v: unknown): string => {
    if (typeof v === 'string') return v;
    if (v == null) return '';
    try { 
      return JSON.stringify(v); 
    } catch { 
      return String(v); 
    }
  };
  
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  
  return (
    <div 
      key={nodeId}
      id={nodeId}
      className={cn(
        "border rounded-lg transition-all duration-200",
        depth === 0 ? "mb-3" : "mb-2",
        depth > 0 && "ml-4 bg-gray-50/50 dark:bg-gray-800/30"
      )}
      data-node-id={node.id}
      data-depth={depth}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700/50",
          "rounded-t-lg transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        )}
        aria-expanded={isOpen}
        aria-controls={`${nodeId}-content`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-2">
            <h3 className={cn(
              "font-medium",
              depth === 0 ? "text-base" : "text-sm"
            )}>
              {toText(node.title)}
            </h3>
          </div>
          <ChevronDown 
            className={cn(
              "w-4 h-4 text-gray-500 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>
      
      {isOpen && (
        <div 
          id={`${nodeId}-content`}
          className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {toText(node.summary)}
          </p>
          
          {/* 证据信息 */}
          {node.evidence && node.evidence.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                相关证据：
              </h4>
              <ul className="space-y-1">
                {node.evidence.map((ev, idx) => (
                  <li key={`${nodeId}_ev_${idx}`} className="text-xs text-gray-500 dark:text-gray-400">
                    • {ev.source} {ev.date && `(${ev.date})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* 递归渲染子节点 */}
          {hasChildren && (
            <div className="mt-3 space-y-2">
              {node.children!.map((child, index) => (
                <CollapsibleNode
                  key={`${nodeId}_child_${index}_${child.id}`}
                  node={child}
                  depth={depth + 1}
                  pathPrefix={currentPath}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 主框架组件
export function CollapsibleFramework({ framework, className }: CollapsibleFrameworkProps) {
  if (!framework || framework.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>正在生成知识框架...</p>
      </div>
    );
  }
  
  return (
    <div className={cn("w-full", className)}>
      {framework.map((node, index) => (
        <CollapsibleNode
          key={`root_${index}_${node.id}`}
          node={node}
          depth={0}
        />
      ))}
    </div>
  );
}

// 导出子组件以供单独使用
export { CollapsibleNode };
