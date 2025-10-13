'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import Stage0View from '@/components/stage0-view';
import Stage1View from '@/components/stage1-view';
import Stage2View from '@/components/stage2-view';
import { StageProgressBar } from '@/components/ui/stage-progress-bar';
import { SmartError } from '@/components/ui/smart-error';
import { GlassCard } from '@/components/ui/glass-card';
import { CompactLanguageSwitcher, type Language } from '@/components/ui/language-switcher';
import { WelcomeTutorial, useTutorial } from '@/components/ui/welcome-tutorial';
import { Sparkles, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

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
  const [language, setLanguage] = React.useState<Language>('en');
  
  const currentStage = useCognitiveCoachStoreV2(state => state.currentStage);
  const error = useCognitiveCoachStoreV2(state => state.error);
  const isLoading = useCognitiveCoachStoreV2(state => state.isLoading);
  const setError = useCognitiveCoachStoreV2(state => state.setError);
  const reset = useCognitiveCoachStoreV2(state => state.reset);
  
  // 教程系统
  const { showTutorial, completeTutorial, skipTutorial } = useTutorial();
  
  // 客户端挂载标志
  React.useEffect(() => {
    setIsClientMounted(true);
    
    // 预加载ECharts（在空闲时）
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        import('echarts-for-react').catch((err) => {
          logger.error('[ClientPageV2] Failed to preload ECharts:', err);
        });
      }, { timeout: 2000 });
    } else {
      // 降级：使用setTimeout
      setTimeout(() => {
        import('echarts-for-react').catch((err) => {
          logger.error('[ClientPageV2] Failed to preload ECharts:', err);
        });
      }, 1000);
    }
  }, []);
  
  // 防止 hydration mismatch
  if (!isClientMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="gradient-background" />
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-400 to-purple-600 p-[2px]"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-blue-400" />
            </div>
          </motion.div>
          <p className="text-white/90 text-lg font-medium">Loading CognitiveCoach...</p>
        </motion.div>
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
          <div className="h-screen flex items-center justify-center">
            <motion.div
              className="text-center max-w-md"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <GlassCard priority="primary" className="p-8">
                <motion.div
                  className="text-6xl mb-6"
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{ duration: 1, repeat: 3 }}
                >
                  🎉
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-3">Congratulations!</h2>
                <p className="text-gray-300 mb-8">Your personalized cognitive growth plan has been generated</p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={reset}
                    size="lg"
                    className="gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Start New Plan
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        );
      
      default:
        return (
          <div className="h-screen flex items-center justify-center">
            <GlassCard priority="primary" className="p-8 text-center max-w-md">
              <p className="text-gray-300">Unknown State</p>
            </GlassCard>
          </div>
        );
    }
  };
  
  return (
    <div className="min-h-screen relative">
      {/* 玻璃态渐变背景 */}
      <div className="gradient-background" />
      
      {/* 全局错误提示 */}
      <AnimatePresence>
        {error && (
          <div className="fixed top-4 right-4 z-50 max-w-md">
            <SmartError
              type="unknown"
              message={error}
              onDismiss={() => setError(null)}
              onRetry={() => {
                setError(null);
              }}
            />
          </div>
        )}
      </AnimatePresence>
      
      {/* 全局加载遮罩 */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="fixed inset-0 glass-overlay flex items-center justify-center z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GlassCard priority="primary" className="p-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent mx-auto"
              />
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 顶部工具栏 */}
      <div className="fixed top-0 left-0 right-0 z-30 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* 语言切换器 */}
          <CompactLanguageSwitcher
            currentLanguage={language}
            onLanguageChange={setLanguage}
          />
          
          {/* 品牌标识 */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <motion.div
              className="glass-card-secondary px-4 py-2 rounded-lg"
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-white font-bold text-sm">CognitiveCoach</span>
            </motion.div>
          </div>
          
          {/* 操作按钮（占位） */}
          <div className="w-24" />
        </div>
      </div>
      
      {/* 阶段进度条 */}
      <div className="fixed top-20 left-0 right-0 z-30 px-4">
        <div className="max-w-3xl mx-auto">
          <StageProgressBar
            currentStage={currentStage}
            onStageClick={() => {
              // Stage navigation can be implemented here if needed
            }}
          />
        </div>
      </div>
      
      {/* 主内容 */}
      <div className="pt-48">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStage()}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* 欢迎教程 */}
      {showTutorial && (
        <WelcomeTutorial
          onComplete={completeTutorial}
          onSkip={skipTutorial}
        />
      )}
    </div>
  );
}

