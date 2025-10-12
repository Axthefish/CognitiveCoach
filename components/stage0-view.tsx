'use client';

import React from 'react';
import { ChatBox } from './chat-interface/ChatBox';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import type { ChatMessage } from '@/lib/types-v2';
import { Button } from './ui/button';
import { Card } from './ui/card';

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
      
      const response = await fetch('/api/stage0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isInitial ? 'initial' : 'continue',
          userInput: isInitial ? content : undefined,
          conversationHistory: isInitial ? undefined : stage0Messages,
          currentDefinition: isInitial ? undefined : {
            rawInput: purposeDefinition?.rawInput || stage0Messages[0]?.content || '',
            clarifiedPurpose: purposeDefinition?.clarifiedPurpose || '',
            problemDomain: purposeDefinition?.problemDomain || '',
            domainBoundary: purposeDefinition?.domainBoundary || '',
            keyConstraints: purposeDefinition?.keyConstraints || [],
            confidence: purposeDefinition?.confidence || 0.3,
          },
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 添加 AI 回复
        const aiMessage: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: result.message,
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
      setError('网络错误，请重试');
      console.error('[Stage0View] Error:', error);
    } finally {
      setIsThinking(false);
    }
  };
  
  // 处理用户确认
  const handleConfirm = async (confirmed: boolean) => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/stage0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          currentDefinition: purposeDefinition,
          userConfirmed: confirmed,
        }),
      });
      
      const result = await response.json();
      
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
            content: result.message,
            timestamp: Date.now(),
          };
          
          addStage0Message(aiMessage);
        }
      } else {
        setError(result.message || '确认失败');
      }
    } catch (error) {
      setError('网络错误，请重试');
      console.error('[Stage0View] Error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="h-screen flex flex-col">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          阶段 0：目的澄清
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          让我们通过对话明确你的目标和需求
        </p>
      </div>
      
      {/* 聊天区域 */}
      <div className="flex-1">
        <ChatBox
          messages={stage0Messages}
          onSendMessage={handleSendMessage}
          isThinking={isThinking}
          thinkingMessage="正在分析你的需求..."
          disabled={showConfirmation}
          placeholder="请描述你想解决的问题或达成的目标..."
        />
      </div>
      
      {/* 确认框 */}
      {showConfirmation && purposeDefinition && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full p-6 bg-white">
            <h2 className="text-xl font-bold mb-4">请确认我的理解</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <h3 className="font-semibold text-gray-700">你的目的：</h3>
                <p className="text-gray-900 mt-1">{purposeDefinition.clarifiedPurpose}</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-700">问题域：</h3>
                <p className="text-gray-900 mt-1">{purposeDefinition.problemDomain}</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-700">范围边界：</h3>
                <p className="text-gray-900 mt-1">{purposeDefinition.domainBoundary}</p>
              </div>
              
              {purposeDefinition.keyConstraints.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700">关键约束：</h3>
                  <ul className="list-disc list-inside text-gray-900 mt-1">
                    {purposeDefinition.keyConstraints.map((constraint, index) => (
                      <li key={index}>{constraint}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => handleConfirm(true)}
                className="flex-1"
                size="lg"
              >
                ✓ 确认，继续
              </Button>
              <Button
                onClick={() => handleConfirm(false)}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                需要调整
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

