import { NextResponse } from 'next/server';
import { createGeminiClient, getApiKey } from '@/lib/gemini-config';
import { getEnv } from '@/lib/env-validator';

export async function GET() {
  try {
    const env = getEnv();
    const apiKey = getApiKey();
    const client = createGeminiClient();
    
    const diagnostics = {
      hasGeminiKey: !!env.GEMINI_API_KEY,
      hasGoogleKey: !!env.GOOGLE_AI_API_KEY,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey?.substring(0, 8) + '...',
      clientCreated: !!client,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
    
    // Test if client can actually make a request
    if (client) {
      try {
        const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Say "API works"');
        diagnostics.testResponse = result.response.text();
        diagnostics.apiStatus = 'working';
      } catch (error) {
        diagnostics.apiStatus = 'error';
        diagnostics.apiError = error instanceof Error ? error.message : 'Unknown error';
      }
    } else {
      diagnostics.apiStatus = 'no_client';
    }
    
    return NextResponse.json(diagnostics);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
