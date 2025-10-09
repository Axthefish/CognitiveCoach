/**
 * useStreamState - 流式处理状态管理 Hook
 * 
 * 职责：
 * - 管理流式处理的所有状态（步骤、内容、错误等）
 * - 提供状态更新函数
 * - 管理 refs（isMounted、hasStarted、streamId 等）
 * 
 * 使用场景：
 * - cognitive-stream-animator.tsx
 */

import { useState, useRef, useEffect } from 'react';
import type { CognitiveStep } from '@/lib/api-types';
import type { StreamResponseData } from '@/lib/schemas';

export interface StreamState {
  steps: CognitiveStep[];
  content: string;
  isStreaming: boolean;
  currentTip: string;
  error: string | null;
  finalData: StreamResponseData | null;
}

export interface StreamRefs {
  isMounted: React.MutableRefObject<boolean>;
  hasStarted: React.MutableRefObject<boolean>;
  abortController: React.MutableRefObject<AbortController | null>;
  currentStreamId: React.MutableRefObject<string | null>;
  isNavigating: React.MutableRefObject<boolean>;
  streamCompleted: React.MutableRefObject<boolean>;
  isStreaming: React.MutableRefObject<boolean>;
  steps: React.MutableRefObject<CognitiveStep[]>;
  hasRetried: React.MutableRefObject<boolean>;
}

export interface UseStreamStateReturn {
  state: StreamState;
  setState: {
    setSteps: React.Dispatch<React.SetStateAction<CognitiveStep[]>>;
    setContent: React.Dispatch<React.SetStateAction<string>>;
    setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentTip: React.Dispatch<React.SetStateAction<string>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    setFinalData: React.Dispatch<React.SetStateAction<StreamResponseData | null>>;
  };
  refs: StreamRefs;
}

/**
 * 管理流式处理的所有状态和 refs
 */
export function useStreamState(): UseStreamStateReturn {
  // 状态
  const [steps, setSteps] = useState<CognitiveStep[]>([]);
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [currentTip, setCurrentTip] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [finalData, setFinalData] = useState<StreamResponseData | null>(null);

  // Refs
  const isMountedRef = useRef(true);
  const streamCompletedSuccessfully = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);
  const currentStreamIdRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false);
  const isStreamingRef = useRef(isStreaming);
  const stepsRef = useRef(steps);
  const hasRetriedRef = useRef(false);

  // 更新 refs 当状态改变时
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  // 组件卸载时清理
  useEffect(() => {
    isMountedRef.current = true;
    isNavigatingRef.current = false;
    
    return () => {
      isMountedRef.current = false;
      hasStartedRef.current = false;
      isNavigatingRef.current = true;
      
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {
          // 忽略abort错误
        }
        abortControllerRef.current = null;
      }
    };
  }, []);

  return {
    state: {
      steps,
      content,
      isStreaming,
      currentTip,
      error,
      finalData,
    },
    setState: {
      setSteps,
      setContent,
      setIsStreaming,
      setCurrentTip,
      setError,
      setFinalData,
    },
    refs: {
      isMounted: isMountedRef,
      hasStarted: hasStartedRef,
      abortController: abortControllerRef,
      currentStreamId: currentStreamIdRef,
      isNavigating: isNavigatingRef,
      streamCompleted: streamCompletedSuccessfully,
      isStreaming: isStreamingRef,
      steps: stepsRef,
      hasRetried: hasRetriedRef,
    },
  };
}

