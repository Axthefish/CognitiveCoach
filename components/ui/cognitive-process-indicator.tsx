"use client"

import React from 'react';
import { Check, Loader2, X } from 'lucide-react';

// 认知步骤状态
type CognitiveStepStatus = 'pending' | 'in_progress' | 'completed' | 'error';

interface CognitiveStep {
  id: string;
  message: string;
  status: CognitiveStepStatus;
  timestamp?: number;
}

interface CognitiveProcessIndicatorProps {
  steps: CognitiveStep[];
  className?: string;
}

export function CognitiveProcessIndicator({ steps, className }: CognitiveProcessIndicatorProps) {
  const getStepIcon = (status: CognitiveStepStatus) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'error':
        return <X className="w-4 h-4 text-red-600" />;
      default:
        return (
          <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
        );
    }
  };

  const getStepStyle = (status: CognitiveStepStatus) => {
    const baseStyle = "flex items-center space-x-3 p-3 rounded-lg transition-all duration-300";
    
    switch (status) {
      case 'completed':
        return `${baseStyle} bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800`;
      case 'in_progress':
        return `${baseStyle} bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 shadow-sm`;
      case 'error':
        return `${baseStyle} bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800`;
      default:
        return `${baseStyle} bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700`;
    }
  };

  const getTextStyle = (status: CognitiveStepStatus) => {
    switch (status) {
      case 'completed':
        return "text-green-800 dark:text-green-200 font-medium";
      case 'in_progress':
        return "text-blue-800 dark:text-blue-200 font-medium";
      case 'error':
        return "text-red-800 dark:text-red-200 font-medium";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        🧠 AI 认知过程
      </h3>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={step.id} className={getStepStyle(step.status)}>
            <div className="flex-shrink-0">
              {getStepIcon(step.status)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${getTextStyle(step.status)}`}>
                {step.message}
              </p>
              {step.status === 'in_progress' && (
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              )}
            </div>
            <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
              {index + 1}/{steps.length}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
