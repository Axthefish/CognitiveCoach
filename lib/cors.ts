import { NextRequest, NextResponse } from 'next/server';

/**
 * 检查来源是否在允许列表中
 * 支持通配符域名（*.example.com）
 */
function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  // 空列表处理
  if (allowedOrigins.length === 0) {
    // 生产环境：未配置CORS时不允许跨域
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    // 开发环境：允许 localhost 和 127.0.0.1
    return origin.includes('localhost') || origin.includes('127.0.0.1');
  }

  // 检查通配符 *（允许所有源）
  if (allowedOrigins.includes('*')) {
    return true;
  }

  // 精确匹配
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // 通配符域名支持（*.example.com）
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      if (origin.endsWith(domain)) {
        return true;
      }
    }
  }

  return false;
}

// Build CORS headers based on ALLOWED_ORIGINS env and incoming Origin
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = (allowedOriginsEnv || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-health-token, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  // 检查origin是否在允许列表中
  if (origin && isAllowedOrigin(origin, allowedOrigins)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function withCors(response: NextResponse, origin: string | null): NextResponse {
  const headers = buildCorsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export function handleOptions(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const headers = buildCorsHeaders(origin);
  return new NextResponse(null, { status: 204, headers });
}


