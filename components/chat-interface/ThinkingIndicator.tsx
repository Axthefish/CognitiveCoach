'use client';

import React from 'react';

interface ThinkingIndicatorProps {
  message?: string;
  progress?: number; // 0-100，可选的进度百分比
  showProgress?: boolean; // 是否显示进度条
  estimatedTime?: string; // 预计时间（如"30-45秒"）
}

export const ThinkingIndicator = React.memo(function ThinkingIndicator({ 
  message = '...', 
}: ThinkingIndicatorProps) {
  return (
    <div className="flex justify-start w-full mb-2">
      <div className="bg-gray-50/80 rounded-lg px-3 py-2 border border-gray-200/50">
        <div className="flex items-center gap-2">
          {/* Cursor-style旋转图标 */}
          <svg className="w-3 h-3 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          
          {/* 极简文本 */}
          <span className="text-xs text-gray-500 font-mono">{message}</span>
        </div>
      </div>
    </div>
  );
});

// ============================================
// 打字机效果组件（用于流式输出）
// ============================================

interface TypewriterTextProps {
  text: string;
  speed?: number; // 每个字符的延迟（毫秒）
  onComplete?: () => void;
}

export const TypewriterText = React.memo(function TypewriterText({ text, speed = 30, onComplete }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);
  
  React.useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      
      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);
  
  return <span>{displayedText}</span>;
});

