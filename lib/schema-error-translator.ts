// Schema 错误翻译器
// 将 Zod 验证错误转换为用户友好的中文消息

import { ZodError, ZodIssue } from 'zod';

/**
 * 错误翻译结果
 */
export interface ErrorTranslation {
  userMessage: string;
  technicalDetails: string;
  suggestions: string[];
}

/**
 * 阶段类型
 */
type Stage = 's0' | 's1' | 's2' | 's3' | 's4';

/**
 * 常见字段的中文翻译
 */
const fieldTranslations: Record<string, string> = {
  id: 'ID标识符',
  title: '标题',
  summary: '摘要',
  children: '子项',
  userGoal: '学习目标',
  framework: '知识框架',
  mermaidChart: 'Mermaid图表',
  metaphor: '比喻',
  nodes: '节点列表',
  actionPlan: '行动计划',
  kpis: '关键绩效指标',
  text: '文本内容',
  isCompleted: '完成状态',
  strategySpec: '策略规格',
  mainPath: '主路径',
  loops: '循环回路',
  nodeAnalogies: '节点类比',
};

/**
 * 阶段特定的错误消息
 */
const stageMessages: Record<Stage, string> = {
  s0: '目标精炼阶段',
  s1: '知识框架生成阶段',
  s2: '系统动力学生成阶段',
  s3: '行动计划生成阶段',
  s4: '进度分析阶段',
};

/**
 * 翻译字段路径为中文
 */
function translateFieldPath(path: (string | number)[]): string {
  if (path.length === 0) return '根对象';
  
  return path
    .map((segment) => {
      if (typeof segment === 'number') {
        return `第${segment + 1}项`;
      }
      if (typeof segment === 'string') {
        return fieldTranslations[segment] || segment;
      }
      return String(segment);
    })
    .join(' > ');
}

/**
 * 翻译单个验证问题
 */
function translateIssue(issue: ZodIssue): string {
  const fieldPath = translateFieldPath(issue.path as (string | number)[]);
  
  switch (issue.code) {
    case 'invalid_type':
      const expected = issue.expected === 'string' ? '文本' :
                      issue.expected === 'number' ? '数字' :
                      issue.expected === 'array' ? '数组' :
                      issue.expected === 'object' ? '对象' : issue.expected;
      return `${fieldPath}: 应该是${expected}类型`;
    
    case 'too_small':
      // 使用类型断言和可选链来安全访问属性
      return `${fieldPath}: 值太小（最小值：${(issue as { minimum?: number | string }).minimum ?? '未知'}）`;
    
    case 'too_big':
      // 使用类型断言和可选链来安全访问属性
      return `${fieldPath}: 值太大（最大值：${(issue as { maximum?: number | string }).maximum ?? '未知'}）`;
    
    case 'unrecognized_keys':
      return `${fieldPath}: 包含未识别的字段`;
    
    default:
      return `${fieldPath}: ${issue.message}`;
  }
}

/**
 * 翻译 Zod 错误为用户友好的消息
 */
export function translateSchemaError(
  error: ZodError,
  stage: Stage
): ErrorTranslation {
  const issues = error.issues;
  const stageMessage = stageMessages[stage];
  
  // 生成用户友好的消息
  const translatedIssues = issues.slice(0, 3).map(translateIssue);
  const userMessage = `${stageMessage}数据验证失败：\n${translatedIssues.join('\n')}`;
  
  // 生成技术详情
  const technicalDetails = issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  
  // 生成修复建议
  const suggestions = generateSuggestions(issues, stage);
  
  return {
    userMessage,
    technicalDetails,
    suggestions,
  };
}

/**
 * 生成修复建议
 */
function generateSuggestions(issues: ZodIssue[], stage: Stage): string[] {
  const suggestions: string[] = [];
  
  // 基于错误类型生成建议
  const hasTypeError = issues.some((i) => i.code === 'invalid_type');
  const hasSizeError = issues.some((i) => i.code === 'too_small' || i.code === 'too_big');
  const hasRequiredError = issues.some((i) => 
    i.code === 'invalid_type' && i.message.includes('Required')
  );
  
  if (hasRequiredError) {
    suggestions.push('确保所有必填字段都已提供');
  }
  
  if (hasTypeError) {
    suggestions.push('检查字段的数据类型是否正确');
  }
  
  if (hasSizeError) {
    suggestions.push('检查文本长度或数组大小是否符合要求');
  }
  
  // 阶段特定建议
  switch (stage) {
    case 's1':
      suggestions.push('确保知识框架包含至少2个主要类别');
      suggestions.push('每个节点应包含id、title和summary');
      break;
    case 's2':
      suggestions.push('确保Mermaid图表以"graph TD"开头');
      suggestions.push('检查nodes数组是否完整');
      break;
    case 's3':
      suggestions.push('确保行动计划至少包含3个步骤');
      suggestions.push('KPIs应该是字符串数组');
      break;
    case 's4':
      suggestions.push('检查进度数据是否完整');
      suggestions.push('确保提供了必要的用户上下文');
      break;
  }
  
  // 通用建议
  if (suggestions.length === 0) {
    suggestions.push('请参考API文档了解正确的数据格式');
    suggestions.push('如问题持续，请联系技术支持');
  }
  
  return suggestions.slice(0, 4); // 最多返回4条建议
}

/**
 * 格式化错误用于日志记录
 */
export function formatErrorForLogging(error: ZodError, stage: Stage): Record<string, unknown> {
  return {
    stage,
    issueCount: error.issues.length,
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    })),
    firstIssue: error.issues[0] ? {
      path: error.issues[0].path.join('.'),
      message: error.issues[0].message,
    } : null,
  };
}

/**
 * 检查是否为关键错误（需要立即处理）
 */
export function isCriticalError(error: ZodError): boolean {
  return error.issues.some((issue) => {
    // 根对象缺失或类型错误
    if (issue.path.length === 0 && issue.code === 'invalid_type') {
      return true;
    }
    // 必填字段缺失
    if (issue.code === 'invalid_type' && issue.message.includes('Required')) {
      return true;
    }
    return false;
  });
}

