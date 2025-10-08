// 增强的结构化日志系统
// 保持向后兼容，同时提供更强大的功能

import { maskSecrets, truncate } from './logger';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  // 请求追踪
  traceId?: string;
  requestId?: string;
  userId?: string;
  
  // 业务上下文
  stage?: string;
  action?: string;
  
  // 性能指标
  duration?: number;
  memoryUsage?: number;
  
  // 其他元数据
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  context?: LogContext;
  timestamp: string;
  stack?: string;
}

interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  enableContextTracking: boolean;
  structuredOutput: boolean;
  maskSensitiveData: boolean;
}

export class EnhancedLogger {
  private level: LogLevel;
  private config: LoggerConfig;
  private globalContext: LogContext = {};
  
  constructor(config?: Partial<LoggerConfig>) {
    const isDev = process.env.NODE_ENV === 'development';
    const isProd = process.env.NODE_ENV === 'production';
    
    this.config = {
      level: process.env.LOG_LEVEL as LogLevel || (isProd ? 'info' : 'debug'),
      enableColors: isDev,
      enableTimestamps: true,
      enableContextTracking: true,
      structuredOutput: isProd,
      maskSensitiveData: true,
      ...config,
    };
    
    this.level = this.config.level;
  }
  
  /**
   * 设置全局上下文（所有日志都会包含）
   */
  setGlobalContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
  }
  
  /**
   * 清除全局上下文
   */
  clearGlobalContext(): void {
    this.globalContext = {};
  }
  
  /**
   * 创建子 logger（继承父 logger 的上下文）
   */
  child(context: LogContext): EnhancedLogger {
    const child = new EnhancedLogger(this.config);
    child.setGlobalContext({ ...this.globalContext, ...context });
    return child;
  }
  
  private getLevelPriority(level: LogLevel): number {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    return levels.indexOf(level);
  }
  
  private shouldLog(level: LogLevel): boolean {
    return this.getLevelPriority(level) >= this.getLevelPriority(this.level);
  }
  
  private formatForConsole(entry: LogEntry): void {
    const { level, message, data, context, timestamp } = entry;
    
    if (this.config.enableColors) {
      const colors: Record<LogLevel, string> = {
        debug: '\x1b[36m',  // cyan
        info: '\x1b[32m',   // green
        warn: '\x1b[33m',   // yellow
        error: '\x1b[31m',  // red
        fatal: '\x1b[35m',  // magenta
      };
      const reset = '\x1b[0m';
      const bold = '\x1b[1m';
      
      const prefix = this.config.enableTimestamps 
        ? `${timestamp} ${bold}${colors[level]}[${level.toUpperCase()}]${reset}`
        : `${bold}${colors[level]}[${level.toUpperCase()}]${reset}`;
      
      console.log(`${prefix} ${message}`);
      
      // 输出上下文信息
      if (context && Object.keys(context).length > 0) {
        console.log(`  ${colors.debug}Context:${reset}`, context);
      }
      
      // 输出数据
      if (data) {
        const processedData = this.config.maskSensitiveData 
          ? JSON.parse(maskSecrets(data))
          : data;
        console.log(`  ${colors.debug}Data:${reset}`, processedData);
      }
      
      // 输出堆栈（仅错误）
      if (entry.stack) {
        console.log(`  ${colors.error}Stack:${reset}\n${entry.stack}`);
      }
    } else {
      // 简单输出（无颜色）
      const prefix = this.config.enableTimestamps 
        ? `${timestamp} [${level.toUpperCase()}]`
        : `[${level.toUpperCase()}]`;
      
      console.log(`${prefix} ${message}`);
      if (context && Object.keys(context).length > 0) {
        console.log('  Context:', context);
      }
      if (data) {
        const processedData = this.config.maskSensitiveData 
          ? JSON.parse(maskSecrets(data))
          : data;
        console.log('  Data:', processedData);
      }
      if (entry.stack) {
        console.log('  Stack:', entry.stack);
      }
    }
  }
  
  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    context?: LogContext
  ): void {
    if (!this.shouldLog(level)) return;
    
    const mergedContext = {
      ...this.globalContext,
      ...context,
    };
    
    const entry: LogEntry = {
      level,
      message: this.config.maskSensitiveData ? maskSecrets(message) : message,
      data,
      context: Object.keys(mergedContext).length > 0 ? mergedContext : undefined,
      timestamp: new Date().toISOString(),
    };
    
    // 在错误和致命级别添加堆栈信息
    if (level === 'error' || level === 'fatal') {
      const stack = new Error().stack;
      if (stack) {
        entry.stack = stack.split('\n').slice(2).join('\n'); // 移除前两行
      }
    }
    
    if (this.config.structuredOutput) {
      // 生产环境：JSON 格式输出
      console.log(JSON.stringify(entry));
    } else {
      // 开发环境：格式化输出
      this.formatForConsole(entry);
    }
  }
  
  debug(message: string, data?: unknown, context?: LogContext): void {
    this.log('debug', message, data, context);
  }
  
  info(message: string, data?: unknown, context?: LogContext): void {
    this.log('info', message, data, context);
  }
  
  warn(message: string, data?: unknown, context?: LogContext): void {
    this.log('warn', message, data, context);
  }
  
  error(message: string, data?: unknown, context?: LogContext): void {
    this.log('error', message, data, context);
  }
  
  fatal(message: string, data?: unknown, context?: LogContext): void {
    this.log('fatal', message, data, context);
  }
  
  /**
   * 性能监控装饰器辅助方法
   */
  time(label: string, context?: LogContext): () => void {
    const startTime = Date.now();
    this.debug(`Timer started: ${label}`, undefined, context);
    
    return () => {
      const duration = Date.now() - startTime;
      this.info(`Timer ended: ${label}`, { duration: `${duration}ms` }, {
        ...context,
        duration,
      });
    };
  }
  
  /**
   * 追踪异步操作
   */
  async trace<T>(
    label: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const endTimer = this.time(label, context);
    
    try {
      const result = await fn();
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      this.error(`Operation failed: ${label}`, error, context);
      throw error;
    }
  }
}

/**
 * 日志工具函数
 */

// 安全地序列化对象（避免循环引用）
export function safeStringify(obj: unknown, maxDepth: number = 3): string {
  const seen = new WeakSet();
  
  const replacer = (depth: number) => {
    return (_key: string, value: unknown): unknown => {
      if (depth > maxDepth) {
        return '[Max Depth Reached]';
      }
      
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      
      return value;
    };
  };
  
  try {
    return JSON.stringify(obj, replacer(0), 2);
  } catch {
    return '[Unable to Stringify]';
  }
}

// 格式化字节数
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// 格式化持续时间
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

// 导出增强版 logger 实例（可选使用）
export const enhancedLogger = new EnhancedLogger();

// 重新导出原始工具
export { maskSecrets, truncate };

