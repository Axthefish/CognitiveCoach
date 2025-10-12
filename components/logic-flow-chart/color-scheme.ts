/**
 * 颜色编码系统
 * 
 * 基于权重的颜色映射，用于直观展示节点的优先级
 */

import type { NodeColor } from '@/lib/types-v2';

// ============================================
// 颜色定义
// ============================================

export const COLOR_SCHEME = {
  // 深蓝色 (90-100%): 核心必修
  DEEP_BLUE: {
    primary: '#1e40af',
    light: '#3b82f6',
    background: '#dbeafe',
    text: '#ffffff',
  },
  
  // 蓝色 (70-89%): 重要推荐
  BLUE: {
    primary: '#3b82f6',
    light: '#60a5fa',
    background: '#eff6ff',
    text: '#ffffff',
  },
  
  // 浅蓝色 (50-69%): 可选增强
  LIGHT_BLUE: {
    primary: '#93c5fd',
    light: '#bfdbfe',
    background: '#f0f9ff',
    text: '#1e40af',
  },
  
  // 灰色 (<50%): 低优先级
  GRAY: {
    primary: '#9ca3af',
    light: '#d1d5db',
    background: '#f9fafb',
    text: '#4b5563',
  },
} as const;

// ============================================
// 边的颜色
// ============================================

export const EDGE_COLOR_SCHEME = {
  required: '#1e40af',      // 深蓝色 - 必需依赖
  recommended: '#3b82f6',   // 蓝色 - 推荐路径
  optional: '#9ca3af',      // 灰色 - 可选路径
} as const;

// ============================================
// 权重到颜色的映射函数
// ============================================

export function getColorForWeight(weight: number): NodeColor {
  if (weight >= 90) return 'DEEP_BLUE';
  if (weight >= 70) return 'BLUE';
  if (weight >= 50) return 'LIGHT_BLUE';
  return 'GRAY';
}

export function getColorScheme(colorType: NodeColor) {
  return COLOR_SCHEME[colorType];
}

export function getColorHex(colorType: NodeColor, variant: 'primary' | 'light' | 'background' = 'primary'): string {
  return COLOR_SCHEME[colorType][variant];
}

// ============================================
// 权重标签
// ============================================

export function getWeightLabel(weight: number): string {
  if (weight >= 90) return '核心必修';
  if (weight >= 70) return '重要推荐';
  if (weight >= 50) return '可选增强';
  return '低优先级';
}

// ============================================
// 权重图标
// ============================================

export function getWeightIcon(weight: number): string {
  if (weight >= 90) return '⭐⭐⭐';
  if (weight >= 70) return '⭐⭐';
  if (weight >= 50) return '⭐';
  return '○';
}

// ============================================
// ECharts 使用的颜色对象
// ============================================

export function getEChartsNodeStyle(colorType: NodeColor) {
  const scheme = COLOR_SCHEME[colorType];
  
  return {
    color: scheme.primary,
    borderColor: scheme.light,
    borderWidth: 2,
  };
}

export function getEChartsEdgeStyle(type: 'required' | 'recommended' | 'optional') {
  return {
    color: EDGE_COLOR_SCHEME[type],
    width: type === 'required' ? 3 : type === 'recommended' ? 2 : 1,
    curveness: 0.2,
  };
}

