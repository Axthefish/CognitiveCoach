'use client';

import React from 'react';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import Stage0View from '@/components/stage0-view';
import Stage1View from '@/components/stage1-view';
import Stage2View from '@/components/stage2-view';
import { Card } from '@/components/ui/card';

/**
 * 新产品流程的主页面 (V2)
 * 
 * 三阶段流程：
 * - Stage 0: 目的澄清（对话式）
 * - Stage 1: 通用框架（逻辑流程图）
 * - Stage 2: 个性化方案（动态收集+实时更新）
 */
export default function ClientPageV2() {
  const [isClientMounted, setIsClientMounted] = React.useState(false);
  const currentStage = useCognitiveCoachStoreV2(state => state.currentStage);
  const error = useCognitiveCoachStoreV2(state => state.error);
  const isLoading = useCognitiveCoachStoreV2(state => state.isLoading);
  const setError = useCognitiveCoachStoreV2(state => state.setError);
  const reset = useCognitiveCoachStoreV2(state => state.reset);
  
  // 客户端挂载标志
  React.useEffect(() => {
    setIsClientMounted(true);
  }, []);
  
  // 防止 hydration mismatch
  if (!isClientMounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载 CognitiveCoach...</p>
        </div>
      </div>
    );
  }
  
  // 渲染当前阶段
  const renderStage = () => {
    switch (currentStage) {
      case 'STAGE_0_PURPOSE_CLARIFICATION':
        return <Stage0View />;
      
      case 'STAGE_1_FRAMEWORK_GENERATION':
        return <Stage1View />;
      
      case 'STAGE_2_PERSONALIZATION':
        return <Stage2View />;
      
      case 'COMPLETED':
        return (
          <div className="h-screen flex items-center justify-center bg-gray-50">
            <Card className="p-8 text-center max-w-md">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">完成！</h2>
              <p className="text-gray-600 mb-6">你的个性化方案已生成</p>
              <button
                onClick={reset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                开始新的规划
              </button>
            </Card>
          </div>
        );
      
      default:
        return (
          <div className="h-screen flex items-center justify-center bg-gray-50">
            <Card className="p-8 text-center max-w-md">
              <p className="text-gray-600">未知状态</p>
            </Card>
          </div>
        );
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 全局错误提示 */}
      {error && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <div className="text-red-600 flex-shrink-0">⚠️</div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">出现错误</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </Card>
        </div>
      )}
      
      {/* 全局加载遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-40">
          <Card className="p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </Card>
        </div>
      )}
      
      {/* 阶段指示器 */}
      <div className="fixed top-4 left-4 z-30">
        <Card className="p-3 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${currentStage === 'STAGE_0_PURPOSE_CLARIFICATION' ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`w-2 h-2 rounded-full ${currentStage === 'STAGE_1_FRAMEWORK_GENERATION' ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`w-2 h-2 rounded-full ${currentStage === 'STAGE_2_PERSONALIZATION' ? 'bg-blue-600' : 'bg-gray-300'}`} />
          </div>
        </Card>
      </div>
      
      {/* 主内容 */}
      {renderStage()}
    </div>
  );
}

