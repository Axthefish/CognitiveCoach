'use client';

import React from 'react';
import type { UniversalFramework } from '@/lib/types-v2';
import { generateGraphConfig } from './graph-config';
import { logger } from '@/lib/logger';

// ECharts 动态导入（减少首次加载体积）
let EChartsReact: React.ComponentType<{
  option: unknown;
  style?: React.CSSProperties;
  notMerge?: boolean;
  lazyUpdate?: boolean;
}> | null = null;

interface LogicFlowChartProps {
  framework: UniversalFramework;
  height?: number | string;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

export function LogicFlowChart({
  framework,
  height = 600,
  onNodeClick,
  className,
}: LogicFlowChartProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [echarts, setEcharts] = React.useState<typeof EChartsReact | null>(null);
  const chartRef = React.useRef<{
    getEchartsInstance: () => { on: (event: string, handler: (params: unknown) => void) => void };
  } | null>(null);
  
  // 动态加载 ECharts
  React.useEffect(() => {
    const loadECharts = async () => {
      try {
        const echartsModule = await import('echarts-for-react');
        EChartsReact = echartsModule.default;
        setEcharts(() => echartsModule.default);
        setIsLoading(false);
      } catch (error) {
        logger.error('Failed to load ECharts:', error);
        setIsLoading(false);
      }
    };
    
    if (!EChartsReact) {
      loadECharts();
    } else {
      setEcharts(() => EChartsReact);
      setIsLoading(false);
    }
  }, []);
  
  // 生成图表配置
  const chartOption = React.useMemo(() => {
    return generateGraphConfig(framework);
  }, [framework]);
  
  // 注册节点点击事件
  React.useEffect(() => {
    if (chartRef.current && onNodeClick) {
      const echartsInstance = chartRef.current.getEchartsInstance();
      
      const handleClick = (params: unknown) => {
        const p = params as { dataType?: string; data?: { id: string } };
        if (p.dataType === 'node' && p.data?.id) {
          onNodeClick(p.data.id);
        }
      };
      
      echartsInstance.on('click', handleClick);
      
      return () => {
        // 清理事件监听
        // ECharts 实例在组件卸载时会自动清理
      };
    }
  }, [onNodeClick]);
  
  // 加载状态
  if (isLoading) {
    return (
      <div
        className={className}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载图表中...</p>
          </div>
        </div>
      </div>
    );
  }
  
  // ECharts 加载失败
  if (!echarts) {
    return (
      <div
        className={className}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <div className="flex items-center justify-center h-full bg-red-50 rounded-lg border border-red-200">
          <div className="text-center text-red-600">
            <p className="font-semibold mb-2">图表加载失败</p>
            <p className="text-sm">请刷新页面重试</p>
          </div>
        </div>
      </div>
    );
  }
  
  const EChartsComponent = echarts as React.ComponentType<{
    option: unknown;
    style?: React.CSSProperties;
    notMerge?: boolean;
    lazyUpdate?: boolean;
    ref?: React.Ref<{ getEchartsInstance: () => { on: (event: string, handler: (params: unknown) => void) => void } }>;
  }>;
  
  return (
    <div className={className}>
      <EChartsComponent
        ref={chartRef}
        option={chartOption}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          width: '100%',
        }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}

/**
 * 图表图例组件
 * 
 * 显示颜色编码的含义
 */
export function ChartLegend() {
  return (
    <div className="glass-card-secondary rounded-lg px-6 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 权重颜色编码 */}
        <div>
          <div className="font-semibold text-white text-sm mb-3">节点颜色 = 权重等级</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <div className="w-4 h-4 rounded-full bg-[#1e40af]" />
              <span>核心必修 (90-100%)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <div className="w-4 h-4 rounded-full bg-[#3b82f6]" />
              <span>重要推荐 (70-89%)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <div className="w-4 h-4 rounded-full bg-[#93c5fd]" />
              <span>可选增强 (50-69%)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <div className="w-4 h-4 rounded-full bg-[#9ca3af]" />
              <span>低优先级 (&lt;50%)</span>
            </div>
          </div>
        </div>
        
        {/* 其他视觉编码 */}
        <div>
          <div className="font-semibold text-white text-sm mb-3">其他视觉编码</div>
          <div className="space-y-2 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">⭐</span>
              <span>金色边框 = 核心主路径</span>
            </div>
            <div className="flex items-center gap-2">
              <span>●</span>
              <span>节点大小 = 权重高低</span>
            </div>
            <div className="flex items-center gap-2">
              <span>━</span>
              <span>连线粗细 = 关联强度</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🖱️</span>
              <span>悬停节点 = 显示详细信息</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 图表操作提示
 */
export function ChartHints() {
  return (
    <div className="glass-card-tertiary rounded-lg p-4">
      <p className="text-sm text-gray-400 mb-2">💡 交互提示：</p>
      <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside">
        <li>拖拽画布可移动，滚轮可缩放</li>
        <li>悬停节点查看权重分解详情</li>
        <li>金色高亮路径是推荐的核心学习顺序</li>
        <li>节点越大表示权重越高，越重要</li>
      </ul>
    </div>
  );
}

