/**
 * Stage 0 Streaming API - 简化可靠版
 * 
 * 设计理念：
 * - 单次JSON生成，但在响应中包含thinking字段
 * - 通过streaming逐字展示thinking，然后显示结果
 * - 参考Cursor：展示真实推理，但保持简单可靠
 * - 参考Anthropic：给模型自主判断空间
 */

import { NextRequest } from 'next/server';
import { generateJson } from '@/lib/gemini-config';
import { 
  getInitialCollectionPrompt,
  getDeepDivePrompt, 
  getStage0GenerationConfig 
} from '@/lib/prompts/stage0-prompts';
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
export const maxDuration = 30; // 单次生成，30秒足够

export async function POST(request: NextRequest) {
  logger.info('[Stage0 Stream API] Received request');
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        const validated = Stage0StreamRequestSchema.parse(body);
        
        // 生成prompt（包含thinking要求）
        const prompt = validated.action === 'initial'
          ? getInitialCollectionPrompt(validated.userInput || '')
          : getDeepDivePrompt(
              validated.conversationHistory as ChatMessage[] || [],
              validated.currentDefinition || {}
            );
        
        logger.info('[Stage0 Stream] Generating response with thinking');
        
        // 生成包含thinking的JSON
        const result = await generateJson(
          prompt,
          getStage0GenerationConfig(),
          'Pro',
          'S0'
        );
        
        if (result.ok) {
          const data = result.data as Record<string, unknown>;
          
          // 如果有thinking字段，一次性发送完整thinking（前端做打字效果）
          if (data.thinking && typeof data.thinking === 'string') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'thinking',
                text: data.thinking, // 完整发送
              })}\n\n`)
            );
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'thinking_done',
              })}\n\n`)
            );
          }
          
          // 发送结构化数据
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'data',
              data: data,
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

