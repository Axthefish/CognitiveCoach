'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { GlassCard } from './ui/glass-card';
import { Button } from './ui/button';
import { Sparkles, Check, Zap, TrendingUp } from 'lucide-react';
import { ComparisonView } from './weight-visualization-3d';
import type { PersonalizedActionFramework } from '@/lib/types-v2';
import { logger } from '@/lib/logger';

/**
 * Stage 7: 个性化方案展示
 * 展示个性化后的框架，使用3D对比视图
 */
export default function Stage7View() {
  const {
    universalFramework,
    weightAnalysis,
    stage56CollectedInfo,
    personalizedActionFramework,
    setPersonalizedActionFramework,
    completeFlow,
    setLoading,
    setError,
  } = useCognitiveCoachStoreV2();
  
  const [viewMode, setViewMode] = React.useState<'3d' | 'split' | '2d'>('3d');
  const [isGenerating, setIsGenerating] = React.useState(false);
  
  // 生成个性化方案
  React.useEffect(() => {
    if (!personalizedActionFramework && universalFramework && stage56CollectedInfo.length > 0) {
      generatePersonalizedPlan();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const generatePersonalizedPlan = async () => {
    if (!universalFramework) return;
    
    setIsGenerating(true);
    setLoading(true);
    
    try {
      const response = await fetch('/api/stage7-personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framework: universalFramework,
          diagnosticPoints: weightAnalysis?.highLeveragePoints || [],
          userAnswers: stage56CollectedInfo,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const plan = result.data as PersonalizedActionFramework;
        setPersonalizedActionFramework(plan);
      } else {
        setError(result.message || 'Failed to generate personalized plan');
      }
    } catch (error) {
      logger.error('[Stage7View] Plan generation failed', { error });
      setError('Failed to generate personalized plan. Please try again.');
    } finally {
      setIsGenerating(false);
      setLoading(false);
    }
  };
  
  // 处理完成
  const handleComplete = () => {
    completeFlow();
  };
  
  // Loading状态
  if (isGenerating || !personalizedActionFramework) {
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
              <Sparkles className="w-16 h-16 text-purple-400 mx-auto" />
            </motion.div>
            
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Crafting Your Personal Framework
              </h3>
              <p className="text-gray-400">
                Integrating your specific context into the action framework...
              </p>
              <p className="text-gray-500 text-sm mt-2">
                This may take 60-90 seconds
              </p>
            </div>
            
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 60, ease: "easeInOut" }}
              />
            </div>
            
            <div className="text-sm text-gray-400 bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
              💡 Creating personalized action modules based on your unique strengths and opportunities
            </div>
          </motion.div>
        </GlassCard>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard priority="primary" className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Stage 7: Your Personal Action Framework
                </h1>
                <p className="text-gray-300 text-lg">
                  Here&apos;s your customized framework, tailored to your situation
                </p>
              </div>
              
              {/* 视图切换 */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === '3d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('3d')}
                >
                  3D Terrain
                </Button>
                <Button
                  variant={viewMode === 'split' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('split')}
                >
                  Split View
                </Button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
        
        {/* Emerging Superpower */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard priority="primary" className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30">
            <div className="flex items-start gap-4">
              <Zap className="w-8 h-8 text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-2">
                  Your Emerging Superpower
                </h2>
                <p className="text-gray-200 text-lg leading-relaxed">
                  {personalizedActionFramework.emergingSuperpower}
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
        
        {/* 3D对比视图 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard priority="primary" className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              Framework Comparison
            </h2>
            
            <div className="bg-black/20 rounded-lg overflow-hidden" style={{ height: '600px' }}>
              <ComparisonView
                universalFramework={universalFramework!}
                personalizedFramework={personalizedActionFramework.personalizedFramework}
                viewMode={viewMode}
              />
            </div>
            
            <p className="text-sm text-gray-400 mt-4 text-center">
              💡 Compare universal (blue) vs personalized (purple) weights
            </p>
          </GlassCard>
        </motion.div>
        
        {/* Personal Insights */}
        {personalizedActionFramework.personalInsights && personalizedActionFramework.personalInsights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard priority="secondary" className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-400" />
                Personal Insights
              </h2>
              <div className="space-y-4">
                {personalizedActionFramework.personalInsights.map((insight, index) => (
                  <motion.div
                    key={index}
                    className="glass-card-tertiary rounded-lg p-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                  >
                    <h3 className="font-semibold text-white mb-2">
                      {insight.diagnosticPoint}
                    </h3>
                    <p className="text-gray-300 text-sm">
                      {insight.derivedInsight}
                    </p>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
        
        {/* Action Map */}
        {personalizedActionFramework.actionMap && personalizedActionFramework.actionMap.modules && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <GlassCard priority="secondary" className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Check className="w-6 h-6 text-green-400" />
                Your Action Map
              </h2>
              <div className="space-y-6">
                {personalizedActionFramework.actionMap.modules.map((module, moduleIndex) => (
                  <motion.div
                    key={moduleIndex}
                    className="glass-card-tertiary rounded-lg p-5"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + moduleIndex * 0.1 }}
                  >
                    <h3 className="font-semibold text-white text-lg mb-3">
                      {module.moduleName}
                    </h3>
                    <div className="space-y-3">
                      {module.actions.map((action, actionIndex) => (
                        <div
                          key={actionIndex}
                          className={`p-3 rounded-lg border-l-4 ${
                            action.status === 'strength'
                              ? 'bg-green-500/10 border-green-500'
                              : action.status === 'opportunity'
                              ? 'bg-blue-500/10 border-blue-500'
                              : 'bg-gray-500/10 border-gray-500'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl flex-shrink-0">
                              {action.status === 'strength' ? '✅' : action.status === 'opportunity' ? '🎯' : '🔄'}
                            </span>
                            <div className="flex-1">
                              <p className="text-white mb-1">{action.action}</p>
                              <p className="text-sm text-gray-400 mb-2">{action.coachNote}</p>
                              
                              {action.nextMoves && action.nextMoves.length > 0 && (
                                <div className="mt-2 pl-3 border-l-2 border-blue-500/30">
                                  <p className="text-xs font-semibold text-blue-300 mb-1">Next moves:</p>
                                  <ul className="space-y-1">
                                    {action.nextMoves.map((move, moveIndex) => (
                                      <li key={moveIndex} className="text-xs text-gray-300">
                                        • {move}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
        
        {/* First Step */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <GlassCard priority="primary" className="p-6 bg-gradient-to-br from-green-500/10 to-blue-500/10 border-2 border-green-500/30">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🚀</span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-2">
                  Your First Step
                </h2>
                <p className="text-gray-200 leading-relaxed">
                  {personalizedActionFramework.firstStep}
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
        
        {/* Complete按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center pb-8"
        >
          <GlassCard priority="primary" className="p-6 max-w-xl w-full">
            <div className="text-center mb-4">
              <p className="text-gray-300 mb-2">
                Your personalized framework is ready! 🎉
              </p>
              <p className="text-sm text-gray-400">
                Start with your first step and build your path to success
              </p>
            </div>
            <Button
              onClick={handleComplete}
              size="lg"
              className="w-full group"
            >
              <Check className="w-5 h-5 mr-2" />
              <span>Complete & Start Your Journey</span>
              <Sparkles className="w-5 h-5 ml-2" />
            </Button>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}

