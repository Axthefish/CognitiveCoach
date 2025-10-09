// 标准化错误处理系统
// 职责：错误分类、业务逻辑、AppError 类
// 依赖：使用 error-utils 的底层响应格式化函数

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';
import { isProduction } from './env-validator';
import { createErrorResponse as createErrorResponseBase } from './error-utils';
import type { ApiErrorResponse } from './api-types';

// 扩展 Window 接口用于开发环境错误报告
declare global {
  interface Window {
    __errorReports?: ErrorReport[];
  }
}

interface ErrorReport {
  type: 'app_error' | 'unknown_error';
  message: string;
  code?: string;
  stage?: string;
  timestamp: string;
  environment: string;
  userAgent?: string;
  url?: string;
}

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
  
  /**
   * 安全的序列化方法 - 确保生产环境不泄露敏感信息
   */
  toJSON() {
    return {
      code: this.code,
      message: this.userMessage,
      details: this.getSecureDetails(),
      fixHints: this.fixHints,
      stage: this.stage,
    };
  }

  /**
   * 获取安全的错误详情 - 绝不在生产环境暴露内部实现细节
   * 
   * 安全策略：
   * - 生产环境：完全不返回任何详情（强制undefined）
   * - 开发环境：返回过滤后的详情，移除敏感字段
   * - 检测潜在的密钥格式（AIza..., sk-..., Bearer等）
   */
  private getSecureDetails(): unknown {
    // 生产环境：完全不返回任何详情
    if (isProduction()) {
      return undefined;
    }

    // 开发环境：过滤敏感信息
    if (this.details && typeof this.details === 'object') {
      const sanitized = { ...this.details } as Record<string, unknown>;
      
      // 移除可能包含敏感信息的字段
      const sensitiveFields = [
        'stack', 'env', 'apiKey', 'token', 'password', 'credentials',
        'authorization', 'bearer', 'jwt', 'secret', 'key', 'auth',
        'accessToken', 'refreshToken', 'sessionId'
      ];
      
      sensitiveFields.forEach(field => {
        delete sanitized[field];
      });
      
      // 检测并移除包含密钥格式的字段
      Object.keys(sanitized).forEach(key => {
        const value = sanitized[key];
        if (typeof value === 'string') {
          // 检测常见的API密钥格式
          const keyPatterns = [
            /^AIza[0-9A-Za-z\-_]{35}$/,  // Google API key
            /^sk-[a-zA-Z0-9]{48}$/,       // OpenAI key
            /^Bearer\s+/i,                // Bearer token
            /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/  // JWT format
          ];
          
          if (keyPatterns.some(pattern => pattern.test(value))) {
            sanitized[key] = '[REDACTED: potential key detected]';
          }
        }
      });
      
      return sanitized;
    }

    return this.details;
  }
}

// 错误响应接口（使用 ApiErrorResponse 确保类型一致性）
export type ErrorResponse = ApiErrorResponse;

