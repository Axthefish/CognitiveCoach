import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasGoogleKey = !!process.env.GOOGLE_AI_API_KEY;
  
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      hasGeminiKey,
      hasGoogleKey,
      nodeVersion: process.version,
      nextVersion: process.env.NEXT_RUNTIME || 'unknown'
    }
  });
}