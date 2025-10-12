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
  const nodes = framework.nodes.map(nodeToEChartsNode);
  const edges = framework.edges.map(edgeToEChartsEdge);
  
  return {
    title: {
      text: framework.domain,
      subtext: `目的: ${framework.purpose}`,
      left: 'center',
      top: 20,
      textStyle: {
        fontSize: 20,
        fontWeight: 'bold',
      },
      subtextStyle: {
        fontSize: 14,
        color: '#666',
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
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: {
        color: '#333',
      },
    },
    
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: edges,
        roam: true, // 允许缩放和平移
        focusNodeAdjacency: true, // 高亮相关节点
        
        // 力导向布局配置
        force: {
          repulsion: 1000, // 节点之间的斥力
          gravity: 0.1, // 重力，影响节点聚集
          edgeLength: [150, 300], // 边的长度范围
          layoutAnimation: true,
        },
        
        // 节点样式
        label: {
          show: true,
          position: 'bottom',
          formatter: '{b}',
          fontSize: 12,
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
            width: 4,
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

function nodeToEChartsNode(node: FrameworkNode): EChartsNode {
  const style = getEChartsNodeStyle(node.color);
  
  // 根据权重计算节点大小
  const baseSize = 40;
  const sizeMultiplier = 0.5 + (node.weight / 100); // 0.5 到 1.5
  const symbolSize = baseSize * sizeMultiplier;
  
  // 节点名称包含权重图标
  const icon = getWeightIcon(node.weight);
  const name = `${icon} ${node.title}`;
  
  return {
    id: node.id,
    name,
    value: node.weight,
    symbolSize,
    itemStyle: style,
    label: {
      show: true,
      formatter: name,
    },
    data: {
      description: node.description,
      estimatedTime: node.estimatedTime,
      weight: node.weight,
      dependencies: node.dependencies,
    },
  };
}

// ============================================
// 边转换函数
// ============================================

function edgeToEChartsEdge(edge: FrameworkEdge): EChartsEdge {
  const style = getEChartsEdgeStyle(edge.type);
  
  return {
    source: edge.from,
    target: edge.to,
    lineStyle: style,
  };
}

// ============================================
// Tooltip 格式化
// ============================================

function formatNodeTooltip(node: EChartsNode): string {
  if (!node.data) return node.name;
  
  const { description, estimatedTime, weight, dependencies } = node.data;
  
  let html = `
    <div style="padding: 8px; max-width: 300px;">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">
        ${node.name}
      </div>
      
      <div style="margin-bottom: 8px;">
        <div style="color: #666; font-size: 12px;">权重: ${weight}%</div>
        <div style="color: #666; font-size: 12px;">预计时间: ${estimatedTime}</div>
      </div>
      
      <div style="margin-bottom: 8px; line-height: 1.5;">
        ${description}
      </div>
  `;
  
  if (dependencies.length > 0) {
    html += `
      <div style="border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px;">
        <div style="color: #666; font-size: 12px; margin-bottom: 4px;">前置依赖:</div>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px;">
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
  const nodes = framework.nodes.map(nodeToEChartsNode);
  const edges = framework.edges.map(edgeToEChartsEdge);
  
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