// 统一的错误处理器
// 使用 error-utils 的底层响应创建函数
export function handleError(error: unknown, stage?: string): NextResponse<ApiErrorResponse> {
  // 记录错误日志
  logger.error(`Error in ${stage || 'unknown stage'}:`, error);
  
  // 处理 AppError
  if (error instanceof AppError) {
    return createErrorResponseBase(
      error.userMessage,
      error.statusCode,
      {
        code: error.code,
        details: serializeErrorDetailsSecurely(error.details),
        fixHints: error.fixHints,
        stage: error.stage || stage,
      }
    );
  }
  
  // 处理 ZodError
  if (error instanceof ZodError) {
    const issues = error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    
    return createErrorResponseBase(
      '输入数据格式不正确',
      400,
      {
        code: ErrorCodes.SCHEMA_VALIDATION_ERROR,
        details: serializeErrorDetailsSecurely(issues),
        fixHints: ['请检查输入数据格式', '确保所有必填字段都已提供'],
        stage,
      }
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
    
    return createErrorResponseBase(
      getErrorMessage(code),
      statusCode,
      {
        code,
        details: serializeErrorDetailsSecurely(error.stack, true),
        stage,
      }
    );
  }
  
  // 处理未知错误
  return createErrorResponseBase(
    '发生未知错误，请联系技术支持',
    500,
    {
      code: ErrorCodes.INTERNAL_ERROR,
      stage,
    }
  );
}

// 辅助函数：获取用户友好的错误消息
function getErrorMessage(code: ErrorCode): string {
  const error = new AppError({ code, message: '' });
  return error.userMessage;
}

/**
 * 安全的错误详情序列化 - 绝不在生产环境泄露敏感信息
 * 
 * 安全策略：
 * - 强制隐藏模式：用于堆栈信息等特别敏感的数据
 * - 生产环境：完全不返回任何详情
 * - 开发环境：递归过滤敏感字段和潜在的密钥格式
 * 
 * @param details - 错误详情（可能包含敏感信息）
 * @param forceHide - 强制隐藏标志（用于堆栈信息等）
 * @returns 安全的错误详情或undefined
 */
export function serializeErrorDetailsSecurely(details: unknown, forceHide = false): unknown {
  // 强制隐藏或生产环境：完全不返回
  if (forceHide || isProduction()) {
    return undefined;
  }

  if (!details) {
    return undefined;
  }

  // 对于字符串类型的详情（如错误堆栈），在开发环境也要谨慎处理
  if (typeof details === 'string') {
    // 如果包含敏感关键词，则隐藏
    const sensitivePatterns = [
      /api[_-]?key/i,
      /token/i,
      /password/i,
      /secret/i,
      /credential/i,
      /auth/i,
      /bearer/i,
      /jwt/i,
      /AIza[0-9A-Za-z\-_]{35}/,  // Google API key format
      /sk-[a-zA-Z0-9]{48}/,       // OpenAI key format
    ];
    
    const containsSensitive = sensitivePatterns.some(pattern => pattern.test(details));
    if (containsSensitive) {
      return '[REDACTED: potentially sensitive information]';
    }
    
    return details;
  }

  // 对于对象类型的详情
  if (typeof details === 'object' && details !== null) {
    const sanitized = Array.isArray(details) ? [...details] : { ...details };
    const obj = sanitized as Record<string, unknown>;
    
    // 移除可能包含敏感信息的字段（扩展列表）
    const sensitiveFields = [
      'stack', 'env', 'apiKey', 'token', 'password', 'credentials',
      'authorization', 'bearer', 'jwt', 'secret', 'key', 'auth',
      'accessToken', 'refreshToken', 'sessionId', 'privateKey',
      'publicKey', 'certificate', 'hash', 'salt'
    ];
    
    sensitiveFields.forEach(field => {
      if (field in obj) {
        delete obj[field];
      }
    });
    
    // 检测并清理包含潜在密钥的字段
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // 递归处理嵌套对象
      if (value && typeof value === 'object') {
        obj[key] = serializeErrorDetailsSecurely(value, false);
        return;
      }
      
      // 检测字符串值中的潜在密钥
      if (typeof value === 'string') {
        const keyPatterns = [
          /^AIza[0-9A-Za-z\-_]{35}$/,  // Google API key
          /^sk-[a-zA-Z0-9]{48}$/,       // OpenAI key
          /^Bearer\s+/i,                // Bearer token
          /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/  // JWT format
        ];
        
        if (keyPatterns.some(pattern => pattern.test(value))) {
          obj[key] = '[REDACTED: potential key detected]';
        }
      }
    });
    
    return obj;
  }

  return details;
}

