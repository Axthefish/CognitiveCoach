/**
 * CollapsibleThinking - Cursor风格的可折叠thinking展示
 * 
 * 设计特点：
 * - 灰色小字，默认展开
 * - 可折叠，点击展开/收起
 * - streaming显示，实时追加文本
 * - 几乎0延迟开始显示
 */

'use client';

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleThinkingProps {
  thinkingText: string;
  isStreaming: boolean; // 是否正在streaming
}

export const CollapsibleThinking = React.memo(function CollapsibleThinking({ 
  thinkingText,
  isStreaming,
}: CollapsibleThinkingProps) {
  const [isExpanded, setIsExpanded] = React.useState(true); // 默认展开
  
  if (!thinkingText && !isStreaming) return null;
  
  return (
    <div className="flex justify-start w-full mb-2">
      <div className="max-w-[90%] rounded-lg border border-gray-200/50 bg-gray-50/40">
        {/* Header: 可点击展开/收起 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-100/50 transition-colors rounded-t-lg"
        >
          {/* 折叠图标 */}
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )}
          
          {/* "Thinking" 标签 */}
          <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wide">
            Thinking
          </span>
          
          {/* streaming指示器 - Cursor风格跳动动画 */}
          {isStreaming && (
            <div className="flex items-center gap-0.5 ml-auto">
              <div 
                className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" 
                style={{ animationDuration: '1s', animationDelay: '0ms' }}
              />
              <div 
                className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" 
                style={{ animationDuration: '1s', animationDelay: '150ms' }}
              />
              <div 
                className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" 
                style={{ animationDuration: '1s', animationDelay: '300ms' }}
              />
            </div>
          )}
        </button>
        
        {/* Content: thinking文本 */}
        {isExpanded && (
          <div className="px-3 py-2 border-t border-gray-200/30">
            <div className="text-[11px] text-gray-500 leading-relaxed font-mono whitespace-pre-wrap">
              {thinkingText}
              {/* Cursor风格的闪烁光标 */}
              {isStreaming && (
                <span className="inline-block w-[2px] h-3 bg-gray-400 ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

