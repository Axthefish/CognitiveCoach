/**
 * Stage 0 Streaming API - 真实思考过程展示
 * 
 * 设计理念：
 * - 两阶段输出：先streaming思考过程，再生成JSON结果
 * - 参考Cursor：展示真实的AI推理，增强可信度
 * - 参考Anthropic：给模型自主判断空间，通过上下文工程引导而非硬编码规则
 */

import { NextRequest } from 'next/server';
import { generateJson, generateStreamingText } from '@/lib/gemini-config';
import { 
  getThinkingPrompt, 
  getStructuredOutputPrompt, 
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
export const maxDuration = 45; // 给thinking + JSON两阶段足够时间

export async function POST(request: NextRequest) {
  logger.info('[Stage0 Stream API] Received request');
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        const validated = Stage0StreamRequestSchema.parse(body);
        
        // 阶段1：生成思考过程（streaming）
        const thinkingPrompt = getThinkingPrompt(
          validated.action,
          validated.userInput,
          validated.conversationHistory as ChatMessage[] || [],
          validated.currentDefinition || {}
        );
        
        logger.info('[Stage0 Stream] Phase 1: Generating thinking process');
        
        const thinkingResult = await generateStreamingText(
          thinkingPrompt,
          (chunk) => {
            // 实时发送思考文本
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'thinking',
                text: chunk,
              })}\n\n`)
            );
          },
          {
            temperature: 0.8, // 思考过程可以更自然
            maxOutputTokens: 1000,
          },
          'Pro'
        );
        
        if (!thinkingResult.ok) {
          throw new Error(`Thinking generation failed: ${thinkingResult.error}`);
        }
        
        // 发送thinking完成信号
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'thinking_done',
          })}\n\n`)
        );
        
        // 阶段2：基于思考生成结构化结果（JSON mode）
        logger.info('[Stage0 Stream] Phase 2: Generating structured output');
        
        const structuredPrompt = getStructuredOutputPrompt(
          validated.action,
          validated.userInput,
          validated.conversationHistory as ChatMessage[] || [],
          validated.currentDefinition || {},
          thinkingResult.fullText // 传入思考过程作为上下文
        );
        
        const result = await generateJson(
          structuredPrompt,
          getStage0GenerationConfig(),
          'Pro',
          'S0'
        );
        
        if (result.ok) {
          // 发送结构化数据
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

