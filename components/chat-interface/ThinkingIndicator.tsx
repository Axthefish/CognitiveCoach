'use client';

import React from 'react';

interface ThinkingIndicatorProps {
  message?: string;
}

export function ThinkingIndicator({ message = 'AI 正在思考...' }: ThinkingIndicatorProps) {
  return (
    <div className="flex justify-start w-full mb-4">
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm max-w-[80%]">
        <div className="flex items-center gap-3">
          {/* 动画点点点 */}
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          
          {/* 提示文本 */}
          <span className="text-sm text-gray-600">{message}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 打字机效果组件（用于流式输出）
// ============================================

interface TypewriterTextProps {
  text: string;
  speed?: number; // 每个字符的延迟（毫秒）
  onComplete?: () => void;
}

export function TypewriterText({ text, speed = 30, onComplete }: TypewriterTextProps) {
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
}

