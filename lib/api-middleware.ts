/**
 * API Middleware - 共享的API路由处理逻辑
 * 
 * 用途：
 * - 统一rate limiting检查
 * - 统一CORS处理
 * - 统一schema验证
 * - 减少/api/coach和/api/coach-stream的重复代码
 */

import { NextRequest } from 'next/server';
import { CoachRequestSchema } from '@/lib/schemas';
import { buildRateKey, checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import type { CoachRequest } from '@/lib/api-types';

/**
 * 请求验证结果
 */
export interface ValidationResult {
  valid: boolean;
  request?: CoachRequest;
  error?: {
    code: string;
    message: string;
    issues?: Array<{ path: string; message: string }>;
  };
}

/**
 * Rate limit检查结果
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  rateKey: string;
}

/**
 * 提取请求元信息
 */
export function extractRequestInfo(request: NextRequest) {
  const origin = request.headers.get('origin');
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  
  return { origin, ip };
}

/**
 * 检查rate limiting
 */
export function checkRequestRateLimit(ip: string | null, endpoint: string): RateLimitResult {
  const rateKey = buildRateKey(ip, endpoint);
  const rl = checkRateLimit(rateKey);
  
  return {
    allowed: rl.allowed,
    retryAfter: rl.retryAfter,
    rateKey,
  };
}

/**
 * 验证请求body schema
 */
export async function validateRequestBody(request: NextRequest): Promise<ValidationResult> {
  try {
    const json = await request.json();
    
    // 记录请求（生产环境不包含敏感数据）
    logger.debug('Received request body:', { action: json?.action });
    
    const parsed = CoachRequestSchema.safeParse(json);
    
    if (!parsed.success) {
      // 记录验证失败
      logger.error('Schema validation failed:', {
        action: json?.action,
        errorCount: parsed.error.issues.length,
        firstError: parsed.error.issues[0]?.message
      });
      
      const issues = parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message
      }));
      
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求格式不正确，请检查您的输入并重试',
          issues,
        },
      };
    }
    
    return {
      valid: true,
      request: parsed.data as unknown as CoachRequest,
    };
  } catch (error) {
    logger.error('Failed to parse request body:', error);
    return {
      valid: false,
      error: {
        code: 'PARSE_ERROR',
        message: '无法解析请求数据',
      },
    };
  }
}

/**
 * 记录API请求完成
 */
export function logRequestCompletion(
  action: string,
  startTime: number,
  status: number,
  ip: string | null
) {
  const duration = Date.now() - startTime;
  
  logger.info('API request completed', {
    action,
    duration,
    status,
    ip: ip ? ip.substring(0, 10) + '...' : 'unknown',
  });
  
  // 如果响应时间过长，记录警告
  if (duration > 30000) { // 30秒
    logger.warn('Slow API response', {
      action,
      duration,
      threshold: 30000
    });
  }
}

/**
 * 创建SSE响应头
 * 用于流式API的统一响应头设置
 */
export function createSSEHeaders(corsHeaders: Record<string, string> = {}) {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...corsHeaders,
  };
}

