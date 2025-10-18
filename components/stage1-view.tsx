'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { ChatBox } from './chat-interface/ChatBox';
import { GlassCard } from './ui/glass-card';
import { Button } from './ui/button';
import { Check, Lightbulb } from 'lucide-react';
import type { ChatMessage, ClarifiedMission } from '@/lib/types-v2';
import { logger } from '@/lib/logger';

/**
 * Stage 1: 目标澄清对话
 * 通过AI对话将用户的模糊输入提炼为清晰的Mission Statement
 */
export default function Stage1View() {
  const {
    userInitialInput,
    stage1Messages,
    clarifiedMission,
    addStage1Message,
    updateClarifiedMission,
    completeStage1,
    setError,
  } = useCognitiveCoachStoreV2();
  
  const [isThinking, setIsThinking] = React.useState(false);
  const [thinkingText, setThinkingText] = React.useState('');
  const [showMissionStatement, setShowMissionStatement] = React.useState(false);
  
  // 初始化：自动发起第一个问题
  React.useEffect(() => {
    if (stage1Messages.length === 0 && userInitialInput) {
      // 自动开始澄清流程
      handleInitialClarification();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // 初始澄清
  const handleInitialClarification = async () => {
    setIsThinking(true);
    setThinkingText('');
    
    try {
      const response = await fetch('/api/stage0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: userInitialInput,
          action: 'initial',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const mission = result.data as ClarifiedMission;
        
        // 如果已经有了完整的mission，直接显示
        if (mission.confidence >= 0.8) {
          updateClarifiedMission(mission);
          setShowMissionStatement(true);
        } else if (result.nextAction === 'continue_dialogue') {
          // 需要继续对话，添加AI的问题
          if (result.message) {
            addStage1Message({
              id: `msg-${Date.now()}-ai`,
              role: 'assistant',
              content: result.message,
              timestamp: Date.now(),
              metadata: { stage: 'STAGE_1_CLARIFICATION', type: 'question' },
            });
          }
        }
      }
    } catch (error) {
      logger.error('[Stage1View] Initial clarification failed', { error });
      setError('Failed to start clarification. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };
  
  // 处理用户发送消息
  const handleSendMessage = async (content: string) => {
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: { stage: 'STAGE_1_CLARIFICATION', type: 'answer' },
    };
    
    addStage1Message(userMessage);
    setIsThinking(true);
    setThinkingText('');
    
    try {
      const response = await fetch('/api/stage0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: content,
          action: 'continue',
          conversationHistory: [...stage1Messages, userMessage],
          currentDefinition: clarifiedMission,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const mission = result.data as ClarifiedMission;
        updateClarifiedMission(mission);
        
        // 检查是否完成澄清
        if (result.nextAction === 'confirm' || mission.confidence >= 0.8) {
          setShowMissionStatement(true);
        } else if (result.nextAction === 'continue_dialogue' && result.message) {
          // 继续对话
          addStage1Message({
            id: `msg-${Date.now()}-ai`,
            role: 'assistant',
            content: result.message,
            timestamp: Date.now(),
            metadata: { stage: 'STAGE_1_CLARIFICATION', type: 'question' },
          });
        }
      }
    } catch (error) {
      logger.error('[Stage1View] Error in clarification', { error });
      setError('An error occurred. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };
  
  // 确认Mission Statement
  const handleConfirmMission = () => {
    if (!clarifiedMission) return;
    
    completeStage1(clarifiedMission);
  };
  
  return (
    <div className="h-screen flex flex-col">
      {/* 头部 */}
        <motion.div
        className="px-6 py-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard priority="primary" className="p-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Stage 1: Goal Clarification
            </h1>
          <p className="text-gray-300 text-lg">
            Let&apos;s clarify your goals through a focused conversation
          </p>
          </GlassCard>
        </motion.div>
        
      {/* 聊天区域 */}
      <div className="flex-1 px-6 overflow-hidden">
        <ChatBox
          messages={stage1Messages}
          onSendMessage={handleSendMessage}
          isThinking={isThinking}
          thinkingText={thinkingText}
          disabled={showMissionStatement}
          placeholder="Share your thoughts..."
        />
      </div>
      
      {/* Mission Statement 确认面板 */}
      <AnimatePresence>
        {showMissionStatement && clarifiedMission && (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-3xl"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <GlassCard priority="primary" className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <Lightbulb className="w-8 h-8 text-yellow-400 flex-shrink-0" />
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      Your Clarified Mission
                    </h2>
                    <p className="text-gray-300">
                      Based on our conversation, here&apos;s what I understand
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
                <div className="mt-8 pt-6 border-t border-white/10">
                  <Button
                    onClick={handleConfirmMission}
                    size="lg"
                    className="w-full group"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    <span>Confirm & Continue to Framework</span>
                  </Button>
                  
                  <p className="text-sm text-gray-400 text-center mt-3">
                    Click to generate your personalized action framework
                  </p>
                </div>
              </GlassCard>
            </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}

