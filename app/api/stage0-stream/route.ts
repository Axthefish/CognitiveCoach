/**
 * Stage 0 Streaming API - 展示AI思考过程
 * 
 * 策略：
 * 1. 先streaming输出thinking过程（text）
 * 2. 基于thinking生成JSON结果
 */

import { NextRequest } from 'next/server';
import { generateStreamingText, generateJson } from '@/lib/gemini-config';
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
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  logger.info('[Stage0 Stream API] Received request');
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        const validated = Stage0StreamRequestSchema.parse(body);
        
        // 生成thinking prompt
        const thinkingPrompt = validated.action === 'initial'
          ? `${getInitialCollectionPrompt(validated.userInput || '')}

在生成JSON之前，先用自然语言描述你的思考过程（2-3句话）：
- 你对用户输入的初步理解
- 你打算问什么以及为什么

格式：
<thinking>
你的思考过程...
</thinking>

<json_output>
{...}
</json_output>`
          : `${getDeepDivePrompt(
              validated.conversationHistory as ChatMessage[] || [],
              validated.currentDefinition || {}
            )}

在生成JSON之前，先用自然语言描述你的思考过程（2-3句话）：
- 当前理解的clarity程度
- 还缺少什么关键信息
- 下一步打算问什么

格式：
<thinking>
你的思考过程...
</thinking>

<json_output>
{...}
</json_output>`;

        // Streaming输出thinking
        let fullText = '';
        let isInThinking = false;
        
        const result = await generateStreamingText(
          thinkingPrompt,
          (chunk) => {
            fullText += chunk;
            
            // 检测<thinking>标签
            if (fullText.includes('<thinking>') && !isInThinking) {
              isInThinking = true;
            }
            
            if (isInThinking && !fullText.includes('</thinking>')) {
              // 实时发送thinking内容
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'thinking',
                  text: chunk,
                })}\n\n`)
              );
            }
          },
          getStage0GenerationConfig(),
          'Pro'
        );
        
        if (!result.ok) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: result.error,
            })}\n\n`)
          );
          controller.close();
          return;
        }
        
        // 提取JSON部分
        const jsonMatch = result.fullText.match(/<json_output>\s*(\{[\s\S]*?\})\s*<\/json_output>/);
        
        if (!jsonMatch) {
          // 降级：直接用JSON mode重新生成
          logger.warn('[Stage0 Stream] No JSON found in streaming output, falling back');
          
          const jsonPrompt = validated.action === 'initial'
            ? getInitialCollectionPrompt(validated.userInput || '')
            : getDeepDivePrompt(
                validated.conversationHistory as ChatMessage[] || [],
                validated.currentDefinition || {}
              );
          
          const jsonResult = await generateJson(
            jsonPrompt,
            getStage0GenerationConfig(),
            'Pro',
            'S0'
          );
          
          if (jsonResult.ok) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'data',
                data: jsonResult.data,
              })}\n\n`)
            );
          } else {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: 'JSON generation failed',
              })}\n\n`)
            );
          }
        } else {
          // 发送JSON数据
          try {
            const jsonData = JSON.parse(jsonMatch[1]);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'data',
                data: jsonData,
              })}\n\n`)
            );
          } catch (parseError) {
            logger.error('[Stage0 Stream] JSON parse failed', { parseError });
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: 'Invalid JSON in response',
              })}\n\n`)
            );
          }
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

