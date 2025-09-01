"use client"

import React, { useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
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
  const { userContext, streaming, isLoading, updateUserContext, addVersionSnapshot, setQaIssues, stopStreaming } = useCognitiveCoachStore();
  const framework = userContext.knowledgeFramework;
  const hasStartedStream = useRef(false);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const renderCount = useRef(0);
  
  // 调试：记录渲染
  useEffect(() => {
    renderCount.current += 1;
    console.log(`S1 component rendered ${renderCount.current} times, isLoading: ${isLoading}, framework: ${framework ? 'exists' : 'null'}`);
  });

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载/卸载时运行

  // 标记hydration完成
  useEffect(() => {
    markHydrationComplete();
  }, []);

  // 处理流式生成完成
  const handleStreamComplete = (data: StreamResponseData) => {
    console.log('✅ Stream complete, received data:', data);
    if (isMountedRef.current && 'framework' in data && data.framework) {
      updateUserContext({ knowledgeFramework: data.framework });
      addVersionSnapshot();
      setQaIssues(null, []);
      // 完成后设置 loading 为 false
      useCognitiveCoachStore.getState().setLoading(false);
    }
  };

  // 处理流式生成错误
  const handleStreamError = (error: string) => {
    const msg = typeof error === 'string' ? error : toText(error);
    console.error('❌ Stream error in S1:', msg);
    
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
    useCognitiveCoachStore.getState().setLoading(false);
  };

  // 临时测试：使用模拟数据
  const useMockData = false; // 禁用模拟数据，使用真实API
  
  // 如果正在加载，显示流式动画器（不需要检查 streaming.currentStage，因为它是由 CognitiveStreamAnimator 设置的）
  if (isLoading && !useMockData) {
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
              window.location.reload();
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
  
  // 临时：如果使用模拟数据，立即设置框架
  if (isLoading && useMockData && !framework) {
    console.log('📝 Using mock data for testing...');
    setTimeout(() => {
      const mockFramework = [
        {
          id: '1',
          title: '减脂基础原理',
          summary: '了解减脂的科学原理，包括热量赤字、基础代谢率等核心概念',
          children: [
            { id: '1-1', title: '能量平衡原理', summary: '摄入与消耗的关系' },
            { id: '1-2', title: '基础代谢率(BMR)', summary: '身体静息状态下的能量消耗' }
          ]
        },
        {
          id: '2',
          title: '营养策略',
          summary: '合理的饮食计划和营养素分配',
          children: [
            { id: '2-1', title: '宏量营养素比例', summary: '蛋白质、碳水化合物、脂肪的合理配比' },
            { id: '2-2', title: '微量营养素', summary: '维生素和矿物质的重要性' }
          ]
        },
        {
          id: '3',
          title: '运动计划',
          summary: '有效的运动组合策略',
          children: [
            { id: '3-1', title: '有氧运动', summary: '提高心肺功能，增加热量消耗' },
            { id: '3-2', title: '力量训练', summary: '保持肌肉量，提高基础代谢' }
          ]
        }
      ];
      
      handleStreamComplete({ framework: mockFramework });
    }, 1000);
  }

  // 静态展示框架内容 - 完全避免动态渲染
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
