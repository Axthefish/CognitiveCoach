/**
 * 阶段进度条组件
 * 玻璃态设计 + Framer Motion 动画
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Lock } from 'lucide-react';
import type { StageState } from '@/lib/types-v2';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';

interface StageProgressBarProps {
  currentStage: StageState;
  onStageClick?: (stage: StageState) => void;
  className?: string;
}

interface StageInfo {
  id: StageState;
  name: string;
  nameEn: string;
  shortName: string;
  description: string;
  percentage: number;
}

const STAGES: StageInfo[] = [
  {
    id: 'STAGE_0_PURPOSE_CLARIFICATION',
    name: '目的澄清',
    nameEn: 'Purpose',
    shortName: '阶段 0',
    description: '明确目标和需求',
    percentage: 0,
  },
  {
    id: 'STAGE_1_FRAMEWORK_GENERATION',
    name: '框架生成',
    nameEn: 'Framework',
    shortName: '阶段 1',
    description: '生成通用解决框架',
    percentage: 33,
  },
  {
    id: 'STAGE_2_PERSONALIZATION',
    name: '个性化',
    nameEn: 'Personalize',
    shortName: '阶段 2',
    description: '定制专属方案',
    percentage: 66,
  },
  {
    id: 'COMPLETED',
    name: '完成',
    nameEn: 'Complete',
    shortName: '完成',
    description: '方案已生成',
    percentage: 100,
  },
];

export function StageProgressBar({
  currentStage,
  onStageClick,
  className,
}: StageProgressBarProps) {
  const { isMobile } = useBreakpoint();
  
  const currentStageIndex = STAGES.findIndex(s => s.id === currentStage);
  const currentPercentage = STAGES[currentStageIndex]?.percentage || 0;
  
  const canNavigateTo = (index: number) => {
    // 只能返回到已完成的阶段
    return index < currentStageIndex && onStageClick;
  };
  
  const getStageStatus = (index: number): 'completed' | 'current' | 'locked' => {
    if (index < currentStageIndex) return 'completed';
    if (index === currentStageIndex) return 'current';
    return 'locked';
  };
  
  if (isMobile) {
    // 移动端：垂直步骤条
    return (
      <div className={cn('glass-card-secondary rounded-xl p-4', className)}>
        <div className="space-y-3">
          {STAGES.map((stage, index) => {
            const status = getStageStatus(index);
            const isClickable = canNavigateTo(index);
            
            return (
              <motion.button
                key={stage.id}
                onClick={() => isClickable && onStageClick?.(stage.id)}
                disabled={!isClickable}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg transition-all',
                  status === 'current' && 'glass-card-primary',
                  isClickable && 'cursor-pointer hover:glass-card-primary'
                )}
                whileTap={isClickable ? { scale: 0.98 } : {}}
                aria-label={`${stage.name} - ${status === 'completed' ? '已完成' : status === 'current' ? '进行中' : '未开始'}`}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <div className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                  'transition-all duration-300',
                  status === 'completed' && 'bg-gradient-to-r from-green-400 to-green-600',
                  status === 'current' && 'bg-gradient-to-r from-blue-400 to-purple-600 animate-pulse',
                  status === 'locked' && 'bg-gray-400/20'
                )}>
                  {status === 'completed' && <Check className="w-4 h-4 text-white" />}
                  {status === 'current' && <Circle className="w-4 h-4 text-white fill-white" />}
                  {status === 'locked' && <Lock className="w-4 h-4 text-gray-400" />}
                </div>
                
                <div className="flex-1 text-left">
                  <div className={cn(
                    'font-semibold text-sm',
                    status === 'current' ? 'text-white' : 'text-gray-300'
                  )}>
                    {stage.name}
                  </div>
                  <div className="text-xs text-gray-400">{stage.description}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
        
        {/* 进度百分比 */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-300">总体进度</span>
            <span className="text-white font-bold">{currentPercentage}%</span>
          </div>
          <div className="glass-progress-bar h-2 rounded-full overflow-hidden">
            <motion.div
              className="glass-progress-fill h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${currentPercentage}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    );
  }
  
  // 桌面端：横向进度条
  return (
    <div className={cn('glass-card-secondary rounded-2xl p-6', className)}>
      {/* 步骤指示器 */}
      <div className="relative">
        {/* 连接线 */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-white/10" />
        <motion.div
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-600"
          initial={{ width: '0%' }}
          animate={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        
        {/* 步骤节点 */}
        <div className="relative flex justify-between">
          {STAGES.map((stage, index) => {
            const status = getStageStatus(index);
            const isClickable = canNavigateTo(index);
            
            return (
              <div key={stage.id} className="flex flex-col items-center" style={{ width: `${100 / STAGES.length}%` }}>
                <motion.button
                  onClick={() => isClickable && onStageClick?.(stage.id)}
                  disabled={!isClickable}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'transition-all duration-300 relative z-10',
                    status === 'completed' && 'bg-gradient-to-r from-green-400 to-green-600 shadow-lg',
                    status === 'current' && 'bg-gradient-to-r from-blue-400 to-purple-600 shadow-lg animate-pulse',
                    status === 'locked' && 'bg-gray-400/20',
                    isClickable && 'cursor-pointer hover:scale-110'
                  )}
                  whileHover={isClickable ? { scale: 1.1 } : {}}
                  whileTap={isClickable ? { scale: 0.95 } : {}}
                  aria-label={`${stage.name} - ${status === 'completed' ? '已完成' : status === 'current' ? '进行中' : '未开始'}`}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  {status === 'completed' && <Check className="w-5 h-5 text-white" />}
                  {status === 'current' && <Circle className="w-5 h-5 text-white fill-white" />}
                  {status === 'locked' && <Lock className="w-5 h-5 text-gray-400" />}
                </motion.button>
                
                <div className="mt-3 text-center">
                  <div className={cn(
                    'font-semibold text-sm',
                    status === 'current' ? 'text-white' : 'text-gray-300'
                  )}>
                    {stage.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {stage.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* 进度百分比 */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">总体进度</span>
          <span className="text-lg font-bold text-white">{currentPercentage}%</span>
        </div>
        <div className="glass-progress-bar h-3 rounded-full overflow-hidden">
          <motion.div
            className="glass-progress-fill h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${currentPercentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  );
}

