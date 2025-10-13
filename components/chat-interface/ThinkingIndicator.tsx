'use client';

import React from 'react';

interface ThinkingIndicatorProps {
  message?: string;
  progress?: number; // 0-100，可选的进度百分比
  showProgress?: boolean; // 是否显示进度条
  estimatedTime?: string; // 预计时间（如"30-45秒"）
}

export const ThinkingIndicator = React.memo(function ThinkingIndicator({ 
  message = 'AI is thinking...', 
  progress,
  showProgress = false,
  estimatedTime,
}: ThinkingIndicatorProps) {
  return (
    <div className="flex justify-start w-full mb-4">
      <div className="bg-white/95 backdrop-blur-sm border border-blue-200 rounded-lg px-4 py-3 shadow-lg max-w-[85%]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {/* 动画点点点 */}
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            
            {/* 提示文本 */}
            <span className="text-sm text-gray-700 font-medium flex-1">{message}</span>
            
            {/* 进度百分比 */}
            {showProgress && progress !== undefined && (
              <span className="text-xs text-blue-600 font-bold">
                {progress}%
              </span>
            )}
          </div>
          
          {/* 进度条 */}
          {showProgress && progress !== undefined && (
            <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          
          {/* 预计时间 */}
          {estimatedTime && (
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <span>⏱️</span>
              <span>预计需要 {estimatedTime}</span>
            </div>
          )}
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

