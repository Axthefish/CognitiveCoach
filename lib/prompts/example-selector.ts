/**
 * Example Selector - 智能选择相关示例
 * 
 * 基于domain、任务类型等特征，动态选择最相关的few-shot示例
 */

import {
  STAGE0_EXAMPLES,
  Stage0Example,
  formatStage0Example,
  findRelevantStage0Examples
} from './examples/stage0-examples';

import {
  STAGE1_EXAMPLES,
  Stage1Example,
  formatStage1Example,
  findRelevantStage1Examples
} from './examples/stage1-examples';

import {
  STAGE2_QUESTION_EXAMPLES,
  Stage2QuestionExample,
  formatStage2QuestionExamples,
  findRelevantStage2Examples
} from './examples/stage2-examples';

import { logger } from '@/lib/logger';

// ============================================
// 示例选择器配置
// ============================================

export interface ExampleSelectorConfig {
  maxExamples?: number;        // 最多返回N个示例
  fallbackToGeneric?: boolean; // 如果没有匹配，是否返回通用示例
  includeReasoning?: boolean;  // 是否包含reasoning说明
}

// ============================================
// Stage 0 示例选择
// ============================================

export interface Stage0ExampleSelection {
  examples: Stage0Example[];
  formatted: string;
  matchQuality: 'exact' | 'partial' | 'generic';
}

/**
 * 为Stage 0选择相关示例
 */
export function selectStage0Examples(
  userInput: string,
  config: ExampleSelectorConfig = {}
): Stage0ExampleSelection {
  const {
    maxExamples = 2,
    fallbackToGeneric = true
  } = config;
  
  logger.debug('[ExampleSelector] Selecting Stage 0 examples', {
    userInput,
    maxExamples
  });
  
  // 如果maxExamples为0，直接返回空结果
  if (maxExamples === 0) {
    return {
      examples: [],
      formatted: '<examples>\n无示例\n</examples>',
      matchQuality: 'generic'
    };
  }
  
  // 使用内置的查找函数
  let examples = findRelevantStage0Examples(userInput, maxExamples);
  let matchQuality: 'exact' | 'partial' | 'generic' = 'partial';
  
  // 如果没有找到相关示例
  if (examples.length === 0) {
    if (fallbackToGeneric) {
      examples = [STAGE0_EXAMPLES[0]];  // 返回第一个作为通用示例
      matchQuality = 'generic';
    }
  } else if (examples.length === maxExamples) {
    matchQuality = 'exact';
  }
  
  // 格式化示例
  const formatted = examples
    .map(example => formatStage0Example(example))
    .join('\n\n---\n\n');
  
  const wrappedFormatted = `
<examples>
以下是${matchQuality === 'exact' ? '相关领域' : matchQuality === 'partial' ? '类似' : '参考'}的对话示例，展示如何有效澄清用户目的：

${formatted}
</examples>
`;
  
  return {
    examples,
    formatted: wrappedFormatted,
    matchQuality
  };
}

// ============================================
// Stage 1 示例选择
// ============================================

export interface Stage1ExampleSelection {
  examples: Stage1Example[];
  formatted: string;
  matchQuality: 'exact' | 'partial' | 'generic';
}

/**
 * 为Stage 1选择相关示例
 */
export function selectStage1Examples(
  domain: string,
  purpose: string,
  config: ExampleSelectorConfig = {}
): Stage1ExampleSelection {
  const {
    maxExamples = 2,
    fallbackToGeneric = true
  } = config;
  
  logger.debug('[ExampleSelector] Selecting Stage 1 examples', {
    domain,
    maxExamples
  });
  
  // 如果maxExamples为0，直接返回空结果
  if (maxExamples === 0) {
    return {
      examples: [],
      formatted: '# 参考示例\n\n无示例\n',
      matchQuality: 'generic'
    };
  }
  
  // 优先使用domain匹配
  let examples = findRelevantStage1Examples(domain, maxExamples);
  let matchQuality: 'exact' | 'partial' | 'generic';
  
  if (examples.length === 0) {
    if (fallbackToGeneric) {
      examples = [STAGE1_EXAMPLES[0]];
      matchQuality = 'generic';
    } else {
      matchQuality = 'generic';
    }
  } else if (examples.length === maxExamples) {
    matchQuality = 'exact';
  } else {
    matchQuality = 'partial';
  }
  
  // 格式化示例
  const formatted = examples
    .map(example => formatStage1Example(example))
    .join('\n');
  
  const wrappedFormatted = `
# 参考示例

以下示例展示如何基于用户的具体目的计算节点权重：

${formatted}

**关键原则**：
- 权重必须基于用户的**具体目的**，不是通用标准
- 每个维度的评分都要有清晰的reasoning
- 相同的技能在不同目的下，权重完全不同

---

现在，基于用户的目的，生成你的框架：
`;
  
  return {
    examples,
    formatted: wrappedFormatted,
    matchQuality
  };
}

