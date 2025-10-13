/**
 * ECharts Graph 配置生成器
 * 
 * 基于 UniversalFramework 数据生成 ECharts 的配置对象
 */

import type { UniversalFramework, FrameworkNode, FrameworkEdge } from '@/lib/types-v2';
import { getEChartsNodeStyle, getEChartsEdgeStyle, getWeightIcon } from './color-scheme';

// ============================================
// ECharts 数据结构
// ============================================

interface EChartsNode {
  id: string;
  name: string;
  value: number; // 权重
  symbolSize: number;
  itemStyle: {
    color: string;
    borderColor: string;
    borderWidth: number;
    shadowBlur?: number;
    shadowColor?: string;
  };
  label: {
    show: boolean;
    formatter: string;
  };
  // 自定义数据，用于 tooltip
  data?: {
    description: string;
    estimatedTime: string;
    weight: number;
    dependencies: string[];
    weightBreakdown?: {
      necessity: number;
      impact: number;
      timeROI: number;
      reasoning?: string;
    };
    isMainPath?: boolean;
  };
}

interface EChartsEdge {
  source: string;
  target: string;
  lineStyle: {
    color: string;
    width: number;
    curveness: number;
  };
}

// ============================================
// 主配置生成函数
// ============================================

export function generateGraphConfig(framework: UniversalFramework) {
  const mainPathSet = new Set(framework.mainPath);
  const nodes = framework.nodes.map(node => nodeToEChartsNode(node, mainPathSet.has(node.id)));
  const edges = framework.edges.map(edge => edgeToEChartsEdge(edge, mainPathSet));
  
  return {
    title: {
      text: framework.domain,
      subtext: `目的: ${framework.purpose}`,
      left: 'center',
      top: 20,
      textStyle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
      },
      subtextStyle: {
        fontSize: 14,
        color: '#aaa',
      },
    },
    
    tooltip: {
      trigger: 'item',
      formatter: (params: {data?: EChartsNode}) => {
        if (params.data) {
          return formatNodeTooltip(params.data);
        }
        return '';
      },
      backgroundColor: 'rgba(30, 30, 50, 0.95)',
      borderColor: '#444',
      borderWidth: 1,
      textStyle: {
        color: '#fff',
      },
    },
    
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: edges,
        roam: true,
        focusNodeAdjacency: true,
        
        // 力导向布局配置
        force: {
          repulsion: 1200,
          gravity: 0.1,
          edgeLength: [180, 350],
          layoutAnimation: true,
        },
        
        // 节点样式
        label: {
          show: true,
          position: 'bottom',
          formatter: '{b}',
          fontSize: 12,
          color: '#fff',
        },
        
        // 边样式
        lineStyle: {
          color: 'source',
          curveness: 0.2,
        },
        
        // 高亮样式
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 5,
          },
          label: {
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
      },
    ],
  };
}

// ============================================
// 节点转换函数
// ============================================

function nodeToEChartsNode(node: FrameworkNode, isMainPath: boolean): EChartsNode {
  const style = getEChartsNodeStyle(node.color);
  
  // 根据权重计算节点大小（更大的差异）
  const baseSize = 40;
  const sizeMultiplier = 0.6 + (node.weight / 100) * 1.2; // 0.6 到 1.8
  const symbolSize = baseSize * sizeMultiplier;
  
  // mainPath节点增强边框
  const enhancedStyle = isMainPath ? {
    ...style,
    borderWidth: 4,
    borderColor: '#fbbf24', // 金色高亮
    shadowBlur: 10,
    shadowColor: '#fbbf24',
  } : style;
  
  // 节点名称包含权重图标
  const icon = getWeightIcon(node.weight);
  const mainPathIcon = isMainPath ? '⭐' : '';
  const name = `${mainPathIcon}${icon} ${node.title}`;
  
  return {
    id: node.id,
    name,
    value: node.weight,
    symbolSize,
    itemStyle: enhancedStyle,
    label: {
      show: true,
      formatter: name,
    },
    data: {
      description: node.description,
      estimatedTime: node.estimatedTime,
      weight: node.weight,
      dependencies: node.dependencies,
      weightBreakdown: node.weightBreakdown,
      isMainPath,
    },
  };
}

// ============================================
// 边转换函数
// ============================================

