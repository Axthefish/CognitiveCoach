'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { validateChatMessage, ValidationError } from '@/lib/input-validator';

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
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  // 自动调整高度
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);
  
  // 清除验证错误
  React.useEffect(() => {
    if (validationError && input.trim()) {
      setValidationError(null);
    }
  }, [input, validationError]);
  
  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      try {
        // 验证输入
        const validated = validateChatMessage(trimmed);
        onSend(validated);
        setInput('');
        setValidationError(null);
        
        // 重置高度
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          setValidationError(error.message);
        } else {
          setValidationError('输入格式有误，请重新输入');
        }
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
          aria-label="消息输入框"
          aria-invalid={!!validationError}
          aria-describedby={validationError ? 'input-error' : 'input-hint'}
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
            aria-label="发送消息"
            title="发送消息（Ctrl+Enter）"
          >
            发送
          </Button>
        </div>
      </div>
      
      {/* 验证错误 */}
      {validationError && (
        <div 
          id="input-error" 
          role="alert" 
          className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded"
        >
          ⚠️ {validationError}
        </div>
      )}
      
      {/* 提示文本 */}
      {!validationError && (
        <div 
          id="input-hint" 
          className="mt-2 text-xs text-gray-400 flex justify-between"
        >
          <span>按 Ctrl+Enter 快速发送</span>
          {!isNearLimit && (
            <span aria-label={`已输入${input.length}个字符，最多${maxLength}个字符`}>
              {input.length} / {maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

