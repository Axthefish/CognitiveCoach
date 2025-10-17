/**
 * 入场动画时间线控制
 * 
 * 功能：
 * - 定义动画步骤序列
 * - 控制动画时机
 * - 支持Stage 3的初次展示动画
 */

import type { Node3DRenderData } from '@/lib/types-v2';

/**
 * 动画步骤定义
 */
export interface AnimationStep {
  timestamp: number; // 毫秒
  action: () => void;
  description: string;
  duration?: number; // 动画持续时间
}

/**
 * 创建入场动画序列
 * 
 * 动画流程：
 * 1. 相机从远处飞入 (0-800ms)
 * 2. 节点依次出现（按权重从高到低）(800-1500ms)
 * 3. 连接线逐条绘制 (1500-2500ms)
 * 4. 启用交互和自动旋转 (2500ms+)
 */
export function createEntryAnimation(
  nodes: Node3DRenderData[],
  onCameraFlyIn?: () => void,
  onNodesAppear?: (nodeIds: string[]) => void,
  onEdgesDrawn?: () => void,
  onInteractionEnabled?: () => void
): AnimationStep[] {
  // 按权重排序节点
  const sortedNodes = [...nodes].sort((a, b) => b.baseNode.weight - a.baseNode.weight);
  
  return [
    {
      timestamp: 0,
      duration: 800,
      action: () => {
        onCameraFlyIn?.();
      },
      description: 'Camera flies in from distance',
    },
    {
      timestamp: 800,
      duration: 700,
      action: () => {
        const nodeIds = sortedNodes.map(n => n.baseNode.id);
        onNodesAppear?.(nodeIds);
      },
      description: 'Nodes appear by weight (high to low)',
    },
    {
      timestamp: 1500,
      duration: 1000,
      action: () => {
        onEdgesDrawn?.();
      },
      description: 'Edges draw in sequentially',
    },
    {
      timestamp: 2500,
      duration: 0,
      action: () => {
        onInteractionEnabled?.();
      },
      description: 'Enable interaction and auto-rotation',
    },
  ];
}

/**
 * 动画时间线播放器
 */
export class AnimationTimeline {
  private steps: AnimationStep[];
  private startTime: number = 0;
  private isPlaying: boolean = false;
  private currentStepIndex: number = 0;
  
  constructor(steps: AnimationStep[]) {
    this.steps = steps.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * 开始播放
   */
  play() {
    this.startTime = Date.now();
    this.isPlaying = true;
    this.currentStepIndex = 0;
    this.tick();
  }
  
  /**
   * 停止播放
   */
  stop() {
    this.isPlaying = false;
  }
  
  /**
   * 跳到指定时间
   */
  seekTo(timeMs: number) {
    const elapsedTime = timeMs;
    
    // 执行所有应该已经执行的步骤
    this.steps.forEach((step, index) => {
      if (step.timestamp <= elapsedTime && index >= this.currentStepIndex) {
        step.action();
        this.currentStepIndex = index + 1;
      }
    });
  }
  
  /**
   * 跳到结束（立即完成所有动画）
   */
  skipToEnd() {
    this.steps.forEach(step => step.action());
    this.currentStepIndex = this.steps.length;
    this.isPlaying = false;
  }
  
  /**
   * 时间线tick
   */
  private tick() {
    if (!this.isPlaying) return;
    
    const elapsedTime = Date.now() - this.startTime;
    
    // 检查是否有需要执行的步骤
    while (
      this.currentStepIndex < this.steps.length &&
      this.steps[this.currentStepIndex].timestamp <= elapsedTime
    ) {
      const step = this.steps[this.currentStepIndex];
      step.action();
      this.currentStepIndex++;
    }
    
    // 如果还没播放完，继续tick
    if (this.currentStepIndex < this.steps.length) {
      requestAnimationFrame(() => this.tick());
    } else {
      this.isPlaying = false;
    }
  }
  
  /**
   * 获取总时长
   */
  getTotalDuration(): number {
    if (this.steps.length === 0) return 0;
    const lastStep = this.steps[this.steps.length - 1];
    return lastStep.timestamp + (lastStep.duration || 0);
  }
}

