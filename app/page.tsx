'use client';

import React from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import S0IntentView from '@/components/s0-intent-view';
import S1KnowledgeFrameworkView from '@/components/s1-knowledge-framework-view';
import S2SystemDynamicsView from '@/components/s2-system-dynamics-view';
import S3ActionPlanView from '@/components/s3-action-plan-view';
import S4AutonomousOperationView from '@/components/s4-autonomous-operation-view';
import { IterativeNavigator } from '@/components/ui/iterative-navigator';

import { ErrorBoundary } from '@/components/error-boundary';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { enhancedFetch, NetworkError } from '@/lib/network-utils';
import { markHydrationComplete } from '@/lib/hydration-safe';

export default function Home() {
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
  
  // Local state for S0 conversation (初始化为稳定状态以避免 hydration mismatch)
  const [s0ConversationMode, setS0ConversationMode] = React.useState(false);
  const [s0AiQuestion, setS0AiQuestion] = React.useState<string | undefined>(undefined);
  const [s0ForceClarification, setS0ForceClarification] = React.useState(false);

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
    }
    
    // 使用 setTimeout 确保状态更新后再启动流式处理
    setTimeout(() => {
      startStreaming('S1');
    }, 0);
  }, [startStreaming, updateUserContext, userContext.userGoal]);

  // S0状态的目标精炼处理 - 使用 useCallback 优化
  const handleGoalRefinement = React.useCallback(async (userInput: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current conversation history
      const conversationHistory = userContext.goalConversationHistory || [];
      
      // 调用API进行目标精炼
      const response = await enhancedFetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refineGoal',
          payload: { 
            userInput,
            conversationHistory 
          }
        }),
        timeout: 30000,
        retries: 2,
      });

      const result = await response.json();

      if (result.status === 'success') {
        // 检查是否需要强制用户确认
        if (result.data.force_clarification) {
          setS0ForceClarification(true);
        } else {
          setS0ForceClarification(false);
        }
        
        if (result.data.status === 'clarification_needed' || result.data.status === 'recommendations_provided') {
          // AI needs more information or provided recommendations
          setS0ConversationMode(true);
          setS0AiQuestion(result.data.ai_question);
          
          // Store recommendations if provided
          if (result.data.status === 'recommendations_provided' && result.data.recommendations) {
            updateUserContext({ goalRecommendations: result.data.recommendations });
          }
          
          // Update conversation history
          const updatedHistory = [
            ...conversationHistory,
            { role: 'user' as const, content: userInput },
            { role: 'assistant' as const, content: result.data.ai_question }
          ];
          updateUserContext({ goalConversationHistory: updatedHistory });
          
        } else if (result.data.status === 'clarified') {
          // Goal is clarified
          // Add final user input to history if in conversation mode
          if (s0ConversationMode) {
            const finalHistory = [
              ...conversationHistory,
              { role: 'user' as const, content: userInput }
            ];
            updateUserContext({ 
              userGoal: result.data.goal,
              goalConversationHistory: finalHistory 
            });
          } else {
            updateUserContext({ userGoal: result.data.goal });
          }
          
          // Reset S0 conversation state
          setS0ConversationMode(false);
          setS0AiQuestion(undefined);
          
          // 转换到下一个状态
          markStageCompleted('S0_INTENT_CALIBRATION');
          setCurrentState('S1_KNOWLEDGE_FRAMEWORK');
          
          // 触发S1的知识框架生成，直接传递精炼后的goal
          await generateKnowledgeFramework(result.data.goal);
        }
      } else if (result.status === 'error') {
        setError(result.error || '目标精炼失败，请重试');
      }
    } catch (error) {
      console.error('Error refining goal:', error);
      if (error instanceof Error && 'type' in error) {
        // NetworkError with enhanced error info
        const networkError = error as NetworkError;
        if (networkError.type === 'timeout') {
          setError('请求超时，请稍后重试');
        } else if (networkError.type === 'network') {
          setError('网络连接失败，请检查您的网络连接');
        } else if (networkError.type === 'server') {
          // Use specific server error message if available
          setError(networkError.message || '服务器暂时不可用，请稍后重试');
        } else {
          setError(networkError.message || '请求失败，请重试');
        }
      } else {
        setError('网络错误，请检查连接后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [userContext.goalConversationHistory, s0ConversationMode, setLoading, setError, updateUserContext, setCurrentState, setS0ConversationMode, setS0AiQuestion, generateKnowledgeFramework, markStageCompleted]);

  const handleForceProceedS0 = React.useCallback(async () => {
    // 当用户选择强制进行时，我们使用对话历史中的最后一个用户输入作为目标
    const lastUserInput = userContext.goalConversationHistory?.slice(-2)[0]?.content;
    const goal = lastUserInput || userContext.userGoal || "已确认的学习目标";
    
    updateUserContext({ userGoal: goal });
    setCurrentState('S1_KNOWLEDGE_FRAMEWORK');
    await generateKnowledgeFramework(goal);
  }, [userContext.goalConversationHistory, userContext.userGoal, updateUserContext, setCurrentState, generateKnowledgeFramework]);
  

  // 生成系统动力学（流式版本）
  const generateSystemDynamics = async (): Promise<boolean> => {
    // 前置条件：必须有 S1 知识框架
    if (!userContext.knowledgeFramework || userContext.knowledgeFramework.length === 0) {
      setError('请先完成 S1：知识框架尚未生成');
      return false;
    }
    setTimeout(() => {
      startStreaming('S2');
    }, 0);
    return true; // 流式处理不需要返回false来阻止状态转换
  };

  // 生成行动计划（流式版本）
  const generateActionPlan = async (): Promise<boolean> => {
    // 前置条件：需要 S1 知识框架与已确认的学习目标
    if (!userContext.knowledgeFramework || userContext.knowledgeFramework.length === 0) {
      setError('缺少知识框架，无法生成行动计划');
      return false;
    }
    if (!userContext.userGoal || userContext.userGoal.trim().length === 0) {
      setError('缺少学习目标，无法生成行动计划');
      return false;
    }
    setTimeout(() => {
      startStreaming('S3');
    }, 0);
    return true; // 流式处理不需要返回false来阻止状态转换
  };

  // 通用状态转换处理器
  const handleProceedToNextState = async () => {
    const transitions: Record<string, typeof currentState> = {
      'S1_KNOWLEDGE_FRAMEWORK': 'S2_SYSTEM_DYNAMICS',
      'S2_SYSTEM_DYNAMICS': 'S3_ACTION_PLAN',
      'S3_ACTION_PLAN': 'S4_AUTONOMOUS_OPERATION',
    };

    const nextState = transitions[currentState];
    if (nextState) {
      // 先生成并校验，再流转
      if (nextState === 'S2_SYSTEM_DYNAMICS') {
        const ok = await generateSystemDynamics();
        if (ok) {
          setCurrentState(nextState);
          markStageCompleted(currentState);
        }
        else return; // QA failed, block transition
      } else if (nextState === 'S3_ACTION_PLAN') {
        const ok = await generateActionPlan();
        if (ok) {
          setCurrentState(nextState);
          markStageCompleted(currentState);
        }
        else return; // QA failed, block transition
      } else {
        setCurrentState(nextState);
        markStageCompleted(currentState);
      }
    }
  };

  // Iterative navigation handlers
  const handleIterativeNavigation = (targetState: typeof currentState) => {
    navigateToStage(targetState);
  };

  const handleIterativeRefinement = async (targetState: typeof currentState) => {
    // Start iterative refinement
    startIterativeRefinement(targetState);
    
    // Trigger appropriate generation based on target state
    switch (targetState) {
      case 'S2_SYSTEM_DYNAMICS':
        await generateSystemDynamics();
        break;
      case 'S3_ACTION_PLAN':
        await generateActionPlan();
        break;
      case 'S4_AUTONOMOUS_OPERATION':
        // S4 doesn't have generation, just navigate
        break;
    }
  };

  // 根据当前状态渲染对应的组件
  const renderCurrentStateView = () => {
    switch (currentState) {
      case 'S0_INTENT_CALIBRATION':
        return (
          <ErrorBoundary>
            <S0IntentView 
              onProceed={handleGoalRefinement}
              conversationHistory={userContext.goalConversationHistory}
              aiQuestion={s0AiQuestion}
              isConversationMode={s0ConversationMode}
              recommendations={userContext.goalRecommendations}
              forceClarification={s0ForceClarification}
              onForceProceed={handleForceProceedS0}
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Iterative Navigator */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <IterativeNavigator
            currentState={currentState}
            completedStages={completedStages}
            onNavigate={handleIterativeNavigation}
            onRefine={handleIterativeRefinement}
            hasContextForIteration={
              userContext.userGoal !== '' && 
              (userContext.knowledgeFramework?.length || 0) > 0
            }
            iterationCount={iterationCount}
          />
        </div>
      </div>

      {/* 主内容区域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800">{typeof error === 'string' ? error : String(error)}</span>
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* 加载遮罩 - 只在非流式模式下显示 */}
        {isLoading && !streaming.isStreaming && (
          <LoadingOverlay 
            variant="blocking" 
            stage={currentStateId as 'S0' | 'S1' | 'S2' | 'S3' | 'S4'} 
            message={currentStateId === 'S0' ? "AI 正在理解与校准你的目标…" : undefined}
            onRetry={() => {
              // 清除错误状态并重新开始当前阶段
              setError(null);
              switch(currentStateId) {
                case 'S0':
                  // S0的重试需要保持当前状态，用户需要重新输入
                  setLoading(false);
                  break;
                case 'S1':
                  generateKnowledgeFramework();
                  break;
                case 'S2':
                  generateSystemDynamics();
                  break;
                case 'S3':
                  generateActionPlan();
                  break;
                default:
                  setLoading(false);
              }
            }}
          />
        )}
        
        {/* QA Issues banner */}
        {qaIssues.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="font-semibold mb-2">质量校验未通过{lastFailedStage ? `（${lastFailedStage}）` : ''}：</div>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {qaIssues.map((i, idx) => (
                <li key={idx} className={i.severity === 'blocker' ? 'text-red-700' : 'text-yellow-800'}>
                  [{i.severity}] [{i.area}] {i.hint} <span className="text-gray-500">@{i.targetPath}</span>
                </li>
              ))}
            </ul>
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
            <div>Stream Stage: {streaming.currentStage || 'None'}</div>
            <div>Show Full Mask: {(isLoading && !streaming.isStreaming) ? 'Yes' : 'No'}</div>
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