/**
 * Stage 0 Streaming API - 简化版：直接JSON mode + 前端模拟thinking
 * 
 * 策略优化：
 * - 直接用JSON mode生成（快速、可靠）
 * - Thinking在前端模拟（不需要等AI生成）
 * - 参考Cursor的设计：快速响应 > 炫技
 */

import { NextRequest } from 'next/server';
import { generateJson } from '@/lib/gemini-config';
import { getDeepDivePrompt, getInitialCollectionPrompt, getStage0GenerationConfig } from '@/lib/prompts/stage0-prompts';
import type { ChatMessage } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const Stage0StreamRequestSchema = z.object({
  action: z.enum(['initial', 'continue']),
  userInput: z.string().optional(),
  conversationHistory: z.array(z.any()).optional(),
  currentDefinition: z.any().optional(),
});

export const runtime = 'nodejs';
export const maxDuration = 30; // 降低到30秒

export async function POST(request: NextRequest) {
  logger.info('[Stage0 Stream API] Received request');
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        const validated = Stage0StreamRequestSchema.parse(body);
        
        // 生成简洁的prompt（不要求特殊格式）
        const prompt = validated.action === 'initial'
          ? getInitialCollectionPrompt(validated.userInput || '')
          : getDeepDivePrompt(
              validated.conversationHistory as ChatMessage[] || [],
              validated.currentDefinition || {}
            );

        // 前端模拟thinking效果（立即发送）
        const thinkingMessages = [
          '分析用户输入...',
          '理解问题域...',
          '准备问题...',
        ];
        
        for (const msg of thinkingMessages) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'thinking',
              text: msg,
            })}\n\n`)
          );
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 直接生成JSON（快速、可靠）
        const result = await generateJson(
          prompt,
          getStage0GenerationConfig(),
          'Pro',
          'S0'
        );
        
        if (result.ok) {
          // 发送数据
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'data',
              data: result.data,
            })}\n\n`)
          );
        } else {
          // 发送错误
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: result.error || 'Generation failed',
            })}\n\n`)
          );
        }
        
        // 发送完成信号
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        );
        
        controller.close();
      } catch (error) {
        logger.error('[Stage0 Stream API] Error', { error });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Stream failed',
          })}\n\n`)
        );
        controller.close();
      }
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

