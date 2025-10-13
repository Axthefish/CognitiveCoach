/**
 * API Client - 统一的Fetch包装器
 * 
 * 提供：
 * - 自动超时处理
 * - 智能重试（指数退避）
 * - 错误分类和友好提示
 * - AbortController支持
 */

import { logger } from './logger';

// ============================================
// 类型定义
// ============================================

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface ApiError extends Error {
  code: string;
  status?: number;
  isNetworkError?: boolean;
  isTimeout?: boolean;
  isRetryable?: boolean;
}

// ============================================
// 错误分类
// ============================================

function classifyError(error: Error, response?: Response): ApiError {
  // 创建一个新的 ApiError 对象，而不是修改原始 Error
  const apiError = Object.create(error) as ApiError;
  
  // 复制原始错误的属性
  Object.assign(apiError, {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
  
  // 网络错误
  if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
    Object.assign(apiError, {
      code: 'NETWORK_ERROR',
      isNetworkError: true,
      isRetryable: true,
      message: '无法连接到服务器，请检查网络后重试',
    });
    return apiError;
  }
  
  // 超时错误
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    Object.assign(apiError, {
      code: 'TIMEOUT',
      isTimeout: true,
      isRetryable: true,
      message: '请求超时，请重试或稍后再试',
    });
    return apiError;
  }
  
  // HTTP错误
  if (response) {
    let errorDetails: Partial<ApiError> = { status: response.status };
    
    switch (response.status) {
      case 400:
        errorDetails = {
          ...errorDetails,
          code: 'VALIDATION_ERROR',
          isRetryable: false,
          message: '请求数据格式有误，请检查后重试',
        };
        break;
      
      case 401:
        errorDetails = {
          ...errorDetails,
          code: 'UNAUTHORIZED',
          isRetryable: false,
          message: '未授权，请重新登录',
        };
        break;
      
      case 403:
        errorDetails = {
          ...errorDetails,
          code: 'FORBIDDEN',
          isRetryable: false,
          message: '没有权限访问此资源',
        };
        break;
      
      case 404:
        errorDetails = {
          ...errorDetails,
          code: 'NOT_FOUND',
          isRetryable: false,
          message: '请求的资源不存在',
        };
        break;
      
      case 429:
        errorDetails = {
          ...errorDetails,
          code: 'RATE_LIMIT',
          isRetryable: true,
          message: '请求过于频繁，请稍后再试',
        };
        break;
      
      case 500:
      case 502:
      case 503:
      case 504:
        errorDetails = {
          ...errorDetails,
          code: 'SERVER_ERROR',
          isRetryable: true,
          message: '服务器错误，请稍后重试',
        };
        break;
      
      default:
        errorDetails = {
          ...errorDetails,
          code: 'UNKNOWN_ERROR',
          isRetryable: false,
          message: '发生未知错误，请稍后重试',
        };
    }
    
    Object.assign(apiError, errorDetails);
  }
  
  return apiError;
}

// ============================================
// 指数退避延迟
// ============================================

function exponentialDelay(attempt: number, baseDelay: number = 1000): number {
  // 第1次重试: 1秒
  // 第2次重试: 2秒
  // 第3次重试: 4秒
  return Math.min(baseDelay * Math.pow(2, attempt - 1), 10000);
}

// ============================================
// 核心函数
// ============================================

/**
 * 带超时和重试的Fetch包装器
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    onRetry,
    ...fetchOptions
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const isLastAttempt = attempt === retries + 1;
    
    try {
      // 创建AbortController用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // 执行fetch
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // 检查HTTP状态
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        throw classifyError(error, response);
      }
      
      // 成功
      if (attempt > 1) {
        logger.info('[API Client] Request succeeded after retry', {
          url,
          attempt,
        });
      }
      
      return response;
      
    } catch (error) {
      const apiError = classifyError(error as Error);
      lastError = apiError;
      
      logger.warn('[API Client] Request failed', {
        url,
        attempt,
        error: apiError.message,
        code: apiError.code,
        isRetryable: apiError.isRetryable,
      });
      
      // 如果是最后一次尝试，或者错误不可重试，直接抛出
      if (isLastAttempt || !apiError.isRetryable) {
        throw apiError;
      }
      
      // 触发重试回调
      if (onRetry) {
        onRetry(attempt, apiError);
      }
      
      // 等待后重试
      const delay = exponentialDelay(attempt, retryDelay);
      logger.info('[API Client] Retrying after delay', {
        url,
        attempt,
        delay,
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // 理论上不会到这里，但为了类型安全
  throw lastError || new Error('Unknown error');
}

/**
 * 便捷方法：POST JSON
 */
export async function postJSON<T = unknown>(
  url: string,
  data: unknown,
  options: Omit<FetchOptions, 'method' | 'body'> = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
    ...options,
  });
  
  return response.json();
}

/**
 * 便捷方法：GET JSON
 */
export async function getJSON<T = unknown>(
  url: string,
  options: Omit<FetchOptions, 'method'> = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    method: 'GET',
    ...options,
  });
  
  return response.json();
}

// ============================================
// React Hook
// ============================================

export interface UseApiCallOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
  onRetry?: (attempt: number) => void;
}

/**
 * API调用Hook（用于React组件）
 */
export function useApiCall<T>(
  apiCall: () => Promise<T>,
  options: UseApiCallOptions<T> = {}
) {
  const { onSuccess, onError } = options;
  
  return async () => {
    try {
      const result = await apiCall();
      if (onSuccess) {
        onSuccess(result);
      }
      return result;
    } catch (error) {
      const apiError = error as ApiError;
      if (onError) {
        onError(apiError);
      }
      throw apiError;
    }
  };
}

// ============================================
// 友好的错误消息映射
// ============================================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: {
    title: '网络连接失败',
    message: '无法连接到服务器，请检查网络后重试',
    action: '重试',
  },
  TIMEOUT: {
    title: '请求超时',
    message: '服务器响应时间过长，请重试或稍后再试',
    action: '重试',
  },
  VALIDATION_ERROR: {
    title: '数据验证失败',
    message: '输入的数据格式有误，请检查后重试',
    action: '返回修改',
  },
  RATE_LIMIT: {
    title: '请求过于频繁',
    message: '请稍后再试',
    action: '稍后重试',
  },
  SERVER_ERROR: {
    title: '服务器错误',
    message: '服务器遇到问题，请稍后重试',
    action: '重试',
  },
  UNAUTHORIZED: {
    title: '未授权',
    message: '请重新登录',
    action: '登录',
  },
  FORBIDDEN: {
    title: '权限不足',
    message: '没有权限访问此资源',
    action: '返回',
  },
  NOT_FOUND: {
    title: '资源不存在',
    message: '请求的资源未找到',
    action: '返回',
  },
  UNKNOWN_ERROR: {
    title: '未知错误',
    message: '发生未知错误，请稍后重试',
    action: '重试',
  },
} as const;

export function getErrorMessage(error: ApiError) {
  return ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES.UNKNOWN_ERROR;
}

