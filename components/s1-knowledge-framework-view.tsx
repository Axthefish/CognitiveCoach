"use client"

import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Check } from "lucide-react"
import { useCognitiveCoachStore } from "@/lib/store"
import { FrameworkNode } from "@/lib/types"
import { CognitiveStreamAnimator } from "@/components/cognitive-stream-animator"
import { StreamResponseData } from "@/lib/schemas"
import { ErrorBoundary } from "@/components/error-boundary"
import { LoadingOverlay } from "@/components/ui/loading-overlay"
import { reportError } from "@/lib/error-reporter"
import { getHydrationSafeTimestamp, markHydrationComplete } from "@/lib/hydration-safe"

// 辅助函数：将任何值安全转换为字符串
const toText = (v: unknown): string => typeof v === 'string' ? v : v == null ? '' : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();

interface S1KnowledgeFrameworkViewProps {
  onProceed: () => void
}

export default function S1KnowledgeFrameworkView({ onProceed }: S1KnowledgeFrameworkViewProps) {
  const { userContext, streaming, isLoading, updateUserContext, addVersionSnapshot, setQaIssues, stopStreaming, setError } = useCognitiveCoachStore();
  const framework = userContext.knowledgeFramework;
  const hasStartedStream = useRef(false);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 统一的 useEffect 处理所有流式相关逻辑和组件生命周期
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('🔧 S1KnowledgeFrameworkView: Effect triggered', {
        isLoading,
        currentStage: streaming.currentStage,
        hasUserGoal: !!userContext.userGoal,
        hasStarted: hasStartedStream.current,
        isMounted: isMountedRef.current
      });
    }
    
    isMountedRef.current = true;
    
    // 清理之前的超时定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // 如果正在S1阶段加载，有有效的userGoal，但还没有启动流式处理
    if (isLoading && 
        streaming.currentStage === 'S1' && 
        userContext.userGoal && 
        userContext.userGoal.trim().length > 0 && 
        !hasStartedStream.current) {
      
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('✅ S1: Starting stream processing for goal:', userContext.userGoal);
      }
      hasStartedStream.current = true;
      // CognitiveStreamAnimator会自动处理流式请求
    }
    
    // 如果在S1阶段等待userGoal太长时间（超过5秒），显示错误
    else if (isLoading && 
             streaming.currentStage === 'S1' && 
             (!userContext.userGoal || userContext.userGoal.trim().length === 0)) {
      
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('⏱️ S1: Setting timeout for missing userGoal');
      }
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && 
            isLoading && 
            streaming.currentStage === 'S1' && 
            (!userContext.userGoal || userContext.userGoal.trim().length === 0)) {
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.log('❌ S1: Timeout - no userGoal found');
          }
          setError('目标精炼失败，请重新开始');
          stopStreaming();
        }
      }, 5000); // 5秒超时
    }
    
    // 清理函数
    return () => {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('🧹 S1KnowledgeFrameworkView: Cleaning up');
      }
      isMountedRef.current = false;
      
      // 清理超时定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // 重置流式处理状态
      hasStartedStream.current = false;
      
      // 如果组件卸载时还在流式处理中，停止流式处理
      if (streaming.isStreaming && streaming.currentStage === 'S1') {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('🛑 S1: Stopping stream due to unmount');
        }
        stopStreaming();
      }
    };
  }, [userContext.userGoal, isLoading, streaming.currentStage, streaming.isStreaming, setError, stopStreaming]);

  // 处理流式生成完成
  const handleStreamComplete = (data: StreamResponseData) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('✅ S1: Stream completed successfully');
    }
    
    if (isMountedRef.current && 'framework' in data && data.framework) {
      updateUserContext({ knowledgeFramework: data.framework });
      addVersionSnapshot();
      setQaIssues(null, []);
    } else if (!isMountedRef.current) {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('⚠️ S1: Component unmounted before stream completion');
      }
    }
  };

  // 处理流式生成错误
  const handleStreamError = (error: string) => {
    const msg = typeof error === 'string' ? error : toText(error);
    if (typeof window !== 'undefined') {
      console.error('❌ S1 streaming error:', msg);
    }
    
    // 只在组件仍挂载时处理错误
    if (!isMountedRef.current) {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('⚠️ S1: Component unmounted before error handling');
      }
      return;
    }
    
    // 报告错误
    reportError(new Error(msg), {
      stage: 'S1',
      userGoal: userContext.userGoal,
      component: 'S1KnowledgeFrameworkView',
      hasFramework: !!framework,
      frameworkLength: framework?.length || 0,
      isMounted: isMountedRef.current
    });
  };

  // 全局节点计数器，确保每个节点都有唯一ID
  const nodeCounterRef = useRef(0);
  const [isClient, setIsClient] = useState(false);
  
  // Hydration保护
  useEffect(() => {
    setIsClient(true);
    markHydrationComplete();
  }, []);
  
  // 递归渲染框架节点 - 修复ID冲突和深度限制
  const renderFrameworkNode = (node: FrameworkNode, parentPath: string[] = [], depth: number = 0): React.ReactElement | null => {
    // 防止深度过深的递归
    if (depth > 8) {
      console.warn('Framework node depth limit exceeded:', depth);
      return (
        <div className="p-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded">
          <em>内容层级过深，已省略显示</em>
        </div>
      );
    }
    
    // 防御性检查
    if (!node || typeof node !== 'object') {
      console.error('Invalid node:', node);
      return null;
    }
    
    // 确保必要的属性存在
    if (!node.id || !node.title) {
      console.error('Node missing required properties:', node);
      return null;
    }
    
    // 生成绝对唯一的ID - 使用路径、时间戳和计数器
    const currentPath = [...parentPath, node.id];
    const pathKey = currentPath.join('_');
    const uniqueId = `node_${++nodeCounterRef.current}_${pathKey}_${depth}_${getHydrationSafeTimestamp().slice(-8)}`;
    
    // 对于嵌套子节点，使用递归渲染但不嵌套Accordion
    const renderChildren = () => {
      if (!Array.isArray(node.children) || node.children.length === 0) {
        return null;
      }
      
      return (
        <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
          {node.children.map((child, index) => {
            const childElement = renderFrameworkNode(child, currentPath, depth + 1);
            if (!childElement) return null;
            
            // 为子节点创建独立的小型accordion项目
            const childId = `${uniqueId}_child_${index}`;
            return (
              <div key={childId} className="border rounded-md bg-gray-50 dark:bg-gray-800/30">
                <details className="group">
                  <summary className="cursor-pointer list-none p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{toText(child.title)}</span>
                      <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </summary>
                  <div className="px-3 pb-3 pt-1">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{toText(child.summary)}</p>
                    {Array.isArray(child.children) && child.children.length > 0 && (
                      renderChildren.call({ node: child, currentPath: [...currentPath, child.id] })
                    )}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      );
    };
    
    return (
      <AccordionItem key={uniqueId} value={uniqueId}>
        <AccordionTrigger className="text-left">
          <span className="font-medium">{toText(node.title)}</span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-gray-600 dark:text-gray-400 mb-3">{toText(node.summary)}</p>
          {renderChildren()}
        </AccordionContent>
      </AccordionItem>
    );
  };

  // 如果正在加载且当前阶段是 S1，显示流式动画器
  if (isLoading && streaming.currentStage === 'S1') {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('✅ S1 View: Should show CognitiveStreamAnimator', {
        isLoading,
        currentStage: streaming.currentStage,
        isStreaming: streaming.isStreaming,
        userGoal: userContext.userGoal
      });
    }
    
    // 确保 userGoal 存在且有效再启动流式处理
    if (!userContext.userGoal || userContext.userGoal.trim().length === 0) {
      return (
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S1: Knowledge Framework Construction</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            正在准备学习目标...
          </p>
          <LoadingOverlay 
            variant="inline" 
            stage="S1" 
            message="正在整理你的目标..." 
            onRetry={() => {
              // S1阶段的重试：重新生成知识框架
              window.location.reload(); // 对于简单的inline显示，保持原有行为
            }}
          />
        </div>
      );
    }

    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S1: Knowledge Framework Construction</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          AI 正在为您构建结构化的知识框架，这将成为后续学习的基础...
        </p>
        
        <ErrorBoundary>
          <CognitiveStreamAnimator 
            stage="S1"
            onComplete={handleStreamComplete}
            onError={handleStreamError}
            requestPayload={{ 
              userGoal: userContext.userGoal,
              decisionType: userContext.decisionType,
              runTier: userContext.runTier,
              seed: userContext.seed
            }}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S1: Knowledge Framework Construction</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Here is the foundational knowledge structure for your goal, retrieved from our verified sources.
      </p>
      <Card className="bg-white dark:bg-gray-950/50 mb-8">
        <CardHeader>
          <CardTitle>Objective Knowledge Framework</CardTitle>
          <CardDescription>
            {userContext.userGoal ? (
              <>Goal: {userContext.userGoal}</>
            ) : (
              <>An interactive outline of key concepts.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {framework && framework.length > 0 ? (
            <div suppressHydrationWarning>
              {isClient ? (
                <Accordion type="single" collapsible className="w-full">
                  {framework.map((node, index) => {
                    // 重置计数器确保根节点从一致的状态开始
                    if (index === 0) {
                      nodeCounterRef.current = 0;
                    }
                    return renderFrameworkNode(node);
                  })}
                </Accordion>
              ) : (
                <div className="space-y-4">
                  {framework.map((node, index) => (
                    <div key={`loading-${index}`} className="border rounded-md p-4 bg-gray-50 dark:bg-gray-800/30">
                      <div className="font-medium">{toText(node.title)}</div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{toText(node.summary)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>正在生成知识框架...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {framework && framework.length > 0 && (
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
          <CardHeader className="flex-row items-start space-x-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Check className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <CardTitle>Milestone Summary</CardTitle>
              <CardDescription className="text-blue-900/80 dark:text-blue-200/80">Framework Established</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-blue-900 dark:text-blue-200">
              You now have a structured overview tailored to your goal. This
              framework will be our map for the next stages.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={onProceed} className="ml-auto">
              Proceed to System Dynamics (S2)
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}