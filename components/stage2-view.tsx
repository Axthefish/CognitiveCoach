'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { GlassCard } from './ui/glass-card';
import { Button } from './ui/button';
import { Check, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Stage 2: 用户确认界面
 * 展示澄清后的Mission Statement，用户确认或提供反馈
 */
export default function Stage2View() {
  const {
    clarifiedMission,
    confirmAndProceed,
    rejectAndRefine,
    setLoading,
  } = useCognitiveCoachStoreV2();
  
  const [feedback, setFeedback] = React.useState('');
  const [showFeedbackInput, setShowFeedbackInput] = React.useState(false);
  
  // 处理确认
  const handleConfirm = async () => {
    setLoading(true);
    
    try {
      // 调用API确认
      const response = await fetch('/api/stage2-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clarifiedMission,
          userConfirmed: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // 进入Stage 3
        confirmAndProceed();
      }
    } catch (error) {
      logger.error('[Stage2View] Confirm failed', { error });
    } finally {
      setLoading(false);
    }
  };
  
  // 处理拒绝/Refine
  const handleRefine = async () => {
    if (showFeedbackInput && !feedback.trim()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // 调用API记录反馈
      const response = await fetch('/api/stage2-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clarifiedMission,
          userConfirmed: false,
          feedback: feedback || undefined,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // 返回Stage 1重新澄清
      rejectAndRefine(feedback || undefined);
    } catch (error) {
      logger.error('[Stage2View] Refine failed', { error });
    } finally {
      setLoading(false);
    }
  };
  
  if (!clarifiedMission) {
    return (
      <div className="h-screen flex items-center justify-center">
        <GlassCard priority="primary" className="p-8 text-center max-w-md">
          <p className="text-gray-300">Missing clarified mission data</p>
        </GlassCard>
      </div>
    );
  }
  
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
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Stage 2: Confirm Your Mission
        </h1>
            <p className="text-gray-300 text-lg">
              Please review and confirm what I understood from our conversation
            </p>
          </div>
          
          {/* Mission Statement 展示 */}
          <div className="space-y-6 mb-8">
            {/* Mission Statement */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="glass-card-secondary rounded-lg p-6">
                <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-blue-400 text-xl">📋</span>
                  <span>Mission Statement</span>
                </h2>
                <p className="text-gray-200 text-lg leading-relaxed">
                  {clarifiedMission.missionStatement}
                </p>
            </div>
            </motion.div>
            
            {/* Subject */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="glass-card-secondary rounded-lg p-6">
                <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-blue-400 text-xl">🎯</span>
                  <span>Core Subject</span>
                </h2>
                <p className="text-gray-300 leading-relaxed">
                  {clarifiedMission.subject}
                </p>
      </div>
      </motion.div>
      
            {/* Desired Outcome */}
          <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="glass-card-secondary rounded-lg p-6">
                <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-blue-400 text-xl">✨</span>
                  <span>Desired Outcome</span>
                </h2>
                <p className="text-gray-300 leading-relaxed">
                  {clarifiedMission.desiredOutcome}
                </p>
              </div>
            </motion.div>
            
            {/* Context */}
            {clarifiedMission.context && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="glass-card-secondary rounded-lg p-6">
                  <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="text-blue-400 text-xl">🌍</span>
                    <span>Context</span>
                  </h2>
                  <p className="text-gray-300 leading-relaxed">
                    {clarifiedMission.context}
                      </p>
                    </div>
              </motion.div>
            )}
            
            {/* Key Levers */}
            {clarifiedMission.keyLevers && clarifiedMission.keyLevers.length > 0 && (
          <motion.div
                initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="glass-card-secondary rounded-lg p-6">
                  <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="text-blue-400 text-xl">🔑</span>
                    <span>Key Leverage Points</span>
                  </h2>
                  <ul className="space-y-3">
                    {clarifiedMission.keyLevers.map((lever, index) => (
                      <li 
                        key={index} 
                        className="text-gray-300 flex items-start gap-3 bg-white/5 rounded-lg p-4"
                      >
                        <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                        <span className="flex-1">{lever}</span>
                              </li>
                            ))}
                          </ul>
                    </div>
                      </motion.div>
                )}
          </div>
                
          {/* Feedback输入区（可选） */}
          {showFeedbackInput && (
                      <motion.div
              className="mb-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label htmlFor="feedback" className="block text-sm font-medium text-gray-300 mb-2">
                What would you like to adjust?
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Please describe what needs to be refined..."
                className="w-full h-24 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 resize-none transition-all"
              />
                      </motion.div>
                    )}
                
          {/* 操作按钮 */}
                    <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {!showFeedbackInput ? (
              <>
                {/* 确认按钮 */}
                        <Button
                  onClick={handleConfirm}
                          size="lg"
                  className="w-full group"
                >
                  <Check className="w-5 h-5 mr-2" />
                  <span>Confirm & Generate Framework</span>
                </Button>
                
                {/* Refine按钮 */}
                <Button
                  onClick={() => setShowFeedbackInput(true)}
                  variant="outline"
                  size="lg"
                  className="w-full group"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  <span>I want to refine this</span>
                </Button>
                      </>
                    ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 提交Feedback */}
                        <Button
                  onClick={handleRefine}
                  size="lg"
                  className="w-full"
                  disabled={!feedback.trim()}
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  <span>Submit & Refine</span>
                        </Button>
                
                {/* 取消 */}
                  <Button
                  onClick={() => {
                    setShowFeedbackInput(false);
                    setFeedback('');
                  }}
                  variant="outline"
                    size="lg"
                    className="w-full"
                  >
                  <span>Cancel</span>
                  </Button>
                </div>
            )}
            
            <p className="text-sm text-gray-400 text-center">
              {showFeedbackInput 
                ? 'Provide feedback to refine your mission statement'
                : 'Confirming will generate a universal action framework based on this mission'
              }
            </p>
          </motion.div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
