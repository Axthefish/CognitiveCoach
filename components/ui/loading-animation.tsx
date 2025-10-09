'use client';

import React from 'react';

interface LoadingAnimationProps {
  variant?: 'orbit' | 'pulse' | 'simple';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

/**
 * 统一的加载动画组件
 * 
 * 简化版设计：
 * - orbit: 轨道旋转动画（默认）
 * - pulse: 脉冲呼吸动画
 * - simple: 简单spinner
 * 
 * 移除了复杂的Canvas动画和粒子系统，保持性能和可维护性
 */
export function LoadingAnimation({
  variant = 'orbit',
  size = 'md',
  message,
}: LoadingAnimationProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const containerSize = sizeClasses[size];

  // Orbit variant - 三个点的轨道旋转
  if (variant === 'orbit') {
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 pulse-ring" />
          
          {/* Orbit container */}
          <div className={`relative ${containerSize}`}>
            <div className="absolute inset-0 orbit" style={{ animationDelay: '0s' }}>
              <div className="absolute top-0 left-1/2 w-2 h-2 -ml-1 bg-blue-500 rounded-full orbit-dot" />
            </div>
            <div className="absolute inset-0 orbit" style={{ animationDelay: '0.4s' }}>
              <div className="absolute top-0 left-1/2 w-2 h-2 -ml-1 bg-blue-400 rounded-full orbit-dot" />
            </div>
            <div className="absolute inset-0 orbit" style={{ animationDelay: '0.8s' }}>
              <div className="absolute top-0 left-1/2 w-2 h-2 -ml-1 bg-blue-300 rounded-full orbit-dot" />
            </div>
          </div>
        </div>
        
        {message && (
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200 text-center max-w-xs">
            {message}
          </div>
        )}
      </div>
    );
  }

  // Pulse variant - 脉冲呼吸动画
  if (variant === 'pulse') {
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          {/* Central pulse */}
          <div className={`relative ${containerSize} flex items-center justify-center`}>
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-pulse opacity-40" />
            <div className="relative w-4 h-4 bg-blue-600 rounded-full" />
          </div>
        </div>
        
        {message && (
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200 text-center max-w-xs">
            {message}
          </div>
        )}
      </div>
    );
  }

  // Simple variant - 简单spinner
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className={`${containerSize} border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin`} />
      
      {message && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200 text-center max-w-xs">
          {message}
        </div>
      )}
    </div>
  );
}

/**
 * 阶段特定的加载动画
 * 为不同阶段提供适当的视觉反馈
 */
export function StageLoadingAnimation({
  stage,
  message,
}: {
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
  message?: string;
}) {
  const stageLabels = {
    S0: '目标校准',
    S1: '知识框架',
    S2: '系统动力学',
    S3: '行动计划',
    S4: '自主运营',
  };

  const stageColors = {
    S0: 'bg-purple-500',
    S1: 'bg-blue-500',
    S2: 'bg-green-500',
    S3: 'bg-orange-500',
    S4: 'bg-amber-500',
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Stage badge */}
      <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
        {stageLabels[stage]}
      </div>
      
      {/* Animation */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 pulse-ring" />
        
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 orbit">
            <div className={`absolute top-0 left-1/2 w-2 h-2 -ml-1 ${stageColors[stage]} rounded-full orbit-dot`} />
          </div>
          <div className="absolute inset-0 orbit" style={{ animationDelay: '0.4s' }}>
            <div className={`absolute top-0 left-1/2 w-2 h-2 -ml-1 ${stageColors[stage]} opacity-70 rounded-full orbit-dot`} />
          </div>
          <div className="absolute inset-0 orbit" style={{ animationDelay: '0.8s' }}>
            <div className={`absolute top-0 left-1/2 w-2 h-2 -ml-1 ${stageColors[stage]} opacity-50 rounded-full orbit-dot`} />
          </div>
        </div>
      </div>
      
      {message && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200 text-center max-w-xs">
          {message}
        </div>
      )}
    </div>
  );
}

// CSS animations are defined in globals.css
// These components rely on existing Tailwind animations and custom CSS

