'use client';

import React from 'react';
import { useCognitiveCoachStore } from '@/lib/store';

export default function Home() {
  const [mounted, setMounted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // 始终调用hook，但只在mounted后使用值
  const currentState = useCognitiveCoachStore(state => state.currentState);
  
  React.useEffect(() => {
    try {
      setMounted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, []);
  
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
        <h1 className="text-2xl font-bold mb-4">CognitiveCoach</h1>
        <p className="text-gray-600 dark:text-gray-400">应用已加载成功</p>
        <div className="mt-8 p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">测试 Store 功能</h2>
          <p>当前状态: {currentState}</p>
        </div>
      </main>
    </div>
  );
}