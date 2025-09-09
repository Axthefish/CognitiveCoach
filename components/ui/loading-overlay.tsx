'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import { getTipsForStage, LoadingTip } from '@/lib/loading-tips';
import { CognitiveCatalystAnimation } from './cognitive-catalyst-animation';
import { NeuralNetworkAnimation } from './neural-network-animation';
import { EnhancedProgressIndicator } from './enhanced-progress-indicator';
import { AIThinkingVisualization } from './ai-thinking-visualization';

interface LoadingOverlayProps {
  variant?: 'blocking' | 'inline';
  message?: string;
  stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
  showTips?: boolean;
  estimatedSteps?: number;
  onRetry?: () => void; // 添加重试回调
}

const STAGE_LABELS = {
  S0: '目标校准',
  S1: '知识框架',
  S2: '系统动力学',
  S3: '行动计划',
  S4: '自主运营',
};

// Custom hook for smooth number animation
function useSmoothedNumber(target: number | null, speed = 0.18, frameMs = 16): number | null {
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const elapsed = timestamp - lastTimeRef.current;
    
    if (elapsed >= frameMs) {
      setDisplayValue(prevValue => {
        if (target === null) return null;
        if (prevValue === null) return target;
        
        const delta = target - prevValue;
        if (Math.abs(delta) < 0.5) {
          return target; // Snap to target when close enough
        }
        
        return prevValue + delta * speed;
      });
      
      lastTimeRef.current = timestamp;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [target, speed, frameMs]);

  useEffect(() => {
    if (target === null) {
      setDisplayValue(null);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = 0;
    };
  }, [target, animate]);

  return displayValue;
}

