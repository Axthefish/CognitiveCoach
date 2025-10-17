'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { GlassCard } from './ui/glass-card';
import { Button } from './ui/button';
import { useIsMobile } from '@/lib/hooks/useBreakpoint';
import { Sparkles, Target, Send } from 'lucide-react';
import { WeightTerrain3D } from './weight-visualization-3d';
import type { DiagnosticQuestion, UserContextInfo } from '@/lib/types-v2';
import { logger } from '@/lib/logger';

/**
 * Stage 5-6: 权重分析 + 诊断提问
 * 左侧：3D权重可视化
 * 右侧：AI诊断问题
 */
export default function Stage56View() {
  const {
    universalFramework,
    stage56State,
    weightAnalysis,
    diagnosticQuestions,
    stage56CollectedInfo,
    setStage56State,
    setWeightAnalysis,
    setDiagnosticQuestions,
    addStage56Answer,
    completeStage56,
    setLoading,
    setError,
  } = useCognitiveCoachStoreV2();
  
  const isMobile = useIsMobile();
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [currentAnswer, setCurrentAnswer] = React.useState('');
  const [highlightedNodeIds, setHighlightedNodeIds] = React.useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  
  // 初始化：进行权重分析
  React.useEffect(() => {
    if (stage56State === 'ANALYZING_WEIGHTS' && !weightAnalysis && universalFramework) {
      analyzeWeights();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // 分析权重并生成诊断问题
  const analyzeWeights = async () => {
    if (!universalFramework) return;
    
    setIsAnalyzing(true);
    setLoading(true);
    
    try {
      const response = await fetch('/api/stage5-6-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          framework: universalFramework,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        if (result.data.analysis) {
          setWeightAnalysis(result.data.analysis);
        }
        if (result.data.questions) {
          setDiagnosticQuestions(result.data.questions);
          setStage56State('QUESTIONING');
        }
      } else {
        setError(result.message || 'Weight analysis failed');
      }
    } catch (error) {
      logger.error('[Stage56View] Weight analysis failed', { error });
      setError('Failed to analyze weights. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setLoading(false);
    }
  };
  
  // 处理回答提交
  const handleSubmitAnswer = () => {
    if (!currentAnswer.trim()) return;
    
    const currentQuestion = diagnosticQuestions[currentQuestionIndex];
    
    // 保存回答
    const answer: UserContextInfo = {
      questionId: currentQuestion.id,
      answer: currentAnswer,
      answeredAt: Date.now(),
    };
    
    addStage56Answer(answer);
    
    // 清空输入
    setCurrentAnswer('');
    
    // 移动到下一个问题或完成
    if (currentQuestionIndex < diagnosticQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setHighlightedNodeIds([]); // 清除高亮
    } else {
      // 所有问题已回答
      handleGeneratePlan();
    }
  };
  
  // 生成个性化方案
  const handleGeneratePlan = async () => {
    setIsAnalyzing(true);
    setLoading(true);
    
    try {
      const response = await fetch('/api/stage5-6-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'collect',
          framework: universalFramework,
          userAnswers: stage56CollectedInfo,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // 进入Stage 7
        completeStage56();
      } else {
        setError(result.message || 'Failed to process answers');
      }
    } catch (error) {
      logger.error('[Stage56View] Generate plan failed', { error });
      setError('Failed to generate plan. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setLoading(false);
    }
  };
  
  // 点击节点标签高亮3D中的节点
  const handleNodeClick = (nodeId: string) => {
    setHighlightedNodeIds([nodeId]);
  };
  
  // Loading状态
  if (isAnalyzing || stage56State === 'ANALYZING_WEIGHTS') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <GlassCard priority="primary" className="p-8 max-w-2xl w-full">
          <motion.div
            className="space-y-6 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="inline-block"
            >
              <Target className="w-16 h-16 text-purple-400 mx-auto" />
            </motion.div>
            
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Analyzing Framework
              </h3>
              <p className="text-gray-400">
                Identifying high-leverage points for personalization...
              </p>
            </div>
            
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 30, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </GlassCard>
      </div>
    );
  }
  
  if (!universalFramework || diagnosticQuestions.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center">
        <GlassCard priority="primary" className="p-8 text-center max-w-md">
          <p className="text-gray-300">Loading diagnostic questions...</p>
        </GlassCard>
      </div>
    );
  }
  
  const currentQuestion = diagnosticQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === diagnosticQuestions.length - 1;
  const allAnswered = stage56CollectedInfo.length === diagnosticQuestions.length;
  
  return (
    <div className="h-screen flex flex-col">
      {/* 头部 */}
      <motion.div
        className="px-6 py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassCard priority="primary" className="p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Stage 5-6: Personalization Diagnostic
              </h1>
              <p className="text-gray-300">
                Answer questions to customize your framework
              </p>
            </div>
            
            {/* 进度指示 */}
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">Progress</div>
              <div className="text-2xl font-bold text-white">
                {currentQuestionIndex + 1} / {diagnosticQuestions.length}
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>
      
      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        {isMobile ? (
          /* 移动端：垂直布局 */
          <div className="h-full overflow-y-auto px-6 pb-6 space-y-4">
            {/* 3D可视化在上 */}
            <GlassCard priority="primary" className="p-4">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Weight Visualization
              </h3>
              <div className="bg-black/20 rounded-lg overflow-hidden" style={{ height: '400px' }}>
                <WeightTerrain3D
                  framework={universalFramework}
                  highlightedQuestionIds={highlightedNodeIds}
                  questions={diagnosticQuestions}
                  onNodeSelect={(_nodeId) => {
                    // Optional: handle node selection
                  }}
                />
              </div>
            </GlassCard>
            
            {/* 问题在下 */}
            {!allAnswered && (
              <GlassCard priority="secondary" className="p-5">
                <QuestionCard
                  question={currentQuestion}
                  questionIndex={currentQuestionIndex}
                  totalQuestions={diagnosticQuestions.length}
                  answer={currentAnswer}
                  onAnswerChange={setCurrentAnswer}
                  onSubmit={handleSubmitAnswer}
                  onNodeClick={handleNodeClick}
                  isLastQuestion={isLastQuestion}
                />
              </GlassCard>
            )}
            
            {allAnswered && (
              <GlassCard priority="primary" className="p-6 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-green-400" />
                <h3 className="text-xl font-bold text-white mb-2">
                  All questions answered!
                </h3>
                <p className="text-gray-300 mb-4">
                  Click below to generate your personalized action framework
                </p>
              </GlassCard>
            )}
          </div>
        ) : (
          /* 桌面端：左右分栏 */
          <div className="h-full flex gap-6 px-6 pb-6">
            {/* 左侧：3D可视化 (70%) */}
            <motion.div
              className="w-[70%] flex flex-col"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <GlassCard priority="primary" className="p-6 flex-1 flex flex-col">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                  3D Weight Terrain
                </h3>
                <div className="flex-1 bg-black/20 rounded-lg overflow-hidden">
                  <WeightTerrain3D
                    framework={universalFramework}
                    highlightedQuestionIds={highlightedNodeIds}
                    questions={diagnosticQuestions}
                    onNodeSelect={(_nodeId) => {
                      // Optional: handle node selection
                    }}
                  />
                </div>
                <p className="text-sm text-gray-400 mt-4 text-center">
                  💡 Click on node tags in the question panel to highlight them here
                </p>
              </GlassCard>
            </motion.div>
            
            {/* 右侧：问题区 (30%) */}
            <motion.div
              className="w-[30%] flex flex-col"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {!allAnswered ? (
                <GlassCard priority="secondary" className="p-5 flex-1 flex flex-col">
                  <QuestionCard
                    question={currentQuestion}
                    questionIndex={currentQuestionIndex}
                    totalQuestions={diagnosticQuestions.length}
                    answer={currentAnswer}
                    onAnswerChange={setCurrentAnswer}
                    onSubmit={handleSubmitAnswer}
                    onNodeClick={handleNodeClick}
                    isLastQuestion={isLastQuestion}
                  />
                </GlassCard>
              ) : (
                <GlassCard priority="primary" className="p-6 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-green-400" />
                  <h3 className="text-xl font-bold text-white mb-2">
                    All questions answered!
                  </h3>
                  <p className="text-gray-300 mb-4">
                    Ready to generate your personalized action framework
                  </p>
                </GlassCard>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Question Card Component */
interface QuestionCardProps {
  question: DiagnosticQuestion;
  questionIndex: number;
  totalQuestions: number;
  answer: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  onNodeClick: (nodeId: string) => void;
  isLastQuestion: boolean;
}

function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  answer,
  onAnswerChange,
  onSubmit,
  onNodeClick,
  isLastQuestion,
}: QuestionCardProps) {
  return (
    <div className="flex flex-col h-full">
      {/* 问题头部 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-gray-400">
            Question {questionIndex + 1} / {totalQuestions}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              question.impactLevel >= 4
                ? 'bg-purple-500/20 text-purple-300'
                : question.impactLevel >= 3
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-gray-500/20 text-gray-300'
            }`}
          >
            {question.impactLevel >= 4 ? 'High Impact' : question.impactLevel >= 3 ? 'Medium Impact' : 'Low Impact'}
          </span>
        </div>
        
        <h4 className="font-semibold text-white text-lg mb-2">
          🎯 {question.questionType === 'baseline' ? 'Baseline' : question.questionType === 'resource' ? 'Resources' : question.questionType === 'context' ? 'Context' : 'Motivation'}
        </h4>
      </div>
      
      {/* 问题内容 */}
      <div className="flex-1 space-y-4 mb-4">
        <div>
          <p className="text-white leading-relaxed mb-3">
            {question.question}
          </p>
          
          {/* Why this matters */}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400 font-semibold mb-1">💡 Why this matters:</p>
            <p className="text-sm text-gray-300">
              {question.whyMatters}
            </p>
          </div>
        </div>
        
        {/* Affected nodes */}
        {question.affects && question.affects.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 font-semibold mb-2">📍 Affects these nodes:</p>
            <div className="flex flex-wrap gap-2">
              {question.affects.slice(0, 3).map((nodeId) => (
                <button
                  key={nodeId}
                  onClick={() => onNodeClick(nodeId)}
                  className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
                >
                  {nodeId}
                </button>
              ))}
              {question.affects.length > 3 && (
                <span className="text-xs text-gray-500">+{question.affects.length - 3} more</span>
              )}
            </div>
          </div>
        )}
        
        {/* Answer input */}
        <div>
          <label htmlFor="answer-input" className="block text-sm font-medium text-gray-300 mb-2">
            Your Answer:
          </label>
          <textarea
            id="answer-input"
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Share your thoughts..."
            className="w-full h-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 resize-none transition-all text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                onSubmit();
              }
            }}
          />
          <p className="text-xs text-gray-500 mt-1">
            Press Cmd/Ctrl + Enter to submit
          </p>
        </div>
      </div>
      
      {/* Submit button */}
      <Button
        onClick={onSubmit}
        disabled={!answer.trim()}
        size="lg"
        className="w-full"
      >
        <Send className="w-4 h-4 mr-2" />
        {isLastQuestion ? 'Submit & Generate Plan' : 'Next Question'}
      </Button>
    </div>
  );
}

