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
  // 从Zustand store获取状态和方法
  const { currentState, setCurrentState, userContext, updateUserContext, isLoading, setLoading, error, setError } = useCognitiveCoachStore();
  
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

  // 获取当前状态ID（S0, S1等）
  const currentStateId = currentState.split('_')[0] as State['id'];

  // 获取已完成的状态列表
  const getCompletedStates = (): State['id'][] => {
    const stateOrder = ['S0', 'S1', 'S2', 'S3', 'S4'];
    const currentIndex = stateOrder.indexOf(currentStateId);
    return stateOrder.slice(0, currentIndex) as State['id'][];
  };

  // S0状态的目标精炼处理
  const handleGoalRefinement = async (userInput: string) => {
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
        if (result.data.status === 'clarification_needed') {
          // AI needs more information
          setS0ConversationMode(true);
          setS0AiQuestion(result.data.ai_question);
          
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
  };

  // 生成知识框架
  const generateKnowledgeFramework = async (userGoal: string) => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generateFramework',
          payload: { userGoal }
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        updateUserContext({ knowledgeFramework: result.data.framework });
      } else if (result.status === 'error') {
        setError(result.error || '生成知识框架失败');
      }
    } catch (error) {
      console.error('Error generating framework:', error);
      setError('生成知识框架时发生错误');
    } finally {
      setLoading(false);
    }
  };

  // 生成系统动力学
  const generateSystemDynamics = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generateSystemDynamics',
          payload: { 
            framework: userContext.knowledgeFramework 
          }
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        updateUserContext({ 
          systemDynamics: {
            mermaidChart: result.data.mermaidChart,
            metaphor: result.data.metaphor
          }
        });
      } else if (result.status === 'error') {
        setError(result.error || '生成系统动力学失败');
      }
    } catch (error) {
      console.error('Error generating system dynamics:', error);
      setError('生成系统动力学时发生错误');
    } finally {
      setLoading(false);
    }
  };

  // 生成行动计划
  const generateActionPlan = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generateActionPlan',
          payload: { 
            userGoal: userContext.userGoal,
            framework: userContext.knowledgeFramework 
          }
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        updateUserContext({ 
          actionPlan: result.data.actionPlan,
          kpis: result.data.kpis
        });
      } else if (result.status === 'error') {
        setError(result.error || '生成行动计划失败');
      }
    } catch (error) {
      console.error('Error generating action plan:', error);
      setError('生成行动计划时发生错误');
    } finally {
      setLoading(false);
    }
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
      setCurrentState(nextState);
      
      // 在进入S2时生成系统动力学
      if (nextState === 'S2_SYSTEM_DYNAMICS') {
        await generateSystemDynamics();
      }
      // 在进入S3时生成行动计划
      else if (nextState === 'S3_ACTION_PLAN') {
        await generateActionPlan();
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
            completedStates={getCompletedStates()} 
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
        </div>
      )}
    </div>
  );
}