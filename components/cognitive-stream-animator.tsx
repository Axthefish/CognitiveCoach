"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CognitiveProcessIndicator } from './ui/cognitive-process-indicator';
import { MicroLearningTip } from './ui/micro-learning-tip';
import { ContentSkeleton } from './ui/content-skeleton';
import { TypewriterContent } from './ui/typewriter-content';
import { useCognitiveCoachStore } from '@/lib/store';
import { reportError } from '@/lib/error-reporter';

// 流式消息类型定义
import { StreamResponseData, StreamPayload } from '@/lib/schemas';

// 声明全局变量类型以便调试
declare global {
  interface Window {
    __streamMessages?: Array<{
      timestamp: number;
      stage: string;
      message: StreamMessage;
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

// 辅助函数：将任何值安全转换为字符串
const toText = (v: unknown): string => typeof v === 'string' ? v : v == null ? '' : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();

interface StreamMessage {
  type: 'cognitive_step' | 'content_chunk' | 'data_structure' | 'error' | 'done';
  payload: StreamPayload;
}

// 认知步骤状态
type CognitiveStepStatus = 'pending' | 'in_progress' | 'completed' | 'error';

interface CognitiveStep {
  id: string;
  message: string;
  status: CognitiveStepStatus;
  timestamp?: number;
}

interface CognitiveStreamAnimatorProps {
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
  onComplete: (data: StreamResponseData) => void;
  onError: (error: string) => void;
  requestPayload: Record<string, unknown>;
}

export function CognitiveStreamAnimator({ 
  stage, 
  onComplete, 
  onError, 
  requestPayload 
}: CognitiveStreamAnimatorProps) {
  const [steps, setSteps] = useState<CognitiveStep[]>([]);
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [currentTip, setCurrentTip] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [finalData, setFinalData] = useState<StreamResponseData | null>(null);

  // T4: 添加重试状态跟踪
  const hasRetriedRef = useRef(false);

  

  const { 
    startStreaming: startStreamingInStore, 
    stopStreaming,
    updateCognitiveSteps,
    setMicroLearningTip,
    appendStreamContent,
    setStreamError
  } = useCognitiveCoachStore();

  // 用于跟踪组件是否已卸载和流状态
  const isMountedRef = useRef(true);
  const streamCompletedSuccessfully = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);
  const currentStreamIdRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false); // 跟踪是否因导航而中止
  
  // 存储当前状态的 refs，避免依赖循环
  const isStreamingRef = useRef(isStreaming);
  const stepsRef = useRef(steps);
  
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
      isNavigatingRef.current = true; // 标记为导航中止
      
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {
          // 忽略abort错误
        }
        abortControllerRef.current = null;
      }
      
      // 清理全局状态（如果组件仍挂载时才清理）
      if (!isNavigatingRef.current) {
        stopStreaming();
      }
    };
  }, [stopStreaming]);

  // 处理流式消息
  const processStreamMessage = useCallback((message: StreamMessage, streamId?: string) => {

    // 检查组件是否已卸载或流ID不匹配
    if (!isMountedRef.current || (streamId && currentStreamIdRef.current !== streamId)) {

      return;
    }
    
    // 安全的状态更新函数
    const safeSetState = <T,>(setter: (value: T) => void, value: T) => {
      if (isMountedRef.current) {
        setter(value);
      }
    };
    
    switch (message.type) {
      case 'cognitive_step':
        if (message.payload && typeof message.payload === 'object' && 'steps' in message.payload) {
          const steps = message.payload.steps as CognitiveStep[];
          safeSetState(setSteps, steps);
          // 同步到全局状态
          if (isMountedRef.current) {
            updateCognitiveSteps(steps);
          }
        }
        if (message.payload && typeof message.payload === 'object' && 'tip' in message.payload) {
          const tip = message.payload.tip as string;
          safeSetState(setCurrentTip, tip);
          // 同步到全局状态
          if (isMountedRef.current) {
            setMicroLearningTip(tip);
          }
        }
        break;
      
      case 'content_chunk':
        const chunk = message.payload as string;
        if (isMountedRef.current) {
          setContent(prev => prev + chunk);
          // 同步到全局状态
          appendStreamContent(String(message.payload));
        }
        break;
      
      case 'data_structure':
        console.log('📊 Processing data_structure message:', message.payload);
        // 提取最终数据：兼容 { status, data } 包装或直接数据
        if (message.payload && typeof message.payload === 'object' && 'status' in message.payload) {
          const wrapped = message.payload as { status: string; data?: StreamResponseData; error?: string };
          console.log('📦 Wrapped data structure:', wrapped);
          if (wrapped.status === 'success' && wrapped.data) {
            console.log('✅ Setting final data and calling onComplete');
            safeSetState(setFinalData, wrapped.data);
            if (isMountedRef.current) {
              onComplete(wrapped.data);
            }
          } else if (wrapped.error) {
            const errorMsg = toText(wrapped.error) || '处理过程中出现错误';
            safeSetState(setError, errorMsg);
            if (isMountedRef.current) {
              onError(errorMsg);
            }
          }
        } else if (message.payload && typeof message.payload === 'object' && 'error' in message.payload) {
          const errorMsg = toText((message.payload as Record<string, unknown>).error) || '处理过程中出现错误';
          safeSetState(setError, errorMsg);
          if (isMountedRef.current) {
            onError(errorMsg);
          }
        } else {
          safeSetState(setFinalData, message.payload as StreamResponseData);
        }
        break;
      
      case 'error':
        // 兼容两种负载：字符串或对象
        let errorCode: string | undefined;
        
        if (typeof message.payload === 'string') {
          const errorMsg = toText(message.payload);
          if (isMountedRef.current) {
            safeSetState(setError, errorMsg);
            setStreamError(errorMsg);
            safeSetState(setIsStreaming, false);
            stopStreaming();
            onError(errorMsg);
          }
        } else if (message.payload && typeof message.payload === 'object') {
          const payloadObj = message.payload as Record<string, unknown>;
          errorCode = payloadObj.code as string;
          const errorMsg = toText((payloadObj as Record<string, unknown>).message ?? (payloadObj as Record<string, unknown>).error ?? '处理过程中出现错误');
          
          // 根据错误代码提供用户友好的消息
          let finalErrorMsg = errorMsg;
          if (errorCode === 'TIMEOUT') {
            finalErrorMsg = '请求超时，已尝试降级重试。可以重新尝试或切换到 Lite 档位。';
          } else if (errorCode === 'NETWORK' || errorCode === 'UNKNOWN') {
            finalErrorMsg = '网络抖动或连接被中止，可重试一次。';
          }
          
          if (isMountedRef.current) {
            safeSetState(setError, finalErrorMsg);
            setStreamError(finalErrorMsg);
            safeSetState(setIsStreaming, false);
            stopStreaming();
            onError(finalErrorMsg);
          }
        } else {
          const errorMsg = '处理过程中出现错误';
          if (isMountedRef.current) {
            safeSetState(setError, errorMsg);
            setStreamError(errorMsg);
            safeSetState(setIsStreaming, false);
            stopStreaming();
            onError(errorMsg);
          }
        }
        break;

      case 'done':
        streamCompletedSuccessfully.current = true;
        if (isMountedRef.current) {
          safeSetState(setIsStreaming, false);
          stopStreaming();
        }
        break;
        
      default:
        // 如果我们收到了一个未知的消息类型，记录它以进行调试
        console.warn('Received unknown stream message type:', message.type);
        break;
    }
  }, [onComplete, onError, stopStreaming, updateCognitiveSteps, setMicroLearningTip, appendStreamContent, setStreamError]);

  // 启动流式请求
  const startStreaming = async () => {
    console.log('🔥🔥🔥 startStreaming ACTUALLY CALLED! 🔥🔥🔥');
    console.log('🎯 startStreaming called', {
      isMounted: isMountedRef.current,
      hasStarted: hasStartedRef.current,
      hasAbortController: !!abortControllerRef.current,
      stage,
      requestPayload
    });
    
    // 检查组件是否已卸载
    if (!isMountedRef.current) {
      console.log('❌ Component not mounted, returning');
      return;
    }
    
    // 若已有进行中的请求，先主动中止以避免并发
    if (abortControllerRef.current) {
      console.log('⚠️ Aborting previous request');
      try { abortControllerRef.current.abort(); } catch {}
      abortControllerRef.current = null;
    }

    // 防止重复启动：如果已经启动过，直接返回
    if (hasStartedRef.current) {
      console.log('⚠️ Stream already started, returning');
      return;
    }
    
    // 标记已启动
    hasStartedRef.current = true;
    console.log('✅ Marked as started');
    
    // 创建新的AbortController，并生成本次流的标识
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const streamId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    currentStreamIdRef.current = streamId;
    
    try {
      console.log(`🚀 Starting stream for stage ${stage} with streamId ${streamId}`);
      
      if (isMountedRef.current) {
        startStreamingInStore(stage);
        setIsStreaming(true);
        setError(null);
        setContent('');
        setSteps([]);
        setCurrentTip('');
      }

      // 构建请求体
      const actionMap = {
        'S0': 'refineGoal',
        'S1': 'generateFramework', 
        'S2': 'generateSystemDynamics',
        'S3': 'generateActionPlan',
        'S4': 'analyzeProgress'
      };

      const requestBody = {
        action: actionMap[stage],
        payload: requestPayload
      };
      
      console.log('📤 Sending request to /api/coach-stream:', requestBody);

      // 添加超时处理
      const fetchWithTimeout = async () => {
        const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30秒超时
        
        try {
          const response = await fetch('/api/coach-stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: abortController.signal // 添加abort信号
          });
          
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };
      
      console.log('🚀 Sending fetch request...');
      const response = await fetchWithTimeout();
      
      console.log('📡 Response object:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bodyUsed: response.bodyUsed,
        url: response.url
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      console.log('✅ Response received, status:', response.status);

      const reader = response.body?.getReader();
      console.log('📚 Reader obtained:', !!reader, 'body exists:', !!response.body);
      
      if (!reader) {
        throw new Error('Unable to read response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      
      console.log('📖 Starting to read stream...');
      let messageCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log(`✅ Stream ended, received ${messageCount} messages`);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          console.log(`📦 Received chunk (length: ${chunk.length}): ${chunk.substring(0, 100)}...`);
          
          const lines = buffer.split('\n');
          
          // 保留最后一行（可能不完整）
          buffer = lines.pop() || '';
          
          // 处理完整的行
          for (const line of lines) {
            if (line.trim()) {
              try {
                // 处理SSE格式（移除 "data: " 前缀如果存在）
                let jsonStr = line;
                if (line.startsWith('data: ')) {
                  jsonStr = line.substring(6);  // 移除 "data: " 前缀
                }
                // 兼容 CRLF 与尾随空白
                jsonStr = jsonStr.trim();
                if (!jsonStr) continue;
                
                const message: StreamMessage = JSON.parse(jsonStr);
                messageCount++;
                console.log(`📨 Parsed message #${messageCount}:`, message.type, message);
                
                // 开发环境调试记录
                if (process.env.NODE_ENV === 'development') {
                  window.__streamMessages = window.__streamMessages || [];
                  window.__streamMessages.push({
                    timestamp: Date.now(),
                    stage,
                    message,
                    rawLine: line,
                    parsedJson: jsonStr,
                    streamId
                  });
                }
                
                console.log(`🔄 Calling processStreamMessage for message type: ${message.type}`);
                processStreamMessage(message, streamId);
              } catch (parseError) {
                // 增强错误日志记录
                console.error('Failed to parse stream message:', {
                  line,
                  parseError,
                  stage,
                  timestamp: Date.now()
                });
                
                // 开发环境错误记录
                if (process.env.NODE_ENV === 'development') {
                  window.__streamErrors = window.__streamErrors || [];
                  window.__streamErrors.push({
                    timestamp: Date.now(),
                    stage,
                    line,
                    error: parseError
                  });
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // 处理剩余的缓冲区内容
      if (buffer.trim()) {
        try {
          // 处理SSE格式（移除 "data: " 前缀如果存在）
          let jsonStr = buffer;
          if (buffer.startsWith('data: ')) {
            jsonStr = buffer.substring(6);  // 移除 "data: " 前缀
          }
          jsonStr = jsonStr.trim();
          if (!jsonStr) {
            // nothing left to parse
          } else {
          
            const message: StreamMessage = JSON.parse(jsonStr);
            processStreamMessage(message, streamId);
          }
        } catch (parseError) {
          console.warn('Failed to parse final stream message:', buffer, parseError);
        }
      }

    } catch (error) {
      console.error('🔥 Stream error caught:', {
        error: error instanceof Error ? error.message : toText(error),
        streamId,
        currentStreamId: currentStreamIdRef.current,
        isMounted: isMountedRef.current,
        isNavigating: isNavigatingRef.current,
        streamCompleted: streamCompletedSuccessfully.current
      });
      
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('🔥 Stream error caught:', {
          error: error instanceof Error ? error.message : toText(error),
          streamId,
          currentStreamId: currentStreamIdRef.current,
          isMounted: isMountedRef.current,
          isNavigating: isNavigatingRef.current,
          streamCompleted: streamCompletedSuccessfully.current
        });
      }

      // 检查是否是已废弃的流 - 如果不是当前活动流，静默忽略
      if (currentStreamIdRef.current !== streamId) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('🚫 Ignoring error from stale stream');
        }
        return;
      }

      const errorInstance = error instanceof Error ? error : new Error(toText(error));
      let errorMsg = errorInstance.message;

      // 如果流已经成功完成，这是一个预期的结束，忽略异常
      if (streamCompletedSuccessfully.current) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('✅ Stream ended gracefully, ignoring post-completion error');
        }
        return;
      }

      // T4: 增强网络错误判断和自动重试逻辑
      const isNetworkError = errorInstance.name === 'AbortError' || 
                            errorInstance.message.includes('BodyStreamBuffer was aborted') ||
                            errorInstance.message.includes('The user aborted a request') ||
                            errorInstance.message.includes('ERR_NETWORK_CHANGED') ||
                            errorInstance.message.includes('NetworkError when attempting to fetch resource') ||
                            errorInstance.message.includes('TypeError: Failed to fetch');

      if (isNetworkError) {
        // 如果是导航中断，忽略
        if (!isMountedRef.current || isNavigatingRef.current) {
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.log('🧭 Stream aborted due to unmount/navigation - this is expected');
          }
          return;
        }
        
        // 检查是否可以自动重试
        const canRetry = !hasRetriedRef.current && 
                        !finalData && 
                        !streamCompletedSuccessfully.current &&
                        currentStreamIdRef.current === streamId &&
                        isMountedRef.current;
        
        if (canRetry) {
          console.log('🔄 Network error detected, attempting automatic retry...');
          hasRetriedRef.current = true;
          
          // 重置状态但保持进度
          streamCompletedSuccessfully.current = false;
          hasStartedRef.current = false;
          
          // 延迟重试，给网络恢复时间
          setTimeout(() => {
            if (isMountedRef.current && currentStreamIdRef.current === streamId) {
              startStreaming();
            }
          }, 1000);
          
          return; // 退出，不显示错误
        }
        
        // 不能重试，显示友好错误信息
        errorMsg = '网络连接中断，已自动重试但仍失败，请检查网络后手动重试';
      }

      // 报告错误（除了预期的导航中止）
      if (!isNetworkError || isMountedRef.current) {
        reportError(errorInstance, {
          stage,
          requestPayload,
          isStreaming: isStreamingRef.current,
          currentSteps: stepsRef.current,
          component: 'CognitiveStreamAnimator',
          streamId,
          isNavigating: isNavigatingRef.current,
          isMounted: isMountedRef.current
        });
      }
      
      // 仅在组件仍挂载且是当前活动流时更新UI状态
      if (isMountedRef.current && currentStreamIdRef.current === streamId) {
        setError(errorMsg);
        setStreamError(errorMsg);
        setIsStreaming(false);
        stopStreaming();
        onError(errorMsg);
      }
    } finally {
      // 仅当仍是当前活动流时才进行收尾，避免踩踏新连接
      if (currentStreamIdRef.current === streamId && isMountedRef.current) {
        hasStartedRef.current = false;
        if (abortControllerRef.current?.signal === abortController.signal) {
          abortControllerRef.current = null;
        }
        // 确保流状态被清理
        stopStreaming();
      }
    }
  };

  // 简化的启动逻辑 - 参考SimpleStreamTest的成功模式
  useEffect(() => {
    console.log(`🚀 CognitiveStreamAnimator effect starting for stage ${stage}`);
    console.log('📊 Current state:', {
      isStreaming,
      steps: steps.length,
      error,
      isMounted: isMountedRef.current,
      hasStarted: hasStartedRef.current,
      requestPayload
    });
    
    // 直接调用，不检查hasStartedRef
    const doStart = async () => {
      console.log('📡 About to call startStreaming directly');
      
      // 重置hasStartedRef以允许启动
      hasStartedRef.current = false;
      
      try {
        console.log('🎯 Calling startStreaming now...');
        await startStreaming();
        console.log('✅ startStreaming completed');
      } catch (error) {
        console.error('❌ Error in startStreaming:', error);
      }
    };
    
    // 立即启动，不延迟
    doStart();
    
    return () => {
      console.log('🧹 Cleaning up CognitiveStreamAnimator');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在挂载时运行一次

  // 如果出现错误，显示错误状态
  if (error) {
    return (
      <div className="w-full p-6 space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                处理过程中出现错误
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
            </div>
          </div>
        </div>
        
        {steps.length > 0 && (
          <CognitiveProcessIndicator steps={steps} />
        )}
      </div>
    );
  }

  // 如果还在加载且没有内容，显示骨架屏
  if (isStreaming && steps.length === 0) {
    return <ContentSkeleton 
      stage={stage} 
      onRetry={() => {
        // 重新启动流式处理
        setError(null);
        setIsStreaming(true);
        setContent('');
        setSteps([]);
        setCurrentTip('');
        hasStartedRef.current = false;
        streamCompletedSuccessfully.current = false;
        startStreaming();
      }}
    />;
  }

  return (
    <div className="w-full p-4 space-y-6 animate-fade-in">
      {/* 认知过程指示器 */}
      {steps.length > 0 && (
        <CognitiveProcessIndicator steps={steps} />
      )}
      
      {/* 内容区域 */}
      {content && (
        <div className="bg-white dark:bg-gray-950/50 rounded-lg p-6 border">
          <TypewriterContent content={content} />
        </div>
      )}
      
      {/* 微学习提示（仅在流式进行中显示） */}
      {isStreaming && currentTip && (
        <MicroLearningTip tip={currentTip} stage={stage} />
      )}
      
      {/* 最终结果显示 */}
      {finalData && !isStreaming && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                {stage} 阶段处理完成
              </h3>
              <div className="mt-2 text-sm text-green-700">
                AI 已成功生成内容，正在为您展示结果...
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
