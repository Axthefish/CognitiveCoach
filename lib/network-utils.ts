/**
 * Enhanced network utilities for better error handling and user experience
 */

export interface NetworkError extends Error {
  type: 'timeout' | 'network' | 'server' | 'unknown';
  status?: number;
  retryable: boolean;
}

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Creates a network error with proper categorization
 */
function createNetworkError(error: unknown, type: NetworkError['type'], retryable: boolean = true): NetworkError {
  const message = error instanceof Error ? error.message : 'Network error occurred';
  const networkError = new Error(message) as NetworkError;
  networkError.type = type;
  networkError.retryable = retryable;
  
  if (error && typeof error === 'object' && 'status' in error) {
    networkError.status = error.status as number;
  }
  
  return networkError;
}

/**
 * Enhanced fetch with timeout, retry, and better error handling
 */
export async function enhancedFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const {
    timeout = 30000, // 30 seconds default
    retries = 2,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  let lastError: NetworkError = createNetworkError(new Error('Unknown error'), 'unknown', true);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status >= 500) {
          throw createNetworkError(
            { message: `Server error: ${response.status}`, status: response.status },
            'server',
            true
          );
        } else if (response.status >= 400) {
          throw createNetworkError(
            { message: `Client error: ${response.status}`, status: response.status },
            'server',
            false
          );
        }
      }

      return response;

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = createNetworkError(
          { message: 'Request timeout' },
          'timeout',
          true
        );
      } else if (error instanceof TypeError && error.message === 'Failed to fetch') {
        lastError = createNetworkError(
          { message: 'Network connection failed' },
          'network',
          true
        );
      } else if (error && typeof error === 'object' && 'type' in error) {
        // Already a NetworkError
        lastError = error as NetworkError;
      } else {
        lastError = createNetworkError(
          error,
          'unknown',
          true
        );
      }

      // Don't retry if it's not retryable or this is the last attempt
      if (!lastError.retryable || attempt === retries) {
        break;
      }

      // Wait before retrying
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Get user-friendly error message based on error type
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
        description: '服务器响应时间过长，请稍后重试。',
        suggestions: [
          '检查您的网络连接',
          '稍后再试',
          '如果问题持续存在，请联系支持团队'
        ]
      };

    case 'network':
      return {
        title: '网络连接问题',
        description: '无法连接到服务器。请检查您的网络连接。',
        suggestions: [
          '检查您的互联网连接',
          '如果使用VPN，请尝试断开连接',
          '禁用可能干扰的浏览器扩展',
          '稍后再试'
        ]
      };

    case 'server':
      if (error.status && error.status >= 500) {
        return {
          title: '服务器暂时不可用',
          description: '我们的服务器遇到了问题，正在努力修复中。',
          suggestions: [
            '稍后再试',
            '如果问题持续存在，请联系支持团队'
          ]
        };
      } else {
        return {
          title: '请求失败',
          description: `请求处理失败（错误代码：${error.status || 'unknown'}）`,
          suggestions: [
            '检查输入内容是否正确',
            '刷新页面重试',
            '如果问题持续存在，请联系支持团队'
          ]
        };
      }

    default:
      return {
        title: '出现错误',
        description: error.message || '发生了未知错误',
        suggestions: [
          '刷新页面重试',
          '检查您的网络连接',
          '如果问题持续存在，请联系支持团队'
        ]
      };
  }
}

/**
 * Network status monitoring utility
 */
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<(online: boolean) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.updateStatus(true));
      window.addEventListener('offline', () => this.updateStatus(false));
    }
  }

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  private updateStatus(online: boolean) {
    this.isOnline = online;
    this.listeners.forEach(listener => listener(online));
  }

  getStatus(): boolean {
    return this.isOnline;
  }

  subscribe(listener: (online: boolean) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
