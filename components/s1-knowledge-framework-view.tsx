"use client"

import React, { useEffect, useRef } from 'react';
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

// 辅助函数：将任何值安全转换为字符串
const toText = (v: unknown): string => typeof v === 'string' ? v : v == null ? '' : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();

interface S1KnowledgeFrameworkViewProps {
  onProceed: () => void
}

export default function S1KnowledgeFrameworkView({ onProceed }: S1KnowledgeFrameworkViewProps) {
  const { userContext, streaming, isLoading, updateUserContext, addVersionSnapshot, setQaIssues, stopStreaming, setError } = useCognitiveCoachStore();
  const framework = userContext.knowledgeFramework;
  const hasStartedStream = useRef(false);

  // 监听userGoal变化，确保在目标设置后才启动流式处理
  useEffect(() => {
    // 如果正在S1阶段加载，有有效的userGoal，但还没有启动流式处理
    if (isLoading && 
        streaming.currentStage === 'S1' && 
        userContext.userGoal && 
        userContext.userGoal.trim().length > 0 && 
        !hasStartedStream.current) {
      
      hasStartedStream.current = true;
      // CognitiveStreamAnimator会自动处理流式请求
    }
    
    // 如果在S1阶段等待userGoal太长时间（超过5秒），显示错误
    if (isLoading && 
        streaming.currentStage === 'S1' && 
        (!userContext.userGoal || userContext.userGoal.trim().length === 0)) {
      
      const timeout = setTimeout(() => {
        if (isLoading && streaming.currentStage === 'S1' && (!userContext.userGoal || userContext.userGoal.trim().length === 0)) {
          setError('目标精炼失败，请重新开始');
          stopStreaming();
        }
      }, 5000); // 5秒超时
      
      return () => clearTimeout(timeout);
    }
  }, [userContext.userGoal, isLoading, streaming.currentStage, setError, stopStreaming]);

  // 重置流式处理状态当组件卸载时
  useEffect(() => {
    return () => {
      hasStartedStream.current = false;
    };
  }, []);

  // 处理流式生成完成
  const handleStreamComplete = (data: StreamResponseData) => {
    if ('framework' in data && data.framework) {
      updateUserContext({ knowledgeFramework: data.framework });
      addVersionSnapshot();
      setQaIssues(null, []);
    }
  };

  // 处理流式生成错误
  const handleStreamError = (error: string) => {
    const msg = typeof error === 'string' ? error : toText(error);
    console.error('S1 streaming error:', msg);
    
    // 报告错误
    reportError(new Error(msg), {
      stage: 'S1',
      userGoal: userContext.userGoal,
      component: 'S1KnowledgeFrameworkView',
      hasFramework: !!framework,
      frameworkLength: framework?.length || 0
    });
  };

  // 递归渲染框架节点
  const renderFrameworkNode = (node: FrameworkNode, parentId: string = ''): React.ReactElement | null => {
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
    
    const nodeId = parentId ? `${parentId}-${node.id}` : node.id;
    
    return (
      <AccordionItem key={nodeId} value={nodeId}>
        <AccordionTrigger>{toText(node.title)}</AccordionTrigger>
        <AccordionContent>
          <p className="text-gray-600 dark:text-gray-400 mb-2">{toText(node.summary)}</p>
          {Array.isArray(node.children) ? (
            <Accordion type="single" collapsible className="ml-4">
              {node.children.map(child => renderFrameworkNode(child, nodeId)).filter(Boolean)}
            </Accordion>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    );
  };

  // 如果正在加载且当前阶段是 S1，显示流式动画器
  if (isLoading && streaming.currentStage === 'S1') {
    console.log('✅ S1 View: Should show CognitiveStreamAnimator', {
      isLoading,
      currentStage: streaming.currentStage,
      isStreaming: streaming.isStreaming,
      userGoal: userContext.userGoal
    });
    
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
            <Accordion type="single" collapsible className="w-full">
              {framework.map(node => renderFrameworkNode(node))}
            </Accordion>
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