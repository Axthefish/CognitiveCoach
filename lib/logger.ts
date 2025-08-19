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

// 获取当前日志级别
function getCurrentLogLevel(): LogLevel {
  try {
    const env = getEnv();
    return LOG_LEVELS[env.LOG_LEVEL] || LogLevel.INFO;
  } catch {
    // 如果环境变量验证失败，使用默认级别
    return LogLevel.INFO;
  }
}

function maskSecrets(input: unknown): string {
  try {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return str
      .replace(/(apiKey|authorization|token|secret|password)\s*[:=]\s*"[^"]+"/gi, '$1:"***"')
      .replace(/(apiKey|authorization|token|secret|password)\s*[:=]\s*'[^']+'/gi, "$1:'***'")
      .replace(/(AIza[0-9A-Za-z\-_]{35})/g, '***')
      .replace(/(Bearer\s+)[A-Za-z0-9\-_]+/gi, '$1***')
      .replace(/(jwt\s*[:=]\s*)[A-Za-z0-9\-_.]+/gi, '$1***');
  } catch (serializationError) {
    console.warn('Failed to sanitize log data:', serializationError);
    return '[unserializable]';
  }
}

function truncate(text: string, max = 300): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...<truncated>';
}

// 结构化日志格式化
function formatStructuredLog(level: string, message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...(meta && Object.keys(meta).length > 0 && { meta }),
  };
  
  try {
    const env = getEnv();
    return env.NODE_ENV === 'production' 
      ? JSON.stringify(logEntry)
      : `[${timestamp}] ${level.toUpperCase()}: ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;
  } catch {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  }
}

const currentLogLevel = getCurrentLogLevel();

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      const sanitizedMeta = meta ? JSON.parse(maskSecrets(meta)) : undefined;
      const formatted = formatStructuredLog('debug', message, sanitizedMeta);
      console.debug(formatted);
    }
  },
  
  info: (message: string, meta?: Record<string, unknown>) => {
    if (currentLogLevel <= LogLevel.INFO) {
      const sanitizedMeta = meta ? JSON.parse(maskSecrets(meta)) : undefined;
      const formatted = formatStructuredLog('info', message, sanitizedMeta);
      console.info(formatted);
    }
  },
  
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (currentLogLevel <= LogLevel.WARN) {
      const sanitizedMeta = meta ? JSON.parse(maskSecrets(meta)) : undefined;
      const formatted = formatStructuredLog('warn', message, sanitizedMeta);
      console.warn(formatted);
    }
  },
  
  error: (message: string, meta?: Record<string, unknown>) => {
    if (currentLogLevel <= LogLevel.ERROR) {
      const sanitizedMeta = meta ? JSON.parse(maskSecrets(meta)) : undefined;
      const formatted = formatStructuredLog('error', message, sanitizedMeta);
      console.error(formatted);
    }
  },
  
  // 兼容性方法 - 支持旧的多参数调用方式
  log: (...args: unknown[]) => {
    const mapped = args.map(a => {
      if (a instanceof Error) return a;
      const s = String(a);
      return truncate(maskSecrets(s));
    });
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(...mapped);
    }
  },
};

export { maskSecrets, truncate };


