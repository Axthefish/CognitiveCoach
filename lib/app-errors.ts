// 标准化错误处理系统

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';

// 错误代码枚举
export const ErrorCodes = {
  // AI 相关错误
  AI_PARSE_ERROR: 'AI_PARSE_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_EMPTY_RESPONSE: 'AI_EMPTY_RESPONSE',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  
  // 验证错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SCHEMA_VALIDATION_ERROR: 'SCHEMA_VALIDATION_ERROR',
  
  // 业务逻辑错误
  GOAL_REFINEMENT_FAILED: 'GOAL_REFINEMENT_FAILED',
  FRAMEWORK_GENERATION_FAILED: 'FRAMEWORK_GENERATION_FAILED',
  SYSTEM_DYNAMICS_FAILED: 'SYSTEM_DYNAMICS_FAILED',
  ACTION_PLAN_FAILED: 'ACTION_PLAN_FAILED',
  PROGRESS_ANALYSIS_FAILED: 'PROGRESS_ANALYSIS_FAILED',
  
  // 系统错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  
  // 质量控制错误
  QA_VALIDATION_FAILED: 'QA_VALIDATION_FAILED',
  CONSISTENCY_CHECK_FAILED: 'CONSISTENCY_CHECK_FAILED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// 应用错误类
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly userMessage: string;
  public readonly fixHints?: string[];
  public readonly stage?: string;
  
  constructor(options: {
    code: ErrorCode;
    message: string;
    statusCode?: number;
    details?: unknown;
    userMessage?: string;
    fixHints?: string[];
    stage?: string;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode || 500;
    this.details = options.details;
    this.userMessage = options.userMessage || this.getDefaultUserMessage(options.code);
    this.fixHints = options.fixHints;
    this.stage = options.stage;
    
    // 保持原型链
    Object.setPrototypeOf(this, AppError.prototype);
  }
  
  private getDefaultUserMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCodes.AI_PARSE_ERROR]: 'AI 响应格式有误，请重新尝试',
      [ErrorCodes.AI_TIMEOUT]: 'AI 响应超时，请稍后重试',
      [ErrorCodes.AI_EMPTY_RESPONSE]: 'AI 未能生成有效响应，请重新描述您的需求',
      [ErrorCodes.AI_RATE_LIMIT]: 'AI 服务繁忙，请稍后再试',
      [ErrorCodes.VALIDATION_ERROR]: '输入数据验证失败，请检查您的输入',
      [ErrorCodes.SCHEMA_VALIDATION_ERROR]: '数据格式不正确，请重试',
      [ErrorCodes.GOAL_REFINEMENT_FAILED]: '目标精炼过程遇到问题，请尝试用其他方式描述',
      [ErrorCodes.FRAMEWORK_GENERATION_FAILED]: '知识框架生成失败，请重试',
      [ErrorCodes.SYSTEM_DYNAMICS_FAILED]: '系统动力学图生成失败，请重试',
      [ErrorCodes.ACTION_PLAN_FAILED]: '行动计划生成失败，请重试',
      [ErrorCodes.PROGRESS_ANALYSIS_FAILED]: '进度分析失败，请检查输入数据',
      [ErrorCodes.INTERNAL_ERROR]: '系统内部错误，请联系技术支持',
      [ErrorCodes.RATE_LIMIT_EXCEEDED]: '请求过于频繁，请稍后再试',
      [ErrorCodes.UNAUTHORIZED]: '未授权的访问',
      [ErrorCodes.NOT_FOUND]: '请求的资源不存在',
      [ErrorCodes.QA_VALIDATION_FAILED]: '质量检查未通过，请调整内容后重试',
      [ErrorCodes.CONSISTENCY_CHECK_FAILED]: '数据一致性检查失败',
    };
    
    return messages[code] || '操作失败，请重试';
  }
  
  toJSON() {
    return {
      code: this.code,
      message: this.userMessage,
      details: process.env.NODE_ENV !== 'production' ? this.details : undefined,
      fixHints: this.fixHints,
      stage: this.stage,
    };
  }
}

// 错误响应接口
export interface ErrorResponse {
  status: 'error';
  code: ErrorCode;
  message: string;
  details?: unknown;
  fixHints?: string[];
  stage?: string;
  timestamp: string;
}

