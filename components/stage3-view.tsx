'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { GlassCard } from './ui/glass-card';
import { Button } from './ui/button';
import { Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react';
import { WeightTerrain3D } from './weight-visualization-3d';
import type { UniversalFramework } from '@/lib/types-v2';
import { logger } from '@/lib/logger';

/**
 * Stage 3: 通用框架展示（3D可视化）
 * 生成并展示通用框架，使用3D权重地形图
 */
export default function Stage3View() {
  const {
    clarifiedMission,
    universalFramework,
    setUniversalFramework,
    completeStage3,
    setLoading,
    setError,
  } = useCognitiveCoachStoreV2();
  
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  
  // 生成通用框架
  React.useEffect(() => {
    if (!universalFramework && clarifiedMission) {
      generateFramework();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const generateFramework = async () => {
    if (!clarifiedMission) return;
    
    setIsGenerating(true);
    setLoading(true);
    
    try {
      const response = await fetch('/api/stage3-framework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission: clarifiedMission,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const framework = result.data as UniversalFramework;
        setUniversalFramework(framework);
      } else {
        setError(result.message || 'Framework generation failed');
      }
    } catch (error) {
      logger.error('[Stage3View] Framework generation failed', { error });
      setError('Failed to generate framework. Please try again.');
    } finally {
      setIsGenerating(false);
      setLoading(false);
    }
  };
  
  // 处理继续
  const handleContinue = () => {
    completeStage3();
  };
  
  // Loading状态
  if (isGenerating || !universalFramework) {
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
              <Sparkles className="w-16 h-16 text-blue-400 mx-auto" />
            </motion.div>
            
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Generating Your Framework
              </h3>
              <p className="text-gray-400">
                Creating a comprehensive action framework based on your mission...
              </p>
              <p className="text-gray-500 text-sm mt-2">
                This may take 60-90 seconds
              </p>
            </div>
            
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 60, ease: "easeInOut" }}
              />
            </div>
            
            <div className="text-sm text-gray-400 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
              💡 The AI is analyzing domain knowledge and identifying key action nodes with weighted priorities
            </div>
          </motion.div>
        </GlassCard>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-6">
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
                  Stage 3: Universal Framework
                </h1>
                <p className="text-gray-300 text-lg">
                  Here&apos;s your action framework with weighted priorities
                </p>
                {clarifiedMission && (
                  <p className="text-sm text-gray-400 mt-2">
                    Based on: <span className="text-blue-300 font-semibold">{clarifiedMission.missionStatement}</span>
                  </p>
                )}
              </div>
              
            </div>
          </GlassCard>
        </motion.div>
        
        {/* 说明卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard priority="secondary" className="p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">💡</span>
              <div className="flex-1">
                <p className="text-blue-200 font-semibold mb-2">This is a Universal Framework</p>
                <ul className="text-sm text-gray-300 space-y-1.5">
                  <li>• Shows the <strong className="text-white">standard path</strong> for this domain, like a textbook</li>
                  <li>• Weights reflect <strong className="text-white">objective importance</strong>, not personal factors</li>
                  <li>• You can use it as-is, or personalize it in the next step</li>
                </ul>
              </div>
            </div>
          </GlassCard>
        </motion.div>
        
        {/* 3D可视化 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard priority="primary" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                3D Weight Visualization
              </h2>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Show Details
                  </>
                )}
              </Button>
            </div>
            
            {/* 3D组件 */}
            <div className="bg-black/20 rounded-lg overflow-hidden" style={{ height: '600px' }}>
              <WeightTerrain3D
                framework={universalFramework}
                config={{ autoRotate: true, rotationSpeed: 0.5, showGrid: false }}
              />
            </div>
            
            <p className="text-sm text-gray-400 mt-4 text-center">
              💡 Higher terrain = higher weight/priority. Interact with the 3D view to explore.
            </p>
          </GlassCard>
        </motion.div>
        
        {/* 节点详情（可选展开） */}
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GlassCard priority="secondary" className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Framework Details</h3>
              <div className="space-y-3">
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
                          node.weight >= 50 ? '#60a5fa' : '#6b7280'
                      }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
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
        )}
        
        {/* 继续按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center pb-8"
        >
          <GlassCard priority="primary" className="p-6 max-w-xl w-full">
            <p className="text-gray-300 text-center mb-4">
              Ready to continue? Next, you&apos;ll choose whether to personalize this framework.
            </p>
            <Button
              onClick={handleContinue}
              size="lg"
              className="w-full group"
            >
              <span>Continue to Personalization Choice</span>
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}

