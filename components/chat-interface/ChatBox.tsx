'use client';

import React from 'react';
import type { ChatMessage } from '@/lib/types-v2';
import { MessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ThinkingStream } from './ThinkingStream';
import { InputArea } from './InputArea';
import { cn } from '@/lib/utils';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isThinking?: boolean;
  thinkingMessage?: string;
  thinkingProgress?: number; // 思考进度 0-100（模拟用）
  showThinkingProgress?: boolean; // 是否显示进度条（模拟用）
  thinkingText?: string; // 🆕 真实的thinking文本流
  estimatedTime?: string; // 预计时间
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatBox({
  messages,
  onSendMessage,
  isThinking = false,
  thinkingMessage,
  thinkingProgress,
  showThinkingProgress = false,
  thinkingText,
  estimatedTime,
  disabled = false,
  placeholder,
  className,
}: ChatBoxProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);
  
  // 自动滚动到底部
  const scrollToBottom = React.useCallback(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [shouldAutoScroll]);
  
  // 监听消息变化
  React.useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);
  
  // 检测用户是否手动滚动
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    setShouldAutoScroll(isNearBottom);
  };
  
  return (
    <div className={cn('flex flex-col h-full bg-gray-50', className)}>
      {/* 消息列表区域 */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <p className="text-lg mb-2">💬 开始对话</p>
              <p className="text-sm">请输入你的问题或目标</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* 🆕 优先显示真实thinking文本流 */}
            {isThinking && thinkingText && (
              <ThinkingStream 
                thinkingText={thinkingText}
              />
            )}
            
            {/* AI 思考指示器（降级或补充） */}
            {isThinking && !thinkingText && (
              <ThinkingIndicator 
                message={thinkingMessage} 
                progress={thinkingProgress}
                showProgress={showThinkingProgress}
                estimatedTime={estimatedTime}
              />
            )}
            
            {/* 滚动锚点 */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* 输入区域 */}
      <InputArea
        onSend={onSendMessage}
        disabled={disabled || isThinking}
        placeholder={placeholder}
      />
      
      {/* 返回底部按钮 */}
      {!shouldAutoScroll && (
        <button
          onClick={() => {
            setShouldAutoScroll(true);
            scrollToBottom();
          }}
          className="absolute bottom-24 right-8 bg-white border border-gray-300 rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors"
          aria-label="滚动到底部"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

