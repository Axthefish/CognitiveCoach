'use client';

import React from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import S0IntentView from '@/components/s0-intent-view';
import { ErrorBoundary } from '@/components/error-boundary';

export default function Home() {
  const [mounted, setMounted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Store hooks
  const currentState = useCognitiveCoachStore(state => state.currentState);
  const setCurrentState = useCognitiveCoachStore(state => state.setCurrentState);
  const updateUserContext = useCognitiveCoachStore(state => state.updateUserContext);
  
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
        
        {currentState !== 'S0_INTENT_CALIBRATION' && (
          <div>
            <h1 className="text-2xl font-bold mb-4">CognitiveCoach</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">当前状态: {currentState}</p>
            <div className="mt-8 p-4 border rounded-lg">
              <p>S1 及后续组件将在下一步添加</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}