export function LoadingOverlay({
  variant = 'inline',
  message,
  stage,
  showTips = true,
  estimatedSteps, // eslint-disable-line @typescript-eslint/no-unused-vars
  onRetry, // eslint-disable-line @typescript-eslint/no-unused-vars
}: LoadingOverlayProps) {
  const { streaming, userContext } = useCognitiveCoachStore();
  
  // Track phase cycling state
  const phaseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTip, setCurrentTip] = useState<LoadingTip | null>(null);
  const [showTip, setShowTip] = useState(true);
  
  // S0 phases state (no soft progress - using real progress only)
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [showLongWaitHelper, setShowLongWaitHelper] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const [useCognitiveCatalyst, setUseCognitiveCatalyst] = useState(false);
  const [catalystStage, setCatalystStage] = useState('');
  const [animationMode, setAnimationMode] = useState<'orbit' | 'catalyst' | 'neural' | 'thinking'>('orbit');
  
  // S0 phases definition - memoized to prevent re-creation
  const s0Phases = useMemo(() => [
    { id: 'parse', label: '解析输入' },
    { id: 'extract', label: '抽取要点' },
    { id: 'draft', label: '生成候选' }
  ], []);
  
  const s0PhaseMessages = [
    "正在为你理解目标与上下文…",
    "正在抽取目标中的关键要素与边界…",
    "正在生成更明确、可执行的目标候选…"
  ];

  // Get tips for the stage
  const stageTips = getTipsForStage(stage);

  // Controlled crossfade tips rotation
  useEffect(() => {
    if (!showTips || stageTips.length === 0) {
      setCurrentTip(null);
      return;
    }

    // Initialize with first tip
    setCurrentTip(stageTips[0]);
    setShowTip(true);

    if (stageTips.length <= 1) return; // No need to rotate if only one tip

    let tipIndex = 0;
    const interval = setInterval(() => {
      // Start crossfade: fade out current tip
      setShowTip(false);
      
      // After fade out, change tip and fade in
      setTimeout(() => {
        tipIndex = (tipIndex + 1) % stageTips.length;
        setCurrentTip(stageTips[tipIndex]);
        setShowTip(true);
      }, 200); // 200ms fade out duration
    }, 4500); // 4.5s interval

    return () => clearInterval(interval);
  }, [stageTips, showTips]);

  // Handle streaming tip changes with crossfade
  useEffect(() => {
    if (streaming.microLearningTip && streaming.microLearningTip !== currentTip?.text) {
      // Crossfade to new streaming tip
      setShowTip(false);
      setTimeout(() => {
        setCurrentTip({ text: streaming.microLearningTip! }); // Non-null assertion since we checked above
        setShowTip(true);
      }, 200);
    }
  }, [streaming.microLearningTip, currentTip?.text]);

  // Decide which animation mode to use
  useEffect(() => {
    if (stage === 'S0' && userContext.userGoal && userContext.userGoal.trim().length > 0) {
      // For S0 with user goal, use a deterministic selection based on stage
      setAnimationMode('catalyst');
      setUseCognitiveCatalyst(true);
    } else if (stage === 'S1' || stage === 'S2') {
      // For S1 and S2, use neural animation
      setAnimationMode('neural');
      setUseCognitiveCatalyst(false);
    } else if (stage === 'S3' || stage === 'S4') {
      // For S3 and S4, use thinking animation
      setAnimationMode('thinking');
      setUseCognitiveCatalyst(false);
    } else {
      // Default orbit animation
      setAnimationMode('orbit');
      setUseCognitiveCatalyst(false);
    }
  }, [stage, userContext.userGoal]);

  // S0 phase cycling with intelligent stopping - only recreate timers when stage changes
  useEffect(() => {
    if (stage !== 'S0') {
      setPhaseIndex(0);
      setShowLongWaitHelper(false);
      setUseCognitiveCatalyst(false);
      return;
    }

    let cycleCount = 0;
    const maxCycles = 10; // Prevent infinite cycling - max 30 seconds of cycling
    
    // Cycle through phases every 1400-2000ms, but stop after reasonable attempts
    const phaseInterval = setInterval(() => {
      // Check if we have real progress from streaming - if so, stop phase cycling
      if (streaming.cognitiveSteps && streaming.cognitiveSteps.length > 0) {
        clearInterval(phaseInterval);
        phaseIntervalRef.current = null;
        return;
      }
      
      cycleCount++;
      
      // Stop cycling after max attempts to prevent infinite loop
      if (cycleCount >= maxCycles) {
        clearInterval(phaseInterval);
        phaseIntervalRef.current = null;
        // Hold on the last phase instead of continuing to cycle
        setPhaseIndex(s0Phases.length - 1);
        return;
      }
      
      setPhaseIndex(prevIndex => (prevIndex + 1) % s0Phases.length);
    }, 1700); // Fixed interval instead of random

    phaseIntervalRef.current = phaseInterval;

    // Show helper text after 5 seconds
    const helperTimer = setTimeout(() => {
      setShowLongWaitHelper(true);
    }, 5000);

    // No more fake progress - using real progress from cognitive steps only

    return () => {
      clearInterval(phaseInterval);
      clearTimeout(helperTimer);
      phaseIntervalRef.current = null;
    };
  }, [stage, s0Phases.length, streaming.cognitiveSteps]); // Include cognitiveSteps for proper dependency tracking

  // Stop phase cycling immediately when real progress starts
  useEffect(() => {
    if (stage === 'S0' && streaming.cognitiveSteps && streaming.cognitiveSteps.length > 0) {
      if (phaseIntervalRef.current) {
        clearInterval(phaseIntervalRef.current);
        phaseIntervalRef.current = null;
        console.log('🛑 LoadingOverlay: Stopping phase cycling - real progress detected');
      }
    }
  }, [stage, streaming.cognitiveSteps]); // Include full cognitiveSteps for proper dependency tracking

  // Monitor network status for UX feedback
  useEffect(() => {
    const onlineHandler = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
      setReconnectAttempts(0);
    };
    
    const offlineHandler = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      setReconnectAttempts(prev => prev + 1);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
      }
    };
  }, []);

  // 计算真实步骤进度
  const steps = streaming.cognitiveSteps;
  const total = steps.length;
  const completed = steps.filter(s => s.status === 'completed').length;
  const inProgress = steps.filter(s => s.status === 'in_progress').length;
  
  // Real progress calculation only - no fake progress
  const realProgress = total > 0 ? Math.min(99, Math.round(((completed + inProgress * 0.5) / total) * 100)) : null;
  
  // Use real progress for all stages
  const targetProgress = realProgress;
  
  // Use smooth animation for progress display
  const displayProgress = useSmoothedNumber(targetProgress);
  const progress = displayProgress;
  
  // 获取当前进行中的步骤
  const currentMsg = steps.find(s => s.status === 'in_progress')?.message;

  // Use streaming tip if available, otherwise use rotating tips
  const displayTip = streaming.microLearningTip || currentTip?.text;

  // Default message based on stage（S1→S2 合并体验的友好文案）
  const defaultMessage = stage
    ? (stage === 'S1' && !userContext.systemDynamics
        ? '正在为你构建完整学习蓝图（知识框架 + 系统动力学）…'
        : `正在为你进行${STAGE_LABELS[stage]}分析...`)
    : '正在为你准备中...';

  // Determine final message with priority order
  let finalMessage: string;
  if (currentMsg) {
    // S1-S3 in-progress step exists - use its message (unchanged)
    finalMessage = currentMsg;
  } else if (stage === 'S0' && useCognitiveCatalyst && catalystStage) {
    // S0 with Cognitive Catalyst - use catalyst stage message
    finalMessage = catalystStage;
  } else if (stage === 'S0' && progress === null) {
    // S0 soft phases active - show phase-specific message
    finalMessage = s0PhaseMessages[phaseIndex];
  } else {
    // Fallback to provided message or default
    finalMessage = message || defaultMessage;
  }

  // 移除内部错误浮层，错误交给上层统一显示，避免与加载态冲突
  const ErrorOverlay = () => null;

  const LoadingContent = () => (
    <div className="relative flex flex-col items-center space-y-4 max-w-xs mx-auto">
      {/* 错误浮层 */}
      <ErrorOverlay />
      
      {/* Render animation based on mode */}
      {animationMode === 'catalyst' && stage === 'S0' && userContext.userGoal ? (
        <CognitiveCatalystAnimation
          userGoal={userContext.userGoal}
          onStageChange={setCatalystStage}
        />
      ) : animationMode === 'neural' ? (
        <div className="mb-4">
          <NeuralNetworkAnimation
            isActive={true}
            message={finalMessage}
            stage={stage === 'S0' ? 'parsing' : stage === 'S1' ? 'analyzing' : 'synthesizing'}
          />
        </div>
      ) : animationMode === 'thinking' && stage ? (
        <AIThinkingVisualization
          stage={stage}
          userGoal={userContext.userGoal}
          isThinking={true}
        />
      ) : (
        <>
          {/* Default orbit indicator with pulse ring */}
          <div className="relative">
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 pulse-ring" />
            
            {/* Orbit container */}
            <div className="relative w-8 h-8">
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

          {/* Stage chip */}
          {stage && (
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
              {STAGE_LABELS[stage]}
            </div>
          )}

          {/* S0 soft phases stepper - only shown when S0 and no real progress */}
          {stage === 'S0' && progress === null && (
            <div className="flex items-center space-x-2">
              {s0Phases.map((phase, index) => (
                <div
                  key={phase.id}
                  className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-all duration-300 ${
                    index === phaseIndex
                      ? 'bg-blue-500 text-white shadow-md'
                      : index < phaseIndex
                      ? 'bg-blue-200 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {index + 1}
                </div>
              ))}
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
        </>
      )}

      {/* Enhanced Progress Indicator - 包裹在固定宽度容器中 */}
      {progress !== null && (
        <div className="w-full max-w-xs mx-auto">
          <EnhancedProgressIndicator
            progress={progress}
            stage={finalMessage}
            variant={animationMode === 'neural' ? 'circular' : animationMode === 'thinking' ? 'wave' : 'linear'}
            showMilestones={stage === 'S0'}
          />
        </div>
      )}

      {/* Tips carousel + goal-based micro-learning */}
      {(showTips && displayTip) || (userContext.userGoal && userContext.userGoal.length > 8) ? (
        <div className="max-w-xs text-center space-y-2">
          {showTips && displayTip && (
            <div 
              className="text-xs text-gray-500 dark:text-gray-400 transition-opacity duration-300 ease-out"
              style={{opacity: showTip ? 1 : 0}}
            >
              💡 {displayTip}
            </div>
          )}
          {userContext.userGoal && (
            <div className="text-[11px] text-gray-400 dark:text-gray-500">
              <div className="mb-1">与“{userContext.userGoal.slice(0, 18)}{userContext.userGoal.length > 18 ? '…' : ''}”相关的思考：</div>
              <ul className="space-y-1">
                <li>• 用一句话定义成功：你怎么判断已达到目标？</li>
                <li>• 识别一个关键障碍：它出现在哪个环节？</li>
                <li>• 找到一个可立即执行的小步骤：今天能做什么？</li>
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* S0 long wait helper */}
      {stage === 'S0' && progress === null && showLongWaitHelper && (
        <div className="max-w-xs text-center">
          <div className="text-xs text-gray-400 dark:text-gray-500 opacity-75">
            可能需要 5–10 秒，请稍候；也可改写输入以加速
          </div>
        </div>
      )}

      {/* Enhanced network status with offline messaging */}
      {stage === 'S0' && (
        <div className="text-center">
          {showOfflineMessage && !isOnline ? (
            <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
                <div className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  网络连接中断
                </div>
              </div>
              <div className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                正在尝试重新连接... {reconnectAttempts > 1 && `(第 ${reconnectAttempts} 次)`}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-gray-400 dark:text-gray-500">
              网络状态：{isOnline ? '在线' : '离线'}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // 现在总是显示LoadingContent，错误以浮层形式显示
  const ContentComponent = LoadingContent;

  if (variant === 'blocking') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl p-8 shadow-2xl border border-white/20 dark:border-gray-700/30 max-w-sm mx-4">
          <ContentComponent />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-6">
      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-200/50 dark:border-gray-700/50">
        <ContentComponent />
      </div>
    </div>
  );
}