// 错误恢复建议生成器
export function generateRecoveryHints(code: ErrorCode, context?: Record<string, unknown>): string[] {
  const hints: Record<ErrorCode, (ctx?: Record<string, unknown>) => string[]> = {
    [ErrorCodes.AI_PARSE_ERROR]: () => [
      '尝试简化您的输入',
      '避免使用特殊字符',
      '用更清晰的语言描述您的需求'
    ],
    
    [ErrorCodes.AI_TIMEOUT]: () => [
      '请稍后重试',
      '尝试简化您的请求',
      '检查网络连接是否稳定'
    ],
    
    [ErrorCodes.AI_EMPTY_RESPONSE]: () => [
      '重新描述您的需求',
      '尝试提供更多细节',
      '使用更具体的语言'
    ],
    
    [ErrorCodes.AI_RATE_LIMIT]: () => [
      '请稍后再试',
      '系统正在处理大量请求',
      '建议等待几分钟后重试'
    ],
    
    [ErrorCodes.VALIDATION_ERROR]: () => [
      '检查输入数据的格式',
      '确保所有必填字段都已填写',
      '参考输入示例进行调整'
    ],
    
    [ErrorCodes.SCHEMA_VALIDATION_ERROR]: () => [
      '检查数据格式是否正确',
      '确保使用正确的数据类型',
      '移除无效的字段'
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
    
    [ErrorCodes.FRAMEWORK_GENERATION_FAILED]: () => [
      '尝试简化学习目标',
      '确保目标描述清晰明确',
      '重新生成知识框架'
    ],
    
    [ErrorCodes.SYSTEM_DYNAMICS_FAILED]: () => [
      '检查知识框架是否完整',
      '尝试重新生成动力学图',
      '简化系统要素'
    ],
    
    [ErrorCodes.ACTION_PLAN_FAILED]: () => [
      '简化行动计划要求',
      '减少 KPI 数量',
      '确保时间安排合理'
    ],
    
    [ErrorCodes.PROGRESS_ANALYSIS_FAILED]: () => [
      '检查进度数据是否完整',
      '确保所有字段都已填写',
      '重新提交进度报告'
    ],
    
    [ErrorCodes.INTERNAL_ERROR]: () => [
      '请刷新页面重试',
      '如果问题持续，请联系技术支持'
    ],
    
    [ErrorCodes.RATE_LIMIT_EXCEEDED]: () => [
      '请求过于频繁，请稍后再试',
      '建议等待一段时间',
      '避免快速连续请求'
    ],
    
    [ErrorCodes.UNAUTHORIZED]: () => [
      '请检查您的访问权限',
      '尝试重新登录',
      '联系管理员获取帮助'
    ],
    
    [ErrorCodes.NOT_FOUND]: () => [
      '请检查请求的资源是否存在',
      '尝试刷新页面',
      '确认 URL 地址正确'
    ],
    
    [ErrorCodes.QA_VALIDATION_FAILED]: (ctx) => {
      const issues = ctx?.issues as Array<{ hint: string }> || [];
      return issues.map(i => i.hint).slice(0, 3);
    },
    
    [ErrorCodes.CONSISTENCY_CHECK_FAILED]: () => [
      '检查数据一致性',
      '确保相关信息匹配',
      '重新验证输入数据'
    ],
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

// ============================================================================
// 错误报告工具（整合自 error-reporter.ts）
// ============================================================================

/**
 * 错误报告 - 用于客户端组件错误上报
 */
export function reportError(error: Error, context: Record<string, unknown> = {}) {
  const errorReport = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'server',
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
    context
  };

  if (process.env.NODE_ENV === 'development') {
    logger.error('Error reported:', errorReport);
    
    // 在开发环境中存储到全局对象供调试
    if (typeof window !== 'undefined') {
      window.__errorReports = window.__errorReports || [];
      window.__errorReports.push(errorReport);
    }
  } else if (process.env.NODE_ENV === 'production') {
    // 生产环境只记录关键信息
    logger.error('Production error:', {
      message: error.message,
      timestamp: errorReport.timestamp,
      context
    });
  }
  
  return errorReport;
}
