'use client';

import React from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import S0IntentView from '@/components/s0-intent-view';
import S1KnowledgeFrameworkView from '@/components/s1-knowledge-framework-view';
import S2SystemDynamicsView from '@/components/s2-system-dynamics-view';
import S3ActionPlanView from '@/components/s3-action-plan-view';
import S4AutonomousOperationView from '@/components/s4-autonomous-operation-view';
import FsmNavigator from '@/components/fsm-navigator';
import { State } from '@/lib/types';

export default function Home() {
  // 优化：分别获取状态，避免不必要的重渲染
  const currentState = useCognitiveCoachStore(state => state.currentState);
  const userContext = useCognitiveCoachStore(state => state.userContext);
  const qaIssues = useCognitiveCoachStore(state => state.qaIssues);
  const lastFailedStage = useCognitiveCoachStore(state => state.lastFailedStage);
  const isLoading = useCognitiveCoachStore(state => state.isLoading);
  const error = useCognitiveCoachStore(state => state.error);
  
  // 获取 actions（这些通常是稳定的，不会导致重渲染）
  const { setCurrentState, updateUserContext, setLoading, setError } = useCognitiveCoachStore();
  
  // Local state for S0 conversation
  const [s0ConversationMode, setS0ConversationMode] = React.useState(false);
  const [s0AiQuestion, setS0AiQuestion] = React.useState<string | undefined>();

  // FSM状态定义
  const states: State[] = [
    { id: 'S0', name: 'Intent Calibration' },
    { id: 'S1', name: 'Knowledge Framework' },
    { id: 'S2', name: 'System Dynamics' },
    { id: 'S3', name: 'Action Plan' },
    { id: 'S4', name: 'Autonomous Operation' }
  ];

  // 获取当前状态ID（S0, S1等） - 使用 useMemo 优化
  const currentStateId = React.useMemo(() => 
    currentState.split('_')[0] as State['id'], 
    [currentState]
  );

  // 获取已完成的状态列表 - 使用 useMemo 优化
  const completedStates = React.useMemo((): State['id'][] => {
    const stateOrder = ['S0', 'S1', 'S2', 'S3', 'S4'];
    const currentIndex = stateOrder.indexOf(currentStateId);
    return stateOrder.slice(0, currentIndex) as State['id'][];
  }, [currentStateId]);

  // 启动流式知识框架生成（使用新的store actions）
  const { startStreaming } = useCognitiveCoachStore();
  
  const generateKnowledgeFramework = React.useCallback(async (_userGoal: string) => {
    startStreaming('S1');
    // 实际的流式处理将由 CognitiveStreamAnimator 组件处理
  }, [startStreaming]);

  // S0状态的目标精炼处理 - 使用 useCallback 优化
  const handleGoalRefinement = React.useCallback(async (userInput: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current conversation history
      const conversationHistory = userContext.goalConversationHistory || [];
      
      // 调用API进行目标精炼
      const response = await fetch('/api/coach', {
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
      });

      const result = await response.json();

      if (result.status === 'success') {
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
          setCurrentState('S1_KNOWLEDGE_FRAMEWORK');
          
          // 触发S1的知识框架生成
          await generateKnowledgeFramework(result.data.goal);
        }
      } else if (result.status === 'error') {
        setError(result.error || '目标精炼失败，请重试');
      }
    } catch (error) {
      console.error('Error refining goal:', error);
      setError('网络错误，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  }, [userContext.goalConversationHistory, s0ConversationMode, setLoading, setError, updateUserContext, setCurrentState, setS0ConversationMode, setS0AiQuestion, generateKnowledgeFramework]);

  

  // 生成系统动力学（流式版本）
  const generateSystemDynamics = async (): Promise<boolean> => {
    startStreaming('S2');
    return true; // 流式处理不需要返回false来阻止状态转换
  };

  // 生成行动计划（流式版本）
  const generateActionPlan = async (): Promise<boolean> => {
    startStreaming('S3');
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
        if (ok) setCurrentState(nextState);
        else return; // QA failed, block transition
      } else if (nextState === 'S3_ACTION_PLAN') {
        const ok = await generateActionPlan();
        if (ok) setCurrentState(nextState);
        else return; // QA failed, block transition
      } else {
        setCurrentState(nextState);
      }
    }
  };

  // 根据当前状态渲染对应的组件
  const renderCurrentStateView = () => {
    switch (currentState) {
      case 'S0_INTENT_CALIBRATION':
        return (
          <S0IntentView 
            onProceed={handleGoalRefinement}
            conversationHistory={userContext.goalConversationHistory}
            aiQuestion={s0AiQuestion}
            isConversationMode={s0ConversationMode}
            recommendations={userContext.goalRecommendations}
          />
        );
      
      case 'S1_KNOWLEDGE_FRAMEWORK':
        return <S1KnowledgeFrameworkView onProceed={handleProceedToNextState} />;
      
      case 'S2_SYSTEM_DYNAMICS':
        return <S2SystemDynamicsView onProceed={handleProceedToNextState} />;
      
      case 'S3_ACTION_PLAN':
        return <S3ActionPlanView onProceed={handleProceedToNextState} />;
      
      case 'S4_AUTONOMOUS_OPERATION':
        return <S4AutonomousOperationView />;
      
      default:
        return <div>Unknown state</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* FSM导航器 */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <FsmNavigator 
            states={states} 
            currentState={currentStateId} 
            completedStates={completedStates} 
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
              <span className="text-red-800">{error}</span>
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
        
        {/* 加载遮罩 */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
              <div className="flex items-center space-x-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                  AI 正在生成内容...
                </span>
              </div>
            </div>
          </div>
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
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg text-xs max-w-sm">
          <div className="font-bold mb-2">Debug Info:</div>
          <div>Current State: {currentState}</div>
          <div>User Goal: {userContext.userGoal || 'Not set'}</div>
          <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
          <div>Error: {error || 'None'}</div>
          <div>RunTier: {userContext.runTier}</div>
          <div>DecisionType: {userContext.decisionType}</div>
          <div>Seed: {userContext.seed ?? '-'}</div>
        </div>
      )}
    </div>
  );
}