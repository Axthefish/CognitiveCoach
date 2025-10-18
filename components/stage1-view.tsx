'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { GlassCard } from './ui/glass-card';
import { Button } from './ui/button';
import { Check, Lightbulb, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Stage 1: 确认AI提炼的结果
 * 用户确认或拒绝AI提炼的核心目标
 */
export default function Stage1View() {
  const {
    clarifiedMission,
    completeStage1,
    reset,
  } = useCognitiveCoachStoreV2();
  
  // 处理确认
  const handleConfirmMission = () => {
    if (!clarifiedMission) return;
    
    logger.info('[Stage1View] User confirmed mission');
    completeStage1(clarifiedMission);
  };
  
  // 处理拒绝（返回Stage 0重新输入）
  const handleRejectMission = () => {
    logger.info('[Stage1View] User rejected mission, resetting');
    reset();
    // 清除localStorage并刷新
    try {
      localStorage.removeItem('cognitive-coach-store-v2');
    } catch (e) {
      logger.error('[Stage1View] Failed to clear localStorage', { error: e });
    }
    window.location.reload();
  };
  
  // 如果没有提炼结果，显示加载或错误状态
  if (!clarifiedMission) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <GlassCard priority="primary" className="p-8 text-center max-w-md">
          <p className="text-gray-300">Processing your input...</p>
          <p className="text-sm text-gray-400 mt-2">
            If this takes too long, please refresh and try again
          </p>
        </GlassCard>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        className="w-full max-w-3xl"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <GlassCard priority="primary" className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <Lightbulb className="w-8 h-8 text-yellow-400 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Please Confirm Your Goal
              </h2>
              <p className="text-gray-300">
                Based on your input, here&apos;s what I understand
              </p>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Mission Statement */}
            <div>
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <span className="text-blue-400">📋</span>
                Mission Statement
              </h3>
              <p className="text-gray-200 text-lg leading-relaxed bg-white/5 rounded-lg p-4">
                {clarifiedMission.missionStatement}
              </p>
            </div>
            
            {/* Subject */}
            <div>
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <span className="text-blue-400">🎯</span>
                Core Subject
              </h3>
              <p className="text-gray-300 bg-white/5 rounded-lg p-4">
                {clarifiedMission.subject}
              </p>
            </div>
            
            {/* Desired Outcome */}
            <div>
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <span className="text-blue-400">✨</span>
                Desired Outcome
              </h3>
              <p className="text-gray-300 bg-white/5 rounded-lg p-4">
                {clarifiedMission.desiredOutcome}
              </p>
            </div>
            
            {/* Context */}
            {clarifiedMission.context && (
              <div>
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <span className="text-blue-400">🌍</span>
                  Context
                </h3>
                <p className="text-gray-300 bg-white/5 rounded-lg p-4">
                  {clarifiedMission.context}
                </p>
              </div>
            )}
            
            {/* Key Levers */}
            {clarifiedMission.keyLevers && clarifiedMission.keyLevers.length > 0 && (
              <div>
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <span className="text-blue-400">🔑</span>
                  Key Leverage Points
                </h3>
                <ul className="space-y-2">
                  {clarifiedMission.keyLevers.map((lever, index) => (
                    <li key={index} className="text-gray-300 flex items-start gap-2 bg-white/5 rounded-lg p-3">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{lever}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* 确认按钮 */}
          <div className="mt-8 pt-6 border-t border-white/10 flex gap-4">
            <Button
              onClick={handleRejectMission}
              variant="outline"
              size="lg"
              className="flex-1"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              <span>Start Over</span>
            </Button>
            
            <Button
              onClick={handleConfirmMission}
              size="lg"
              className="flex-1 group"
            >
              <Check className="w-5 h-5 mr-2" />
              <span>Confirm & Continue</span>
            </Button>
          </div>
          
          <p className="text-sm text-gray-400 text-center mt-3">
            Confirm to generate your personalized action framework
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
