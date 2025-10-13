/**
 * ThinkingStream - Cursor风格的streaming思考展示
 * 极简、清晰、专业
 */

'use client';

import React from 'react';

interface ThinkingStreamProps {
  thinkingText: string;
}

export const ThinkingStream = React.memo(function ThinkingStream({ 
  thinkingText 
}: ThinkingStreamProps) {
  if (!thinkingText) return null;
  
  return (
    <div className="flex justify-start w-full mb-2">
      <div className="bg-gray-50/80 rounded-lg px-3 py-2 max-w-[90%] border border-gray-200/50">
        <div className="flex items-start gap-2">
          {/* Cursor-style旋转图标 */}
          <div className="mt-0.5 flex-shrink-0">
            <svg className="w-3 h-3 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          </div>
          
          {/* 思考文本 - Cursor风格 */}
          <div className="flex-1 text-xs text-gray-600 leading-normal font-mono">
            {thinkingText}
            {/* Cursor-style闪烁光标 */}
            <span className="inline-block w-px h-3 bg-gray-400 ml-px animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
});

