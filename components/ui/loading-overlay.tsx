'use client';

import React from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import { getTipsForStage } from '@/lib/loading-tips';
import { LoadingAnimation, StageLoadingAnimation } from './loading-animation';
import { EnhancedProgressIndicator } from './enhanced-progress-indicator';
import { useNetworkStatus } from '@/components/hooks/useNetworkStatus';
import { useLoadingProgress } from '@/components/hooks/useLoadingProgress';

interface LoadingOverlayProps {
  variant?: 'blocking' | 'inline';
  message?: string;
  stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
  showTips?: boolean;
  onRetry?: () => void;
}

const STAGE_LABELS = {
  S0: '目标校准',
  S1: '知识框架',
  S2: '系统动力学',
  S3: '行动计划',
  S4: '自主运营',
};

/**
 * 统一的加载遮罩组件（重构版）
 * 
 * v1.9 优化：
 * - 从498行简化到约200行（减少60%）
 * - 移除复杂动画组件依赖（Canvas、粒子系统）
 * - 提取网络监控和进度计算到独立hooks
 * - 保留核心功能：进度显示、提示轮播、错误处理
 */
export function LoadingOverlay({
  variant = 'inline',
  message,
  stage,
  showTips = true,
}: LoadingOverlayProps) {
  const { streaming, userContext } = useCognitiveCoachStore();
  const { isOnline, reconnectAttempts, showOfflineMessage } = useNetworkStatus();
  const { progress, currentStepMessage } = useLoadingProgress(streaming.cognitiveSteps);
  
  // Tips轮播状态
  const [currentTipIndex, setCurrentTipIndex] = React.useState(0);
  const [showTip, setShowTip] = React.useState(true);
  
  const stageTips = getTipsForStage(stage);

  // Tips轮播逻辑
  React.useEffect(() => {
    if (!showTips || stageTips.length === 0) return;

    if (stageTips.length <= 1) {
      setCurrentTipIndex(0);
      setShowTip(true);
      return;
    }

    const interval = setInterval(() => {
      setShowTip(false);
      setTimeout(() => {
        setCurrentTipIndex((prev) => (prev + 1) % stageTips.length);
        setShowTip(true);
      }, 200);
    }, 4500);

    return () => clearInterval(interval);
  }, [stageTips, showTips]);

  // 使用流式tip覆盖轮播tip
  const displayTip = streaming.microLearningTip || stageTips[currentTipIndex]?.text;

  // 确定最终显示的消息
  const defaultMessage = stage
    ? (stage === 'S1' && !userContext.systemDynamics
        ? '正在为你构建完整学习蓝图（知识框架 + 系统动力学）…'
        : `正在为你进行${STAGE_LABELS[stage]}分析...`)
    : '正在为你准备中...';

  const finalMessage = currentStepMessage || message || defaultMessage;

  const LoadingContent = () => (
    <div className="relative flex flex-col items-center space-y-4 max-w-xs mx-auto">
      {/* 主加载动画 */}
      {stage ? (
        <StageLoadingAnimation stage={stage} message={finalMessage} />
      ) : (
        <LoadingAnimation variant="orbit" message={finalMessage} />
      )}

      {/* 进度指示器 */}
      {progress !== null && (
        <div className="w-full max-w-xs mx-auto">
          <EnhancedProgressIndicator
            progress={progress}
            stage={finalMessage}
            variant="linear"
            showMilestones={stage === 'S0'}
          />
        </div>
      )}

      {/* Tips展示 */}
      {showTips && displayTip && (
        <div 
          className="text-xs text-gray-500 dark:text-gray-400 transition-opacity duration-300 ease-out max-w-xs text-center"
          style={{ opacity: showTip ? 1 : 0 }}
        >
          💡 {displayTip}
        </div>
      )}

      {/* 目标关联的微学习提示 */}
      {userContext.userGoal && userContext.userGoal.length > 8 && (
        <div className="text-[11px] text-gray-400 dark:text-gray-500 max-w-xs">
          <div className="mb-1">
            与&quot;{userContext.userGoal.slice(0, 18)}{userContext.userGoal.length > 18 ? '…' : ''}&quot;相关的思考：
          </div>
          <ul className="space-y-1 text-left">
            <li>• 用一句话定义成功：你怎么判断已达到目标？</li>
            <li>• 识别一个关键障碍：它出现在哪个环节？</li>
            <li>• 找到一个可立即执行的小步骤：今天能做什么？</li>
          </ul>
        </div>
      )}

      {/* 网络状态提示（仅S0阶段） */}
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
