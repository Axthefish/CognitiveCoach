/**
 * useStreamConnection - 流式连接管理 Hook
 * 
 * 职责：
 * - 管理SSE流式连接的建立和断开
 * - 处理流式消息的接收和解析
 * - 处理重试逻辑
 * - 管理请求的生命周期
 * 
 * 使用场景：
 * - cognitive-stream-animator.tsx
 */

import { useCallback, useEffect } from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import { enhancedFetch } from '@/lib/error-utils';
import { hydrationSafeLog } from '@/lib/hydration-safe';
import { reportError } from '@/lib/app-errors';
import type { StreamResponseData } from '@/lib/schemas';
import type { CognitiveStep } from '@/lib/api-types';
import type { StreamRefs } from './useStreamState';
import { processStreamMessage, parseSSELine, type StreamMessage } from '../utils/streamMessageProcessor';

export interface UseStreamConnectionOptions {
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
  requestPayload: Record<string, unknown>;
  refs: StreamRefs;
  onStepsUpdate: (steps: CognitiveStep[]) => void;
  onTipUpdate: (tip: string) => void;
  onContentUpdate: (chunk: string) => void;
  onComplete: (data: StreamResponseData) => void;
  onError: (error: string) => void;
  onStreamingStateChange: (isStreaming: boolean) => void;
}

const ACTION_MAP = {
  'S0': 'refineGoal',
  'S1': 'generateFramework',
  'S2': 'generateSystemDynamics',
  'S3': 'generateActionPlan',
  'S4': 'analyzeProgress'
} as const;

/**
 * 管理流式连接和消息处理
 */
