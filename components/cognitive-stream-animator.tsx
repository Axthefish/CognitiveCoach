"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CognitiveProcessIndicator } from './ui/cognitive-process-indicator';
import { MicroLearningTip } from './ui/micro-learning-tip';
import { ContentSkeleton } from './ui/content-skeleton';
import { TypewriterContent } from './ui/typewriter-content';
import { useCognitiveCoachStore } from '@/lib/store';

// 流式消息类型定义
import { StreamResponseData, StreamPayload } from '@/lib/schemas';

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

  const { startStreaming: startStreamingInStore, stopStreaming } = useCognitiveCoachStore();

  // 用于跟踪组件是否已卸载
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
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
          setSteps(message.payload.steps as CognitiveStep[]);
        }
        if (message.payload && typeof message.payload === 'object' && 'tip' in message.payload) {
          setCurrentTip(message.payload.tip as string);
        }
        break;
      
      case 'content_chunk':
        setContent(prev => prev + (message.payload as string));
        break;
      
      case 'data_structure':
        setFinalData(message.payload as StreamResponseData);
        if (message.payload && typeof message.payload === 'object' && 'status' in message.payload && message.payload.status === 'success') {
          onComplete((message.payload as { data: StreamResponseData }).data);
        } else if (message.payload && typeof message.payload === 'object' && 'error' in message.payload) {
          const errorMsg = (message.payload as { error: string }).error || '处理过程中出现错误';
          setError(errorMsg);
          onError(errorMsg);
        }
        break;
      
              case 'error':
          const errorMsg = message.payload as string;
          setError(errorMsg);
          setIsStreaming(false);
          stopStreaming();
          onError(errorMsg);
          break;
      
      case 'done':
        setIsStreaming(false);
        stopStreaming();
        break;
    }
  }, [onComplete, onError, stopStreaming]);

  // 启动流式请求
  const startStreaming = useCallback(async () => {
    // 检查组件是否已卸载
    if (!isMountedRef.current) {
      return;
    }
    
    // 创建新的AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
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
                const message: StreamMessage = JSON.parse(line);
                processStreamMessage(message);
              } catch (parseError) {
                console.warn('Failed to parse stream message:', line, parseError);
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
          const message: StreamMessage = JSON.parse(buffer);
          processStreamMessage(message);
        } catch (parseError) {
          console.warn('Failed to parse final stream message:', buffer, parseError);
        }
      }

    } catch (error) {
      console.error('Streaming error:', error);
      const errorMsg = error instanceof Error ? error.message : '网络错误，请重试';
      setError(errorMsg);
      setIsStreaming(false);
      stopStreaming();
      onError(errorMsg);
    } finally {
      stopStreaming();
    }
  }, [stage, requestPayload, processStreamMessage, onError, startStreamingInStore, stopStreaming]);

  // 组件挂载时启动流式请求
  useEffect(() => {
    startStreaming();
  }, [startStreaming]);

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
    return <ContentSkeleton stage={stage} />;
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
