/**
 * Output Validator - 输出质量验证器
 * 
 * 基于Anthropic最佳实践：
 * - 双层保障（prompt自检 + 代码验证）
 * - 标准化验证规则
 * - 自动重试机制
 * 
 * 与现有的prompt自检清单对应
 */

import type {
  PurposeDefinition,
  DynamicQuestion,
  PersonalizedPlan,
} from '@/lib/types-v2';
import { logger } from '@/lib/logger';

// ============================================
// 类型定义
// ============================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationCheck {
  name: string;
  check: () => boolean;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
}

export interface ValidationIssue {
  checkName: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

// ============================================
// 验证辅助函数
// ============================================

/**
 * 运行一组验证检查
 */
function runValidationChecks(checks: ValidationCheck[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  
  for (const check of checks) {
    try {
      const passed = check.check();
      if (!passed) {
        issues.push({
          checkName: check.name,
          severity: check.severity,
          message: check.message,
          suggestion: check.suggestion,
        });
      }
    } catch (error) {
      logger.error('[Validator] Check execution failed', {
        checkName: check.name,
        error,
      });
      issues.push({
        checkName: check.name,
        severity: 'error',
        message: `验证检查执行失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }
  
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  return {
    isValid: errorCount === 0,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    issues,
    errorCount,
    warningCount,
  };
}

/**
 * 检查字符串是否过于笼统（包含通用词汇）
 */
function isVagueText(text: string): boolean {
  const vaguePatterns = [
    /^学习/, /^了解/, /^掌握/,
    /东西/, /方面/, /内容/, /知识/,
    /一些/, /某些/, /这个/, /那个/,
  ];
  
  const lowerText = text.toLowerCase();
  return vaguePatterns.some(pattern => pattern.test(lowerText)) && text.length < 30;
}

/**
 * 检查是否包含具体的约束信息
 */
function hasConcreteConstraints(constraints: string[]): boolean {
  if (constraints.length === 0) return false;
  
  // 检查是否包含具体的时间、资源或数字
  const concretePatterns = [
    /\d+/, // 包含数字
    /周|月|年|天|小时/, // 时间单位
    /元|块|预算|成本/, // 资源
    /必须|不能|只能|仅/, // 强约束词
  ];
  
  return constraints.some(c => 
    concretePatterns.some(pattern => pattern.test(c))
  );
}

/**
 * 检查问题域是否过于笼统
 */
function isGenericDomain(domain: string): boolean {
  const genericDomains = [
    '学习', '工作', '生活', '技能',
    '知识', '能力', '提升', '改善',
  ];
  
  return genericDomains.some(g => domain === g || domain.startsWith(g));
}

// ============================================
// Stage 0 验证器
// ============================================

/**
 * 验证 Stage 0 的输出
 * 对应 stage0-prompts.ts 中的决策checklist
 */
export function validateStage0Output(definition: PurposeDefinition): ValidationResult {
  const checks: ValidationCheck[] = [
    // 必需信息检查
    {
      name: 'purpose_clarity',
      check: () => {
        if (!definition.clarifiedPurpose) return false;
        if (definition.clarifiedPurpose.length < 20) return false;
        return !isVagueText(definition.clarifiedPurpose);
      },
      severity: 'error',
      message: '目的描述过短、缺失或过于笼统',
      suggestion: '目的应该具体说明"为什么"和"达成后的状态"，至少20字符',
    },
    
    {
      name: 'domain_specificity',
      check: () => {
        if (!definition.problemDomain) return false;
        if (definition.problemDomain.length < 5) return false;
        return !isGenericDomain(definition.problemDomain);
      },
      severity: 'warning',
      message: '问题域过于笼统或缺失',
      suggestion: '问题域应该明确具体领域，避免"学习"、"工作"等过于宽泛的描述',
    },
    
    {
      name: 'boundary_definition',
      check: () => {
        if (!definition.domainBoundary) return false;
        return definition.domainBoundary.length >= 10;
      },
      severity: 'warning',
      message: '问题域边界描述缺失或过短',
      suggestion: '边界应该明确"包括什么"和"不包括什么"',
    },
    
    {
      name: 'constraints_presence',
      check: () => {
        return definition.keyConstraints && definition.keyConstraints.length >= 2;
      },
      severity: 'warning',
      message: '关键约束少于2个',
      suggestion: '应该至少识别2-3个约束（时间、资源、背景等）',
    },
    
    {
      name: 'constraints_quality',
      check: () => {
        if (!definition.keyConstraints || definition.keyConstraints.length === 0) return false;
        return hasConcreteConstraints(definition.keyConstraints);
      },
      severity: 'info',
      message: '约束条件缺少具体细节',
      suggestion: '约束最好包含具体的数字、时间或明确的限制',
    },
    
    {
      name: 'confidence_threshold',
      check: () => {
        return definition.confidence >= 0.7;
      },
      severity: 'error',
      message: `置信度不足 (${definition.confidence.toFixed(2)} < 0.7)`,
      suggestion: '需要继续澄清对话，直到置信度达到0.7以上',
    },
    
    {
      name: 'conversation_history',
      check: () => {
        return definition.conversationHistory && definition.conversationHistory.length >= 2;
      },
      severity: 'warning',
      message: '对话轮次过少',
      suggestion: '通常需要2-5轮对话才能充分澄清目的',
    },
  ];
  
  const result = runValidationChecks(checks);
  
  if (result.hasErrors || result.hasWarnings) {
    logger.info('[Stage0Validator] Validation completed', {
      isValid: result.isValid,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      issues: result.issues.map(i => i.checkName),
    });
  }
  
  return result;
}

/**
 * 验证 Stage 0 是否可以进入下一阶段
 */
export function canProceedToStage1(definition: PurposeDefinition): {
  canProceed: boolean;
  reason?: string;
  blockingIssues: ValidationIssue[];
} {
  const result = validateStage0Output(definition);
  
  if (!result.isValid) {
    const blockingIssues = result.issues.filter(i => i.severity === 'error');
    return {
      canProceed: false,
      reason: `有${blockingIssues.length}个阻塞性问题需要解决`,
      blockingIssues,
    };
  }
  
  return {
    canProceed: true,
    blockingIssues: [],
  };
}

// ============================================
// Stage 2 验证器 - 问题质量
// ============================================

/**
 * 验证 Stage 2 生成的问题质量
 * 对应 stage2-prompts.ts 中的自检清单
 */
export function validateStage2Questions(questions: DynamicQuestion[]): ValidationResult {
  const checks: ValidationCheck[] = [
    {
      name: 'question_count',
      check: () => questions.length >= 3 && questions.length <= 6,
      severity: 'error',
      message: `问题数量不合理 (${questions.length}个)`,
      suggestion: '应该生成3-6个高质量问题',
    },
    
    {
      name: 'impact_clarity',
      check: () => {
        return questions.every(q => 
          q.whyMatters && q.whyMatters.length > 10
        );
      },
      severity: 'error',
      message: '某些问题缺少或未说明对框架的影响',
      suggestion: '每个问题都必须明确说明"回答后如何影响框架调整"',
    },
    
    {
      name: 'affects_specified',
      check: () => {
        return questions.every(q => q.affects && q.affects.length > 0);
      },
      severity: 'warning',
      message: '某些问题未指定影响的框架节点',
      suggestion: '最好明确每个问题影响哪些框架节点',
    },
    
    {
      name: 'impact_level_distribution',
      check: () => {
        const highImpact = questions.filter(q => q.impactLevel >= 4);
        return highImpact.length >= 1 && highImpact.length <= 3;
      },
      severity: 'warning',
      message: '高影响力问题数量不合理',
      suggestion: '应该有1-3个高影响力问题（impactLevel >= 4）',
    },
    
    {
      name: 'question_specificity',
      check: () => {
        return questions.every(q => q.question.length >= 20);
      },
      severity: 'warning',
      message: '某些问题过于简短',
      suggestion: '问题应该具体明确，通常需要20字以上',
    },
    
    {
      name: 'avoid_redundancy',
      check: () => {
        // 检查问题之间是否过于相似
        for (let i = 0; i < questions.length; i++) {
          for (let j = i + 1; j < questions.length; j++) {
            const similarity = calculateTextSimilarity(
              questions[i].question,
              questions[j].question
            );
            if (similarity > 0.7) return false;
          }
        }
        return true;
      },
      severity: 'warning',
      message: '检测到重复或过于相似的问题',
      suggestion: '确保每个问题关注不同的方面',
    },
  ];
  
  const result = runValidationChecks(checks);
  
  if (result.hasErrors || result.hasWarnings) {
    logger.info('[Stage2QuestionValidator] Validation completed', {
      isValid: result.isValid,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      questionCount: questions.length,
    });
  }
  
  return result;
}

/**
 * 验证 Stage 2 的个性化方案
 */
export function validateStage2Plan(plan: PersonalizedPlan): ValidationResult {
  const checks: ValidationCheck[] = [
    {
      name: 'adjusted_framework_present',
      check: () => {
        return plan.adjustedFramework && plan.adjustedFramework.nodes && plan.adjustedFramework.nodes.length > 0;
      },
      severity: 'error',
      message: '缺少调整后的框架',
      suggestion: '个性化方案必须包含调整后的框架',
    },
    
    {
      name: 'adjustment_rationale',
      check: () => {
        return Boolean(plan.adjustmentRationale && plan.adjustmentRationale.length >= 30);
      },
      severity: 'warning',
      message: '调整理由缺失或过于简短',
      suggestion: '应该明确说明为什么这样调整（基于用户回答）',
    },
    
    {
      name: 'personalized_tips',
      check: () => {
        return Boolean(plan.personalizedTips && plan.personalizedTips.length >= 2);
      },
      severity: 'warning',
      message: '个性化建议过少',
      suggestion: '应该提供2-5个具体的个性化建议',
    },
    
    {
      name: 'action_steps_present',
      check: () => {
        return plan.actionSteps && plan.actionSteps.length > 0;
      },
      severity: 'warning',
      message: '缺少具体的行动步骤',
      suggestion: '应该提供具体可执行的行动步骤',
    },
    
    {
      name: 'milestones_present',
      check: () => {
        return plan.milestones && plan.milestones.length > 0;
      },
      severity: 'warning',
      message: '缺少里程碑',
      suggestion: '应该设置明确的里程碑以跟踪进度',
    },
  ];
  
  const result = runValidationChecks(checks);
  
  if (result.hasErrors || result.hasWarnings) {
    logger.info('[Stage2PlanValidator] Validation completed', {
      isValid: result.isValid,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
    });
  }
  
  return result;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 简单的文本相似度计算（Jaccard相似度）
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * 格式化验证结果为可读字符串
 */
export function formatValidationResult(result: ValidationResult): string {
  if (result.isValid && !result.hasWarnings) {
    return '✅ 验证通过';
  }
  
  const lines: string[] = [];
  
  if (result.hasErrors) {
    lines.push(`❌ 发现 ${result.errorCount} 个错误:`);
    result.issues
      .filter(i => i.severity === 'error')
      .forEach(issue => {
        lines.push(`  - ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`    建议: ${issue.suggestion}`);
        }
      });
  }
  
  if (result.hasWarnings) {
    lines.push(`⚠️  发现 ${result.warningCount} 个警告:`);
    result.issues
      .filter(i => i.severity === 'warning')
      .forEach(issue => {
        lines.push(`  - ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`    建议: ${issue.suggestion}`);
        }
      });
  }
  
  return lines.join('\n');
}

// ============================================
// 导出便捷函数
// ============================================

/**
 * 验证并自动决定是否需要重试
 */
export function validateWithRetryDecision(
  result: ValidationResult
): {
  shouldRetry: boolean;
  reason?: string;
} {
  // 如果有error级别的问题，建议重试
  if (result.hasErrors) {
    const criticalErrors = result.issues.filter(i => 
      i.severity === 'error' && 
      !i.checkName.includes('confidence') // 置信度问题不应该重试
    );
    
    if (criticalErrors.length > 0) {
      return {
        shouldRetry: true,
        reason: `发现${criticalErrors.length}个关键错误，建议重新生成`,
      };
    }
  }
  
  return {
    shouldRetry: false,
  };
}

