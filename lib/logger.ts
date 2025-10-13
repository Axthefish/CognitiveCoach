import { getEnv } from './env-validator';

// 日志级别枚举
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// 日志级别映射
const LOG_LEVELS: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

// 缓存的日志级别（用于性能优化）
let cachedLogLevel: LogLevel | null = null;
let lastLogLevelCheck = 0;
const LOG_LEVEL_CACHE_MS = 5000; // 5秒内使用缓存

// 获取当前日志级别（支持动态更新）
function getCurrentLogLevel(): LogLevel {
  const now = Date.now();
  
  // 如果有缓存且未过期，使用缓存
  if (cachedLogLevel !== null && (now - lastLogLevelCheck) < LOG_LEVEL_CACHE_MS) {
    return cachedLogLevel;
  }
  
  try {
    const env = getEnv();
    cachedLogLevel = LOG_LEVELS[env.LOG_LEVEL] || LogLevel.INFO;
    lastLogLevelCheck = now;
    return cachedLogLevel;
  } catch {
    // 如果环境变量验证失败，使用默认级别
    cachedLogLevel = LogLevel.INFO;
    lastLogLevelCheck = now;
    return cachedLogLevel;
  }
}

// 清除日志级别缓存（用于测试或强制刷新）
export function clearLogLevelCache(): void {
  cachedLogLevel = null;
  lastLogLevelCheck = 0;
}

function maskSecrets(input: unknown): string {
  try {
    let str = typeof input === 'string' ? input : JSON.stringify(input);
    
    // 1. JSON字段格式：{"key":"value"} 或 {"key": "value"} 或无引号
    str = str.replace(/(["']?(?:apiKey|api_key|authorization|token|secret|password|credentials|auth)["']?\s*[:=]\s*["']?)([^"',}\s]+)(["']?)/gi, '$1***$3');
    
    // 2. URL参数格式：?key=value 或 &token=value
    str = str.replace(/([?&])(key|token|auth|apikey|api_key|secret|password)=([^&\s]+)/gi, '$1$2=***');
    
    // 3. Bearer token格式
    str = str.replace(/(Bearer\s+)[A-Za-z0-9\-_]+/gi, '$1***');
    
    // 4. Google API Key格式（AIza开头）
    str = str.replace(/AIza[0-9A-Za-z\-_]{35}/g, '***');
    
    // 5. JWT token格式（三段式）
    str = str.replace(/eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '***');
    
    // 6. 通用长字符串密钥（32+字符的连续字母数字）
    str = str.replace(/(?:^|[^A-Za-z0-9])([A-Za-z0-9]{32,})(?:[^A-Za-z0-9]|$)/g, (match, key) => {
      // 避免误伤普通文本，只处理看起来像密钥的字符串
      if (/^[A-F0-9]+$/i.test(key)) {
        return match.replace(key, '***');
      }
      return match;
    });
    
    return str;
  } catch (serializationError) {
    console.warn('Failed to sanitize log data:', serializationError);
    return '[unserializable]';
  }
}

function truncate(text: string, max = 300): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...<truncated>';
}

// 序列化和清理日志参数
function serializeLogArg(arg: unknown): string | Error {
  // Error对象直接返回，让console保持原生处理
  if (arg instanceof Error) return arg;
  
  // 对象类型尝试序列化
  if (typeof arg === 'object' && arg !== null) {
    try {
      const serialized = JSON.stringify(arg, null, 2);
      return truncate(maskSecrets(serialized));
    } catch {
      return '[unserializable object]';
    }
  }
  
  // 其他类型转字符串
  const str = String(arg);
  return truncate(maskSecrets(str));
}

// 创建统一的logger接口，支持动态日志级别
export const logger = {
  debug: (...args: unknown[]) => {
    // 每次调用时动态获取日志级别
    if (getCurrentLogLevel() <= LogLevel.DEBUG) {
      console.debug(...args.map(serializeLogArg));
    }
  },
  
  info: (...args: unknown[]) => {
    if (getCurrentLogLevel() <= LogLevel.INFO) {
      console.info(...args.map(serializeLogArg));
    }
  },
  
  warn: (...args: unknown[]) => {
    if (getCurrentLogLevel() <= LogLevel.WARN) {
      console.warn(...args.map(serializeLogArg));
    }
  },
  
  error: (...args: unknown[]) => {
    if (getCurrentLogLevel() <= LogLevel.ERROR) {
      console.error(...args.map(serializeLogArg));
    }
  },
  
  // 兼容性方法
  log: (...args: unknown[]) => {
    if (getCurrentLogLevel() <= LogLevel.INFO) {
      console.log(...args.map(serializeLogArg));
    }
  },
  
  // 添加性能监控方法（与 EnhancedLogger 兼容）
  time: (label: string): (() => void) => {
    const startTime = Date.now();
    logger.debug(`⏱️ Timer started: ${label}`);
    
    return () => {
      const duration = Date.now() - startTime;
      logger.info(`⏱️ Timer ended: ${label}`, { duration: `${duration}ms` });
    };
  },
};

export { maskSecrets, truncate };

// 导出类型以便与 logger-enhanced.ts 兼容
export type { LogLevel as LogLevelType };


