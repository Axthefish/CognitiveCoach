'use client';

import React from 'react';
import type { UniversalFramework } from '@/lib/types-v2';
import { generateGraphConfig } from './graph-config';

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
        console.error('Failed to load ECharts:', error);
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
    <div className="flex items-center gap-6 text-sm text-gray-600 bg-white rounded-lg border border-gray-200 px-4 py-3">
      <div className="font-semibold text-gray-900">图例：</div>
      
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#1e40af]" />
        <span>核心必修 (90-100%)</span>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#3b82f6]" />
        <span>重要推荐 (70-89%)</span>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#93c5fd]" />
        <span>可选增强 (50-69%)</span>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#9ca3af]" />
        <span>低优先级 (&lt;50%)</span>
      </div>
    </div>
  );
}

/**
 * 图表操作提示
 */
export function ChartHints() {
  return (
    <div className="text-xs text-gray-500 space-y-1">
      <p>💡 提示：</p>
      <ul className="list-disc list-inside space-y-1">
        <li>拖拽可移动图表，滚轮可缩放</li>
        <li>点击节点查看详细信息</li>
        <li>节点大小代表权重高低</li>
        <li>连线粗细代表依赖强度</li>
      </ul>
    </div>
  );
}

