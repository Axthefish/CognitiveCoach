"use client"

import React, { useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import { InteractiveMermaid } from "@/components/ui/interactive-mermaid"
import { useCognitiveCoachStore } from "@/lib/store"
import { CognitiveStreamAnimator } from "@/components/cognitive-stream-animator"
import { StreamResponseData } from "@/lib/schemas"
import { ErrorBoundary } from "@/components/error-boundary"
import { LoadingOverlay } from "@/components/ui/loading-overlay"
import { reportError } from "@/lib/error-reporter"
import { markHydrationComplete } from "@/lib/hydration-safe"


// 辅助函数：将任何值安全转换为字符串
const toText = (v: unknown): string => typeof v === 'string' ? v : v == null ? '' : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();

interface S1KnowledgeFrameworkViewProps {
  onProceed: () => void
}

// 完全静态的S1组件 - 避免任何可能导致hydration问题的动态内容
export default function S1KnowledgeFrameworkView({ onProceed }: S1KnowledgeFrameworkViewProps) {
  const { userContext, streaming, isLoading, updateUserContext, addVersionSnapshot, setQaIssues, stopStreaming, setLoading, startStreaming, navigateToStage } = useCognitiveCoachStore();
  const framework = userContext.knowledgeFramework;
  const hasStartedStream = useRef(false);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);


  // 组件挂载时的生命周期管理
  useEffect(() => {
    isMountedRef.current = true;
    
    // 清理函数
    return () => {
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
        stopStreaming();
      }
    };
  }, [streaming.currentStage, streaming.isStreaming, stopStreaming]); // 依赖清理相关状态

  // 标记hydration完成
  useEffect(() => {
    markHydrationComplete();
  }, []);

  // 处理流式生成完成
  const handleStreamComplete = (data: StreamResponseData) => {
    if (isMountedRef.current && 'framework' in data && data.framework) {
      updateUserContext({ knowledgeFramework: data.framework });
      addVersionSnapshot();
      setQaIssues(null, []);
      // S1 完成后，预启动 S2 流式处理，避免用户感知的二次等待
      if (!userContext.systemDynamics && !streaming.isStreaming) {
        startStreaming('S2');
      }
    }
  };

  // 处理流式生成错误
  const handleStreamError = (error: string) => {
    const msg = typeof error === 'string' ? error : toText(error);
    
    // 只在组件仍挂载时处理错误
    if (!isMountedRef.current) {
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
    
    // 错误时也设置 loading 为 false
    setLoading(false);
  };

  // 临时测试：使用模拟数据
  const useMockData = false; // 禁用模拟数据，使用真实API
  
  // 如果正在加载，显示流式动画器（不需要检查 streaming.currentStage，因为它是由 CognitiveStreamAnimator 设置的）
  if (isLoading && !useMockData) {
    // 确保 userGoal 存在且有效再启动流式处理
    if (!userContext.userGoal || userContext.userGoal.trim().length === 0) {
      return (
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S1：知识框架构建</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            正在准备学习目标...
          </p>
          <LoadingOverlay 
            variant="inline" 
            stage="S1" 
            message="正在整理你的目标..." 
            onRetry={() => {
              window.location.reload();
            }}
          />
        </div>
      );
    }


    
    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S1：知识框架构建</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          AI 正在为你构建完整学习蓝图（知识框架 + 系统动力学），内容将逐步流入页面。
        </p>
        
        <ErrorBoundary>
          <CognitiveStreamAnimator 
            stage="S1"
            onComplete={handleStreamComplete}
            onError={handleStreamError}
            requestPayload={{ 
              userGoal: userContext.userGoal,
              decisionType: userContext.decisionType
            }}
          />
        </ErrorBoundary>
      </div>
    );
  }
  


  // 静态展示框架内容 - 完全避免动态渲染
  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S1：知识框架构建</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">这是为你的目标定制的核心知识结构。</p>
      <Card className="bg-white dark:bg-gray-950/50 mb-8">
        <CardHeader>
          <CardTitle>知识框架</CardTitle>
          <CardDescription>
            {userContext.userGoal ? (
              <>目标：{userContext.userGoal}</>
            ) : (
              <>关键概念的结构化大纲。</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {framework && framework.length > 0 ? (
            <div className="space-y-4" suppressHydrationWarning>
              {/* 静态展示框架内容 - 不使用任何复杂组件 */}
              {framework.map((node, index) => (
                <div key={index} className="border rounded-md p-4 bg-gray-50 dark:bg-gray-800/30">
                  <h3 className="font-medium text-lg mb-2">{toText(node.title)}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{toText(node.summary)}</p>
                  {node.children && node.children.length > 0 && (
                    <div className="ml-4 space-y-2">
                      {node.children.map((child, childIndex) => (
                        <div key={childIndex} className="border-l-2 border-gray-300 dark:border-gray-600 pl-4">
                          <h4 className="font-medium text-sm">{toText(child.title)}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{toText(child.summary)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3" aria-hidden>
              <div className="h-5 w-52 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-11/12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-10/12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-9/12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
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
              <CardTitle>阶段里程碑</CardTitle>
              <CardDescription className="text-blue-900/80 dark:text-blue-200/80">知识框架已建立</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-blue-900 dark:text-blue-200">已为你的目标建立结构化知识概览，这将作为后续阶段的参考地图。</p>
          </CardContent>
          <CardFooter>
            <Button onClick={onProceed} className="ml-auto">
              进入 S2：系统动力学
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* S2 简化预览区块：在 S1 页面内联展示，减少跳转 */}
      {(userContext.systemDynamics || streaming.currentStage === 'S2') && (
        <Card className="mt-6 bg-white dark:bg-gray-950/50">
          <CardHeader>
            <CardTitle>S2 预览：系统动力学与核心比喻</CardTitle>
          </CardHeader>
          <CardContent>
            {userContext.systemDynamics ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="rounded border border-gray-200 dark:border-gray-800 p-2">
                    {userContext.systemDynamics.mermaidChart ? (
                      <InteractiveMermaid 
                        chart={userContext.systemDynamics.mermaidChart}
                        nodes={userContext.systemDynamics.nodes}
                      />
                    ) : (
                      <div className="h-64 grid grid-rows-4 gap-2">
                        <div className="bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                        <div className="bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                        <div className="bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                        <div className="bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-1">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                    <div className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">核心比喻</div>
                    <div className="text-sm text-amber-800 dark:text-amber-300">
                      {userContext.systemDynamics.metaphor || '生成中…'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2" aria-hidden>
                <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-48 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => navigateToStage('S2_SYSTEM_DYNAMICS')}>查看完整系统动力学</Button>
            <Button onClick={onProceed}>继续到 S3</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
