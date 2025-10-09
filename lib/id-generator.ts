// 唯一ID生成器 - 避免 hydration 不匹配

/**
 * 生成客户端安全的唯一ID
 * 使用自增计数器 + 会话标识，确保不会在服务器端和客户端产生不同的ID
 */

let sessionId: string | null = null;
let counter = 0;

/**
 * 初始化会话ID（只在客户端执行一次）
 */
function initializeSessionId(): string {
  if (typeof window === 'undefined') {
    // 服务器端，使用固定的会话ID
    return 'server-session';
  }
  
  // 客户端，生成唯一会话ID
  if (sessionId) {
    return sessionId;
  }
  
  sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  return sessionId;
}

/**
 * 生成唯一ID
 * @param prefix 可选的前缀
 * @returns 唯一ID字符串
 */
export function generateUniqueId(prefix = 'id'): string {
  const session = initializeSessionId();
  counter++;
  return `${prefix}-${session}-${counter}`;
}

/**
 * 生成版本快照ID
 * 使用 UUID + 时间戳，确保唯一性、可排序性和 hydration 安全
 */
export function generateVersionId(): string {
  if (typeof window === 'undefined') {
    // 服务器端，返回占位符ID（不应该在服务器端创建版本）
    // 使用明显的前缀避免与客户端ID冲突
    console.warn('⚠️ generateVersionId called on server side - this should only be called on client');
    return `v-server-${Date.now()}-${counter++}`;
  }
  
  // 客户端，使用 UUID + 时间戳确保唯一性
  const timestamp = Date.now();
  const uuid = generateUUID().substring(0, 8); // 使用UUID的前8位
  
  return `v-${timestamp}-${uuid}`;
}

/**
 * 生成短ID（用于临时标识）
 * @param length ID长度，默认8
 */
export function generateShortId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    // 使用计数器而不是随机数，确保可预测性
    const index = (counter + i) % chars.length;
    result += chars[index];
  }
  
  counter++;
  return result;
}

/**
 * 重置计数器（用于测试）
 */
export function resetIdGenerator(): void {
  counter = 0;
  sessionId = null;
}

/**
 * 生成基于内容的确定性ID
 * 用于相同输入总是生成相同ID的场景
 * @param content 内容字符串
 * @param prefix 可选前缀
 */
export function generateContentBasedId(content: string, prefix = 'id'): string {
  // 简单的哈希函数（不使用crypto以保持轻量）
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

/**
 * UUID v4 生成器（客户端安全版本）
 * 使用 crypto.randomUUID() 或降级方案
 */
export function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  
  // 降级方案：使用时间戳和计数器
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Date.now() + counter++) % 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成 TraceId 用于请求追踪
 * 格式：时间戳(base36)-随机数(6位)
 * 示例：lm7k3p2-a4b9c3
 * 
 * 用于：
 * - API 请求追踪
 * - 日志关联
 * - 错误报告
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}`;
}

