'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { LogicFlowChart, ChartLegend } from './logic-flow-chart/LogicFlowChart';
import { GlassCard } from './ui/glass-card';
import { SmartLoading } from './ui/smart-loading';
import { Button } from './ui/button';
import { ArrowRight, Download, Sparkles } from 'lucide-react';
import { postJSON, type ApiError, getErrorMessage } from '@/lib/api-client';
import type { Stage1Response } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { exportFrameworkAsMarkdown } from '@/lib/export-utils';

export default function Stage1View() {
  const {
    purposeDefinition,
    universalFramework,
    setUniversalFramework,
    continueFromStage1,
    completeWithoutStage2,
    setLoading,
    setError,
  } = useCognitiveCoachStoreV2();
  
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [showDecisionArea, setShowDecisionArea] = React.useState(false);
  const decisionRef = React.useRef<HTMLDivElement>(null);
  
  const generateFramework = React.useCallback(async () => {
    if (!purposeDefinition) return;
    
    setIsGenerating(true);
    setLoading(true);
    
    try {
      const result = await postJSON<Stage1Response>('/api/stage1', {
        purposeDefinition,
        runTier: 'Pro',
      }, {
        timeout: 45000, // 框架生成可能需要更长时间
        retries: 2,
      });
      
      if (result.success && result.data) {
        setUniversalFramework(result.data);
      } else {
        setError(result.message || 'Framework generation failed');
      }
    } catch (error) {
      const apiError = error as ApiError;
      const errorInfo = getErrorMessage(apiError);
      setError(errorInfo.message);
      logger.error('[Stage1View] Error generating framework', { error: apiError });
    } finally {
      setIsGenerating(false);
      setLoading(false);
    }
  }, [purposeDefinition, setLoading, setUniversalFramework, setError]);
  
  // 自动生成框架
  React.useEffect(() => {
    if (!universalFramework && purposeDefinition) {
      generateFramework();
    }
  }, [universalFramework, purposeDefinition, generateFramework]);
  
  // 导出并完成流程
  const handleExportAndComplete = React.useCallback(async () => {
    if (!universalFramework) return;
    
    setIsExporting(true);
    try {
      // 导出为Markdown
      exportFrameworkAsMarkdown(universalFramework);
      
      // 短暂延迟后标记完成
      setTimeout(() => {
        completeWithoutStage2();
        setIsExporting(false);
      }, 500);
    } catch (error) {
      logger.error('[Stage1View] Export failed', { error });
      setError('导出失败，请重试');
      setIsExporting(false);
    }
  }, [universalFramework, completeWithoutStage2, setError]);
  
  // 监听滚动，当框架详情可见时才显示决策区域
  React.useEffect(() => {
    const currentRef = decisionRef.current;
    if (!currentRef) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowDecisionArea(true);
        }
      },
      { threshold: 0.3 }
    );
    
    observer.observe(currentRef);
    
    return () => {
      observer.unobserve(currentRef);
    };
  }, []);
  
  if (isGenerating || !universalFramework) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <SmartLoading
          steps={[
            {
              label: 'Analyzing problem domain...',
              percentage: 40,
              tip: '💡 Cognitive Load Theory: AI is breaking down complex problems into manageable modules',
            },
            {
              label: 'Calculating module weights...',
              percentage: 70,
              tip: '🎯 Pareto Principle: Identifying the 20% of key modules that bring 80% of value',
            },
            {
              label: 'Generating relationship graph...',
              percentage: 100,
              tip: '🔄 Systems Thinking: Establishing dependency networks between modules',
            },
          ]}
          estimatedTime="10-30 seconds"
        />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-6 pb-32 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 头部 + 阅读提示 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard priority="primary" className="p-6">
            <h1 className="text-3xl font-bold text-white mb-3">
              Stage 1: Universal Framework
            </h1>
            <p className="text-gray-300 text-lg mb-4">
              Based on your purpose &ldquo;<span className="text-blue-300 font-semibold">{purposeDefinition?.clarifiedPurpose}</span>&rdquo;,
              I&apos;ve generated a weighted solution framework for you.
            </p>
            
            {/* 用户教育：说明这是通用框架 */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div className="flex-1">
                  <p className="text-blue-200 font-semibold mb-2">这是通用框架（Universal Framework）</p>
                  <ul className="text-sm text-gray-300 space-y-1.5">
                    <li>• 像医学教科书一样，展示该领域的<strong className="text-white">标准路径</strong></li>
                    <li>• 权重反映<strong className="text-white">客观重要性</strong>，不含个人因素（如你的基础、时间）</li>
                    <li>• 你可以：
                      <span className="ml-2 text-gray-400">
                        ①直接使用按权重执行 
                        <span className="mx-1">|</span>
                        ②个性化调整适配你的情况
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/10 rounded-lg p-3">
              <span>⏱️</span>
              <span>建议阅读时间：{Math.ceil(universalFramework.nodes.length * 0.5)} 分钟 | 请仔细查看每个节点的权重和说明，确保理解整体框架</span>
            </div>
          </GlassCard>
        </motion.div>
        
        {/* 图例 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ChartLegend />
        </motion.div>
        
        {/* 框架可视化 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard priority="primary" className="p-6">
            <LogicFlowChart
              framework={universalFramework}
              height={600}
            />
          </GlassCard>
        </motion.div>
        
        {/* 框架详情 */}
        <motion.div
          ref={decisionRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard priority="secondary" className="p-6">
            <h3 className="font-semibold text-xl text-white mb-6">Framework Details</h3>
            <div className="space-y-4">
              {universalFramework.nodes
                .sort((a, b) => b.weight - a.weight)
                .map((node, index) => (
                  <motion.div
                    key={node.id}
                    className="glass-card-tertiary rounded-lg border-l-4 pl-4 py-3"
                    style={{
                      borderColor: 
                        node.weight >= 90 ? '#1e40af' :
                        node.weight >= 70 ? '#3b82f6' :
                        node.weight >= 50 ? '#93c5fd' : '#9ca3af'
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-lg">{node.title}</h4>
                        <p className="text-sm text-gray-300 mt-1">{node.description}</p>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-xl font-bold text-white">{node.weight}%</div>
                        <div className="text-xs text-gray-400">{node.estimatedTime}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </div>
          </GlassCard>
        </motion.div>
        
        {/* 用户决策点：需要滚动才能看到 */}
        <AnimatePresence>
          {showDecisionArea && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.2 }}
            >
              <GlassCard priority="primary" className="p-6" glow>
                <h3 className="font-semibold text-2xl text-white mb-4 text-center">
                  💡 What would you like to do next?
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Option 1: This framework is sufficient */}
                  <motion.div
                    className="glass-card-secondary p-6 cursor-pointer rounded-lg border-2 border-transparent hover:border-white/20 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleExportAndComplete}
                  >
                    <div className="text-4xl mb-3 text-center">
                      <Download className="w-12 h-12 mx-auto text-blue-400" />
                    </div>
                    <h4 className="font-semibold text-lg text-white mb-2 text-center">
                      This framework is sufficient
                    </h4>
                    <p className="text-sm text-gray-300 text-center">
                      Download and implement based on priority weights
                    </p>
                    {isExporting && (
                      <p className="text-xs text-blue-400 text-center mt-2">Exporting...</p>
                    )}
                  </motion.div>
                  
                  {/* Option 2: I need personalization */}
                  <motion.div
                    className="glass-card-secondary p-6 cursor-pointer rounded-lg border-2 border-blue-500 hover:border-blue-400 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={continueFromStage1}
                  >
                    <div className="text-4xl mb-3 text-center">
                      <Sparkles className="w-12 h-12 mx-auto text-purple-400" />
                    </div>
                    <h4 className="font-semibold text-lg text-white mb-2 text-center">
                      I need personalization
                    </h4>
                    <p className="text-sm text-gray-300 text-center">
                      Adjust weights based on my specific situation
                    </p>
                  </motion.div>
                </div>
                
                {/* Helper text */}
                <div className="text-xs text-gray-400 space-y-2 bg-white/5 rounded-lg p-4">
                  <p className="font-semibold text-gray-300">💡 Personalization will:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Ask 3-5 questions about your current level and resources</li>
                    <li>Adjust node weights based on your individual situation</li>
                    <li>Generate specific action steps with timeline</li>
                    <li>Provide personalized tips and recommendations</li>
                  </ul>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Sticky Bottom Bar - 移动端 */}
        <motion.div
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 p-4 glass-card-primary border-t border-white/10"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
            <Button
              onClick={handleExportAndComplete}
              variant="outline"
              size="lg"
              className="flex flex-col items-center gap-2 h-auto py-4"
              disabled={isExporting}
            >
              <Download className="w-5 h-5" />
              <span className="text-xs">直接使用</span>
            </Button>
            <Button
              onClick={continueFromStage1}
              size="lg"
              className="flex flex-col items-center gap-2 h-auto py-4 bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-xs">个性化调整</span>
            </Button>
          </div>
        </motion.div>
        
        {/* Floating Decision Card - 桌面端 */}
        <motion.div
          className="hidden md:block fixed right-6 top-32 w-80 z-30"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <GlassCard priority="primary" className="p-5">
            <h4 className="font-semibold text-lg text-white mb-3">
              💡 Next Step
            </h4>
            
            {/* 核心节点快速预览 */}
            <div className="mb-4 space-y-2">
              <p className="text-xs text-gray-400 mb-2">核心节点 (≥70%):</p>
              {universalFramework.nodes
                .filter(n => n.weight >= 70)
                .slice(0, 3)
                .map(node => (
                  <div key={node.id} className="text-xs text-gray-300 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="flex-1 truncate">{node.title}</span>
                    <span className="text-blue-400 font-semibold">{node.weight}%</span>
                  </div>
                ))}
              {universalFramework.nodes.filter(n => n.weight >= 70).length > 3 && (
                <p className="text-xs text-gray-500 ml-4">+{universalFramework.nodes.filter(n => n.weight >= 70).length - 3} more</p>
              )}
            </div>
            
            {/* 决策按钮 */}
            <div className="space-y-2">
              <Button
                onClick={continueFromStage1}
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                个性化调整
              </Button>
              <Button
                onClick={handleExportAndComplete}
                variant="outline"
                size="lg"
                className="w-full"
                disabled={isExporting}
              >
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? '导出中...' : '直接使用'}
              </Button>
            </div>
            
            {/* Helper hint */}
            <div className="mt-4 text-xs text-gray-400 bg-white/5 rounded p-3">
              <p className="font-semibold mb-1">💡 提示：</p>
              <p>个性化调整会根据你的基础和时间调整权重</p>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}

