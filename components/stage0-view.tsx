'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatBox } from './chat-interface/ChatBox';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import type { ChatMessage, Stage0Response } from '@/lib/types-v2';
import { Button } from './ui/button';
import { GlassCard } from './ui/glass-card';
import { MobileDrawer } from './ui/mobile-drawer';
import { useIsMobile } from '@/lib/hooks/useBreakpoint';
import { Check, X } from 'lucide-react';
import { postJSON, type ApiError, getErrorMessage } from '@/lib/api-client';
import { logger } from '@/lib/logger';

export default function Stage0View() {
  const {
    stage0Messages,
    purposeDefinition,
    addStage0Message,
    updatePurposeDefinition,
    completeStage0,
    setLoading,
    setError,
  } = useCognitiveCoachStoreV2();
  
  const [isThinking, setIsThinking] = React.useState(false);
  const [showConfirmation, setShowConfirmation] = React.useState(false);
  const isMobile = useIsMobile();
  const [retryCount, setRetryCount] = React.useState(0);
  
  // 处理用户发送消息
  const handleSendMessage = async (content: string) => {
    // 判断是初始请求还是继续对话（在添加消息之前判断）
    const isInitial = stage0Messages.length === 0;
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: { stage: 'STAGE_0_PURPOSE_CLARIFICATION', type: 'answer' },
    };
    
    addStage0Message(userMessage);
    setIsThinking(true);
    
    try {
      const result = await postJSON<Stage0Response>('/api/stage0', {
        action: isInitial ? 'initial' : 'continue',
        userInput: isInitial ? content : undefined,
        conversationHistory: isInitial ? undefined : stage0Messages,
        currentDefinition: isInitial ? undefined : {
          rawInput: purposeDefinition?.rawInput || stage0Messages[0]?.content || '',
          clarifiedPurpose: purposeDefinition?.clarifiedPurpose || '',
          problemDomain: purposeDefinition?.problemDomain || '',
          domainBoundary: purposeDefinition?.domainBoundary || '',
          boundaryConstraints: purposeDefinition?.boundaryConstraints || [],
          personalConstraints: purposeDefinition?.personalConstraints || [],
          keyConstraints: purposeDefinition?.keyConstraints || [],
          conversationHistory: purposeDefinition?.conversationHistory || [],
          confidence: purposeDefinition?.confidence || 0.3,
          clarificationState: purposeDefinition?.clarificationState || 'COLLECTING',
        },
      }, {
        timeout: 30000,
        retries: 2,
        onRetry: (attempt) => {
          setRetryCount(attempt);
          logger.info(`[Stage0View] Retrying... (attempt ${attempt})`);
        },
      });
      
      if (result.success) {
        // 添加 AI 回复
        const aiMessage: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: result.message || '收到，让我继续了解...',
          timestamp: Date.now(),
          metadata: { stage: 'STAGE_0_PURPOSE_CLARIFICATION', type: 'question' },
        };
        
        addStage0Message(aiMessage);
        
        // 更新目的定义
        if (result.data) {
          updatePurposeDefinition(result.data);
        }
        
        // 检查是否需要确认
        if (result.nextAction === 'confirm') {
          setShowConfirmation(true);
        }
      } else {
        setError(result.message || '处理失败');
      }
    } catch (error) {
      const apiError = error as ApiError;
      const errorInfo = getErrorMessage(apiError);
      setError(errorInfo.message);
      
      // 详细的错误日志
      logger.error('[Stage0View] Error sending message', {
        error: apiError,
        errorMessage: apiError?.message,
        errorCode: apiError?.code,
        errorStatus: apiError?.status,
        isNetworkError: apiError?.isNetworkError,
        isTimeout: apiError?.isTimeout,
        isRetryable: apiError?.isRetryable,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
    } finally {
      setIsThinking(false);
      setRetryCount(0);
    }
  };
  
  // 处理用户确认
  const handleConfirm = async (confirmed: boolean) => {
    setLoading(true);
    
    try {
      const result = await postJSON<Stage0Response>('/api/stage0', {
        action: 'confirm',
        currentDefinition: purposeDefinition,
        userConfirmed: confirmed,
      }, {
        timeout: 30000,
        retries: 2,
      });
      
      if (result.success) {
        if (result.nextAction === 'complete' && result.data) {
          // 完成 Stage 0，进入 Stage 1
          completeStage0(result.data);
        } else {
          // 用户不确认，继续对话
          setShowConfirmation(false);
          
          const aiMessage: ChatMessage = {
            id: `msg-${Date.now()}-ai`,
            role: 'assistant',
            content: result.message || '好的，让我重新理解...',
            timestamp: Date.now(),
          };
          
          addStage0Message(aiMessage);
        }
      } else {
        setError(result.message || '确认失败');
      }
    } catch (error) {
      const apiError = error as ApiError;
      const errorInfo = getErrorMessage(apiError);
      setError(errorInfo.message);
      logger.error('[Stage0View] Error confirming purpose', { error: apiError });
    } finally {
      setLoading(false);
    }
  };
  
  // 渲染确认内容
  const renderConfirmationContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-white mb-2">Your Purpose:</h3>
        <p className="text-gray-300">{purposeDefinition?.clarifiedPurpose}</p>
      </div>
      
      <div>
        <h3 className="font-semibold text-white mb-2">Problem Domain:</h3>
        <p className="text-gray-300">{purposeDefinition?.problemDomain}</p>
      </div>
      
      <div>
        <h3 className="font-semibold text-white mb-2">Scope Boundary:</h3>
        <p className="text-gray-300">{purposeDefinition?.domainBoundary}</p>
      </div>
      
      {purposeDefinition?.keyConstraints && purposeDefinition.keyConstraints.length > 0 && (
        <div>
          <h3 className="font-semibold text-white mb-2">Key Constraints:</h3>
          <ul className="space-y-2">
            {purposeDefinition.keyConstraints.map((constraint, index) => (
              <li key={index} className="text-gray-300 flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span>{constraint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button
          onClick={() => handleConfirm(true)}
          className="flex-1 gap-2"
          size="lg"
        >
          <Check className="w-5 h-5" />
          Confirm & Continue
        </Button>
        <Button
          onClick={() => handleConfirm(false)}
          variant="outline"
          className="flex-1 gap-2"
          size="lg"
        >
          <X className="w-5 h-5" />
          Need Adjustment
        </Button>
      </div>
    </div>
  );
  
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
            Stage 0: Purpose Clarification
          </h1>
          <p className="text-gray-300 text-lg">
            Let&apos;s clarify your goals and needs through conversation
          </p>
        </GlassCard>
      </motion.div>
      
      {/* 聊天区域 */}
      <div className="flex-1 px-6">
        <ChatBox
          messages={stage0Messages}
          onSendMessage={handleSendMessage}
          isThinking={isThinking}
          thinkingMessage={
            retryCount > 0 
              ? `Retrying... (Attempt ${retryCount})`
              : "Analyzing your needs..."
          }
          disabled={showConfirmation}
          placeholder="Please describe the problem you want to solve or the goal you want to achieve..."
        />
      </div>
      
      {/* 确认对话框 - 移动端使用抽屉，桌面端使用模态框 */}
      {isMobile ? (
        <MobileDrawer
          isOpen={showConfirmation && !!purposeDefinition}
          onClose={() => setShowConfirmation(false)}
          title="Please Confirm My Understanding"
        >
          {purposeDefinition && renderConfirmationContent()}
        </MobileDrawer>
      ) : (
        <AnimatePresence>
          {showConfirmation && purposeDefinition && (
            <>
              <motion.div
                className="fixed inset-0 glass-overlay z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfirmation(false)}
                aria-hidden="true"
              />
              
              <motion.div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl mx-4"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirmation-title"
              >
                <GlassCard priority="primary" className="p-8">
                  <h2 id="confirmation-title" className="text-2xl font-bold text-white mb-6">
                    Please Confirm My Understanding
                  </h2>
                  {renderConfirmationContent()}
                </GlassCard>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

