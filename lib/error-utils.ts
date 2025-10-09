// 错误和成功响应的工具函数（低级响应格式化工具）
// 职责：只负责 NextResponse 格式化，不包含业务逻辑
// 使用场景：被 app-errors.ts 和 Service 层调用
// 
// 注意：业务错误处理请使用 app-errors.ts 的 handleError() 和 AppError 类

import { NextResponse } from 'next/server';
import { logger } from './logger';
import type { ApiSuccessResponse, ApiErrorResponse } from './api-types';

// 注意：使用 api-types.ts 中的统一类型定义
// 这里只是为了向后兼容而创建类型别名
export type SuccessResponse<T = unknown> = ApiSuccessResponse<T>;
export type ErrorResponseData = ApiErrorResponse;

/**
 * 创建成功响应
 * @param data 响应数据
 * @param statusCode HTTP状态码（默认200）
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode = 200
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json<SuccessResponse<T>>(
    {
      status: 'success',
      data,
    },
    { status: statusCode }
  );
}

/**
 * 创建错误响应
 * @param message 错误消息
 * @param statusCode HTTP状态码
 * @param additionalData 附加错误数据
 */
export function createErrorResponse(
  message: string,
  statusCode = 500,
  additionalData?: {
    code?: string;
    details?: unknown;
    fixHints?: string[];
    stage?: string;
  }
): NextResponse<ErrorResponseData> {
  const timestamp = new Date().toISOString();
  
  logger.error('Error response created:', {
    message,
    statusCode,
    stage: additionalData?.stage,
    code: additionalData?.code,
  });

  return NextResponse.json<ErrorResponseData>(
    {
      status: 'error',
      error: message,
      timestamp,
      ...additionalData,
    },
    { status: statusCode }
  );
}

/**
 * 从错误对象创建错误响应
 * @param error 错误对象
 * @param stage 当前阶段
 * @param defaultMessage 默认错误消息
 */
export function createErrorResponseFromError(
  error: unknown,
  stage?: string,
  defaultMessage = '处理请求时发生错误'
): NextResponse<ErrorResponseData> {
  const message = error instanceof Error ? error.message : defaultMessage;
  const details = error instanceof Error ? error.stack : undefined;

  return createErrorResponse(message, 500, {
    stage,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
    fixHints: ['请检查输入数据', '如问题持续，请联系技术支持'],
  });
}

/**
 * 验证失败响应
 * @param validationErrors 验证错误数组
 * @param stage 当前阶段
 */
export function createValidationErrorResponse(
  validationErrors: Array<{ path: string; message: string }>,
  stage?: string
): NextResponse<ErrorResponseData> {
  return createErrorResponse('数据验证失败', 400, {
    code: 'VALIDATION_ERROR',
    stage,
    details: validationErrors,
    fixHints: [
      '请检查输入数据格式',
      '确保所有必填字段都已提供',
      '参考API文档了解正确格式',
    ],
  });
}

// ============================================
// 网络错误处理（替代 lib/network-utils.ts）
// ============================================

/**
 * 网络错误类型
 */
export interface NetworkError {
  type: 'timeout' | 'network' | 'server' | 'unknown';
  message: string;
  status?: number;
  retryable: boolean;
}

/**
 * 简化的 fetch 包装函数，支持超时和重试
 */
export async function enhancedFetch(
  url: string,
  options: RequestInit & { timeout?: number; retries?: number } = {}
): Promise<Response> {
  const { timeout = 30000, retries = 0, ...fetchOptions } = options;
  
  let lastError: NetworkError | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw createNetworkError({
          type: 'server',
          status: response.status,
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
      
      return response;
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        lastError = createNetworkError({
          type: 'timeout',
          message: '请求超时',
        });
      } else if (error && typeof error === 'object' && 'type' in error) {
        // Already a NetworkError
        lastError = error as NetworkError;
      } else {
        lastError = createNetworkError({
          type: 'network',
          message: error instanceof Error ? error.message : '网络连接失败',
        });
      }
      
      // 如果不是最后一次尝试，继续重试
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }
  
  // 所有重试都失败了
  throw lastError;
}

/**
 * 创建标准化的 NetworkError 对象
 */
export function createNetworkError(params: {
  type: NetworkError['type'];
  message: string;
  status?: number;
}): NetworkError {
  return {
    type: params.type,
    message: params.message,
    status: params.status,
    retryable: params.type === 'timeout' || params.type === 'network',
  };
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyErrorMessage(error: NetworkError): {
  title: string;
  description: string;
  suggestions: string[];
} {
  switch (error.type) {
    case 'timeout':
      return {
        title: '请求超时',
        description: '处理时间过长，请稍后重试',
        suggestions: [
          '检查网络连接是否稳定',
          '稍后再试',
          '如问题持续，请联系技术支持',
        ],
      };
    
    case 'network':
      return {
        title: '网络错误',
        description: error.message || '无法连接到服务器',
        suggestions: [
          '检查网络连接',
          '确认防火墙设置',
          '尝试刷新页面',
        ],
      };
    
    case 'server':
      if (error.status && error.status >= 400 && error.status < 500) {
        return {
          title: '请求错误',
          description: '请求格式有误或数据无效',
          suggestions: [
            '检查输入数据',
            '确认所有必填字段都已填写',
            '参考使用说明',
          ],
        };
      }
      return {
        title: '服务器错误',
        description: '服务暂时不可用',
        suggestions: [
          '稍后重试',
          '如问题持续，请联系技术支持',
        ],
      };
    
    default:
      return {
        title: '未知错误',
        description: error.message || '发生了未知错误',
        suggestions: [
          '刷新页面重试',
          '如问题持续，请联系技术支持',
        ],
      };
  }
}

/**
 * 映射错误消息到用户友好的消息和错误代码
 * 用于流式API错误处理
 */
export function mapErrorToUserMessage(
  errorMessage: string
): { code: 'TIMEOUT' | 'NETWORK' | 'SCHEMA' | 'QA' | 'UNKNOWN'; message: string } {
  const lowerMessage = errorMessage.toLowerCase();
  
  if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('fetch')) {
    return {
      code: 'NETWORK',
      message: '网络连接出现问题，请检查网络后重试'
    };
  } else if (lowerMessage.includes('timeout')) {
    return {
      code: 'TIMEOUT',
      message: '处理时间过长，正在重新尝试...'
    };
  } else if (lowerMessage.includes('schema')) {
    return {
      code: 'SCHEMA',
      message: '内容格式验证失败，正在重新生成...'
    };
  } else if (lowerMessage.includes('qa') || lowerMessage.includes('quality')) {
    return {
      code: 'QA',
      message: '内容质量检查未通过，正在改进中...'
    };
  } else {
    return {
      code: 'UNKNOWN',
      message: '处理过程中遇到问题，正在尝试恢复...'
    };
  }
}