// 统一的错误处理器
export function handleError(error: unknown, stage?: string): NextResponse<ErrorResponse> {
  const timestamp = new Date().toISOString();
  
  // 记录错误日志
  logger.error(`Error in ${stage || 'unknown stage'}:`, error);
  
  // 处理 AppError
  if (error instanceof AppError) {
    return NextResponse.json<ErrorResponse>(
      {
        status: 'error',
        code: error.code,
        message: error.userMessage,
        details: process.env.NODE_ENV !== 'production' ? error.details : undefined,
        fixHints: error.fixHints,
        stage: error.stage || stage,
        timestamp,
      },
      { status: error.statusCode }
    );
  }
  
  // 处理 ZodError
  if (error instanceof ZodError) {
    const issues = error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    
    return NextResponse.json<ErrorResponse>(
      {
        status: 'error',
        code: ErrorCodes.SCHEMA_VALIDATION_ERROR,
        message: '输入数据格式不正确',
        details: process.env.NODE_ENV !== 'production' ? issues : undefined,
        fixHints: ['请检查输入数据格式', '确保所有必填字段都已提供'],
        stage,
        timestamp,
      },
      { status: 400 }
    );
  }
  
  // 处理普通 Error
  if (error instanceof Error) {
    // 尝试从错误消息中识别错误类型
    let code: ErrorCode = ErrorCodes.INTERNAL_ERROR;
    let statusCode = 500;
    
    if (error.message.includes('rate limit')) {
      code = ErrorCodes.RATE_LIMIT_EXCEEDED;
      statusCode = 429;
    } else if (error.message.includes('timeout')) {
      code = ErrorCodes.AI_TIMEOUT;
      statusCode = 504;
    } else if (error.message.includes('parse') || error.message.includes('JSON')) {
      code = ErrorCodes.AI_PARSE_ERROR;
      statusCode = 400;
    }
    
    return NextResponse.json<ErrorResponse>(
      {
        status: 'error',
        code,
        message: getErrorMessage(code),
        details: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        stage,
        timestamp,
      },
      { status: statusCode }
    );
  }
  
  // 处理未知错误
  return NextResponse.json<ErrorResponse>(
    {
      status: 'error',
      code: ErrorCodes.INTERNAL_ERROR,
      message: '发生未知错误，请联系技术支持',
      stage,
      timestamp,
    },
    { status: 500 }
  );
}

// 辅助函数：获取用户友好的错误消息
function getErrorMessage(code: ErrorCode): string {
  const error = new AppError({ code, message: '' });
  return error.userMessage;
}

// 错误恢复建议生成器
export function generateRecoveryHints(code: ErrorCode, context?: Record<string, unknown>): string[] {
  const hints: Record<ErrorCode, (ctx?: Record<string, unknown>) => string[]> = {
    [ErrorCodes.AI_PARSE_ERROR]: () => [
      '尝试简化您的输入',
      '避免使用特殊字符',
      '用更清晰的语言描述您的需求'
    ],
    
    [ErrorCodes.GOAL_REFINEMENT_FAILED]: (ctx) => {
      const attempts = ctx?.attempts as number || 0;
      if (attempts > 2) {
        return [
          '尝试从我们的推荐列表中选择一个方向',
          '参考示例目标：学习 React 开发现代 Web 应用',
          '或者稍后再试'
        ];
      }
      return ['请用不同的方式描述您的学习目标', '尽量具体说明您想达到的成果'];
    },
    
    [ErrorCodes.QA_VALIDATION_FAILED]: (ctx) => {
      const issues = ctx?.issues as Array<{ hint: string }> || [];
      return issues.map(i => i.hint).slice(0, 3);
    },
    
    // 默认恢复提示
    [ErrorCodes.INTERNAL_ERROR]: () => ['请刷新页面重试', '如果问题持续，请联系技术支持'],
  };
  
  const generator = hints[code] || (() => ['请稍后重试']);
  return generator(context);
}

// 错误边界组件的错误处理
export function handleComponentError(error: Error, errorInfo: { componentStack: string }): void {
  logger.error('React component error:', {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
  });
  
  // 可以在这里发送错误到监控服务
  if (process.env.NODE_ENV === 'production') {
    // sendToMonitoring({ error, errorInfo });
  }
}

// 创建特定阶段的错误
export const createStageError = {
  s0: (message: string, details?: unknown) => new AppError({
    code: ErrorCodes.GOAL_REFINEMENT_FAILED,
    message,
    statusCode: 400,
    details,
    stage: 'S0',
    fixHints: generateRecoveryHints(ErrorCodes.GOAL_REFINEMENT_FAILED, { details })
  }),
  
  s1: (message: string, details?: unknown) => new AppError({
    code: ErrorCodes.FRAMEWORK_GENERATION_FAILED,
    message,
    statusCode: 400,
    details,
    stage: 'S1',
    fixHints: ['确保学习目标明确', '尝试简化目标描述']
  }),
  
  s2: (message: string, details?: unknown) => new AppError({
    code: ErrorCodes.SYSTEM_DYNAMICS_FAILED,
    message,
    statusCode: 400,
    details,
    stage: 'S2',
    fixHints: ['检查知识框架是否完整', '尝试重新生成']
  }),
  
  s3: (message: string, details?: unknown) => new AppError({
    code: ErrorCodes.ACTION_PLAN_FAILED,
    message,
    statusCode: 400,
    details,
    stage: 'S3',
    fixHints: ['简化行动计划要求', '减少 KPI 数量']
  }),
  
  s4: (message: string, details?: unknown) => new AppError({
    code: ErrorCodes.PROGRESS_ANALYSIS_FAILED,
    message,
    statusCode: 400,
    details,
    stage: 'S4',
    fixHints: ['检查进度数据是否完整', '确保所有字段都已填写']
  }),
};
