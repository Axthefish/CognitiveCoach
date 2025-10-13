/**
 * 玻璃态卡片组件
 * 支持不同优先级和动画效果
 */

'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type Priority = 'primary' | 'secondary' | 'tertiary';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'priority'> {
  priority?: Priority;
  hover?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

/**
 * 玻璃态卡片组件
 * 
 * @example
 * <GlassCard priority="primary" hover glow>
 *   <h2>标题</h2>
 *   <p>内容</p>
 * </GlassCard>
 */
export function GlassCard({
  priority = 'secondary',
  hover = false,
  glow = false,
  children,
  className,
  ...props
}: GlassCardProps) {
  const priorityClasses = {
    primary: 'glass-card-primary',
    secondary: 'glass-card-secondary',
    tertiary: 'glass-card-tertiary',
  };
  
  return (
    <motion.div
      className={cn(
        priorityClasses[priority],
        'rounded-xl relative overflow-hidden',
        glow && 'shadow-[0_0_30px_rgba(102,126,234,0.3)]',
        className
      )}
      whileHover={hover ? { y: -4, scale: 1.02 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      {...props}
    >
      {glow && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-purple-600/10 opacity-0 pointer-events-none"
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
      {children}
    </motion.div>
  );
}

/**
 * 玻璃态卡片头部
 */
export function GlassCardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-6 py-4 border-b border-white/10', className)}>
      {children}
    </div>
  );
}

/**
 * 玻璃态卡片内容
 */
export function GlassCardContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>;
}

/**
 * 玻璃态卡片底部
 */
export function GlassCardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-6 py-4 border-t border-white/10', className)}>
      {children}
    </div>
  );
}

/**
 * 带图标的玻璃态卡片
 */
export function GlassCardWithIcon({
  icon,
  title,
  description,
  children,
  priority = 'secondary',
  iconColor = 'text-blue-400',
  ...props
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  priority?: Priority;
  iconColor?: string;
} & Omit<HTMLMotionProps<'div'>, 'priority'>) {
  return (
    <GlassCard priority={priority} hover {...props}>
      <GlassCardHeader>
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br from-white/10 to-white/5',
              iconColor
            )}
          >
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && (
              <p className="text-sm text-gray-300 mt-1">{description}</p>
            )}
          </div>
        </div>
      </GlassCardHeader>
      {children && <GlassCardContent>{children}</GlassCardContent>}
    </GlassCard>
  );
}

