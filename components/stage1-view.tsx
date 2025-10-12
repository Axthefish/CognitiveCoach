'use client';

import React from 'react';
import { useCognitiveCoachStoreV2 } from '@/lib/store-v2';
import { LogicFlowChart, ChartLegend, ChartHints } from './logic-flow-chart/LogicFlowChart';
import { Button } from './ui/button';
import { Card } from './ui/card';

export default function Stage1View() {
  const {
    purposeDefinition,
    universalFramework,
    stage1Paused,
    setUniversalFramework,
    continueFromStage1,
    setLoading,
    setError,
  } = useCognitiveCoachStoreV2();
  
  const [isGenerating, setIsGenerating] = React.useState(false);
  
  const generateFramework = React.useCallback(async () => {
    if (!purposeDefinition) return;
    
    setIsGenerating(true);
    setLoading(true);
    
    try {
      const response = await fetch('/api/stage1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purposeDefinition,
          runTier: 'Pro',
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setUniversalFramework(result.data);
      } else {
        setError(result.message || '框架生成失败');
      }
    } catch (error) {
      setError('网络错误，请重试');
      console.error('[Stage1View] Error:', error);
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
  
  if (isGenerating || !universalFramework) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center max-w-md">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">正在生成框架...</h2>
          <p className="text-gray-600">
            AI 正在基于你的目的分析问题域，计算各模块的权重和优先级。
          </p>
          <p className="text-sm text-gray-500 mt-4">这可能需要 10-30 秒</p>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 头部 */}
        <Card className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">
            阶段 1：通用框架
          </h1>
          <p className="text-gray-600 mt-2">
            基于你的目的「{purposeDefinition?.clarifiedPurpose}」，
            我为你生成了一个带权重的解决框架。
          </p>
        </Card>
        
        {/* 图例 */}
        <ChartLegend />
        
        {/* 框架可视化 */}
        <Card className="p-6">
          <LogicFlowChart
            framework={universalFramework}
            height={600}
          />
        </Card>
        
        {/* 提示和操作 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <ChartHints />
          </Card>
          
          <Card className="p-6">
            {stage1Paused ? (
              <div>
                <h3 className="font-semibold text-lg mb-3">💡 请花 2-3 分钟思考</h3>
                <ul className="space-y-2 text-sm text-gray-700 mb-4">
                  <li>• 哪些部分你已经有基础？</li>
                  <li>• 哪些部分是你当前最需要的？</li>
                  <li>• 你的时间和资源允许你在哪些方面深入？</li>
                </ul>
                
                <Button
                  onClick={continueFromStage1}
                  size="lg"
                  className="w-full"
                >
                  我已思考，继续 →
                </Button>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>准备进入个性化定制...</p>
              </div>
            )}
          </Card>
        </div>
        
        {/* 框架详情 */}
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">框架详情</h3>
          <div className="space-y-4">
            {universalFramework.nodes
              .sort((a, b) => b.weight - a.weight)
              .map(node => (
                <div
                  key={node.id}
                  className="border-l-4 pl-4 py-2"
                  style={{
                    borderColor: 
                      node.weight >= 90 ? '#1e40af' :
                      node.weight >= 70 ? '#3b82f6' :
                      node.weight >= 50 ? '#93c5fd' : '#9ca3af'
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{node.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{node.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-gray-900">{node.weight}%</div>
                      <div className="text-xs text-gray-500">{node.estimatedTime}</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

