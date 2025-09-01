'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useCognitiveCoachStore } from '@/lib/store';
import S0IntentView from '@/components/s0-intent-view';
import { ErrorBoundary } from '@/components/error-boundary';

// 动态导入 S1 组件，禁用 SSR
const S1Simple = dynamic(() => import('@/components/s1-simple'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ),
});

export default function Home() {
  const [mounted, setMounted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Store hooks
  const currentState = useCognitiveCoachStore(state => state.currentState);
  const setCurrentState = useCognitiveCoachStore(state => state.setCurrentState);
  const updateUserContext = useCognitiveCoachStore(state => state.updateUserContext);
  const userContext = useCognitiveCoachStore(state => state.userContext);
  
  React.useEffect(() => {
    try {
      setMounted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, []);
  
  // 处理从S0进入下一阶段
  const handleProceedFromS0 = (goal: string) => {
    console.log('Goal received:', goal);
    updateUserContext({ userGoal: goal });
    setCurrentState('S1_KNOWLEDGE_FRAMEWORK');
  };
  
  // 处理从S1进入下一阶段
  const handleProceedFromS1 = () => {
    console.log('Proceeding from S1 to S2');
    setCurrentState('S2_SYSTEM_DYNAMICS');
  };
  
  // 处理返回到上一阶段
  const handleBackToS0 = () => {
    console.log('Going back to S0');
    setCurrentState('S0_INTENT_CALIBRATION');
  };
  
  if (error) {
        return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">正在加载 CognitiveCoach...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {currentState === 'S0_INTENT_CALIBRATION' && (
          <ErrorBoundary>
            <S0IntentView onProceed={handleProceedFromS0} />
          </ErrorBoundary>
        )}
        
        {currentState === 'S1_KNOWLEDGE_FRAMEWORK' && (
          <ErrorBoundary>
            <S1Simple 
              userGoal={userContext.userGoal}
              onProceed={handleProceedFromS1}
              onBack={handleBackToS0}
            />
          </ErrorBoundary>
        )}
        
        {currentState !== 'S0_INTENT_CALIBRATION' && currentState !== 'S1_KNOWLEDGE_FRAMEWORK' && (
          <div>
            <h1 className="text-2xl font-bold mb-4">CognitiveCoach</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">当前状态: {currentState}</p>
            <div className="mt-8 p-4 border rounded-lg">
              <p>S2、S3、S4 组件将在后续步骤中添加</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}