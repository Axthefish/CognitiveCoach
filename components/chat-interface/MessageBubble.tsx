'use client';

import React from 'react';
import type { ChatMessage } from '@/lib/types-v2';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: ChatMessage;
}

// 使用React.memo避免不必要的重渲染
export const MessageBubble = React.memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  return (
    <div
      className={cn(
        'flex w-full mb-4 animate-fade-in',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3 shadow-sm',
          isUser && 'bg-blue-600 text-white',
          isSystem && 'bg-gray-100 text-gray-700 border border-gray-200',
          !isUser && !isSystem && 'bg-white text-gray-900 border border-gray-200'
        )}
      >
        {/* 消息内容 */}
        <div className="prose prose-sm max-w-none">
          <MessageContent content={message.content} />
        </div>
        
        {/* 时间戳 */}
        <div
          className={cn(
            'text-xs mt-2',
            isUser ? 'text-blue-100' : 'text-gray-400'
          )}
        >
          {formatTimestamp(message.timestamp)}
        </div>
        
        {/* 元数据标签（调试用） */}
        {message.metadata?.type && process.env.NODE_ENV === 'development' && (
          <div className="text-xs mt-1 opacity-50">
            [{message.metadata.type}]
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================
// 消息内容渲染（支持简单markdown）
// ============================================

function MessageContent({ content }: { content: string }) {
  // 简单的 markdown 渲染
  const lines = content.split('\n');
  
  return (
    <>
      {lines.map((line, index) => {
        // 列表项
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return (
            <li key={index} className="ml-4">
              {line.trim().substring(2)}
            </li>
          );
        }
        
        // 数字列表
        const numberMatch = line.trim().match(/^(\d+)\.\s+(.+)$/);
        if (numberMatch) {
          return (
            <div key={index} className="flex gap-2">
              <span className="font-semibold">{numberMatch[1]}.</span>
              <span>{numberMatch[2]}</span>
            </div>
          );
        }
        
        // 加粗文本 **text**
        const boldLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // 普通段落
        return (
          <p
            key={index}
            dangerouslySetInnerHTML={{ __html: boldLine }}
            className={line.trim() === '' ? 'h-2' : ''}
          />
        );
      })}
    </>
  );
}

// ============================================
// 工具函数
// ============================================

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  // 如果是今天，只显示时间
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  // 否则显示日期和时间
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

