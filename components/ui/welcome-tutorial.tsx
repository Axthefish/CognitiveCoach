/**
 * Welcome Tutorial - 首次访问教程
 * 
 * 引导新用户了解三阶段流程
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button';
import { Card } from './card';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// 类型定义
// ============================================

interface TutorialStep {
  title: string;
  description: string;
  icon?: string;
  tip?: string;
}

interface WelcomeTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

// ============================================
// 教程步骤
// ============================================

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '欢迎使用 CognitiveCoach',
    description: '我们将通过3个智能阶段，帮你制定个性化的学习方案',
    icon: '🎓',
    tip: '整个过程大约需要5-10分钟',
  },
  {
    title: '阶段 1：目的澄清',
    description: '通过对话式交互，明确你的目标和需求。AI会通过追问帮你理清真正想要的是什么。',
    icon: '💬',
    tip: '花2-3分钟深入思考你的真实目的',
  },
  {
    title: '阶段 2：框架生成',
    description: 'AI基于你的目的生成带权重的学习框架。颜色越深代表越重要，你可以看到各模块的优先级。',
    icon: '🗺️',
    tip: '框架会自动计算每个模块的必要性和时间投资回报率',
  },
  {
    title: '阶段 3：个性化定制',
    description: '回答几个问题，AI会根据你的实际情况调整框架权重，并生成具体的行动计划。',
    icon: '🎯',
    tip: '诚实回答能帮AI做出更准确的判断',
  },
];

// ============================================
// 组件
// ============================================

export function WelcomeTutorial({ onComplete, onSkip }: WelcomeTutorialProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [direction, setDirection] = React.useState<'forward' | 'backward'>('forward');
  
  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;
  
  const handleNext = React.useCallback(() => {
    if (isLastStep) {
      onComplete();
    } else {
      setDirection('forward');
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, onComplete]);
  
  const handlePrevious = React.useCallback(() => {
    if (!isFirstStep) {
      setDirection('backward');
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);
  
  // 键盘导航
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft' && !isFirstStep) {
        handlePrevious();
      } else if (e.key === 'Escape') {
        onSkip();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, isFirstStep, onSkip]);
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <Card className="max-w-2xl w-full p-8 relative overflow-hidden">
        {/* 关闭按钮 */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="跳过教程"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* 进度条 */}
        <div className="mb-6">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>步骤 {currentStep + 1} / {TUTORIAL_STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
        
        {/* 步骤内容 */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            initial={{ 
              opacity: 0, 
              x: direction === 'forward' ? 50 : -50 
            }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ 
              opacity: 0, 
              x: direction === 'forward' ? -50 : 50 
            }}
            transition={{ duration: 0.3 }}
            className="min-h-[300px] flex flex-col items-center text-center"
          >
            {/* 图标 */}
            {step.icon && (
              <div className="text-7xl mb-6 animate-pulse-soft">
                {step.icon}
              </div>
            )}
            
            {/* 标题 */}
            <h2 
              id="tutorial-title"
              className="text-3xl font-bold mb-4 text-gray-900"
            >
              {step.title}
            </h2>
            
            {/* 描述 */}
            <p className="text-lg text-gray-600 mb-6 max-w-lg">
              {step.description}
            </p>
            
            {/* 提示 */}
            {step.tip && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 max-w-md">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">💡 提示：</span> {step.tip}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        
        {/* 导航按钮 */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <Button
            onClick={handlePrevious}
            variant="outline"
            disabled={isFirstStep}
            className={cn(
              'gap-2',
              isFirstStep && 'invisible'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            上一步
          </Button>
          
          <div className="flex gap-2">
            {TUTORIAL_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > currentStep ? 'forward' : 'backward');
                  setCurrentStep(index);
                }}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  index === currentStep 
                    ? 'bg-blue-600 w-8' 
                    : 'bg-gray-300 hover:bg-gray-400'
                )}
                aria-label={`转到步骤 ${index + 1}`}
                aria-current={index === currentStep ? 'step' : undefined}
              />
            ))}
          </div>
          
          <Button
            onClick={handleNext}
            className="gap-2"
          >
            {isLastStep ? '开始使用' : '下一步'}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
        
        {/* 键盘提示 */}
        <div className="mt-4 text-center text-xs text-gray-400">
          使用 ← → 方向键导航 • ESC 跳过
        </div>
      </Card>
    </div>
  );
}

// ============================================
// Hook: 管理教程状态
// ============================================

const TUTORIAL_STORAGE_KEY = 'cognitive-coach-tutorial-completed';

export function useTutorial() {
  const [showTutorial, setShowTutorial] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);
  
  React.useEffect(() => {
    // 检查是否已完成教程
    const hasCompleted = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    
    if (!hasCompleted) {
      // 延迟显示教程，让页面先渲染
      setTimeout(() => {
        setShowTutorial(true);
        setIsChecking(false);
      }, 500);
    } else {
      setIsChecking(false);
    }
  }, []);
  
  const completeTutorial = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setShowTutorial(false);
  };
  
  const skipTutorial = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setShowTutorial(false);
  };
  
  const resetTutorial = () => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setShowTutorial(true);
  };
  
  return {
    showTutorial,
    isChecking,
    completeTutorial,
    skipTutorial,
    resetTutorial,
  };
}

