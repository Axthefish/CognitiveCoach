// 监控和性能追踪
// 集成 Sentry 错误追踪和 Web Vitals 性能监控

import { logger } from './logger';

// Web Vitals 类型定义
interface WebVitalsMetric {
  id: string;
  name: 'CLS' | 'FCP' | 'FID' | 'LCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'prerender';
}

/**
 * 性能监控配置
 */
export const PERFORMANCE_THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  FID: { good: 100, poor: 300 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 }
} as const;

/**
 * 评估性能指标等级
 * 注意：此函数供未来使用，当前由web-vitals库自动计算rating
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getRating(name: WebVitalsMetric['name'], value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = PERFORMANCE_THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Web Vitals 性能监控
 * 在客户端代码中使用
 */
export function reportWebVitals(metric: WebVitalsMetric) {
  // 控制台日志（开发环境）
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Web Vitals:', {
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating
    });
  }

  // 发送到分析服务
  if (typeof window !== 'undefined') {
    // Google Analytics 4
    if (window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_category: 'Web Vitals',
        event_label: metric.id,
        non_interaction: true
      });
    }

    // 自定义端点（可选）
    sendToAnalytics(metric);
  }
}

/**
 * 发送性能数据到分析端点
 */
async function sendToAnalytics(metric: WebVitalsMetric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent
  });

  // 使用 sendBeacon 确保数据发送（即使页面卸载）
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/vitals', body);
  } else {
    // 降级方案
    fetch('/api/analytics/vitals', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true
    }).catch((error) => {
      logger.warn('Failed to send vitals:', error);
    });
  }
}

/**
 * 错误边界监控
 */
export interface ErrorBoundaryInfo {
  error: Error;
  errorInfo: {
    componentStack: string;
  };
  userId?: string;
  userContext?: Record<string, unknown>;
}

/**
 * 报告组件错误
 */
export function reportComponentError(info: ErrorBoundaryInfo) {
  logger.error('Component Error:', {
    message: info.error.message,
    stack: info.error.stack,
    componentStack: info.errorInfo.componentStack,
    userId: info.userId
  });

  // 发送到 Sentry（如果配置）
  if (typeof window !== 'undefined' && window.Sentry) {
    const Sentry = window.Sentry as { captureException: (error: Error, options?: unknown) => void };
    Sentry.captureException(info.error, {
      contexts: {
        react: {
          componentStack: info.errorInfo.componentStack
        }
      },
      user: info.userId ? { id: info.userId } : undefined,
      extra: info.userContext
    });
  }
}

/**
 * API 调用监控
 */
export interface APICallMetrics {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  success: boolean;
  errorCode?: string;
  stage?: string;
}

/**
 * 报告 API 调用指标
 */
export function reportAPICall(metrics: APICallMetrics) {
  // 记录慢请求
  if (metrics.duration > 5000) {
    logger.warn('Slow API call detected:', {
      endpoint: metrics.endpoint,
      duration: metrics.duration,
      status: metrics.status
    });
  }

  // 记录失败请求
  if (!metrics.success) {
    logger.error('API call failed:', {
      endpoint: metrics.endpoint,
      status: metrics.status,
      errorCode: metrics.errorCode,
      stage: metrics.stage
    });
  }

  // 发送到监控服务
  if (typeof window !== 'undefined') {
    sendToMonitoring('api_call', metrics);
  }
}

/**
 * 用户行为追踪
 */
export interface UserAction {
  action: string;
  category: string;
  label?: string;
  value?: number;
  properties?: Record<string, unknown>;
}

/**
 * 追踪用户行为
 */
export function trackUserAction(action: UserAction) {
  // 开发环境日志
  if (process.env.NODE_ENV === 'development') {
    logger.debug('User Action:', action);
  }

  // Google Analytics 4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action.action, {
      event_category: action.category,
      event_label: action.label,
      value: action.value,
      ...action.properties
    });
  }

  // 自定义分析
  sendToMonitoring('user_action', action);
}

/**
 * 发送到监控服务
 */
function sendToMonitoring(eventType: string, data: unknown) {
  const body = JSON.stringify({
    eventType,
    data,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    url: window.location.href
  });

  fetch('/api/analytics/events', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true
  }).catch((error) => {
    // 静默失败，不影响用户体验
    logger.debug('Failed to send monitoring data:', error);
  });
}

/**
 * 获取或创建会话 ID
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    sessionStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

/**
 * 初始化 Sentry（在应用启动时调用）
 */
export function initSentry() {
  if (typeof window === 'undefined') return;
  
  const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!SENTRY_DSN) {
    logger.debug('Sentry DSN not configured, skipping initialization');
    return;
  }

  // 动态导入 Sentry（注意：需要安装 @sentry/nextjs）
  // @ts-expect-error Sentry包是可选依赖
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // 错误过滤
      beforeSend(event: unknown, hint: { originalException?: unknown }) {
        // 过滤掉开发环境的错误
        if (process.env.NODE_ENV === 'development') {
          return null;
        }
        
        // 过滤掉某些已知的良性错误
        const error = hint.originalException;
        if (error instanceof Error) {
          if (error.message.includes('ResizeObserver loop')) {
            return null;
          }
          if (error.message.includes('Hydration')) {
            // 水合错误只记录警告
            logger.warn('Hydration error:', error.message);
            return null;
          }
        }
        
        return event;
      }
    });
    
    logger.info('Sentry initialized');
  }).catch(() => {
    // Sentry未安装，静默失败
    logger.debug('Sentry package not installed, skipping initialization');
  });
}

/**
 * 性能标记工具
 */
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  
  /**
   * 开始计时
   */
  start(label: string) {
    this.marks.set(label, performance.now());
  }
  
  /**
   * 结束计时并返回耗时
   */
  end(label: string): number {
    const start = this.marks.get(label);
    if (!start) {
      logger.warn(`Performance mark "${label}" not found`);
      return 0;
    }
    
    const duration = performance.now() - start;
    this.marks.delete(label);
    
    // 记录性能数据
    logger.debug(`Performance: ${label}`, { duration: Math.round(duration) });
    
    // 如果超过阈值，发送告警
    if (duration > 3000) {
      logger.warn(`Slow operation detected: ${label}`, { duration });
      trackUserAction({
        action: 'slow_operation',
        category: 'performance',
        label,
        value: Math.round(duration)
      });
    }
    
    return duration;
  }
  
  /**
   * 清除所有标记
   */
  clear() {
    this.marks.clear();
  }
}

// 全局性能监控实例
export const perfMonitor = new PerformanceMonitor();

// 类型声明扩展
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    Sentry?: unknown;
  }
}

