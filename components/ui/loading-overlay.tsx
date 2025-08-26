'use client';

import React, { useState, useEffect } from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import { getTipsForStage, LoadingTip } from '@/lib/loading-tips';

interface LoadingOverlayProps {
  variant?: 'blocking' | 'inline';
  message?: string;
  stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
  showTips?: boolean;
  estimatedSteps?: number;
}

const STAGE_LABELS = {
  S0: '目标校准',
  S1: '知识框架',
  S2: '系统动力学',
  S3: '行动计划',
  S4: '自主运营',
};

export function LoadingOverlay({
  variant = 'inline',
  message,
  stage,
  showTips = true,
  estimatedSteps,
}: LoadingOverlayProps) {
  const { streaming } = useCognitiveCoachStore();
  const [currentTip, setCurrentTip] = useState<LoadingTip | null>(null);

  // Get tips for the stage
  const stageTips = getTipsForStage(stage);

  // Rotate tips every 2.5 seconds
  useEffect(() => {
    if (!showTips || stageTips.length === 0) return;

    // Initialize with first tip
    setCurrentTip(stageTips[0]);

    let tipIndex = 0;
    const interval = setInterval(() => {
      tipIndex = (tipIndex + 1) % stageTips.length;
      setCurrentTip(stageTips[tipIndex]);
    }, 2500);

    return () => clearInterval(interval);
  }, [stageTips, showTips]);

  // Calculate progress if estimatedSteps provided
  const progress = estimatedSteps && streaming.cognitiveSteps.length > 0 
    ? Math.min(95, Math.round((streaming.cognitiveSteps.length / estimatedSteps) * 100))
    : null;

  // Use streaming tip if available, otherwise use rotating tips
  const displayTip = streaming.microLearningTip || currentTip?.text;

  // Default message based on stage
  const defaultMessage = stage 
    ? `AI 正在进行${STAGE_LABELS[stage]}分析...`
    : 'AI 正在准备中...';

  const finalMessage = message || defaultMessage;

  const LoadingContent = () => (
    <div className="flex flex-col items-center space-y-4">
      {/* Orbit indicator with pulse ring */}
      <div className="relative">
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 pulse-ring" />
        
        {/* Orbit container */}
        <div className="relative w-8 h-8 orbit">
          <div className="absolute top-0 left-1/2 w-2 h-2 -ml-1 bg-blue-500 rounded-full orbit-dot" />
          <div className="absolute top-0 left-1/2 w-2 h-2 -ml-1 bg-blue-400 rounded-full orbit-dot" style={{ animationDelay: '0.4s' }} />
          <div className="absolute top-0 left-1/2 w-2 h-2 -ml-1 bg-blue-300 rounded-full orbit-dot" style={{ animationDelay: '0.8s' }} />
        </div>
      </div>

      {/* Stage chip */}
      {stage && (
        <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
          {STAGE_LABELS[stage]}
        </div>
      )}

      {/* Message with shimmer */}
      <div className="text-center">
        <div 
          className="text-sm font-medium text-gray-700 dark:text-gray-200 gradient-shimmer px-4 py-1 rounded"
          role="status"
          aria-live="polite"
        >
          {finalMessage}
        </div>
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div 
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
            {progress}%
          </div>
        </div>
      )}

      {/* Tips carousel */}
      {showTips && displayTip && (
        <div className="max-w-xs text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 animate-fade-in">
            💡 {displayTip}
          </div>
        </div>
      )}
    </div>
  );

  if (variant === 'blocking') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl p-8 shadow-2xl border border-white/20 dark:border-gray-700/30 max-w-sm mx-4">
          <LoadingContent />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-6">
      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-200/50 dark:border-gray-700/50">
        <LoadingContent />
      </div>
    </div>
  );
}
