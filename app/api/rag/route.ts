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
    return withCors(NextResponse.json({ status: 'error', error: 'RAG disabled' }, { status: 404 }), origin);
  }
  const res = NextResponse.json({ status: 'ok', items: [], todo: 'Implement RAG retrieval' });
  return withCors(res, origin);
}

export async function OPTIONS(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handleOptions(request as unknown as any);
}


