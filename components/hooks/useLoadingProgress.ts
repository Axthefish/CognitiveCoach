import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 加载进度管理 Hook
 * 
 * 功能：
 * - 平滑的进度数字动画
 * - 基于认知步骤计算真实进度
 * - 支持自定义帧率和速度
 */

interface CognitiveStep {
  id: string;
  message: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  timestamp?: number;
}

interface UseLoadingProgressOptions {
  speed?: number;
  frameMs?: number;
}

export function useLoadingProgress(
  cognitiveSteps: CognitiveStep[],
  options: UseLoadingProgressOptions = {}
) {
  const { speed = 0.18, frameMs = 16 } = options;
  const [displayProgress, setDisplayProgress] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // 计算真实进度
  const calculateProgress = useCallback(() => {
    const total = cognitiveSteps.length;
    if (total === 0) return null;
    
    const completed = cognitiveSteps.filter(s => s.status === 'completed').length;
    const inProgress = cognitiveSteps.filter(s => s.status === 'in_progress').length;
    
    // 真实进度计算（completed全算，in_progress算50%）
    const realProgress = Math.min(99, Math.round(((completed + inProgress * 0.5) / total) * 100));
    return realProgress;
  }, [cognitiveSteps]);

  const targetProgress = calculateProgress();

  // 平滑进度动画
  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const elapsed = timestamp - lastTimeRef.current;
    
    if (elapsed >= frameMs) {
      setDisplayProgress(prevValue => {
        if (targetProgress === null) return null;
        if (prevValue === null) return targetProgress;
        
        const delta = targetProgress - prevValue;
        if (Math.abs(delta) < 0.5) {
          return targetProgress; // Snap to target when close enough
        }
        
        return prevValue + delta * speed;
      });
      
      lastTimeRef.current = timestamp;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [targetProgress, speed, frameMs]);

  useEffect(() => {
    if (targetProgress === null) {
      setDisplayProgress(null);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = 0;
    };
  }, [targetProgress, animate]);

  // 获取当前进行中的步骤消息
  const currentStepMessage = cognitiveSteps.find(s => s.status === 'in_progress')?.message;

  return {
    progress: displayProgress,
    currentStepMessage,
    totalSteps: cognitiveSteps.length,
    completedSteps: cognitiveSteps.filter(s => s.status === 'completed').length,
  };
}

