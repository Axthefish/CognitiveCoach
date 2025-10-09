'use client';

import React from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import S0IntentView from '@/components/s0-intent-view';
import dynamic from 'next/dynamic';

const S1KnowledgeFrameworkView = dynamic(
  () => import('@/components/s1-knowledge-framework-view'),
  { ssr: false }
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
import { useStageNavigation } from '@/lib/hooks/useStageNavigation';

// DebugPanel - 仅在开发环境动态导入，减少生产包体积
const DebugPanel = dynamic(
  () => import('@/components/ui/debug-panel').then(m => ({ default: m.DebugPanel })),
  { ssr: false }
);

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
    setError,
    navigateToStage,
    startIterativeRefinement
  } = useCognitiveCoachStore();
  


  // 使用自定义 Hook 管理状态导航
  const { 
    generateKnowledgeFramework, 
    handleProceedFromS0, 
    handleProceedToNextState 
  } = useStageNavigation();

  // 客户端挂载标志，避免 hydration mismatch
  React.useEffect(() => {
    setIsClientMounted(true);
    // Note: markHydrationComplete() 由 HydrationMonitor 组件统一管理
  }, []);

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

      {/* 调试信息面板（仅在开发环境显示） */}
      {process.env.NODE_ENV === 'development' && <DebugPanel isClientMounted={isClientMounted} />}
    </div>
  );
}
