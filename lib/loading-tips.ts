/**
 * Loading tips helper - provides stage-specific tips for LoadingOverlay
 * 
 * Note: This file provides UI-layer loading tips for the LoadingOverlay component.
 * For streaming API tips, see lib/streaming-wrapper.ts (different content and purpose).
 */

export interface LoadingTip {
  text: string;
  stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4';
}

const STAGE_TIPS: Record<string, LoadingTip[]> = {
  S0: [
    { text: "用 动词 + 对象 + 约束（时间/范围） 能显著提升质量", stage: 'S0' },
    { text: "若有已有基础或限制条件，请一并写出", stage: 'S0' },
    { text: "目标越具体，后续框架与计划越准确", stage: 'S0' },
    { text: "示例：在8周内完成XX基础并输出2个练习作品", stage: 'S0' },
  ],
  S1: [
    { text: "构建知识框架需要分析多个维度...", stage: 'S1' },
    { text: "AI 正在整理相关概念和理论基础", stage: 'S1' },
    { text: "结构化的知识框架是后续分析的基石", stage: 'S1' },
    { text: "正在建立概念间的逻辑关系", stage: 'S1' },
  ],
  S2: [
    { text: "系统动力学分析需要识别关键要素...", stage: 'S2' },
    { text: "AI 正在分析各要素间的相互影响", stage: 'S2' },
    { text: "动态系统的反馈环路正在构建中", stage: 'S2' },
    { text: "复杂系统需要多角度的深入分析", stage: 'S2' },
  ],
  S3: [
    { text: "个性化行动计划正在制定中...", stage: 'S3' },
    { text: "AI 正在结合您的具体情况优化策略", stage: 'S3' },
    { text: "可执行的行动步骤需要细致规划", stage: 'S3' },
    { text: "关键绩效指标有助于跟踪进展", stage: 'S3' },
  ],
  S4: [
    { text: "自主运营分析需要综合多维数据...", stage: 'S4' },
    { text: "AI 正在评估执行效果和改进空间", stage: 'S4' },
    { text: "持续优化是成功的关键", stage: 'S4' },
  ],
  default: [
    { text: "AI 正在处理您的请求..." },
    { text: "复杂分析需要一些时间，请耐心等待" },
    { text: "系统正在运用先进算法为您服务" },
  ]
};

/**
 * Get tips for a specific stage
 * Used by LoadingOverlay component for UI display
 */
export function getTipsForStage(stage?: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'): LoadingTip[] {
  if (!stage) return STAGE_TIPS.default;
  return STAGE_TIPS[stage] || STAGE_TIPS.default;
}

// Note: getRandomTip was removed as it was unused. 
// For random tip selection in streaming API, use lib/streaming-wrapper.ts
