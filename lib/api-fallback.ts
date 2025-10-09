/**
 * API Fallback 处理 - 统一处理 API 密钥缺失和服务不可用场景
 * 
 * 职责：
 * - 检测和处理 NO_API_KEY 错误
 * - 为不同阶段提供优雅降级响应
 * - S0 特殊处理：返回默认澄清问题而非错误
 * 
 * 使用场景：
 * - 所有 Service 层（S0-S4）在 AI 调用失败时使用
 * - 开发环境未配置 API Key 时的友好提示
 * 
 * 注意：
 * - 此文件保持独立，不合并到 error-utils.ts
 * - 原因：功能单一、多处使用、业务逻辑清晰
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * 当 API 密钥缺失时的统一 fallback 响应
 * 用于各个 service 层统一处理 NO_API_KEY 错误
 */
export function createNoApiKeyResponse(stage: string): NextResponse {
  logger.warn(`NO_API_KEY fallback triggered for stage: ${stage}`);
  
  return NextResponse.json({
    status: 'error',
    error: '服务暂时不可用，请检查配置',
    code: 'SERVICE_UNAVAILABLE',
    stage,
    details: process.env.NODE_ENV === 'development' 
      ? 'AI API key is not configured. Please set GEMINI_API_KEY in your environment variables.'
      : undefined
  }, { status: 503 });
}

/**
 * S0 阶段的特殊 fallback - 返回默认澄清问题
 */
export function createS0FallbackResponse(): NextResponse {
  logger.info('Using S0 fallback response due to missing API key');
  
  return NextResponse.json({
    status: 'success',
    data: {
      status: 'clarification_needed',
      ai_question: '为加速明确目标，请一次性回答：1) 具体学习主题；2) 期望产出；3) 时间范围。（若已有部分明确，仅补充缺失项即可。）'
    }
  });
}

/**
 * 检查 API 调用结果，如果是 NO_API_KEY 错误则返回 fallback
 * @param result AI 调用结果
 * @param stage 当前阶段
 * @param customFallback 自定义 fallback 函数（可选）
 * @returns NextResponse 或 null（表示没有 NO_API_KEY 错误）
 */
export function handleNoApiKeyResult(
  result: { ok: boolean; error?: string },
  stage: string,
  customFallback?: () => NextResponse
): NextResponse | null {
  if (!result.ok && result.error === 'NO_API_KEY') {
    if (customFallback) {
      return customFallback();
    }
    
    // S0 阶段使用特殊的 fallback
    if (stage.toLowerCase() === 's0') {
      return createS0FallbackResponse();
    }
    
    // 其他阶段使用通用的服务不可用响应
    return createNoApiKeyResponse(stage);
  }
  
  return null;
}
