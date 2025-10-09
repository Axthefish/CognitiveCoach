/**
 * Service 层共享工具函数
 * 
 * 职责：
 * - 统一的 Schema 验证错误处理
 * - 统一的 QA 验证失败处理
 * - Service 层通用逻辑抽取
 * 
 * 使用场景：
 * - services/s1-service.ts
 * - services/s2-service.ts
 * - services/s4-service.ts
 */

import { z } from 'zod';
import { logger } from './logger';
import { createStageError, AppError, ErrorCodes } from './app-errors';
import { translateSchemaError, formatErrorForLogging } from './schema-error-translator';
import type { QualityGateResult } from './qa';

/**
 * 统一处理 Schema 验证错误
 * 
 * @param result - Zod safeParse 的结果
 * @param stage - 当前阶段标识（如 's1', 's2', 's4'）
 * @param data - 原始数据（用于错误详情）
 * @returns 验证成功返回数据，失败则抛出异常
 * 
 * @example
 * ```typescript
 * const validationResult = KnowledgeFrameworkSchema.safeParse(result.data);
 * const framework = handleSchemaValidation(validationResult, 's1', result.data);
 * ```
 */
export function handleSchemaValidation<T>(
  result: z.SafeParseReturnType<unknown, T>,
  stage: 's0' | 's1' | 's2' | 's3' | 's4',
  data?: unknown
): T {
  if (result.success) {
    return result.data;
  }

  // 生成用户友好的错误消息
  const translation = translateSchemaError(result.error, stage);
  
  // 记录详细的技术日志
  logger.error('Schema validation failed:', formatErrorForLogging(result.error, stage));
  
  // 根据阶段抛出相应的错误
  const stageErrorCreators = {
    s0: createStageError.s0,
    s1: createStageError.s1,
    s2: createStageError.s2,
    s3: createStageError.s3,
    s4: createStageError.s4,
  };
  
  throw stageErrorCreators[stage](translation.userMessage, {
    suggestions: translation.suggestions,
    technicalDetails: translation.technicalDetails,
    receivedData: data,
  });
}

/**
 * 通用对象验证 - 检查数据是否为有效对象
 * 
 * @param data - 待验证的数据
 * @returns 如果是有效对象返回类型安全的对象，否则返回 null
 * 
 * @example
 * ```typescript
 * const obj = validateObject(data);
 * if (!obj) return false;
 * ```
 */
export function validateObject(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  return data as Record<string, unknown>;
}

/**
 * 验证字符串字段
 * 
 * @param obj - 包含字段的对象
 * @param field - 字段名
 * @param options - 验证选项
 * @returns 验证是否通过
 * 
 * @example
 * ```typescript
 * if (!validateStringField(obj, 'title', { required: true, minLength: 1 })) {
 *   return false;
 * }
 * ```
 */
export function validateStringField(
  obj: Record<string, unknown>,
  field: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  } = {}
): boolean {
  const value = obj[field];
  
  // 检查必需性
  if (options.required !== false) {
    if (typeof value !== 'string' || !value) return false;
  } else if (value === undefined || value === null) {
    return true; // 可选字段，未提供时通过
  }
  
  // 类型检查
  if (typeof value !== 'string') return false;
  
  // 长度检查
  if (options.minLength !== undefined && value.length < options.minLength) {
    return false;
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return false;
  }
  
  return true;
}

/**
 * 验证数组字段
 * 
 * @param obj - 包含字段的对象
 * @param field - 字段名
 * @param options - 验证选项
 * @returns 验证是否通过
 * 
 * @example
 * ```typescript
 * if (!validateArrayField(obj, 'items', { required: true, minLength: 1 })) {
 *   return false;
 * }
 * ```
 */
export function validateArrayField(
  obj: Record<string, unknown>,
  field: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    elementValidator?: (element: unknown, index: number) => boolean;
  } = {}
): boolean {
  const value = obj[field];
  
  // 检查必需性
  if (options.required !== false) {
    if (!Array.isArray(value)) return false;
  } else if (value === undefined || value === null) {
    return true; // 可选字段，未提供时通过
  }
  
  // 类型检查
  if (!Array.isArray(value)) return false;
  
  // 长度检查
  if (options.minLength !== undefined && value.length < options.minLength) {
    return false;
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return false;
  }
  
  // 元素验证
  if (options.elementValidator) {
    return value.every((element, index) => 
      options.elementValidator!(element, index)
    );
  }
  
  return true;
}

/**
 * 验证布尔字段
 * 
 * @param obj - 包含字段的对象
 * @param field - 字段名
 * @param required - 是否必需
 * @returns 验证是否通过
 */
export function validateBooleanField(
  obj: Record<string, unknown>,
  field: string,
  required = false
): boolean {
  const value = obj[field];
  
  if (!required && (value === undefined || value === null)) {
    return true;
  }
  
  return typeof value === 'boolean';
}

/**
 * 验证数字字段
 * 
 * @param obj - 包含字段的对象
 * @param field - 字段名
 * @param options - 验证选项
 * @returns 验证是否通过
 */
export function validateNumberField(
  obj: Record<string, unknown>,
  field: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
  } = {}
): boolean {
  const value = obj[field];
  
  if (!options.required && (value === undefined || value === null)) {
    return true;
  }
  
  if (typeof value !== 'number') return false;
  
  if (options.min !== undefined && value < options.min) return false;
  if (options.max !== undefined && value > options.max) return false;
  
  return true;
}

/**
 * 统一处理 QA 验证失败
 * 
 * 当质量门控检查失败时，记录警告日志并抛出统一的错误。
 * 此函数提取了 S1/S2/S4 Service 中重复的 16 行 QA 处理代码。
 * 
 * @param qaResult - QA 验证结果
 * @param stage - 当前阶段标识
 * @throws AppError 如果 QA 验证未通过
 * 
 * @example
 * ```typescript
 * const qaResult = runQualityGates('S1', framework);
 * handleQAValidation(qaResult, 'S1');
 * // 如果验证失败，会抛出异常；否则继续执行
 * ```
 */
export function handleQAValidation(
  qaResult: QualityGateResult,
  stage: 'S1' | 'S2' | 'S3' | 'S4'
): void {
  if (!qaResult.passed) {
    logger.warn('Quality gates failed:', qaResult.issues);
    throw new AppError({
      code: ErrorCodes.QA_VALIDATION_FAILED,
      message: 'Quality gates failed',
      statusCode: 400,
      details: qaResult.issues,
      fixHints: qaResult.issues.map((i) => i.hint),
      stage,
    });
  }
}
