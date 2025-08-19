"use client"

import React, { useState, useEffect } from 'react';

interface TypewriterContentProps {
  content: string;
  speed?: number;
  showCursor?: boolean;
}

export function TypewriterContent({ 
  content, 
  speed = 30,
  showCursor = true 
}: TypewriterContentProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (currentIndex < content.length) {
      const timer = setTimeout(() => {
        setDisplayedContent(content.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [content, currentIndex, speed]);

  // 如果内容发生变化，重置打字机效果
  useEffect(() => {
    setDisplayedContent('');
    setCurrentIndex(0);
    setIsTyping(true);
  }, [content]);

  return (
    <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
      <span className="whitespace-pre-wrap">
        {displayedContent}
      </span>
      {showCursor && isTyping && (
        <span className="inline-block w-0.5 h-5 bg-blue-600 animate-pulse ml-0.5" />
      )}
      
      {/* 如果打字完成，显示完整内容（处理可能的显示差异） */}
      {!isTyping && displayedContent !== content && (
        <span className="whitespace-pre-wrap">
          {content.slice(displayedContent.length)}
        </span>
      )}
    </div>
  );
}
