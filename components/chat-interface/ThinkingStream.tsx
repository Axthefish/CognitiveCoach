/**
 * ThinkingStream - 实时展示AI思考过程
 * 类似ChatGPT的streaming效果
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ThinkingStreamProps {
  thinkingText: string; // 累积的思考文本
  isComplete?: boolean; // 是否完成
}

export const ThinkingStream = React.memo(function ThinkingStream({ 
  thinkingText, 
  isComplete = false 
}: ThinkingStreamProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // 自动滚动到底部
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [thinkingText]);
  
  if (!thinkingText) return null;
  
  return (
    <motion.div
      className="flex justify-start w-full mb-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg px-4 py-3 shadow-lg max-w-[85%]">
        <div className="flex items-start gap-3">
          {/* 思考图标 */}
          {!isComplete && (
            <div className="flex gap-1 mt-1 flex-shrink-0">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          
          {isComplete && (
            <span className="text-green-600 text-lg mt-0.5">✓</span>
          )}
          
          {/* 思考内容 */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-2">
              <span>🧠 AI思考过程</span>
              {!isComplete && (
                <motion.span
                  className="inline-block w-1 h-3 bg-blue-600"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </div>
            <div 
              ref={containerRef}
              className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto prose prose-sm"
            >
              {thinkingText}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

