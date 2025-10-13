/**
 * 智能加载指示器
 * 显示分阶段进度、预估时间和认知学习小贴士
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, Brain, Zap } from 'lucide-react';

interface LoadingStep {
  label: string;
  percentage: number;
  tip?: string;
}

interface SmartLoadingProps {
  steps: LoadingStep[];
  estimatedTime?: string;
  tips?: string[];
  className?: string;
}

const DEFAULT_TIPS = [
  '💡 认知负荷理论：将复杂任务分解能提高学习效率',
  '🎯 间隔重复：多次复习比一次性学习更有效',
  '🔄 主动回忆：尝试回忆比被动阅读记忆效果更好',
  '🎨 多模态学习：结合视觉、听觉能增强理解',
  '🌟 元认知：思考自己的思考过程能提升学习质量',
];

export function SmartLoading({
  steps,
  estimatedTime = '10-30 秒',
  tips = DEFAULT_TIPS,
  className,
}: SmartLoadingProps) {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [currentTipIndex, setCurrentTipIndex] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  
  const currentStep = steps[currentStepIndex] || steps[0];
  
  // 模拟进度更新
  React.useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const targetPercentage = currentStep.percentage;
        const increment = (targetPercentage - prev) / 10;
        const newProgress = prev + increment;
        
        if (newProgress >= targetPercentage) {
          // 进入下一步
          if (currentStepIndex < steps.length - 1) {
            setTimeout(() => {
              setCurrentStepIndex(currentStepIndex + 1);
            }, 500);
          }
          return targetPercentage;
        }
        
        return newProgress;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [currentStep, currentStepIndex, steps.length]);
  
  // 定期切换提示
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % tips.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [tips.length]);
  
  return (
    <div className={className}>
      <motion.div
        className="glass-card-primary rounded-2xl p-8 max-w-2xl mx-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* 动画图标 */}
        <div className="flex justify-center mb-6">
          <motion.div
            className="relative"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-400 to-purple-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                <Brain className="w-10 h-10 text-blue-400" />
              </div>
            </div>
            
            {/* 环绕粒子 */}
            {[0, 120, 240].map((angle, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2"
                animate={{
                  x: Math.cos((angle * Math.PI) / 180) * 40 - 4,
                  y: Math.sin((angle * Math.PI) / 180) * 40 - 4,
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: i * 0.2,
                }}
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
              </motion.div>
            ))}
          </motion.div>
        </div>
        
        {/* 标题 */}
        <motion.h2
          className="text-2xl font-bold text-center text-white mb-2"
          key={currentStep.label}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep.label}
        </motion.h2>
        
        <p className="text-center text-gray-300 text-sm mb-6">
          AI 正在处理中，请稍候...
        </p>
        
        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-300">进度</span>
            <span className="text-white font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="glass-progress-bar h-3 rounded-full overflow-hidden">
            <motion.div
              className="glass-progress-fill h-full rounded-full flex items-center justify-end pr-2"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <motion.div
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                <Zap className="w-3 h-3 text-white" />
              </motion.div>
            </motion.div>
          </div>
        </div>
        
        {/* 步骤指示器 */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index < currentStepIndex
                  ? 'w-8 bg-green-400'
                  : index === currentStepIndex
                  ? 'w-12 bg-gradient-to-r from-blue-400 to-purple-600'
                  : 'w-8 bg-gray-600'
              }`}
              initial={{ scale: 0.8 }}
              animate={{ scale: index === currentStepIndex ? 1 : 0.8 }}
            />
          ))}
        </div>
        
        {/* 预估时间 */}
        <div className="text-center text-sm text-gray-400 mb-6">
          <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" />
          预计需要 {estimatedTime}
        </div>
        
        {/* 认知学习小贴士 */}
        <div className="glass-card-secondary rounded-xl p-4 min-h-[60px] flex items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTipIndex}
              className="text-sm text-gray-200 flex items-start gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>{tips[currentTipIndex]}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * 简单加载指示器（用于小范围加载）
 */
export function SimpleLoading({ message = '加载中...' }: { message?: string }) {
  return (
    <motion.div
      className="flex items-center gap-3 text-gray-300"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-5 h-5" />
      </motion.div>
      <span className="text-sm">{message}</span>
    </motion.div>
  );
}

