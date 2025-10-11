'use client';

import React, { useEffect, useState, useRef } from 'react';

interface EnhancedProgressIndicatorProps {
  progress: number;
  stage?: string;
  showMilestones?: boolean;
  variant?: 'linear' | 'circular' | 'wave';
}

export function EnhancedProgressIndicator({
  progress,
  stage,
  showMilestones = true,
  variant = 'wave'
}: EnhancedProgressIndicatorProps) {
  const [displayProgress, setDisplayProgress] = useState(progress);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const prevProgressRef = useRef(progress);

  // Smooth progress animation - 避免重置和跳跃
  useEffect(() => {
    // 如果进度值真的发生了变化（非组件重新挂载）
    if (prevProgressRef.current !== progress) {
      const timer = setTimeout(() => {
        setDisplayProgress(progress);
      }, 50); // 缩短延迟，使动画更流畅
      prevProgressRef.current = progress;
      return () => clearTimeout(timer);
    } else if (displayProgress !== progress) {
      // 组件重新挂载但progress相同时，直接同步
      setDisplayProgress(progress);
    }
  }, [progress, displayProgress]);

  // Pulse effect on progress change - 仅在实际变化时触发
  useEffect(() => {
    if (prevProgressRef.current !== progress && progress > 0) {
      setPulseIntensity(1);
      const timer = setTimeout(() => setPulseIntensity(0), 300);
      return () => clearTimeout(timer);
    }
  }, [progress]);

  // Milestones for different stages
  const milestones = [
    { position: 25, label: '理解' },
    { position: 50, label: '分析' },
    { position: 75, label: '综合' },
    { position: 100, label: '完成' }
  ];

  if (variant === 'circular') {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (displayProgress / 100) * circumference;

    return (
      <div className="relative w-32 h-32 mx-auto">
        <svg className="transform -rotate-90 w-32 h-32">
          {/* Background circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          
          {/* Progress circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-blue-500 transition-all duration-500 ease-out"
            style={{
              filter: `drop-shadow(0 0 ${6 * pulseIntensity}px rgba(59, 130, 246, 0.6))`
            }}
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            {Math.round(displayProgress)}%
          </span>
          {stage && (
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stage}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'wave') {
    return (
      <div className="relative w-full text-center">
        {/* Wave container */}
        <div className="relative h-20 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          {/* Animated wave */}
          <div
            className="absolute bottom-0 left-0 w-full transition-all duration-500 ease-out"
            style={{ height: `${displayProgress}%` }}
          >
            {/* Wave layers for depth */}
            <div className="absolute inset-0 opacity-30">
              <svg className="w-full h-full" preserveAspectRatio="none">
                <path
                  d={`M0,10 Q${displayProgress / 4},0 ${displayProgress / 2},10 T${displayProgress},10 L${displayProgress},100 L0,100 Z`}
                  fill="url(#wave-gradient-1)"
                  className="animate-wave"
                />
              </svg>
            </div>
            
            <div className="absolute inset-0 opacity-50">
              <svg className="w-full h-full" preserveAspectRatio="none">
                <path
                  d={`M0,15 Q${displayProgress / 3},5 ${displayProgress / 1.5},15 T${displayProgress},15 L${displayProgress},100 L0,100 Z`}
                  fill="url(#wave-gradient-2)"
                  className="animate-wave-slow"
                />
              </svg>
            </div>
            
            <div className="absolute inset-0">
              <svg className="w-full h-full" preserveAspectRatio="none">
                <path
                  d={`M0,20 Q${displayProgress / 2},10 ${displayProgress},20 L${displayProgress},100 L0,100 Z`}
                  fill="url(#wave-gradient-3)"
                />
              </svg>
            </div>
          </div>

          {/* SVG definitions */}
          <svg width="0" height="0">
            <defs>
              <linearGradient id="wave-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
              <linearGradient id="wave-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="wave-gradient-3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
          </svg>

          {/* Progress text overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                {Math.round(displayProgress)}%
              </span>
              {stage && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {stage}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Milestones */}
        {showMilestones && (
          <div className="relative mt-2">
            <div className="absolute inset-0 flex justify-between">
              {milestones.map((milestone) => (
                <div
                  key={milestone.position}
                  className={`text-xs transition-all duration-300 ${
                    displayProgress >= milestone.position
                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-400 dark:text-gray-600'
                  }`}
                  style={{ left: `${milestone.position}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        displayProgress >= milestone.position
                          ? 'bg-blue-600 dark:bg-blue-400 scale-125'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                    <span className="mt-1">{milestone.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default linear variant
  return (
    <div className="relative w-full text-center">
      {/* Progress bar background */}
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {/* Animated stripes background */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full bg-stripe-pattern animate-stripe-scroll" />
        </div>
        
        {/* Progress bar fill */}
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
          style={{
            width: `${displayProgress}%`,
            boxShadow: `0 0 ${10 * pulseIntensity}px rgba(59, 130, 246, 0.5)`
          }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* Progress text */}
      <div className="flex justify-between items-center mt-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {stage || '处理中'}
        </span>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {Math.round(displayProgress)}%
        </span>
      </div>
    </div>
  );
}

// Add CSS for custom animations
const styleSheet = `
  @keyframes wave {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  @keyframes wave-slow {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  @keyframes stripe-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(20px); }
  }
  
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .animate-wave {
    animation: wave 3s linear infinite;
  }
  
  .animate-wave-slow {
    animation: wave-slow 4s linear infinite;
  }
  
  .animate-stripe-scroll {
    animation: stripe-scroll 1s linear infinite;
  }
  
  .animate-shimmer {
    animation: shimmer 2s linear infinite;
  }
  
  .bg-stripe-pattern {
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(0, 0, 0, 0.1) 10px,
      rgba(0, 0, 0, 0.1) 20px
    );
  }
`;

// Inject styles
if (typeof window !== 'undefined' && !document.getElementById('enhanced-progress-styles')) {
  const style = document.createElement('style');
  style.id = 'enhanced-progress-styles';
  style.textContent = styleSheet;
  document.head.appendChild(style);
}
