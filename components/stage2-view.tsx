'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { ChatBox } from './chat-interface/ChatBox';
import { LogicFlowChart, ChartLegend } from './logic-flow-chart/LogicFlowChart';
import { Button } from './ui/button';
import { GlassCard } from './ui/glass-card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Download, Copy, Check, Sparkles, Target, Clock, TrendingUp } from 'lucide-react';
import type { ChatMessage, UserContextInfo, Stage2Response } from '@/lib/types-v2';
import { exportPlanAsJSON, exportPlanAsMarkdown, copyPlanSummary } from '@/lib/export-utils';
import { postJSON, type ApiError, getErrorMessage } from '@/lib/api-client';
import { logger } from '@/lib/logger';

export default function Stage2View() {
  const {
    purposeDefinition,
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
  const [thinkingText] = React.useState(''); // 真实thinking文本（Stage2暂未实现streaming）
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [showPlan, setShowPlan] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<'chat' | 'chart'>('chat');
  const [copySuccess, setCopySuccess] = React.useState(false);
  
  // 分析缺失信息并生成问题
  const analyzeMissingInfo = React.useCallback(async () => {
    if (!universalFramework || !purposeDefinition) return;
    
    setIsThinking(true);
    setLoading(true);
    
    try {
      // ⭐️ 传递constraints和conversationInsights用于个性化
      const result = await postJSON<Stage2Response>('/api/stage2', {
          action: 'analyze',
          framework: universalFramework,
          constraints: purposeDefinition.personalConstraints || purposeDefinition.keyConstraints,
          conversationInsights: purposeDefinition.conversationInsights,
      }, {
        timeout: 50000, // Stage2 analyze: ~45秒 + 5秒余量
        retries: 2,
      });
      
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
      const apiError = error as ApiError;
      const errorInfo = getErrorMessage(apiError);
      setError(errorInfo.message);
      logger.error('[Stage2View] Analyze error:', apiError);
    } finally {
      setIsThinking(false);
      setLoading(false);
    }
  }, [universalFramework, purposeDefinition, setLoading, setDynamicQuestions, addStage2Message, setError]);
  
  // 自动分析缺失信息
  React.useEffect(() => {
    if (stage2State === 'ANALYZING' && universalFramework && purposeDefinition && dynamicQuestions.length === 0) {
      analyzeMissingInfo();
    }
  }, [stage2State, universalFramework, purposeDefinition, dynamicQuestions, analyzeMissingInfo]);
  
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
      const result = await postJSON<Stage2Response>('/api/stage2', {
          action: 'generate',
          framework: universalFramework,
          collectedInfo: collectedInfo,
      }, {
        timeout: 115000, // Stage2 generate (Pro): 108秒 + 7秒余量
        retries: 1, // 降低重试次数，避免过长等待
      });
      
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
      const apiError = error as ApiError;
      const errorInfo = getErrorMessage(apiError);
      setError(errorInfo.message);
      logger.error('[Stage2View] Generate error:', apiError);
    } finally {
      setIsThinking(false);
      setLoading(false);
    }
  };
  
  // 完成整个流程
  const handleComplete = () => {
    completeFlow();
  };
  
  // 导出功能
  const handleExport = async (format: 'json' | 'markdown') => {
    if (!personalizedPlan) return;
    
    try {
      if (format === 'json') {
        exportPlanAsJSON(personalizedPlan);
      } else {
        exportPlanAsMarkdown(personalizedPlan);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '导出失败');
    }
  };
  
  // 复制摘要
  const handleCopy = async () => {
    if (!personalizedPlan) return;
    
    try {
      await copyPlanSummary(personalizedPlan);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : '复制失败');
    }
  };
  
  if (!universalFramework) {
    return (
      <div className="h-screen flex items-center justify-center">
        <GlassCard priority="primary" className="p-8 text-center max-w-md">
          <p className="text-gray-300">缺少框架数据，请返回上一步</p>
        </GlassCard>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col">
      {/* 头部 */}
      <motion.div
        className="px-6 py-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassCard priority="primary" className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">
          阶段 2：个性化定制
        </h1>
              <motion.p
                className="text-gray-300 text-lg"
                key={stage2State}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
          {stage2State === 'QUESTIONING' && '回答几个问题，让我为你定制专属方案'}
          {stage2State === 'GENERATING' && '正在生成个性化方案...'}
                {stage2State === 'COMPLETED' && '🎉 个性化方案已生成！'}
              </motion.p>
            </div>
      </div>
        </GlassCard>
      </motion.div>
      
      {/* 主内容区：响应式布局 */}
      <div className="flex-1 flex overflow-hidden px-6">
        {/* 桌面端：分屏布局 */}
        <div className="hidden lg:flex w-full gap-6">
        {/* 左侧：对话区 */}
          <motion.div
            className="w-1/2 flex flex-col gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* 🆕 当前问题卡片 - 带视觉层次 */}
            {stage2State === 'QUESTIONING' && dynamicQuestions.length > 0 && currentQuestionIndex < dynamicQuestions.length && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                key={`question-${currentQuestionIndex}`}
              >
                <GlassCard 
                  priority="primary" 
                  className={`p-4 border-l-4 ${
                    dynamicQuestions[currentQuestionIndex].impactLevel >= 4 
                      ? 'border-blue-500 bg-blue-500/5' 
                      : dynamicQuestions[currentQuestionIndex].impactLevel >= 3 
                      ? 'border-purple-500 bg-purple-500/5' 
                      : 'border-gray-500 bg-gray-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-gray-400">
                          问题 {currentQuestionIndex + 1}/{dynamicQuestions.length}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          dynamicQuestions[currentQuestionIndex].impactLevel >= 4 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : dynamicQuestions[currentQuestionIndex].impactLevel >= 3 
                            ? 'bg-purple-500/20 text-purple-300' 
                            : 'bg-gray-500/20 text-gray-300'
                        }`}>
                          {dynamicQuestions[currentQuestionIndex].impactLevel >= 4 ? '高优先级' : 
                           dynamicQuestions[currentQuestionIndex].impactLevel >= 3 ? '中优先级' : '低优先级'}
                        </span>
                      </div>
                      <p className="text-white text-sm leading-relaxed">
                        {dynamicQuestions[currentQuestionIndex].question}
                      </p>
                    </div>
                  </div>
                  
                  {/* 可展开的"为什么问这个" */}
                  <details className="mt-3 group">
                    <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 transition-colors list-none flex items-center gap-1">
                      <span>💡 为什么问这个？</span>
                      <svg className="w-3 h-3 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <p className="text-xs text-gray-300 mt-2 pl-4 border-l-2 border-blue-500/30">
                      {dynamicQuestions[currentQuestionIndex].whyMatters}
                    </p>
                  </details>
                </GlassCard>
              </motion.div>
            )}
            
          <ChatBox
            messages={stage2Messages}
            onSendMessage={handleSendMessage}
            isThinking={isThinking}
            thinkingText={thinkingText}
            disabled={stage2State !== 'QUESTIONING'}
            placeholder={
              stage2State === 'QUESTIONING' 
                ? '输入你的回答...' 
                : '等待问题加载...'
            }
          />
          </motion.div>
        
        {/* 右侧：框架可视化 */}
          <motion.div
            className="w-1/2 flex flex-col overflow-auto"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="space-y-4 pb-6">
            {/* 图例 */}
            <ChartLegend />
            
            {/* 框架图表 */}
              <GlassCard priority="primary" className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  {personalizedPlan ? (
                    <>
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                      调整后的框架
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-blue-400" />
                      通用框架
                    </>
                  )}
              </h3>
              <LogicFlowChart
                framework={personalizedPlan?.adjustedFramework || universalFramework}
                height={400}
              />
              </GlassCard>
            
            {/* 个性化方案详情 */}
              <AnimatePresence>
            {personalizedPlan && showPlan && (
              <>
                {/* 调整说明 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: 0.1 }}
                    >
                      <GlassCard priority="secondary" className="p-6">
                        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                          <Target className="w-5 h-5 text-blue-400" />
                          调整说明
                  </h3>
                        <p className="text-gray-300 leading-relaxed">
                    {personalizedPlan.adjustmentRationale}
                  </p>
                      </GlassCard>
                    </motion.div>
                
                {/* 行动步骤 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: 0.2 }}
                    >
                      <GlassCard priority="secondary" className="p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-400" />
                          行动步骤
                  </h3>
                  <div className="space-y-3">
                    {personalizedPlan.actionSteps
                      .sort((a, b) => {
                        const priorityOrder = { high: 0, medium: 1, low: 2 };
                        return priorityOrder[a.priority] - priorityOrder[b.priority];
                      })
                      .map((step, index) => (
                              <motion.div
                          key={step.id}
                                className="glass-card-tertiary rounded-lg border-l-4 pl-4 py-3"
                          style={{
                            borderColor:
                              step.priority === 'high' ? '#ef4444' :
                              step.priority === 'medium' ? '#f59e0b' : '#10b981'
                          }}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + index * 0.05 }}
                                whileHover={{ x: 4 }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                                    <h4 className="font-semibold text-white">
                                {index + 1}. {step.title}
                              </h4>
                                    <p className="text-sm text-gray-300 mt-1">
                                {step.description}
                              </p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {step.startTime} - {step.endTime}
                                      </span>
                                <span>•</span>
                                <span className={
                                        step.priority === 'high' ? 'text-red-400 font-semibold' :
                                        step.priority === 'medium' ? 'text-amber-400' : 'text-green-400'
                                }>
                                  {step.priority === 'high' ? '高优先级' :
                                   step.priority === 'medium' ? '中优先级' : '低优先级'}
                                </span>
                              </div>
                            </div>
                          </div>
                              </motion.div>
                            ))}
                        </div>
                      </GlassCard>
                    </motion.div>
                
                {/* 里程碑 */}
                {personalizedPlan.milestones.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: 0.3 }}
                      >
                        <GlassCard priority="secondary" className="p-6">
                          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-400" />
                            里程碑
                    </h3>
                    <div className="space-y-3">
                            {personalizedPlan.milestones.map((milestone, idx) => (
                              <motion.div
                                key={milestone.id}
                                className="glass-card-tertiary rounded-lg p-4"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 + idx * 0.05 }}
                                whileHover={{ scale: 1.02 }}
                              >
                                <h4 className="font-semibold text-white">
                            {milestone.title}
                          </h4>
                                <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                            预期时间：{milestone.expectedTime}
                          </p>
                                <ul className="mt-3 space-y-2">
                                  {milestone.successCriteria.map((criteria, cidx) => (
                                    <li key={cidx} className="text-sm text-gray-300 flex items-start gap-2">
                                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                      {criteria}
                              </li>
                            ))}
                          </ul>
                              </motion.div>
                      ))}
                    </div>
                        </GlassCard>
                      </motion.div>
                )}
                
                {/* 个性化建议 */}
                {personalizedPlan.personalizedTips.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: 0.4 }}
                      >
                        <GlassCard priority="secondary" className="p-6">
                          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-yellow-400" />
                            个性化建议
                    </h3>
                          <ul className="space-y-3">
                      {personalizedPlan.personalizedTips.map((tip, index) => (
                              <motion.li
                                key={index}
                                className="text-gray-300 flex items-start gap-2"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + index * 0.05 }}
                              >
                                <span className="text-blue-400 flex-shrink-0">•</span>
                                <span>{tip}</span>
                              </motion.li>
                      ))}
                    </ul>
                        </GlassCard>
                      </motion.div>
                    )}
                
                    {/* 导出和完成按钮 */}
                    <motion.div
                      className="sticky bottom-0 mt-6"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <GlassCard priority="primary" className="p-4 space-y-3">
                        {/* 导出选项 */}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleExport('markdown')}
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1"
                          >
                            <Download className="w-4 h-4" />
                            Markdown
                          </Button>
                          <Button
                            onClick={() => handleExport('json')}
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1"
                          >
                            <Download className="w-4 h-4" />
                            JSON
                          </Button>
                          <Button
                            onClick={handleCopy}
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1"
                          >
                            {copySuccess ? (
                              <>
                                <Check className="w-4 h-4" />
                                已复制
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                复制
                              </>
                            )}
                          </Button>
                        </div>
                        
                        {/* 完成按钮 */}
                        <Button
                          onClick={handleComplete}
                          size="lg"
                          className="w-full gap-2"
                        >
                          完成，开始行动
                          <Sparkles className="w-5 h-5" />
                        </Button>
                      </GlassCard>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
        
        {/* 移动端：Tab切换布局 */}
        <div className="lg:hidden w-full flex flex-col">
          <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as 'chat' | 'chart')} className="flex-1 flex flex-col">
            <div className="glass-card-secondary rounded-xl p-1 mx-4 mb-4">
              <TabsList className="grid w-full grid-cols-2 gap-1 bg-transparent p-0">
                <TabsTrigger
                  value="chat"
                  className="data-[state=active]:glass-card-primary data-[state=active]:text-white"
                >
                  💬 对话
                </TabsTrigger>
                <TabsTrigger
                  value="chart"
                  className="data-[state=active]:glass-card-primary data-[state=active]:text-white"
                >
                  📊 框架
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="chat" className="flex-1 m-0 flex flex-col gap-4 px-4">
              {/* 🆕 当前问题卡片 - 移动端 */}
              {stage2State === 'QUESTIONING' && dynamicQuestions.length > 0 && currentQuestionIndex < dynamicQuestions.length && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={`question-mobile-${currentQuestionIndex}`}
                >
                  <GlassCard 
                    priority="primary" 
                    className={`p-4 border-l-4 ${
                      dynamicQuestions[currentQuestionIndex].impactLevel >= 4 
                        ? 'border-blue-500 bg-blue-500/5' 
                        : dynamicQuestions[currentQuestionIndex].impactLevel >= 3 
                        ? 'border-purple-500 bg-purple-500/5' 
                        : 'border-gray-500 bg-gray-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-400">
                        问题 {currentQuestionIndex + 1}/{dynamicQuestions.length}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        dynamicQuestions[currentQuestionIndex].impactLevel >= 4 
                          ? 'bg-blue-500/20 text-blue-300' 
                          : dynamicQuestions[currentQuestionIndex].impactLevel >= 3 
                          ? 'bg-purple-500/20 text-purple-300' 
                          : 'bg-gray-500/20 text-gray-300'
                      }`}>
                        {dynamicQuestions[currentQuestionIndex].impactLevel >= 4 ? '高优先级' : 
                         dynamicQuestions[currentQuestionIndex].impactLevel >= 3 ? '中优先级' : '低优先级'}
                      </span>
                    </div>
                    <p className="text-white text-sm leading-relaxed mb-3">
                      {dynamicQuestions[currentQuestionIndex].question}
                    </p>
                    
                    {/* 可展开的"为什么问这个" */}
                    <details className="group">
                      <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 transition-colors list-none flex items-center gap-1">
                        <span>💡 为什么问这个？</span>
                        <svg className="w-3 h-3 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="text-xs text-gray-300 mt-2 pl-4 border-l-2 border-blue-500/30">
                        {dynamicQuestions[currentQuestionIndex].whyMatters}
                      </p>
                    </details>
                  </GlassCard>
                </motion.div>
              )}
              
              <ChatBox
                messages={stage2Messages}
                onSendMessage={handleSendMessage}
                isThinking={isThinking}
                thinkingText={thinkingText}
                disabled={stage2State !== 'QUESTIONING'}
                placeholder={
                  stage2State === 'QUESTIONING' 
                    ? '输入你的回答...' 
                    : '等待问题加载...'
                }
              />
            </TabsContent>            
            <TabsContent value="chart" className="flex-1 m-0 overflow-auto">
              <div className="px-4 pb-4 space-y-4">
                {/* 图例 */}
                <ChartLegend />
                
                {/* 框架图表 */}
                <GlassCard priority="primary" className="p-4">
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                    {personalizedPlan ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        调整后的框架
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        通用框架
                      </>
                    )}
                  </h3>
                  <LogicFlowChart
                    framework={personalizedPlan?.adjustedFramework || universalFramework}
                    height={300}
                  />
                </GlassCard>
                
                {/* 个性化方案详情 */}
                {personalizedPlan && showPlan && (
                  <>
                    {/* 调整说明 */}
                    <GlassCard priority="secondary" className="p-4">
                      <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-400" />
                        调整说明
                      </h3>
                      <p className="text-sm text-gray-300">
                        {personalizedPlan.adjustmentRationale}
                      </p>
                    </GlassCard>
                    
                    {/* 行动步骤 */}
                    <GlassCard priority="secondary" className="p-4">
                      <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        行动步骤
                      </h3>
                      <div className="space-y-2">
                        {personalizedPlan.actionSteps
                          .sort((a, b) => {
                            const priorityOrder = { high: 0, medium: 1, low: 2 };
                            return priorityOrder[a.priority] - priorityOrder[b.priority];
                          })
                          .map((step, index) => (
                            <div
                              key={step.id}
                              className="glass-card-tertiary rounded-lg border-l-4 pl-3 py-2"
                              style={{
                                borderColor:
                                  step.priority === 'high' ? '#ef4444' :
                                  step.priority === 'medium' ? '#f59e0b' : '#10b981'
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-sm text-white">
                                    {index + 1}. {step.title}
                                  </h4>
                                  <p className="text-xs text-gray-300 mt-1">
                                    {step.description}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {step.startTime} - {step.endTime}
                                    </span>
                                    <span>•</span>
                                    <span className={
                                      step.priority === 'high' ? 'text-red-400 font-semibold' :
                                      step.priority === 'medium' ? 'text-amber-400' : 'text-green-400'
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
                    </GlassCard>
                    
                    {/* 导出和完成按钮（移动端） */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-3">
                      {/* 导出选项 */}
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          onClick={() => handleExport('markdown')}
                          variant="outline"
                          size="sm"
                        >
                          📄 MD
                        </Button>
                        <Button
                          onClick={() => handleExport('json')}
                          variant="outline"
                          size="sm"
                        >
                          💾 JSON
                        </Button>
                        <Button
                          onClick={handleCopy}
                          variant="outline"
                          size="sm"
                        >
                          {copySuccess ? '✓' : '📋'}
                        </Button>
                      </div>
                
                {/* 完成按钮 */}
                  <Button
                    onClick={handleComplete}
                    size="lg"
                    className="w-full"
                  >
                        完成 🚀
                  </Button>
                </div>
              </>
            )}
          </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