// ============================================
// Stage 2 示例选择
// ============================================

export interface Stage2ExampleSelection {
  examples: Stage2QuestionExample[];
  formatted: string;
  matchQuality: 'exact' | 'partial' | 'generic';
}

/**
 * 为Stage 2选择相关示例
 */
export function selectStage2Examples(
  domain: string,
  config: ExampleSelectorConfig = {}
): Stage2ExampleSelection {
  const {
    maxExamples = 1,
    fallbackToGeneric = true
  } = config;
  
  logger.debug('[ExampleSelector] Selecting Stage 2 examples', {
    domain,
    maxExamples
  });
  
  let examples = findRelevantStage2Examples(domain, maxExamples);
  let matchQuality: 'exact' | 'partial' | 'generic' = 'partial';
  
  if (examples.length === 0 && fallbackToGeneric) {
    examples = [STAGE2_QUESTION_EXAMPLES[0]];
    matchQuality = 'generic';
  } else if (examples.length > 0) {
    matchQuality = 'exact';
  }
  
  // 使用内置的格式化函数
  const formatted = formatStage2QuestionExamples(examples.length);
  
  const wrappedFormatted = `
# 高质量问题设计示例

${formatted}

**设计原则总结**：
✓ 问题能直接影响2个以上节点的权重调整
✓ 回答后能产生可执行的调整决策
✓ 开放式但有明确的决策空间
✗ 避免纯信息收集式的问题
✗ 避免Stage 0已经确认过的信息

---
`;
  
  return {
    examples,
    formatted: wrappedFormatted,
    matchQuality
  };
}

// ============================================
// 批量预加载（可选优化）
// ============================================

/**
 * 预加载所有示例到内存（如果需要优化性能）
 */
export function preloadAllExamples(): {
  stage0Count: number;
  stage1Count: number;
  stage2Count: number;
} {
  return {
    stage0Count: STAGE0_EXAMPLES.length,
    stage1Count: STAGE1_EXAMPLES.length,
    stage2Count: STAGE2_QUESTION_EXAMPLES.length
  };
}

// ============================================
// 示例统计（用于监控）
// ============================================

export interface ExampleStats {
  totalExamples: number;
  byStage: {
    stage0: number;
    stage1: number;
    stage2: number;
  };
  byDomain: Record<string, number>;
}

/**
 * 获取示例库统计信息
 */
export function getExampleStats(): ExampleStats {
  const allDomains = [
    ...STAGE0_EXAMPLES.map(e => e.domain),
    ...STAGE1_EXAMPLES.map(e => e.domain),
    ...STAGE2_QUESTION_EXAMPLES.map(e => e.domain)
  ];
  
  const domainCounts: Record<string, number> = {};
  allDomains.forEach(domain => {
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  });
  
  return {
    totalExamples: STAGE0_EXAMPLES.length + STAGE1_EXAMPLES.length + STAGE2_QUESTION_EXAMPLES.length,
    byStage: {
      stage0: STAGE0_EXAMPLES.length,
      stage1: STAGE1_EXAMPLES.length,
      stage2: STAGE2_QUESTION_EXAMPLES.length
    },
    byDomain: domainCounts
  };
}

// ============================================
// 导出便捷函数
// ============================================

export const exampleSelector = {
  stage0: selectStage0Examples,
  stage1: selectStage1Examples,
  stage2: selectStage2Examples,
  stats: getExampleStats,
  preload: preloadAllExamples
};

