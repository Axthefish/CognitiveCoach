/**
 * useStageNavigation Hook - 状态导航和转换逻辑
 * 
 * 职责：
 * - 封装阶段间的状态转换逻辑
 * - 封装流式生成触发逻辑
 * - 处理阶段完成标记
 * 
 * 使用场景：
 * - ClientPage 主页面
 * - 其他需要控制阶段流转的组件
 */

import { useCallback } from 'react';
import { useCognitiveCoachStore } from '@/lib/store';
import type { FSMState } from '@/lib/types';
import { logger } from '@/lib/logger';

export function useStageNavigation() {
  const {
    currentState,
    userContext,
    isLoading,
    setCurrentState,
    updateUserContext,
    startStreaming,
    markStageCompleted,
  } = useCognitiveCoachStore();

  /**
   * 启动知识框架生成
   */
  const generateKnowledgeFramework = useCallback(async (explicitGoal?: string) => {
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

  /**
   * S0 状态的目标精炼处理
   */
  const handleProceedFromS0 = useCallback(async (goal: string) => {
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

  /**
   * 通用的状态前进处理
   */
  const handleProceedToNextState = useCallback(async () => {
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
      logger.error('No next state for:', currentState);
      return;
    }

    // Mark current stage as completed
    markStageCompleted(currentState as FSMState);
    
    // 切换到下一个状态
    setCurrentState(nextState as FSMState);
    
    // 根据状态切换执行不同的操作
    if (nextState === 'S2_SYSTEM_DYNAMICS') {
      startStreaming('S2');
    } else if (nextState === 'S3_ACTION_PLAN') {
      startStreaming('S3');
    }
    // S4 doesn't use streaming
  }, [
    currentState,
    isLoading,
    setCurrentState,
    startStreaming,
    markStageCompleted,
    userContext.systemDynamics
  ]);

  return {
    generateKnowledgeFramework,
    handleProceedFromS0,
    handleProceedToNextState,
  };
}

