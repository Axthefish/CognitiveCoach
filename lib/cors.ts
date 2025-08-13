import { NextRequest, NextResponse } from 'next/server';

// Build CORS headers based on ALLOWED_ORIGINS env and incoming Origin
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = (allowedOriginsEnv || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-health-token',
  };

  // 默认仅允许同源：未配置允许域时，不设置 A-C-A-O 头，浏览器同源请求不需要该头
  if (allowedOrigins.length > 0 && origin && allowedOrigins.includes(origin)) {
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


