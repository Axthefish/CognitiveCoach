// Next.js 中间件 - 统一处理安全头部、日志记录等
// CORS 处理统一使用 lib/cors.ts

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { handleOptions, withCors } from '@/lib/cors';

/**
 * Next.js 中间件配置
 * 
 * 处理顺序：
 * 1. CORS 预检请求（OPTIONS）- 使用 lib/cors.ts
 * 2. 请求日志记录
 * 3. 安全头部设置
 * 4. API 路径特殊处理
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const method = request.method;

  // 1. CORS 预检请求处理 - 统一使用 lib/cors.ts
  if (method === 'OPTIONS') {
    return handleOptions(request);
  }

  // 2. 记录请求日志
  logRequest(request);

  // 3. API 路由特殊处理
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return withCors(response, origin);
  }

  // 4. 其他请求正常通过
  const response = NextResponse.next();
  addSecurityHeaders(response);
  
  return response;
}

/**
 * 添加安全头部
 */
function addSecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
}

/**
 * 记录请求日志
 */
function logRequest(request: NextRequest): void {
  const { pathname, search } = request.nextUrl;
  const method = request.method;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  // 只记录 API 请求和错误请求
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    logger.debug('Incoming request', {
      method,
      pathname,
      search,
      ip: ip.split(',')[0]?.trim() || ip, // 取第一个 IP
      userAgent: userAgent.substring(0, 100), // 限制长度
    });
  }
}

/**
 * 中间件配置
 * 指定哪些路径需要经过中间件处理
 */
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - public 文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

