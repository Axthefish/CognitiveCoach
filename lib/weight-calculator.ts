/**
 * 权重计算器
 * 
 * 基于目的的权重计算逻辑
 * weight = (necessity × 0.4) + (impact × 0.3) + (timeROI × 0.3)
 */

import type { WeightDimensions, WeightConfig, FrameworkNode } from './types-v2';
import { getColorForWeight } from './types-v2';

// ============================================
// 默认权重配置
// ============================================

export const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  necessityWeight: 0.4,   // 必要性权重
  impactWeight: 0.3,      // 影响力权重
  timeROIWeight: 0.3,     // 时间投资回报率权重
};

// ============================================
// 主计算函数
// ============================================

/**
 * 计算综合权重
 * 
 * @param dimensions 权重维度（必要性、影响力、时间ROI）
 * @param config 权重配置（可选，使用默认配置）
 * @returns 0-100 的权重值
 */
export function calculateWeight(
  dimensions: WeightDimensions,
  config: WeightConfig = DEFAULT_WEIGHT_CONFIG
): number {
  const { necessity, impact, timeROI } = dimensions;
  const { necessityWeight, impactWeight, timeROIWeight } = config;
  
  // 确保输入在 0-1 范围内
  const normalizedNecessity = Math.max(0, Math.min(1, necessity));
  const normalizedImpact = Math.max(0, Math.min(1, impact));
  const normalizedTimeROI = Math.max(0, Math.min(1, timeROI));
  
  // 计算加权平均
  const weight = 
    normalizedNecessity * necessityWeight +
    normalizedImpact * impactWeight +
    normalizedTimeROI * timeROIWeight;
  
  // 转换为 0-100 的分数，并四舍五入
  return Math.round(weight * 100);
}

/**
 * 为节点计算权重并设置颜色
 */
export function enrichNodeWithWeight(
  node: Omit<FrameworkNode, 'weight' | 'color'>
): FrameworkNode {
  // 如果有权重维度，使用它计算
  if (node.weightBreakdown) {
    const weight = calculateWeight(node.weightBreakdown);
    const color = getColorForWeight(weight);
    
    return {
      ...node,
      weight,
      color,
    };
  }
  
  // 否则使用默认权重
  const defaultWeight = 50;
  return {
    ...node,
    weight: defaultWeight,
    color: getColorForWeight(defaultWeight),
  };
}

// ============================================
// 排序函数
// ============================================

/**
 * 按权重排序节点（降序）
 */
export function sortByWeight(nodes: FrameworkNode[]): FrameworkNode[] {
  return [...nodes].sort((a, b) => b.weight - a.weight);
}

/**
 * 按依赖关系和权重排序（拓扑排序 + 权重）
 */
export function sortByDependencyAndWeight(nodes: FrameworkNode[]): FrameworkNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set<string>();
  const sorted: FrameworkNode[] = [];
  
  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodeMap.get(nodeId);
    if (!node) return;
    
    // 先访问依赖
    node.dependencies.forEach(depId => visit(depId));
    
    sorted.push(node);
  }
  
  // 按权重排序后访问（确保高权重节点优先）
  const sortedByWeight = sortByWeight(nodes);
  sortedByWeight.forEach(node => visit(node.id));
  
  return sorted;
}

// ============================================
// 权重分布分析
// ============================================

export interface WeightDistribution {
  total: number;
  coreRequired: number;      // 90-100%
  importantRecommended: number;  // 70-89%
  optionalEnhancement: number;   // 50-69%
  lowPriority: number;       // <50%
}

/**
 * 分析权重分布
 */
export function analyzeWeightDistribution(nodes: FrameworkNode[]): WeightDistribution {
  const distribution: WeightDistribution = {
    total: nodes.length,
    coreRequired: 0,
    importantRecommended: 0,
    optionalEnhancement: 0,
    lowPriority: 0,
  };
  
  nodes.forEach(node => {
    if (node.weight >= 90) {
      distribution.coreRequired++;
    } else if (node.weight >= 70) {
      distribution.importantRecommended++;
    } else if (node.weight >= 50) {
      distribution.optionalEnhancement++;
    } else {
      distribution.lowPriority++;
    }
  });
  
  return distribution;
}

/**
 * 检查权重分布是否合理
 * 
 * 合理的分布：
 * - 核心必修不超过30%
 * - 重要推荐占40-60%
 * - 低优先级不超过20%
 */
export function validateWeightDistribution(distribution: WeightDistribution): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  const corePercentage = (distribution.coreRequired / distribution.total) * 100;
  const importantPercentage = (distribution.importantRecommended / distribution.total) * 100;
  const lowPercentage = (distribution.lowPriority / distribution.total) * 100;
  
  if (corePercentage > 40) {
    warnings.push(`核心必修项过多 (${corePercentage.toFixed(0)}%)，建议控制在30%以内`);
  }
  
  if (importantPercentage < 30) {
    warnings.push(`重要推荐项过少 (${importantPercentage.toFixed(0)}%)，建议在40-60%之间`);
  }
  
  if (lowPercentage > 25) {
    warnings.push(`低优先级项过多 (${lowPercentage.toFixed(0)}%)，建议控制在20%以内`);
  }
  
  if (distribution.coreRequired === 0) {
    warnings.push('缺少核心必修项，框架可能不完整');
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

// ============================================
// 调试工具
// ============================================

/**
 * 生成权重报告（用于调试）
 */
export function generateWeightReport(nodes: FrameworkNode[]): string {
  const distribution = analyzeWeightDistribution(nodes);
  const validation = validateWeightDistribution(distribution);
  const sorted = sortByWeight(nodes);
  
  let report = '=== 权重分布报告 ===\n\n';
  
  report += `总节点数: ${distribution.total}\n`;
  report += `核心必修 (90-100%): ${distribution.coreRequired} (${((distribution.coreRequired / distribution.total) * 100).toFixed(0)}%)\n`;
  report += `重要推荐 (70-89%): ${distribution.importantRecommended} (${((distribution.importantRecommended / distribution.total) * 100).toFixed(0)}%)\n`;
  report += `可选增强 (50-69%): ${distribution.optionalEnhancement} (${((distribution.optionalEnhancement / distribution.total) * 100).toFixed(0)}%)\n`;
  report += `低优先级 (<50%): ${distribution.lowPriority} (${((distribution.lowPriority / distribution.total) * 100).toFixed(0)}%)\n\n`;
  
  if (!validation.isValid) {
    report += '⚠️ 警告:\n';
    validation.warnings.forEach(w => {
      report += `  - ${w}\n`;
    });
    report += '\n';
  } else {
    report += '✓ 权重分布合理\n\n';
  }
  
  report += '=== 节点排序 ===\n\n';
  sorted.forEach((node, index) => {
    report += `${index + 1}. [${node.weight}%] ${node.title}\n`;
  });
  
  return report;
}