export function useStreamConnection(options: UseStreamConnectionOptions) {
  const {
    stage,
    requestPayload,
    refs,
    onStepsUpdate,
    onTipUpdate,
    onContentUpdate,
    onComplete,
    onError,
    onStreamingStateChange,
  } = options;

  const {
    startStreaming: startStreamingInStore,
    stopStreaming,
    updateCognitiveSteps,
    setMicroLearningTip,
    appendStreamContent,
    setStreamError,
  } = useCognitiveCoachStore();

  /**
   * 处理流式消息
   */
  const handleStreamMessage = useCallback((message: StreamMessage, streamId?: string) => {
    // 检查组件是否已卸载或流ID不匹配
    if (!refs.isMounted.current || (streamId && refs.currentStreamId.current !== streamId)) {
      return;
    }

    const isMounted = () => refs.isMounted.current;

    processStreamMessage(message, {
      onStepsUpdate: (steps) => {
        onStepsUpdate(steps);
        if (isMounted()) {
          updateCognitiveSteps(steps);
        }
      },
      onTipUpdate: (tip) => {
        onTipUpdate(tip);
        if (isMounted()) {
          setMicroLearningTip(tip);
        }
      },
      onContentUpdate: (chunk) => {
        onContentUpdate(chunk);
        if (isMounted()) {
          appendStreamContent(chunk);
        }
      },
      onDataComplete: (data) => {
        if (isMounted()) {
          onComplete(data);
        }
      },
      onError: (errorMsg) => {
        if (isMounted()) {
          setStreamError(errorMsg);
          onStreamingStateChange(false);
          stopStreaming();
          onError(errorMsg);
        }
      },
      onDone: () => {
        refs.streamCompleted.current = true;
        if (isMounted()) {
          onStreamingStateChange(false);
          stopStreaming();
        }
      },
      isMounted,
    });
  }, [
    refs,
    onStepsUpdate,
    onTipUpdate,
    onContentUpdate,
    onComplete,
    onError,
    onStreamingStateChange,
    updateCognitiveSteps,
    setMicroLearningTip,
    appendStreamContent,
    setStreamError,
    stopStreaming,
  ]);

  /**
   * 启动流式连接
   */
  const startStream = useCallback(async () => {
    hydrationSafeLog('🚀 startStream called', {
      isMounted: refs.isMounted.current,
      hasStarted: refs.hasStarted.current,
      stage,
    });

    // 检查组件是否已卸载
    if (!refs.isMounted.current) {
      hydrationSafeLog('❌ Component not mounted, returning');
      return;
    }

    // 若已有进行中的请求，先主动中止
    if (refs.abortController.current) {
      hydrationSafeLog('⚠️ Aborting previous request');
      try {
        refs.abortController.current.abort();
      } catch {
        // 忽略abort错误
      }
      refs.abortController.current = null;
    }

    // 防止重复启动
    if (refs.hasStarted.current) {
      hydrationSafeLog('⚠️ Stream already started, returning');
      return;
    }

    // 标记已启动
    refs.hasStarted.current = true;

    // 创建新的AbortController和streamId
    const abortController = new AbortController();
    refs.abortController.current = abortController;
    const streamId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    refs.currentStreamId.current = streamId;

    try {
      hydrationSafeLog(`🚀 Starting stream for stage ${stage} with streamId ${streamId}`);

      if (refs.isMounted.current) {
        startStreamingInStore(stage);
        onStreamingStateChange(true);
      }

      // 构建请求体
      const requestBody = {
        action: ACTION_MAP[stage],
        payload: requestPayload,
      };

      hydrationSafeLog('📤 Sending request to /api/coach-stream:', requestBody);

      // 发送请求
      const response = await enhancedFetch('/api/coach-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
        timeout: 30000,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      hydrationSafeLog('✅ Response received, status:', response.status);

      // 读取流
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let messageCount = 0;

      hydrationSafeLog('📖 Starting to read stream...');

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            hydrationSafeLog(`✅ Stream ended, received ${messageCount} messages`);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          // 处理每一行
          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) {
              continue;
            }

            messageCount++;
            const message = parseSSELine(line);

            if (message) {
              hydrationSafeLog(`📨 [${messageCount}] Processing message:`, {
                type: message.type,
                hasPayload: !!message.payload,
              });

              // 检查是否是已废弃的流
              if (!refs.isMounted.current || refs.currentStreamId.current !== streamId) {
                hydrationSafeLog('⚠️ Stream is stale or component unmounted, stopping read');
                try {
                  reader.cancel();
                } catch {
                  // 忽略取消错误
                }
                return;
              }

              handleStreamMessage(message, streamId);

              // 记录调试信息（开发环境）
              if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
                if (!window.__streamMessages) {
                  window.__streamMessages = [];
                }
                window.__streamMessages.push({
                  timestamp: Date.now(),
                  stage,
                  message,
                  rawLine: line,
                  parsedJson: JSON.stringify(message, null, 2),
                  streamId,
                });
              }
            }
          }
        }
      } catch (readError) {
        if (readError && typeof readError === 'object' && 'name' in readError && readError.name === 'AbortError') {
          hydrationSafeLog('🛑 Stream read aborted');
          return;
        }
        throw readError;
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        hydrationSafeLog('🛑 Request aborted');
        if (!refs.isNavigating.current && refs.isMounted.current) {
          onStreamingStateChange(false);
          stopStreaming();
        }
        return;
      }

      hydrationSafeLog('❌ Stream error:', error);

      // 记录错误（开发环境）
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        if (!window.__streamErrors) {
          window.__streamErrors = [];
        }
        window.__streamErrors.push({
          timestamp: Date.now(),
          stage,
          line: error instanceof Error ? error.message : String(error),
          error,
        });
      }

      if (refs.isMounted.current) {
        const errorMessage = error instanceof Error ? error.message : '流式连接失败';
        reportError(new Error(errorMessage), {
          context: 'useStreamConnection',
          stage,
        });

        // 重试逻辑（仅在未重试过时）
        if (!refs.hasRetried.current && refs.isMounted.current) {
          hydrationSafeLog('🔄 Attempting retry...');
          refs.hasRetried.current = true;
          refs.hasStarted.current = false;

          // 延迟1秒后重试
          setTimeout(() => {
            if (refs.isMounted.current) {
              startStream();
            }
          }, 1000);
          return;
        }

        onStreamingStateChange(false);
        stopStreaming();
        onError(errorMessage);
      }
    }
  }, [
    stage,
    requestPayload,
    refs,
    startStreamingInStore,
    stopStreaming,
    onStreamingStateChange,
    onError,
    handleStreamMessage,
  ]);

  // 组件卸载时的清理
  useEffect(() => {
    return () => {
      // 清理全局状态（如果不是因为导航而卸载）
      if (!refs.isNavigating.current) {
        stopStreaming();
      }
    };
  }, [refs, stopStreaming]);

  return { startStream };
}

