// 错误报告工具
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
    console.error('Error reported:', errorReport);
    
    // 在开发环境中存储到全局对象供调试
    if (typeof window !== 'undefined') {
      (window as Record<string, unknown>).__errorReports = (window as Record<string, unknown>).__errorReports || [];
      ((window as Record<string, unknown>).__errorReports as Record<string, unknown>[]).push(errorReport);
    }
  } else if (process.env.NODE_ENV === 'production') {
    // 生产环境可以发送到监控服务
    // 这里暂时只记录到控制台
    console.error('Production error:', {
      message: error.message,
      timestamp: errorReport.timestamp,
      context
    });
  }
  
  return errorReport;
}

// 开发环境调试工具
export function getDebugInfo() {
  if (typeof window === 'undefined') return null;
  
  return {
    streamMessages: (window as Record<string, unknown>).__streamMessages || [],
    streamErrors: (window as Record<string, unknown>).__streamErrors || [],
    errorReports: (window as Record<string, unknown>).__errorReports || [],
    performance: {
      memory: (performance as PerformanceNavigatorTiming & { memory?: unknown }).memory,
      navigation: performance.navigation,
      timing: performance.timing
    }
  };
}

// 清理调试数据
export function clearDebugData() {
  if (typeof window === 'undefined') return;
  
  delete (window as Record<string, unknown>).__streamMessages;
  delete (window as Record<string, unknown>).__streamErrors;
  delete (window as Record<string, unknown>).__errorReports;
  
  console.log('Debug data cleared');
}
