/**
 * Stage 0 Streaming API - Decoupled thinking + JSON
 * 
 * 设计理念：
 * - 解耦思考流和JSON生成：两者并行运行
 * - 思考流：轻量级文本流，提供实时UX反馈
 * - JSON生成：独立一次性调用，保证结构化输出可靠性
 * - 参考Cursor：展示真实推理，但保持简单可靠
 * - 参考Anthropic：给模型自主判断空间 + 紧凑化上下文
 */

import { NextRequest } from 'next/server';
import { generateJson, generateTextStream } from '@/lib/gemini-config';
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
export const maxDuration = 120; // 为thinking mode预留足够时间（Gemini思考+生成需要更多时间）

export async function POST(request: NextRequest) {
  logger.info('[Stage0 Stream API] Received request');
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        const validated = Stage0StreamRequestSchema.parse(body);
        
        // 生成JSON prompt（用于结构化输出）
        const jsonPrompt = validated.action === 'initial'
          ? getInitialCollectionPrompt(validated.userInput || '')
          : getDeepDivePrompt(
              validated.conversationHistory as ChatMessage[] || [],
              validated.currentDefinition || {}
            );
        
        // 生成thinking prompt（轻量级思考流，不输出最终JSON）
        const thinkingPrompt = jsonPrompt + `\n\n<streaming_instruction>
请先输出你的思考过程（简短的推理片段，200-400字），但不要输出最终的JSON结果。
你的思考应该包括：
- 分析用户输入的关键信息
- 推测可能的问题域
- 思考应该问什么问题来深入理解

注意：只输出思考过程的文本，不要输出JSON格式的答案。
</streaming_instruction>`;
        
        logger.info('[Stage0 Stream] Starting parallel thinking stream + JSON generation', {
          promptLength: jsonPrompt.length,
          action: validated.action
        });
        
        let thinkingChunksSent = 0;
        
        // 并行执行：思考流 + JSON生成
        const jsonPromise = generateJson<{
          analysis?: { possible_domains?: string[]; possible_purposes?: string[]; initial_clues?: string[] };
          assessment?: { clarity_score?: number; missing_info?: string[]; confidence?: number };
          action?: string;
          next_question?: string;
        }>(
          jsonPrompt,
          getStage0GenerationConfig(),
          'Pro',
          'S0'
        );
        
        const thinkingPromise = (async () => {
          const result = await generateTextStream(
            thinkingPrompt,
            (chunk: string) => {
              thinkingChunksSent++;
              logger.info(`[Stage0 Stream API] Sending thinking chunk #${thinkingChunksSent}`, { 
                length: chunk.length,
                sample: chunk.substring(0, 30)
              });
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'thinking_chunk',
                  text: chunk,
                })}\n\n`)
              );
            },
            {
              ...getStage0GenerationConfig(),
              maxOutputTokens: 1200, // 限制思考流token成本
            },
            'Pro',
            'S0'
          );
          
          if (result.ok) {
            logger.info(`[Stage0 Stream API] Thinking stream completed, sent ${thinkingChunksSent} chunks`);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'thinking_done',
              })}\n\n`)
            );
          } else {
            logger.warn('[Stage0 Stream API] Thinking stream failed (non-critical)', { error: result.error });
            // 思考流失败不影响主流程，依然发送thinking_done
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'thinking_done',
              })}\n\n`)
            );
          }
        })();
        
        // 等待两个promise都完成（或失败）
        const [jsonResult, _] = await Promise.allSettled([jsonPromise, thinkingPromise]);
        
        logger.info('[Stage0 Stream API] Both operations completed', { 
          jsonStatus: jsonResult.status,
          jsonOk: jsonResult.status === 'fulfilled' ? jsonResult.value.ok : false
        });
        
        // 处理JSON结果
        if (jsonResult.status === 'fulfilled' && jsonResult.value.ok) {
          // 成功：发送结构化数据
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'data',
              data: jsonResult.value.data,
            })}\n\n`)
          );
        } else {
          // 失败：发送错误
          const errorMsg = jsonResult.status === 'fulfilled' && !jsonResult.value.ok
            ? jsonResult.value.error 
            : 'JSON generation failed';
          
          logger.error('[Stage0 Stream API] JSON generation failed', { error: errorMsg });
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: errorMsg || 'Generation failed',
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
      'Cache-Control': 'no-store', // 更严格的缓存控制
      'Connection': 'keep-alive',
    },
  });
}

