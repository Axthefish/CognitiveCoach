/**
 * 骨架屏加载组件
 * 为不同内容类型提供加载状态占位符
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * 基础骨架组件
 */
export function Skeleton({
  className,
  variant = 'rectangular',
  animation = 'pulse',
}: SkeletonProps) {
  return (
    <motion.div
      className={cn(
        'bg-white/10 backdrop-blur-sm',
        animation === 'pulse' && 'animate-pulse',
        animation === 'wave' && 'skeleton',
        variant === 'text' && 'h-4 rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    />
  );
}

/**
 * 消息气泡骨架屏
 */
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={cn(
      'flex w-full mb-4',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      <div className={cn(
        'max-w-[80%] rounded-lg px-4 py-3 space-y-2',
        isUser ? 'glass-card-primary' : 'glass-card-secondary'
      )}>
        <Skeleton variant="text" className="w-48 h-3" />
        <Skeleton variant="text" className="w-32 h-3" />
        <Skeleton variant="text" className="w-40 h-3" />
      </div>
    </div>
  );
}

/**
 * 聊天界面骨架屏
 */
export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <MessageSkeleton isUser={false} />
      <MessageSkeleton isUser={true} />
      <MessageSkeleton isUser={false} />
    </div>
  );
}

/**
 * 框架图表骨架屏
 */
export function FrameworkSkeleton() {
  return (
    <div className="glass-card-primary rounded-xl p-6 space-y-4">
      {/* 标题 */}
      <div className="space-y-2">
        <Skeleton variant="text" className="w-32 h-6" />
        <Skeleton variant="text" className="w-48 h-4" />
      </div>
      
      {/* 图表区域 */}
      <div className="relative h-[400px] glass-card-secondary rounded-lg p-8">
        {/* 中心节点 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Skeleton variant="circular" className="w-24 h-24" />
        </div>
        
        {/* 周围节点 */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const x = Math.cos((angle * Math.PI) / 180) * 120;
          const y = Math.sin((angle * Math.PI) / 180) * 120;
          
          return (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/2"
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
            >
              <Skeleton variant="circular" className="w-16 h-16" />
            </motion.div>
          );
        })}
      </div>
      
      {/* 图例 */}
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton variant="circular" className="w-4 h-4" />
            <Skeleton variant="text" className="w-20 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 卡片骨架屏
 */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-card-primary rounded-xl p-6 space-y-4">
      <Skeleton variant="text" className="w-40 h-6" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            className={cn(
              'h-4',
              i === lines - 1 ? 'w-3/4' : 'w-full'
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 列表骨架屏
 */
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <motion.div
          key={i}
          className="glass-card-secondary rounded-lg p-4 flex items-start gap-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Skeleton variant="circular" className="w-12 h-12 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-3/4 h-4" />
            <Skeleton variant="text" className="w-full h-3" />
            <Skeleton variant="text" className="w-1/2 h-3" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * 表单骨架屏
 */
export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton variant="text" className="w-24 h-4" />
          <Skeleton variant="rectangular" className="w-full h-10" />
        </div>
      ))}
      <Skeleton variant="rectangular" className="w-32 h-10" />
    </div>
  );
}

