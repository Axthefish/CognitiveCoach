import { NextResponse } from 'next/server';
import { handleOptions, withCors } from '@/lib/cors';
import { buildRateKey, checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const headers = new Headers(request.headers);
  const origin = headers.get('origin');
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const rl = checkRateLimit(buildRateKey(ip, '/api/rag'));
  if (!rl.allowed) {
    const res = NextResponse.json({ status: 'error', error: 'Too Many Requests' }, { status: 429 });
    res.headers.set('Retry-After', String(rl.retryAfter ?? 60));
    return withCors(res, origin);
  }
  if (process.env.ENABLE_RAG !== 'true') {
    return withCors(
      NextResponse.json(
        { 
          status: 'error', 
          error: 'RAG 功能当前已禁用',
          message: 'Retrieval-Augmented Generation 功能正在开发中',
          code: 'RAG_DISABLED'
        }, 
        { status: 503 }
      ), 
      origin
    );
  }
  
  // RAG 功能尚未实现
  return withCors(
    NextResponse.json(
      { 
        status: 'error', 
        error: 'RAG 检索功能尚未实现',
        message: 'Retrieval-Augmented Generation API 正在开发中，敬请期待',
        code: 'NOT_IMPLEMENTED',
        documentation: 'https://docs.example.com/api/rag'
      }, 
      { status: 501 }
    ), 
    origin
  );
}

export async function OPTIONS(request: Request) {
  // Use a more specific type cast instead of any
  return handleOptions({ headers: request.headers } as { headers: Headers });
}


