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

  const { 
    startStreaming: startStreamingInStore, 
    stopStreaming,
    updateCognitiveSteps,
    setMicroLearningTip,
    appendStreamContent,
    setStreamError
  } = useCognitiveCoachStore();

  // 用于跟踪组件是否已卸载
  const isMountedRef = useRef(true);
  const streamCompletedSuccessfully = useRef(false); // <--- 添加这一行
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);
  const currentStreamIdRef = useRef<string | null>(null);
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      hasStartedRef.current = false;
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // 处理流式消息
  const processStreamMessage = useCallback((message: StreamMessage) => {
    // 检查组件是否已卸载
    if (!isMountedRef.current) {
      return;
    }
    
    switch (message.type) {
      case 'cognitive_step':
        if (message.payload && typeof message.payload === 'object' && 'steps' in message.payload) {
          const steps = message.payload.steps as CognitiveStep[];
          setSteps(steps);
          // 同步到全局状态
          updateCognitiveSteps(steps);
        }
        if (message.payload && typeof message.payload === 'object' && 'tip' in message.payload) {
          const tip = message.payload.tip as string;
          setCurrentTip(tip);
          // 同步到全局状态
          setMicroLearningTip(tip);
        }
        break;
      
      case 'content_chunk':
        const chunk = message.payload as string;
        setContent(prev => prev + chunk);
        // 同步到全局状态
        appendStreamContent(String(message.payload));
        break;
      
      case 'data_structure':
        // 提取最终数据：兼容 { status, data } 包装或直接数据
        if (message.payload && typeof message.payload === 'object' && 'status' in message.payload) {
          const wrapped = message.payload as { status: string; data?: StreamResponseData; error?: string };
          if (wrapped.status === 'success' && wrapped.data) {
            setFinalData(wrapped.data);
            onComplete(wrapped.data);
          } else if (wrapped.error) {
            const errorMsg = toText(wrapped.error) || '处理过程中出现错误';
            setError(errorMsg);
            onError(errorMsg);
          }
        } else if (message.payload && typeof message.payload === 'object' && 'error' in message.payload) {
          const errorMsg = toText((message.payload as Record<string, unknown>).error) || '处理过程中出现错误';
          setError(errorMsg);
          onError(errorMsg);
        } else {
          setFinalData(message.payload as StreamResponseData);
        }
        break;
      
      case 'error':
        // 兼容两种负载：字符串或对象
        let errorCode: string | undefined;
        
        if (typeof message.payload === 'string') {
          const errorMsg = toText(message.payload);
          setError(errorMsg);
          setStreamError(errorMsg);
          setIsStreaming(false);
          stopStreaming();
          onError(errorMsg);
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
          
          setError(finalErrorMsg);
          setStreamError(finalErrorMsg);
          setIsStreaming(false);
          stopStreaming();
          onError(finalErrorMsg);
        } else {
          const errorMsg = '处理过程中出现错误';
          setError(errorMsg);
          setStreamError(errorMsg);
          setIsStreaming(false);
          stopStreaming();
          onError(errorMsg);
        }
        break;

      case 'done':
        streamCompletedSuccessfully.current = true;
        setIsStreaming(false);
        stopStreaming();
        break;
        
      default:
        // 如果我们收到了一个未知的消息类型，记录它以进行调试
        console.warn('Received unknown stream message type:', message.type);
        break;
    }
  }, [onComplete, onError, stopStreaming, updateCognitiveSteps, setMicroLearningTip, appendStreamContent, setStreamError]);

  // 启动流式请求
  const startStreaming = useCallback(async () => {
    // 检查组件是否已卸载
    if (!isMountedRef.current) {
      return;
    }
    
    // 若已有进行中的请求，先主动中止以避免并发
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort(); } catch {}
      abortControllerRef.current = null;
    }

    // 防止重复启动：如果已经启动过，直接返回
    if (hasStartedRef.current) {
      return;
    }
    
    // 标记已启动
    hasStartedRef.current = true;
    
    // 创建新的AbortController，并生成本次流的标识
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const streamId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    currentStreamIdRef.current = streamId;
    
    try {
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

      const response = await fetch('/api/coach-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal // 添加abort信号
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
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
                
                // 开发环境调试记录
                if (process.env.NODE_ENV === 'development') {
                  (window as unknown as Record<string, unknown>).__streamMessages = (window as unknown as Record<string, unknown>).__streamMessages || [];
                  ((window as unknown as Record<string, unknown>).__streamMessages as Record<string, unknown>[]).push({
                    timestamp: Date.now(),
                    stage,
                    message,
                    rawLine: line,
                    parsedJson: jsonStr
                  });
                }
                
                processStreamMessage(message);
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
                  (window as unknown as Record<string, unknown>).__streamErrors = (window as unknown as Record<string, unknown>).__streamErrors || [];
                  ((window as unknown as Record<string, unknown>).__streamErrors as Record<string, unknown>[]).push({
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
            processStreamMessage(message);
          }
        } catch (parseError) {
          console.warn('Failed to parse final stream message:', buffer, parseError);
        }
      }

    } catch (error) {
      // 若该错误已不属于当前活动流（例如阶段切换后新流已启动），静默忽略
      if (currentStreamIdRef.current && currentStreamIdRef.current !== undefined) {
        // 在 finally 中通过 streamId 精确清理
      }
      // 使用错误报告工具
      const errorInstance = error instanceof Error ? error : new Error(toText(error));
      reportError(errorInstance, {
        stage,
        requestPayload,
        isStreaming,
        currentSteps: steps,
        component: 'CognitiveStreamAnimator'
      });
      
      let errorMsg = error instanceof Error ? error.message : toText(error);

      // 如果流已经成功完成，这是一个预期的结束，忽略异常
      if (streamCompletedSuccessfully.current) {
        // 如果流已经成功完成，这是一个预期的中止，忽略它
        console.log('Stream ended gracefully, ignoring abort error.');
        return;
      }

      // 如果是 AbortError，进一步判断是否组件卸载导致，避免误报
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('BodyStreamBuffer was aborted'))) {
        if (!isMountedRef.current) {
          console.warn('Stream aborted due to unmount/navigation, ignoring.');
          return;
        }
        errorMsg = '连接中断或被浏览器终止，可重试一次或切换 Lite 档';
      }
      
      // 若当前流已被新的流替换，则不再上报 UI 错误
      if (currentStreamIdRef.current === streamId) {
        setError(errorMsg);
        setStreamError(errorMsg); // 同步错误到全局状态
        setIsStreaming(false);
        stopStreaming();
        onError(errorMsg);
      }
    } finally {
      // 仅当仍是当前活动流时才进行收尾，避免踩踏新连接
      if (currentStreamIdRef.current === streamId) {
        hasStartedRef.current = false;
        abortControllerRef.current = null;
        // 避免在组件卸载后多余地触发全局 stop
        if (isMountedRef.current) {
          stopStreaming();
        }
      }
    }
  }, [stage, requestPayload, processStreamMessage, onError, startStreamingInStore, stopStreaming, isStreaming, steps, setStreamError]);

  // 组件挂载或 stage 改变时启动流式请求
  useEffect(() => {
    // 阶段切换：主动中止旧流，重置标志并启动新流
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort(); } catch {}
      abortControllerRef.current = null;
    }
    streamCompletedSuccessfully.current = false;
    hasStartedRef.current = false;
    startStreaming();
  }, [stage, startStreaming]);

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
