/**
 * DebugPanel - 开发环境调试信息面板
 * 
 * 职责：
 * - 显示当前状态、用户目标、加载状态等调试信息
 * - 仅在开发环境显示
 * - 固定在页面右下角
 * 
 * 使用场景：
 * - ClientPage 开发调试
 */

'use client';

import React from 'react';
import { useCognitiveCoachStore } from '@/lib/store';

interface DebugPanelProps {
  isClientMounted: boolean;
}

export function DebugPanel({ isClientMounted }: DebugPanelProps) {
  const currentState = useCognitiveCoachStore(state => state.currentState);
  const userContext = useCognitiveCoachStore(state => state.userContext);
  const isLoading = useCognitiveCoachStore(state => state.isLoading);
  const streaming = useCognitiveCoachStore(state => state.streaming);
  const error = useCognitiveCoachStore(state => state.error);

  // 获取当前状态ID（S0, S1等）
  const currentStateId = React.useMemo(() => 
    currentState.split('_')[0] as 'S0' | 'S1' | 'S2' | 'S3' | 'S4', 
    [currentState]
  );

  // 仅在开发环境和客户端挂载后显示
  if (process.env.NODE_ENV !== 'development' || !isClientMounted) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg text-xs max-w-sm z-50"
      suppressHydrationWarning
    >
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
  );
}

