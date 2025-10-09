import { useState, useEffect, useCallback, useRef } from 'react';
import { useCognitiveCoachStore } from '@/lib/store';

/**
 * 加载进度管理 Hook (v2 - 从全局store读取)
 * 
 * 功能：
 * - 平滑的进度数字动画
 * - 从全局store读取进度，避免组件重新挂载导致重置
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

  // 从store读取全局进度状态
  const targetProgress = useCognitiveCoachStore(state => state.streaming.loadingProgress);

  // 平滑进度动画 - 改进：避免从null突变到目标值
  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const elapsed = timestamp - lastTimeRef.current;
    
    if (elapsed >= frameMs) {
      setDisplayProgress(prevValue => {
        if (targetProgress === null) return null;
        
        // 改进：第一次从null到有值时，使用较小的初始值平滑过渡
        if (prevValue === null) {
          return Math.min(targetProgress, 5); // 从5%开始，避免突变
        }
        
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

