import { NextResponse } from 'next/server';
import { handleOptions, withCors } from '@/lib/cors';
import { buildRateKey, checkRateLimit } from '@/lib/rate-limit';
import { isHealthProtected, getEnv, hasAIKey } from '@/lib/env-validator';
import { aiResponseCache } from '@/lib/cache-service';

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
    const env = getEnv();
    const token = reqHeaders.get('x-health-token');
    if (token !== env.HEALTH_TOKEN) {
      return withCors(minimal, origin);
    }
  }

  const env = getEnv();
  const hasGeminiKey = !!env.GEMINI_API_KEY;
  const hasGoogleKey = !!env.GOOGLE_AI_API_KEY;
  
  // 获取缓存健康状态
  const cacheHealth = aiResponseCache.getGlobalHealthStatus();
  
  // 计算整体系统健康状态
  const systemStatus = calculateSystemHealth(hasGeminiKey || hasGoogleKey, cacheHealth);
  
  // 获取内存使用情况
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024),
  };

  const res = NextResponse.json({
    status: systemStatus,
    timestamp: new Date().toISOString(),
    environment: {
      hasApiKey: hasAIKey(),
      hasGeminiKey,
      hasGoogleKey,
      nodeVersion: process.version,
      nodeEnv: env.NODE_ENV,
      nextVersion: process.env.NEXT_RUNTIME || 'unknown'
    },
    cache: {
      status: cacheHealth.overallStatus,
      totalItems: cacheHealth.globalMetrics.totalItems,
      hitRate: Math.round(cacheHealth.globalMetrics.averageHitRate * 100) / 100,
      memoryEstimateMB: Math.round(cacheHealth.globalMetrics.totalMemoryEstimate / 1024 / 1024 * 100) / 100,
      recommendations: cacheHealth.recommendations.length > 0 ? cacheHealth.recommendations : undefined
    },
    memory: memoryUsageMB,
    uptime: Math.floor(process.uptime()),
    checks: {
      apiKey: hasAIKey() ? 'configured' : 'missing',
      cache: cacheHealth.overallStatus,
      memory: memoryUsageMB.heapUsed < 500 ? 'ok' : 'warning' // 500MB threshold
    }
  });
  return withCors(res, origin);
}

/**
 * 计算系统整体健康状态
 */
function calculateSystemHealth(
  hasApiKey: boolean,
  cacheHealth: ReturnType<typeof aiResponseCache.getGlobalHealthStatus>
): 'healthy' | 'degraded' | 'unhealthy' {
  // 如果没有 API 密钥，系统不健康
  if (!hasApiKey) {
    return 'unhealthy';
  }
  
  // 如果缓存处于关键状态，系统降级
  if (cacheHealth.overallStatus === 'critical') {
    return 'degraded';
  }
  
  // 如果缓存有警告，系统降级
  if (cacheHealth.overallStatus === 'warning') {
    return 'degraded';
  }
  
  return 'healthy';
}

export async function OPTIONS(request: NextRequest) {
  // CORS preflight
  return handleOptions(request);
}