'use client';

import React from 'react';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { ChatBox } from './chat-interface/ChatBox';
import { LogicFlowChart, ChartLegend } from './logic-flow-chart/LogicFlowChart';
import { Button } from './ui/button';
import { Card } from './ui/card';
import type { ChatMessage, UserContextInfo } from '@/lib/types-v2';

export default function Stage2View() {
  const {
    universalFramework,
    stage2State,
    dynamicQuestions,
    collectedInfo,
    stage2Messages,
    personalizedPlan,
    setStage2State,
    setDynamicQuestions,
    addUserAnswer,
    addStage2Message,
    setPersonalizedPlan,
    completeFlow,
    setLoading,
    setError,
  } = useCognitiveCoachStoreV2();
  
  const [isThinking, setIsThinking] = React.useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [showPlan, setShowPlan] = React.useState(false);
  
  // 分析缺失信息并生成问题
  const analyzeMissingInfo = React.useCallback(async () => {
    if (!universalFramework) return;
    
    setIsThinking(true);
    setLoading(true);
    
    try {
      const response = await fetch('/api/stage2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          framework: universalFramework,
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.questions) {
        setDynamicQuestions(result.data.questions);
        
        // 添加第一个问题到消息
        if (result.data.questions.length > 0) {
          const firstQuestion = result.data.questions[0];
          const aiMessage: ChatMessage = {
            id: `msg-${Date.now()}-ai`,
            role: 'assistant',
            content: `${firstQuestion.question}\n\n💡 ${firstQuestion.whyMatters}`,
            timestamp: Date.now(),
            metadata: { stage: 'STAGE_2_PERSONALIZATION', type: 'question' },
          };
          
          addStage2Message(aiMessage);
        }
      } else {
        setError(result.message || '分析失败');
      }
    } catch (error) {
      setError('网络错误，请重试');
      console.error('[Stage2View] Analyze error:', error);
    } finally {
      setIsThinking(false);
      setLoading(false);
    }
  }, [universalFramework, setLoading, setStage2State, setDynamicQuestions, addStage2Message, setError]);
  
  // 自动分析缺失信息
  React.useEffect(() => {
    if (stage2State === 'ANALYZING' && universalFramework && dynamicQuestions.length === 0) {
      analyzeMissingInfo();
    }
  }, [stage2State, universalFramework, dynamicQuestions, analyzeMissingInfo]);
  
  // 处理用户回答
  const handleSendMessage = async (content: string) => {
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: { stage: 'STAGE_2_PERSONALIZATION', type: 'answer' },
    };
    
    addStage2Message(userMessage);
    
    // 保存用户回答
    const currentQuestion = dynamicQuestions[currentQuestionIndex];
    const userInfo: UserContextInfo = {
      questionId: currentQuestion.id,
      answer: content,
      answeredAt: Date.now(),
    };
    
    addUserAnswer(userInfo);
    
    // 检查是否还有更多问题
    if (currentQuestionIndex < dynamicQuestions.length - 1) {
      // 还有问题，显示下一个
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      
      const nextQuestion = dynamicQuestions[currentQuestionIndex + 1];
      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: `${nextQuestion.question}\n\n💡 ${nextQuestion.whyMatters}`,
        timestamp: Date.now(),
        metadata: { stage: 'STAGE_2_PERSONALIZATION', type: 'question' },
      };
      
      addStage2Message(aiMessage);
    } else {
      // 所有问题已回答，生成个性化方案
      generatePersonalizedPlan();
    }
  };
  
  // 生成个性化方案
  const generatePersonalizedPlan = async () => {
    if (!universalFramework) return;
    
    setIsThinking(true);
    setLoading(true);
    setStage2State('GENERATING');
    
    // 添加提示消息
    const thinkingMessage: ChatMessage = {
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      content: '好的，我已经了解你的情况了。现在让我为你生成个性化的行动方案...',
      timestamp: Date.now(),
      metadata: { stage: 'STAGE_2_PERSONALIZATION', type: 'info' },
    };
    
    addStage2Message(thinkingMessage);
    
    try {
      const response = await fetch('/api/stage2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          framework: universalFramework,
          collectedInfo: collectedInfo,
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.plan) {
        setPersonalizedPlan(result.data.plan);
        
        // 添加完成消息
        const completionMessage: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: '✓ 个性化方案已生成！你可以查看右侧更新后的框架和下方的行动计划。',
          timestamp: Date.now(),
          metadata: { stage: 'STAGE_2_PERSONALIZATION', type: 'info' },
        };
        
        addStage2Message(completionMessage);
        setShowPlan(true);
      } else {
        setError(result.message || '方案生成失败');
      }
    } catch (error) {
      setError('网络错误，请重试');
      console.error('[Stage2View] Generate error:', error);
    } finally {
      setIsThinking(false);
      setLoading(false);
    }
  };
  
  // 完成整个流程
  const handleComplete = () => {
    completeFlow();
  };
  
  if (!universalFramework) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center max-w-md">
          <p className="text-gray-600">缺少框架数据，请返回上一步</p>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          阶段 2：个性化定制
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {stage2State === 'QUESTIONING' && '回答几个问题，让我为你定制专属方案'}
          {stage2State === 'GENERATING' && '正在生成个性化方案...'}
          {stage2State === 'COMPLETED' && '个性化方案已生成！'}
        </p>
      </div>
      
      {/* 主内容区：分屏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：对话区 */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col">
          <ChatBox
            messages={stage2Messages}
            onSendMessage={handleSendMessage}
            isThinking={isThinking}
            thinkingMessage="正在分析..."
            disabled={stage2State !== 'QUESTIONING'}
            placeholder={
              stage2State === 'QUESTIONING' 
                ? '输入你的回答...' 
                : '等待问题加载...'
            }
          />
        </div>
        
        {/* 右侧：框架可视化 */}
        <div className="w-1/2 flex flex-col overflow-auto">
          <div className="p-4 space-y-4">
            {/* 图例 */}
            <ChartLegend />
            
            {/* 框架图表 */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {personalizedPlan ? '调整后的框架' : '通用框架'}
              </h3>
              <LogicFlowChart
                framework={personalizedPlan?.adjustedFramework || universalFramework}
                height={400}
              />
            </Card>
            
            {/* 个性化方案详情 */}
            {personalizedPlan && showPlan && (
              <>
                {/* 调整说明 */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    📊 调整说明
                  </h3>
                  <p className="text-sm text-gray-600">
                    {personalizedPlan.adjustmentRationale}
                  </p>
                </Card>
                
                {/* 行动步骤 */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    📋 行动步骤
                  </h3>
                  <div className="space-y-3">
                    {personalizedPlan.actionSteps
                      .sort((a, b) => {
                        const priorityOrder = { high: 0, medium: 1, low: 2 };
                        return priorityOrder[a.priority] - priorityOrder[b.priority];
                      })
                      .map((step, index) => (
                        <div
                          key={step.id}
                          className="border-l-4 pl-3 py-2"
                          style={{
                            borderColor:
                              step.priority === 'high' ? '#ef4444' :
                              step.priority === 'medium' ? '#f59e0b' : '#10b981'
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm text-gray-900">
                                {index + 1}. {step.title}
                              </h4>
                              <p className="text-xs text-gray-600 mt-1">
                                {step.description}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                <span>⏰ {step.startTime} - {step.endTime}</span>
                                <span>•</span>
                                <span className={
                                  step.priority === 'high' ? 'text-red-600 font-semibold' :
                                  step.priority === 'medium' ? 'text-amber-600' : 'text-green-600'
                                }>
                                  {step.priority === 'high' ? '高优先级' :
                                   step.priority === 'medium' ? '中优先级' : '低优先级'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
                
                {/* 里程碑 */}
                {personalizedPlan.milestones.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      🎯 里程碑
                    </h3>
                    <div className="space-y-3">
                      {personalizedPlan.milestones.map((milestone) => (
                        <div key={milestone.id} className="bg-blue-50 p-3 rounded">
                          <h4 className="font-semibold text-sm text-gray-900">
                            {milestone.title}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            预期时间：{milestone.expectedTime}
                          </p>
                          <ul className="mt-2 space-y-1">
                            {milestone.successCriteria.map((criteria, idx) => (
                              <li key={idx} className="text-xs text-gray-700">
                                ✓ {criteria}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                
                {/* 个性化建议 */}
                {personalizedPlan.personalizedTips.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      💡 个性化建议
                    </h3>
                    <ul className="space-y-2">
                      {personalizedPlan.personalizedTips.map((tip, index) => (
                        <li key={index} className="text-sm text-gray-700">
                          • {tip}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                
                {/* 完成按钮 */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
                  <Button
                    onClick={handleComplete}
                    size="lg"
                    className="w-full"
                  >
                    完成，开始行动 🚀
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

