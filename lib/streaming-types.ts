/**
 * Streaming 思考过程类型定义
 */

export type ThinkingStep = 
  | 'analyzing_domain'      // 分析问题域
  | 'designing_structure'   // 设计框架结构
  | 'calculating_weights'   // 计算权重
  | 'building_dependencies' // 构建依赖关系
  | 'optimizing_path'       // 优化主路径
  | 'generating_json'       // 生成JSON输出
  | 'validating_output';    // 验证输出

export interface ThinkingProgress {
  step: ThinkingStep;
  message: string;
  progress: number; // 0-100
  timestamp: number;
}

export const THINKING_STEPS: Record<ThinkingStep, { message: string; progress: number }> = {
  analyzing_domain: {
    message: '🔍 正在分析问题域和边界...',
    progress: 10,
  },
  designing_structure: {
    message: '📐 正在设计框架结构...',
    progress: 25,
  },
  calculating_weights: {
    message: '⚖️ 正在评估各模块的重要性权重...',
    progress: 45,
  },
  building_dependencies: {
    message: '🔗 正在构建模块间的依赖关系...',
    progress: 65,
  },
  optimizing_path: {
    message: '🎯 正在优化核心学习路径...',
    progress: 80,
  },
  generating_json: {
    message: '📝 正在生成完整框架数据...',
    progress: 90,
  },
  validating_output: {
    message: '✅ 正在验证框架质量...',
    progress: 95,
  },
};

export interface StreamEvent {
  type: 'thinking' | 'data' | 'error' | 'done';
  data?: unknown;
  thinking?: ThinkingProgress;
  error?: string;
}

