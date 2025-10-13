/**
 * Stage 1 Streaming API - 带思考过程展示
 */

import { NextRequest } from 'next/server';
import { Stage1Service } from '@/services/stage1-service';
import type { PurposeDefinition } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { THINKING_STEPS, type ThinkingStep } from '@/lib/streaming-types';

const Stage1StreamRequestSchema = z.object({
  purposeDefinition: z.object({
    clarifiedPurpose: z.string(),
    problemDomain: z.string(),
    domainBoundary: z.string(),
    boundaryConstraints: z.array(z.string()),
    personalConstraints: z.array(z.string()),
  }),
  runTier: z.enum(['Lite', 'Pro']).optional(),
});

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  logger.info('[Stage1 Stream API] Received request');
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 解析请求
        const body = await request.json();
        const validated = Stage1StreamRequestSchema.parse(body);
        
        // 辅助函数：发送思考进度
        const sendThinking = (step: ThinkingStep) => {
          const stepInfo = THINKING_STEPS[step];
          const event = {
            type: 'thinking',
            thinking: {
              step,
              message: stepInfo.message,
              progress: stepInfo.progress,
              timestamp: Date.now(),
            },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        };
        
        // 发送初始思考步骤
        const steps: ThinkingStep[] = [
          'analyzing_domain',
          'designing_structure',
          'calculating_weights',
          'building_dependencies',
          'optimizing_path',
          'generating_json',
          'validating_output',
        ];
        
        // 逐步发送进度（模拟思考过程）
        let currentStepIndex = 0;
        const progressInterval = setInterval(() => {
          if (currentStepIndex < steps.length - 2) {
            sendThinking(steps[currentStepIndex]);
            currentStepIndex++;
          }
        }, 8000); // 每8秒一个步骤
        
        // 发送第一个步骤
        sendThinking(steps[0]);
        
        try {
          // 实际生成框架（这是主要耗时操作）
          const service = Stage1Service.getInstance();
          const result = await service.generateFramework(
            validated.purposeDefinition as PurposeDefinition,
            validated.runTier || 'Pro'
          );
          
          // 清除进度定时器
          clearInterval(progressInterval);
          
          // 发送最后两个步骤
          sendThinking('generating_json');
          await new Promise(resolve => setTimeout(resolve, 500));
          sendThinking('validating_output');
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 解析结果
          const resultData = await result.json();
          
          if (resultData.success && resultData.data) {
            // 发送最终数据
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'data',
                  data: resultData.data,
                })}\n\n`
              )
            );
            
            // 发送完成信号
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
            );
          } else {
            // 发送错误
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  error: resultData.message || 'Framework generation failed',
                })}\n\n`
              )
            );
          }
        } catch (error) {
          clearInterval(progressInterval);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              })}\n\n`
            )
          );
        }
        
        controller.close();
      } catch (error) {
        logger.error('[Stage1 Stream API] Error', { error });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Stream setup failed',
            })}\n\n`
          )
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

