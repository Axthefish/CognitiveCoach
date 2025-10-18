'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { Button } from './ui/button';
import { GlassCard } from './ui/glass-card';
import { Sparkles, ArrowRight } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Stage 0: 产品介绍 + 简洁输入
 * 新架构：简化为产品说明 + 输入框 + Get Started按钮
 */
export default function Stage0View() {
  const { initStage0, setError, completeStage0WithMission } = useCognitiveCoachStoreV2();
  
  const [userInput, setUserInput] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // 处理开始 - 直接调用API获取提炼结果
  const handleGetStarted = async () => {
    if (!userInput.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      logger.info('[Stage0View] User initiated with input:', { 
        inputLength: userInput.length 
      });
      
      // 保存用户输入到store
      initStage0(userInput);
      
      // 直接调用API进行目标提炼
      const response = await fetch('/api/stage0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: userInput,
          action: 'initial',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // 保存提炼结果到store
        const mission = result.data;
        completeStage0WithMission(mission, result.message);
      } else {
        throw new Error(result.message || 'Failed to process input');
      }
    } catch (error) {
      logger.error('[Stage0View] Error initiating:', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('504') || errorMessage.includes('timeout')) {
        setError('Request timeout. The AI is taking too long to respond. Please try again.');
      } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(errorMessage || 'Failed to start. Please try again.');
      }
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        className="w-full max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <GlassCard priority="primary" className="p-8 md:p-12">
          {/* 产品标题 */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-3 mb-4">
              <Sparkles className="w-8 h-8 text-blue-400" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                CognitiveCoach
              </h1>
            </div>
            
            <p className="text-xl text-gray-300 leading-relaxed">
              AI-powered cognitive growth coach
            </p>
          </motion.div>
          
          {/* 产品说明 */}
          <motion.div
            className="mb-8 space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="glass-card-secondary rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-3">
                What is CognitiveCoach?
              </h2>
              <p className="text-gray-300 leading-relaxed">
                CognitiveCoach helps you build a personalized action framework for learning any subject or skill. 
                We combine universal best practices with your unique situation to create an optimal learning path.
              </p>
            </div>
            
            <div className="glass-card-secondary rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-3">
                How it works:
              </h2>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">1.</span>
                  <span>Share what you want to learn or achieve</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">2.</span>
                  <span>We generate a universal action framework based on domain knowledge</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">3.</span>
                  <span>Optionally personalize it based on your specific context and constraints</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">4.</span>
                  <span>Get a clear, actionable roadmap to achieve your goal</span>
                </li>
              </ul>
            </div>
          </motion.div>
          
          {/* 输入区域 */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <label htmlFor="user-input" className="block text-sm font-medium text-gray-300">
              What would you like to learn or achieve?
            </label>
            
            <textarea
              id="user-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSubmitting) {
                  handleGetStarted();
                }
              }}
              placeholder="Example: I want to learn Python for data analysis..."
              className="w-full h-32 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 resize-none transition-all"
              disabled={isSubmitting}
            />
            
            <p className="text-sm text-gray-400">
              Be as specific as possible. Include any context, constraints, or goals.
            </p>
            
            {/* 开始按钮 */}
            <Button
              onClick={handleGetStarted}
              disabled={!userInput.trim() || isSubmitting}
              size="lg"
              className="w-full group"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <span>Get Started</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
            
            <p className="text-xs text-gray-500 text-center">
              Press Cmd/Ctrl + Enter to submit
            </p>
          </motion.div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

