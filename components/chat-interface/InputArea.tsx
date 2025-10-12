'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InputAreaProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export function InputArea({
  onSend,
  placeholder = '输入你的回答...',
  disabled = false,
  maxLength = 2000,
}: InputAreaProps) {
  const [input, setInput] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  // 自动调整高度
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);
  
  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
      
      // 重置高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter 或 Cmd+Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };
  
  const remainingChars = maxLength - input.length;
  const isNearLimit = remainingChars < 100;
  
  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div
        className={cn(
          'relative border rounded-lg transition-all',
          isFocused ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* 文本输入区域 */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={1}
          className={cn(
            'w-full px-4 py-3 pr-24 resize-none',
            'focus:outline-none',
            'min-h-[50px] max-h-[200px]',
            'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100'
          )}
        />
        
        {/* 发送按钮 */}
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          {isNearLimit && (
            <span
              className={cn(
                'text-xs',
                remainingChars < 0 ? 'text-red-500' : 'text-gray-400'
              )}
            >
              {remainingChars}
            </span>
          )}
          
          <Button
            onClick={handleSend}
            disabled={disabled || !input.trim() || remainingChars < 0}
            size="sm"
            className="h-8"
          >
            发送
          </Button>
        </div>
      </div>
      
      {/* 提示文本 */}
      <div className="mt-2 text-xs text-gray-400 flex justify-between">
        <span>按 Ctrl+Enter 快速发送</span>
        {!isNearLimit && (
          <span>{input.length} / {maxLength}</span>
        )}
      </div>
    </div>
  );
}

