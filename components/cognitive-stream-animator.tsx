/**
 * CognitiveStreamAnimator - 流式处理动画组件
 * 
 * 职责：
 * - 协调流式处理的 UI 展示
 * - 管理组件的生命周期
 * - 提供用户友好的加载和进度反馈
 * 
 * 架构：
 * - 使用 useStreamState 管理状态
 * - 使用 useStreamConnection 管理流式连接
 * - 使用 streamMessageProcessor 处理消息
 * 
 * 重构历史：
 * - v1.8: 拆分为多个模块，提升可维护性和可测试性
 *   - hooks/useStreamState.ts: 状态管理
 *   - hooks/useStreamConnection.ts: 连接管理
 *   - utils/streamMessageProcessor.ts: 消息处理
 */

"use client"

import React, { useEffect } from 'react';
import { CognitiveProcessIndicator } from './ui/cognitive-process-indicator';
import { MicroLearningTip } from './ui/micro-learning-tip';
import { ContentSkeleton } from './ui/content-skeleton';
import { TypewriterContent } from './ui/typewriter-content';
import type { StreamResponseData } from '@/lib/schemas';

// 导入自定义 Hooks
import { useStreamState } from './hooks/useStreamState';
import { useStreamConnection } from './hooks/useStreamConnection';

// 声明全局变量类型以便调试
declare global {
  interface Window {
    __streamMessages?: Array<{
      timestamp: number;
      stage: string;
      message: unknown;
      rawLine: string;
      parsedJson: string;
      streamId?: string;
    }>;
    __streamErrors?: Array<{
      timestamp: number;
      stage: string;
      line: string;
      error: unknown;
    }>;
  }
}

export interface CognitiveStreamAnimatorProps {
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
  onComplete: (data: StreamResponseData) => void;
  onError: (error: string) => void;
  requestPayload: Record<string, unknown>;
}

/**
 * 流式处理动画组件
 * 
 * 显示认知处理步骤、微学习提示和实时内容
 */
export function CognitiveStreamAnimator({
  stage,
  onComplete,
  onError,
  requestPayload
}: CognitiveStreamAnimatorProps) {
  // 使用状态管理 Hook
  const { state, setState, refs } = useStreamState();
  const { steps, content, isStreaming, currentTip, error } = state;
  const { setSteps, setContent, setIsStreaming, setCurrentTip, setError, setFinalData } = setState;

  // 使用流式连接 Hook
  const { startStream } = useStreamConnection({
    stage,
    requestPayload,
    refs,
    onStepsUpdate: setSteps,
    onTipUpdate: setCurrentTip,
    onContentUpdate: (chunk) => {
      setContent(prev => prev + chunk);
    },
    onComplete: (data) => {
      setFinalData(data);
      onComplete(data);
    },
    onError: (errorMsg) => {
      setError(errorMsg);
      onError(errorMsg);
    },
    onStreamingStateChange: setIsStreaming,
  });

  // 自动启动流式处理
  useEffect(() => {
    if (refs.isMounted.current && !refs.hasStarted.current) {
      startStream();
    }
  }, [startStream, refs]);

  // 渲染错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-red-600 dark:text-red-400 text-center">
          <h3 className="text-lg font-semibold mb-2">处理失败</h3>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            refs.hasStarted.current = false;
            refs.hasRetried.current = false;
            startStream();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  // 渲染加载状态
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 认知步骤指示器 */}
      {steps.length > 0 && (
        <CognitiveProcessIndicator
          steps={steps}
          className="mb-6"
        />
      )}

      {/* 微学习提示 */}
      {currentTip && (
        <MicroLearningTip
          tip={currentTip}
          stage={stage}
          className="mb-6"
        />
      )}

      {/* 内容骨架屏或打字机效果 */}
      {isStreaming && (
        <div className="space-y-4">
          {content ? (
            <TypewriterContent content={content} />
          ) : (
            <ContentSkeleton stage={stage} />
          )}
        </div>
      )}

      {/* 加载提示 */}
      {isStreaming && !content && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            AI 正在为你生成内容...
          </span>
        </div>
      )}
    </div>
  );
}

export default CognitiveStreamAnimator;
