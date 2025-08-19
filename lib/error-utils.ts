import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serializeErrorDetailsSecurely } from './app-errors';

export interface APIError {
  status: 'error';
  error: string;
  details?: string;
  fixHints?: string[];
  stage?: string;
}

export interface APISuccess<T = unknown> {
  status: 'success';
  data: T;
}

export type APIResponse<T = unknown> = APISuccess<T> | APIError;

export function createErrorResponse(
  message: string, 
  statusCode: number = 500,
  options?: {
    details?: string;
    fixHints?: string[];
    stage?: string;
  }
): NextResponse<APIError> {
  return NextResponse.json({
    status: 'error',
    error: message,
    ...options
  }, { status: statusCode });
}

export function createSuccessResponse<T>(data: T): NextResponse<APISuccess<T>> {
  return NextResponse.json({
    status: 'success',
    data
  });
}

export function safeJSONParse<T>(text: string): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (error) {
    const message = error instanceof SyntaxError 
      ? `Invalid JSON response: ${error.message}` 
      : 'Failed to parse response';
    return { success: false, error: message };
  }
}

export function formatSchemaError(error: z.ZodError): { message: string; fixHints: string[] } {
  const issues = error.issues.map(issue => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });
  
  const fixHints = error.issues.map(issue => {
    switch (issue.code) {
      case 'invalid_type':
        return `确保 ${issue.path.join('.')} 是 ${issue.expected} 类型`;
      case 'too_small':
        return `${issue.path.join('.')} 需要至少 ${issue.minimum} 个元素`;
      case 'invalid_value':
        return `${issue.path.join('.')} 的取值不合法，请检查可选项或格式`;
      default:
        return `修复 ${issue.path.join('.')}: ${issue.message}`;
    }
  });

  return {
    message: `Schema validation failed: ${issues.join('; ')}`,
    fixHints
  };
}

export function handleAPIError(error: unknown, stage?: string): NextResponse<APIError> {
  console.error(`API Error in ${stage || 'unknown stage'}:`, error);
  
  if (error instanceof z.ZodError) {
    const { message, fixHints } = formatSchemaError(error);
    return createErrorResponse(message, 400, { fixHints, stage });
  }
  
  if (error instanceof Error) {
    return createErrorResponse(error.message, 500, { 
      details: serializeErrorDetailsSecurely(error.stack, true), // 安全处理堆栈信息
      stage 
    });
  }
  
  return createErrorResponse('Unknown error occurred', 500, { stage });
}