function edgeToEChartsEdge(edge: FrameworkEdge, mainPathSet: Set<string>): EChartsEdge {
  const baseStyle = getEChartsEdgeStyle(edge.type);
  
  // 检查是否为mainPath边（起点和终点都在mainPath中）
  const isMainPathEdge = mainPathSet.has(edge.from) && mainPathSet.has(edge.to);
  
  // 根据strength映射边的粗细（1-4px）
  const width = 1 + edge.strength * 3;
  
  // mainPath边使用金色高亮
  const lineStyle = isMainPathEdge ? {
    ...baseStyle,
    width: width + 1,
    color: '#fbbf24',
    shadowBlur: 5,
    shadowColor: '#fbbf24',
  } : {
    ...baseStyle,
    width,
  };
  
  return {
    source: edge.from,
    target: edge.to,
    lineStyle,
  };
}

// ============================================
// Tooltip 格式化
// ============================================

function formatNodeTooltip(node: EChartsNode): string {
  if (!node.data) return node.name;
  
  const { description, estimatedTime, weight, dependencies, weightBreakdown, isMainPath } = node.data;
  
  let html = `
    <div style="padding: 12px; max-width: 320px;">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #fff;">
        ${node.name}
      </div>
      
      ${isMainPath ? '<div style="color: #fbbf24; font-size: 12px; margin-bottom: 8px;">⭐ 核心主路径节点</div>' : ''}
      
      <div style="margin-bottom: 8px;">
        <div style="color: #aaa; font-size: 12px;">权重: <span style="color: #60a5fa; font-weight: bold;">${weight}%</span></div>
        <div style="color: #aaa; font-size: 12px;">预计时间: ${estimatedTime}</div>
      </div>
      
      <div style="margin-bottom: 8px; line-height: 1.5; color: #ddd; font-size: 13px;">
        ${description}
      </div>
  `;
  
  // 显示权重分解详情
  if (weightBreakdown) {
    html += `
      <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
        <div style="color: #aaa; font-size: 12px; margin-bottom: 6px; font-weight: bold;">权重构成:</div>
        <div style="font-size: 11px; color: #ddd; margin-bottom: 4px;">
          • 必要性: ${(weightBreakdown.necessity * 100).toFixed(0)}%
        </div>
        <div style="font-size: 11px; color: #ddd; margin-bottom: 4px;">
          • 影响力: ${(weightBreakdown.impact * 100).toFixed(0)}%
        </div>
        <div style="font-size: 11px; color: #ddd; margin-bottom: 4px;">
          • 时间ROI: ${(weightBreakdown.timeROI * 100).toFixed(0)}%
        </div>
        ${weightBreakdown.reasoning ? `<div style="font-size: 11px; color: #bbb; margin-top: 6px; font-style: italic;">${weightBreakdown.reasoning}</div>` : ''}
      </div>
    `;
  }
  
  if (dependencies.length > 0) {
    html += `
      <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
        <div style="color: #aaa; font-size: 12px; margin-bottom: 4px;">前置依赖:</div>
        <ul style="margin: 0; padding-left: 20px; font-size: 11px; color: #ddd;">
          ${dependencies.map(dep => `<li>${dep}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  html += '</div>';
  
  return html;
}

// ============================================
// 层级布局配置（备选方案）
// ============================================

export function generateHierarchicalConfig(framework: UniversalFramework) {
  // 如果需要严格的层级结构（从上到下），可以使用这个配置
  const mainPathSet = new Set(framework.mainPath);
  const nodes = framework.nodes.map(node => nodeToEChartsNode(node, mainPathSet.has(node.id)));
  const edges = framework.edges.map(edge => edgeToEChartsEdge(edge, mainPathSet));
  
  // 根据 mainPath 计算层级
  const layerMap = new Map<string, number>();
  framework.mainPath.forEach((nodeId, index) => {
    layerMap.set(nodeId, index);
  });
  
  // 为非主路径节点分配层级
  framework.nodes.forEach(node => {
    if (!layerMap.has(node.id)) {
      // 基于依赖关系计算层级
      const depLayers = node.dependencies
        .map(dep => layerMap.get(dep) ?? 0)
        .filter(layer => layer > 0);
      
      const layer = depLayers.length > 0 ? Math.max(...depLayers) + 0.5 : 0;
      layerMap.set(node.id, layer);
    }
  });
  
  return {
    ...generateGraphConfig(framework),
    series: [
      {
        type: 'graph',
        layout: 'none', // 使用固定布局
        data: nodes.map(node => ({
          ...node,
          x: layerMap.get(node.id) ?? 0 * 200, // 水平间距
          y: (framework.nodes.findIndex(n => n.id === node.id) % 3) * 100, // 垂直位置
        })),
        links: edges,
        roam: true,
      },
    ],
  };
}

