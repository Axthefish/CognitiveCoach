"use client"

import React from 'react';
import { Lightbulb } from 'lucide-react';

interface MicroLearningTipProps {
  tip: string;
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
  className?: string;
}

export function MicroLearningTip({ tip, stage, className }: MicroLearningTipProps) {
  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'S0':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          border: 'border-purple-200 dark:border-purple-800',
          icon: 'text-purple-600 dark:text-purple-400',
          text: 'text-purple-800 dark:text-purple-200',
          title: 'text-purple-900 dark:text-purple-100'
        };
      case 'S1':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400',
          text: 'text-blue-800 dark:text-blue-200',
          title: 'text-blue-900 dark:text-blue-100'
        };
      case 'S2':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          icon: 'text-green-600 dark:text-green-400',
          text: 'text-green-800 dark:text-green-200',
          title: 'text-green-900 dark:text-green-100'
        };
      case 'S3':
        return {
          bg: 'bg-orange-50 dark:bg-orange-900/20',
          border: 'border-orange-200 dark:border-orange-800',
          icon: 'text-orange-600 dark:text-orange-400',
          text: 'text-orange-800 dark:text-orange-200',
          title: 'text-orange-900 dark:text-orange-100'
        };
      default:
        return {
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          border: 'border-amber-200 dark:border-amber-800',
          icon: 'text-amber-600 dark:text-amber-400',
          text: 'text-amber-800 dark:text-amber-200',
          title: 'text-amber-900 dark:text-amber-100'
        };
    }
  };

  const colors = getStageColor(stage);

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg p-4 animate-fade-in ${className || ''}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <Lightbulb className={`w-5 h-5 ${colors.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${colors.title} mb-2`}>
            💡 学习小贴士
          </h4>
          <p className={`text-sm ${colors.text} leading-relaxed`}>
            {tip}
          </p>
        </div>
      </div>
      
      {/* 装饰性动画点 */}
      <div className="flex justify-center mt-3 space-x-1">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 ${colors.bg} rounded-full animate-pulse`}
            style={{
              animationDelay: `${i * 0.3}s`,
              animationDuration: '1.5s'
            }}
          />
        ))}
      </div>
    </div>
  );
}
