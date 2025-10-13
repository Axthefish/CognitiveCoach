/**
 * Input Validator - 输入验证和清理
 * 
 * 提供：
 * - XSS防护
 * - 长度限制
 * - 内容过滤
 * - 格式验证
 */

import { logger } from './logger';

// ============================================
// 配置
// ============================================

export const VALIDATION_RULES = {
  // 文本输入
  TEXT_MIN_LENGTH: 2,
  TEXT_MAX_LENGTH: 2000,
  
  // 用户目标描述
  USER_GOAL_MIN_LENGTH: 10,
  USER_GOAL_MAX_LENGTH: 1000,
  
  // 对话消息
  CHAT_MESSAGE_MIN_LENGTH: 1,
  CHAT_MESSAGE_MAX_LENGTH: 2000,
} as const;

// ============================================
// 错误类型
// ============================================

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================
// XSS防护
// ============================================

/**
 * 移除潜在的XSS攻击代码
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';
  
  return input
    // 移除script标签
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // 移除iframe
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    // 移除on*事件处理器
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    // 移除javascript:协议
    .replace(/javascript:/gi, '')
    // 移除data:协议（可能包含恶意代码）
    .replace(/data:text\/html/gi, '');
}

/**
 * 完全移除HTML标签
 */
export function stripHTML(input: string): string {
  if (!input) return '';
  
  return input.replace(/<[^>]+>/g, '');
}

// ============================================
// 内容验证
// ============================================

/**
 * 验证文本长度
 */
export function validateLength(
  input: string,
  minLength: number,
  maxLength: number,
  fieldName: string = '输入'
): string {
  const trimmed = input.trim();
  
  if (trimmed.length < minLength) {
    throw new ValidationError(
      `${fieldName}至少需要${minLength}个字符`,
      fieldName
    );
  }
  
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName}不能超过${maxLength}个字符`,
      fieldName
    );
  }
  
  return trimmed;
}

/**
 * 检测垃圾内容
 */
export function detectSpam(input: string): boolean {
  if (!input) return false;
  
  const spamPatterns = [
    // 重复字符超过10次
    /(.)\1{10,}/,
    // 全是数字或特殊字符
    /^[\d\s!@#$%^&*()_+\-=\[\]{}|;:,.<>?\/]+$/,
    // URL spam（超过3个URL）
    /(https?:\/\/[^\s]+.*?){4,}/gi,
  ];
  
  return spamPatterns.some(pattern => pattern.test(input));
}

/**
 * 检测恶意内容
 */
export function detectMalicious(input: string): boolean {
  if (!input) return false;
  
  const maliciousPatterns = [
    // SQL注入尝试
    /(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b)/i,
    // 命令注入尝试
    /[;&|`$(){}[\]<>]/,
    // 路径遍历
    /\.\.[\/\\]/,
  ];
  
  return maliciousPatterns.some(pattern => pattern.test(input));
}

// ============================================
// 综合验证函数
// ============================================

export interface ValidationOptions {
  minLength?: number;
  maxLength?: number;
  fieldName?: string;
  allowHTML?: boolean;
  checkSpam?: boolean;
  checkMalicious?: boolean;
}

/**
 * 验证并清理用户输入
 */
export function validateInput(
  input: string,
  options: ValidationOptions = {}
): string {
  const {
    minLength = VALIDATION_RULES.TEXT_MIN_LENGTH,
    maxLength = VALIDATION_RULES.TEXT_MAX_LENGTH,
    fieldName = '输入',
    allowHTML = false,
    checkSpam = true,
    checkMalicious = true,
  } = options;
  
  // 1. 基础检查
  if (!input || typeof input !== 'string') {
    throw new ValidationError(`${fieldName}不能为空`, fieldName);
  }
  
  // 2. 清理HTML
  let cleaned = allowHTML ? sanitizeHTML(input) : stripHTML(input);
  
  // 3. 验证长度
  cleaned = validateLength(cleaned, minLength, maxLength, fieldName);
  
  // 4. 检测垃圾内容
  if (checkSpam && detectSpam(cleaned)) {
    logger.warn('[Validator] Spam detected', { input: cleaned.substring(0, 50) });
    throw new ValidationError(
      `${fieldName}包含无效内容，请重新输入`,
      fieldName
    );
  }
  
  // 5. 检测恶意内容
  if (checkMalicious && detectMalicious(cleaned)) {
    logger.warn('[Validator] Malicious content detected', { input: cleaned.substring(0, 50) });
    throw new ValidationError(
      `${fieldName}包含不允许的字符，请重新输入`,
      fieldName
    );
  }
  
  return cleaned;
}

// ============================================
// 特定场景的验证函数
// ============================================

/**
 * 验证用户目标描述
 */
export function validateUserGoal(goal: string): string {
  return validateInput(goal, {
    minLength: VALIDATION_RULES.USER_GOAL_MIN_LENGTH,
    maxLength: VALIDATION_RULES.USER_GOAL_MAX_LENGTH,
    fieldName: '目标描述',
    allowHTML: false,
    checkSpam: true,
    checkMalicious: true,
  });
}

/**
 * 验证聊天消息
 */
export function validateChatMessage(message: string): string {
  return validateInput(message, {
    minLength: VALIDATION_RULES.CHAT_MESSAGE_MIN_LENGTH,
    maxLength: VALIDATION_RULES.CHAT_MESSAGE_MAX_LENGTH,
    fieldName: '消息',
    allowHTML: false,
    checkSpam: true,
    checkMalicious: true,
  });
}

/**
 * 验证用户回答（Stage 2）
 */
export function validateUserAnswer(answer: string): string {
  return validateInput(answer, {
    minLength: 1,
    maxLength: 1000,
    fieldName: '回答',
    allowHTML: false,
    checkSpam: true,
    checkMalicious: true,
  });
}

// ============================================
// 辅助函数
// ============================================

/**
 * 安全地获取输入的前N个字符（用于日志）
 */
export function safeSubstring(input: string, length: number = 50): string {
  if (!input) return '';
  const truncated = input.substring(0, length);
  return truncated + (input.length > length ? '...' : '');
}

/**
 * 检查输入是否安全
 */
export function isInputSafe(input: string): boolean {
  try {
    validateInput(input, {
      minLength: 1,
      maxLength: 2000,
      checkSpam: true,
      checkMalicious: true,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 批量验证输入
 */
export function validateInputs(
  inputs: Record<string, string>,
  rules: Record<string, ValidationOptions> = {}
): Record<string, string> {
  const validated: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(inputs)) {
    const options = rules[key] || {};
    validated[key] = validateInput(value, {
      fieldName: key,
      ...options,
    });
  }
  
  return validated;
}

