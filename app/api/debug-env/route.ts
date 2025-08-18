import { NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import { getApiKey, createGeminiClient, getModelName } from '@/lib/gemini-config';
import { generateJson } from '@/lib/gemini-config';

export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  
  try {
    // 检查环境变量
    const envCheck = {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_AI_API_KEY,
      apiKeyPresent: !!getApiKey(),
      allowedOrigins: process.env.ALLOWED_ORIGINS || 'Not configured',
      nodeEnv: process.env.NODE_ENV,
      modelName: getModelName(),
      liteModelName: getModelName('Lite'),
      vercelUrl: process.env.VERCEL_URL,
      timestamp: new Date().toISOString()
    };
    
    // 测试 Gemini 客户端
    const client = createGeminiClient();
    const clientStatus = client ? 'Initialized' : 'Failed';
    
    // 尝试一个简单的 AI 调用
    let aiTestResult = 'Not tested';
    if (client) {
      try {
        const testPrompt = 'Return this JSON exactly: {"test": "success"}';
        const result = await generateJson<{test: string}>(testPrompt, { maxOutputTokens: 100 });
        aiTestResult = result.ok ? 'Success' : `Failed: ${result.error}`;
      } catch (error) {
        aiTestResult = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
    
    const debugInfo = {
      environment: envCheck,
      geminiClient: clientStatus,
      aiTest: aiTestResult,
      corsHeaders: {
        origin: origin || 'No origin',
        willSetCors: !!origin
      }
    };
    
    const res = NextResponse.json({
      status: 'ok',
      debug: debugInfo
    });
    
    return withCors(res, origin);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    const res = NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
    
    return withCors(res, origin);
  }
}

export async function OPTIONS(request: Request) {
  const headers = request.headers;
  const origin = headers.get('origin');
  
  const response = new NextResponse(null, { status: 204 });
  
  // 处理 CORS
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return response;
}
