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

// 结构化日志格式化（暂时未使用，保留以备将来扩展）
// function formatStructuredLog(level: string, message: string, meta?: Record<string, unknown>) {
//   const timestamp = new Date().toISOString();
//   const logEntry = {
//     timestamp,
//     level: level.toUpperCase(),
//     message,
//     ...(meta && Object.keys(meta).length > 0 && { meta }),
//   };
//   
//   try {
//     const env = getEnv();
//     return env.NODE_ENV === 'production' 
//       ? JSON.stringify(logEntry)
//       : `[${timestamp}] ${level.toUpperCase()}: ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;
//   } catch {
//     return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
//   }
// }

const currentLogLevel = getCurrentLogLevel();

export const logger = {
  debug: (...args: unknown[]) => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.debug(...args.map(maskSecrets));
    }
  },
  
  info: (...args: unknown[]) => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.info(...args.map(maskSecrets));
    }
  },
  
  warn: (...args: unknown[]) => {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(...args.map(maskSecrets));
    }
  },
  
  error: (...args: unknown[]) => {
    if (currentLogLevel <= LogLevel.ERROR) {
      const mapped = args.map(a => {
        if (a instanceof Error) return a;
        const s = String(a);
        return truncate(maskSecrets(s));
      });
      console.error(...mapped);
    }
  },
  
  // 兼容性方法
  log: (...args: unknown[]) => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(...args.map(maskSecrets));
    }
  },
};

export { maskSecrets, truncate };


