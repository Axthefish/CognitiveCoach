/**
 * 帮助提示组件
 * 提供上下文帮助和引导
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function HelpTooltip({
  content,
  title,
  position = 'top',
  className,
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };
  
  return (
    <div className={cn('relative inline-block', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="p-1 rounded-full hover:bg-white/10 transition-colors"
        aria-label="显示帮助"
        aria-expanded={isOpen}
      >
        <HelpCircle className="w-4 h-4 text-gray-400 hover:text-white" />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={cn(
              'absolute z-50 w-64',
              positionClasses[position]
            )}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <div className="glass-card-primary rounded-lg p-4 shadow-lg">
              {title && (
                <h4 className="font-semibold text-white mb-2">{title}</h4>
              )}
              <div className="text-sm text-gray-300">
                {content}
              </div>
              
              {/* 箭头指示器 */}
              <div
                className={cn(
                  'absolute w-2 h-2 bg-white/10 rotate-45',
                  position === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
                  position === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
                  position === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
                  position === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2'
                )}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 首次访问引导蒙层
 */
export function OnboardingOverlay({
  isOpen,
  onClose,
  steps,
  currentStep,
}: {
  isOpen: boolean;
  onClose: () => void;
  steps: Array<{
    title: string;
    description: string;
    targetElement?: string;
  }>;
  currentStep: number;
}) {
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* 引导提示 */}
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
          >
            <div className="glass-card-primary rounded-2xl p-8">
              {/* 关闭按钮 */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10"
                aria-label="关闭引导"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
              
              {/* 步骤指示器 */}
              <div className="flex gap-2 mb-6">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      index <= currentStep ? 'bg-blue-400' : 'bg-gray-600'
                    )}
                  />
                ))}
              </div>
              
              {/* 内容 */}
              <h3 className="text-2xl font-bold text-white mb-3">
                {step.title}
              </h3>
              <p className="text-gray-300 text-lg mb-8">
                {step.description}
              </p>
              
              {/* 操作按钮 */}
              <div className="flex gap-3">
                {isLastStep ? (
                  <motion.button
                    onClick={onClose}
                    className="flex-1 py-3 px-6 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    whileTap={{ scale: 0.98 }}
                  >
                    开始使用
                  </motion.button>
                ) : (
                  <>
                    <motion.button
                      onClick={onClose}
                      className="px-6 py-3 rounded-xl font-semibold glass-button text-white"
                      whileTap={{ scale: 0.98 }}
                    >
                      跳过
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        // 父组件应该管理 currentStep
                      }}
                      className="flex-1 py-3 px-6 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      whileTap={{ scale: 0.98 }}
                    >
                      下一步 ({currentStep + 1}/{steps.length})
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

