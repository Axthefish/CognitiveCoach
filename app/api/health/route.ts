import { NextResponse } from 'next/server';
import { handleOptions, withCors } from '@/lib/cors';
import { buildRateKey, checkRateLimit } from '@/lib/rate-limit';
import { isHealthProtected } from '@/lib/env';

export async function GET(request: Request) {
  const reqHeaders = new Headers(request.headers);
  const origin = reqHeaders.get('origin');
  const ip = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const rl = checkRateLimit(buildRateKey(ip, '/api/health'));
  if (!rl.allowed) {
    const res = NextResponse.json({ status: 'error', error: 'Too Many Requests' }, { status: 429 });
    res.headers.set('Retry-After', String(rl.retryAfter ?? 60));
    return withCors(res, origin);
  }

  const minimal = NextResponse.json({ status: 'ok' });
  if (isHealthProtected()) {
    const token = reqHeaders.get('x-health-token');
    if (token !== process.env.HEALTH_TOKEN) {
      return withCors(minimal, origin);
    }
  }

  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasGoogleKey = !!process.env.GOOGLE_AI_API_KEY;

  const res = NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      hasGeminiKey,
      hasGoogleKey,
      nodeVersion: process.version,
      nextVersion: process.env.NEXT_RUNTIME || 'unknown'
    }
  });
  return withCors(res, origin);
}

export async function OPTIONS(request: Request) {
  // CORS preflight
  // Narrow Request to NextRequest-like for our helper (we only need headers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handleOptions(request as unknown as any);
}