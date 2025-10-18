'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { GlassCard } from './ui/glass-card';
import { Button } from './ui/button';
import { Sparkles, Check } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Stage 4: 个性化选择界面
 * 询问用户是否需要个性化调整
 */
export default function Stage4View() {
  const {
    choosePersonalization,
    skipPersonalization,
    setPersonalizationChoice,
    setLoading,
  } = useCognitiveCoachStoreV2();
  
  const [reason, setReason] = React.useState('');
  const [selectedOption, setSelectedOption] = React.useState<'yes' | 'no' | null>(null);
  
  // 处理选择
  const handleChoice = async (wantsPersonalization: boolean) => {
    setLoading(true);
    
    try {
      // 直接保存选择并转换状态（纯前端）
      setPersonalizationChoice({
        wantsPersonalization,
        timestamp: Date.now(),
        reason: reason || undefined,
      });
      
      // 根据选择进入不同阶段
      if (wantsPersonalization) {
        choosePersonalization();
      } else {
        skipPersonalization();
      }
    } catch (error) {
      logger.error('[Stage4View] Choice failed', { error });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        className="w-full max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <GlassCard priority="primary" className="p-8 md:p-12">
          {/* 头部 */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-400" />
            </motion.div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Stage 4: Personalization Choice
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed max-w-2xl mx-auto">
              Would you like to personalize this framework for your specific situation?
            </p>
          </div>
          
          {/* 选项卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* 选项1：需要个性化 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GlassCard
                priority="secondary"
                className={`p-6 cursor-pointer transition-all duration-300 border-2 ${
                  selectedOption === 'yes'
                    ? 'border-purple-500 bg-purple-500/10 scale-[1.02]'
                    : 'border-transparent hover:border-purple-500/50'
                }`}
                onClick={() => setSelectedOption('yes')}
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-purple-400" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3">
                    Yes, personalize it
                  </h3>
                  
                  <p className="text-gray-300 text-sm mb-4">
                    Answer a few questions about your current level, available time, and resources. 
                    I&apos;ll adjust the framework to match your specific situation.
                  </p>
                  
                  <div className="space-y-2 text-left">
                    <div className="flex items-start gap-2 text-sm text-gray-400">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Weight adjustment based on your context</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-400">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Personalized action recommendations</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-400">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Tailored learning path</span>
                    </div>
                  </div>
                  
                  {selectedOption === 'yes' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center"
                    >
                      <Check className="w-5 h-5 text-white" />
                    </motion.div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
            
            {/* 选项2：使用通用框架 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <GlassCard
                priority="secondary"
                className={`p-6 cursor-pointer transition-all duration-300 border-2 ${
                  selectedOption === 'no'
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                    : 'border-transparent hover:border-blue-500/50'
                }`}
                onClick={() => setSelectedOption('no')}
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-gray-500/20 flex items-center justify-center">
                    <Check className="w-8 h-8 text-blue-400" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3">
                    No, use universal framework
                  </h3>
                  
                  <p className="text-gray-300 text-sm mb-4">
                    The universal framework is already powerful. Use it as-is and follow the weighted priorities.
                  </p>
                  
                  <div className="space-y-2 text-left">
                    <div className="flex items-start gap-2 text-sm text-gray-400">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>Faster to get started</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-400">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>Based on domain best practices</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-400">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>Clear priority weights</span>
                    </div>
                  </div>
                  
                  {selectedOption === 'no' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center"
                    >
                      <Check className="w-5 h-5 text-white" />
                    </motion.div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          </div>
          
          {/* 可选：原因输入 */}
          {selectedOption && (
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-2">
                Why this choice? (Optional)
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Share your reasoning (optional)..."
                className="w-full h-20 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 resize-none transition-all"
              />
            </motion.div>
          )}
          
          {/* 确认按钮 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={() => handleChoice(selectedOption === 'yes')}
              disabled={!selectedOption}
              size="lg"
              className="w-full group"
            >
              {selectedOption === 'yes' ? (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  <span>Continue to Personalization</span>
                </>
              ) : selectedOption === 'no' ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  <span>Complete with Universal Framework</span>
                </>
              ) : (
                <span>Please select an option</span>
              )}
            </Button>
            
            <p className="text-sm text-gray-400 text-center mt-3">
              {selectedOption === 'yes'
                ? 'Next: Answer diagnostic questions to personalize your framework'
                : selectedOption === 'no'
                ? 'Your universal framework is ready to use'
                : 'Choose an option to continue'
              }
            </p>
          </motion.div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

