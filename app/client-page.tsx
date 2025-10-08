'use client';

import React from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import S0IntentView from '@/components/s0-intent-view';
import dynamic from 'next/dynamic';

const S1KnowledgeFrameworkView = dynamic(
  () => import('@/components/s1-knowledge-framework-static'),
  { 
    ssr: false,
    loading: () => (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">S1：知识框架构建</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          正在加载知识框架模块...
        </p>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }
);
const S2SystemDynamicsView = dynamic(
  () => import('@/components/s2-system-dynamics-view'),
  { ssr: false }
);
const S3ActionPlanView = dynamic(
  () => import('@/components/s3-action-plan-view'),
  { ssr: false }
);
const S4AutonomousOperationView = dynamic(
  () => import('@/components/s4-autonomous-operation-view'),
  { ssr: false }
);
import { IterativeNavigator } from '@/components/ui/iterative-navigator';

import { ErrorBoundary } from '@/components/error-boundary';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
// import { enhancedFetch, NetworkError } from '@/lib/network-utils';
import { markHydrationComplete } from '@/lib/hydration-safe';

export default function ClientPage() {
  // 防止 hydration mismatch 的标志
  const [isClientMounted, setIsClientMounted] = React.useState(false);
  
  // 优化：分别获取状态，避免不必要的重渲染
  const currentState = useCognitiveCoachStore(state => state.currentState);
  const userContext = useCognitiveCoachStore(state => state.userContext);
  const qaIssues = useCognitiveCoachStore(state => state.qaIssues);
  const lastFailedStage = useCognitiveCoachStore(state => state.lastFailedStage);
  const isLoading = useCognitiveCoachStore(state => state.isLoading);
  const error = useCognitiveCoachStore(state => state.error);
  const streaming = useCognitiveCoachStore(state => state.streaming);
  
  // Iterative state
  const completedStages = useCognitiveCoachStore(state => state.completedStages);
  const iterationCount = useCognitiveCoachStore(state => state.iterationCount);
  
  // 获取 actions（这些通常是稳定的，不会导致重渲染）
  const { 
    setCurrentState, 
    updateUserContext, 
    setLoading, 
    setError,
    markStageCompleted,
    navigateToStage,
    startIterativeRefinement
  } = useCognitiveCoachStore();
  


  // 客户端挂载标志，避免 hydration mismatch
  React.useEffect(() => {
    setIsClientMounted(true);
    // 标记 hydration 完成，允许使用真实的随机数和时间戳
    markHydrationComplete();
  }, []);

  // 获取当前状态ID（S0, S1等） - 使用 useMemo 优化
  const currentStateId = React.useMemo(() => 
    currentState.split('_')[0] as 'S0' | 'S1' | 'S2' | 'S3' | 'S4', 
    [currentState]
  );

  // 启动流式知识框架生成（使用新的store actions）
  const { startStreaming } = useCognitiveCoachStore();
  
  const generateKnowledgeFramework = React.useCallback(async (explicitGoal?: string) => {
    // 如果提供了明确的goal，先将其存储到store中
    if (explicitGoal && explicitGoal !== userContext.userGoal) {
      updateUserContext({ userGoal: explicitGoal });
      // 使用 Promise 确保状态更新在下一个渲染周期完成
      await new Promise(resolve => {
        // 使用 queueMicrotask 确保在下一个微任务中执行
        queueMicrotask(() => {
          // 再使用 requestAnimationFrame 确保在下一帧开始前执行
          requestAnimationFrame(() => {
            resolve(undefined);
          });
        });
      });
    }
    
    // 状态更新完成后启动流式处理
    startStreaming('S1');
    // 为空状态策略生成按钮提供一个轻量触发通道
    (window as unknown as { __cc_restartS3?: () => void }).__cc_restartS3 = () => startStreaming('S3');
  }, [startStreaming, updateUserContext, userContext.userGoal]);

  // S0状态的目标精炼处理 - 使用 useCallback 优化
  const handleProceedFromS0 = React.useCallback(async (goal: string) => {
    // 如果用户提供了明确的目标，保存到 store
    if (goal) {
      updateUserContext({ 
        userGoal: goal
      });
    }
    
    // 切换到S1状态并启动流式生成
    setCurrentState('S1_KNOWLEDGE_FRAMEWORK');
    await generateKnowledgeFramework(goal);
  }, [setCurrentState, updateUserContext, generateKnowledgeFramework]);

  // 通用的状态前进处理
  const handleProceedToNextState = React.useCallback(async () => {
    if (isLoading) return; // 防止重复点击

    const transitions: Record<string, string> = {
      'S1_KNOWLEDGE_FRAMEWORK': 'S2_SYSTEM_DYNAMICS',
      'S2_SYSTEM_DYNAMICS': 'S3_ACTION_PLAN',
      'S3_ACTION_PLAN': 'S4_AUTONOMOUS_OPERATION'
    };

    // 如果在 S1 阶段已经生成了系统模型，则直接进入 S3，避免重复的二次等待
    let nextState = transitions[currentState];
    if (currentState === 'S1_KNOWLEDGE_FRAMEWORK') {
      nextState = userContext.systemDynamics ? 'S3_ACTION_PLAN' : 'S2_SYSTEM_DYNAMICS';
    }
    
    if (!nextState) {
      console.error('No next state for:', currentState);
      return;
    }

    // Mark current stage as completed
    markStageCompleted(currentState as typeof completedStages[number]);
    
    // 切换到下一个状态
    setCurrentState(nextState as typeof currentState);
    
    // 根据状态切换执行不同的操作
    if (nextState === 'S2_SYSTEM_DYNAMICS') {
      startStreaming('S2');
    } else if (nextState === 'S3_ACTION_PLAN') {
      startStreaming('S3');
    } else if (nextState === 'S4_AUTONOMOUS_OPERATION') {
      // S4 doesn't use streaming but might need setup
      setLoading(false);
    }
  }, [currentState, isLoading, setCurrentState, setLoading, startStreaming, markStageCompleted, userContext.systemDynamics]);

  // 渲染当前状态对应的视图
  const renderCurrentStateView = () => {
    
    // 对于每个阶段，我们都要检查是否在加载中
    switch (currentState) {
      case 'S0_INTENT_CALIBRATION':
        return (
          <ErrorBoundary>
            <S0IntentView 
              onProceed={handleProceedFromS0}
            />
          </ErrorBoundary>
        );
      
      case 'S1_KNOWLEDGE_FRAMEWORK':
        return (
          <ErrorBoundary>
            <S1KnowledgeFrameworkView onProceed={handleProceedToNextState} />
          </ErrorBoundary>
        );

      case 'S2_SYSTEM_DYNAMICS':
        return (
          <ErrorBoundary>
            <S2SystemDynamicsView onProceed={handleProceedToNextState} />
          </ErrorBoundary>
        );

      case 'S3_ACTION_PLAN':
        return (
          <ErrorBoundary>
            <S3ActionPlanView onProceed={handleProceedToNextState} />
          </ErrorBoundary>
        );

      case 'S4_AUTONOMOUS_OPERATION':
        return (
          <ErrorBoundary>
            <S4AutonomousOperationView />
          </ErrorBoundary>
        );

      default:
        return <div>Unknown state</div>;
    }
  };

  // 防止 hydration mismatch - 在客户端挂载前显示最小UI
  if (!isClientMounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center" suppressHydrationWarning>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">正在加载 CognitiveCoach...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" suppressHydrationWarning>
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Iterative Navigation */}
        {completedStages.length > 0 && (
          <IterativeNavigator 
            currentState={currentState}
            completedStages={completedStages}
            iterationCount={iterationCount}
            onNavigate={(targetState) => {
              navigateToStage(targetState);
            }}
            onRefine={(targetState) => {
              startIterativeRefinement(targetState);
            }}
          />
        )}

        {/* 根据上下文显示不同的全局加载覆盖（错误优先，避免与加载并存） */}
        {isLoading && !error && (
          <LoadingOverlay 
            stage={streaming.currentStage || 'S0'} 
            variant={
              // 如果有 QA 问题或需要人工审核，显示阻塞版本
              qaIssues.length > 0 || userContext.requiresHumanReview ? 'blocking' : 'inline'
            }
            onRetry={() => {
              // 重试逻辑
              if (lastFailedStage) {
                if (lastFailedStage === 'S1') {
                  generateKnowledgeFramework();
                } else if (lastFailedStage === 'S2') {
                  startStreaming('S2');
                } else if (lastFailedStage === 'S3') {
                  startStreaming('S3');
                }
              } else {
                // 如果没有明确的失败阶段，刷新页面
                window.location.reload();
              }
            }}
          />
        )}

        {/* Error display */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <h3 className="font-semibold mb-2">出现错误</h3>
            <p>{error}</p>
            <button 
              onClick={() => {
                setError(null);
                // 根据当前状态重试
                if (currentState === 'S1_KNOWLEDGE_FRAMEWORK') {
                  generateKnowledgeFramework();
                } else if (currentState === 'S2_SYSTEM_DYNAMICS') {
                  startStreaming('S2');
                } else if (currentState === 'S3_ACTION_PLAN') {
                  startStreaming('S3');
                }
              }}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              重试
            </button>
          </div>
        )}

        {renderCurrentStateView()}
      </main>

              {/* 调试信息（仅在开发环境显示） */}
        {process.env.NODE_ENV === 'development' && isClientMounted && (
          <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg text-xs max-w-sm" suppressHydrationWarning>
            <div className="font-bold mb-2">Debug Info:</div>
            <div>Current State: {currentState}</div>
            <div>User Goal: {userContext.userGoal || 'Not set'}</div>
            <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
            <div>Streaming: {streaming.isStreaming ? 'Yes' : 'No'}</div>
            <div>Streaming Stage: {streaming.currentStage || 'None'}</div>
            <div>Has Framework: {userContext.knowledgeFramework ? 'Yes' : 'No'}</div>
            <div>Show Stream UI: {(isLoading && streaming.currentStage === currentStateId.slice(0, 2)) ? 'Yes' : 'No'}</div>
            <div>Error: {error || 'None'}</div>
            <div>RunTier: {userContext.runTier}</div>
            <div>DecisionType: {userContext.decisionType}</div>
            <div>Seed: {userContext.seed ?? '-'}</div>
            <div>Client Mounted: {isClientMounted ? 'Yes' : 'No'}</div>
          </div>
        )}
    </div>
  );
}
