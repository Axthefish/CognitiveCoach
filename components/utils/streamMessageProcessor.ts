/**
 * Stream Message Processor - 流式消息处理工具
 * 
 * 职责：
 * - 处理不同类型的SSE消息
 * - 提取和转换消息数据
 * - 错误消息的友好转换
 * 
 * 使用场景：
 * - useStreamConnection hook
 */

import type { CognitiveStep } from '@/lib/api-types';
import type { StreamResponseData, StreamPayload } from '@/lib/schemas';
import { toText } from '@/lib/utils';
import { hydrationSafeLog } from '@/lib/hydration-safe';
import { reportError } from '@/lib/app-errors';

export interface StreamMessage {
  type: 'cognitive_step' | 'content_chunk' | 'data_structure' | 'error' | 'done';
  payload: StreamPayload;
}

export interface ProcessMessageOptions {
  onStepsUpdate: (steps: CognitiveStep[]) => void;
  onTipUpdate: (tip: string) => void;
  onContentUpdate: (chunk: string) => void;
  onDataComplete: (data: StreamResponseData) => void;
  onError: (error: string) => void;
  onDone: () => void;
  isMounted: () => boolean;
}

/**
 * 处理单个流式消息
 */
export function processStreamMessage(
  message: StreamMessage,
  options: ProcessMessageOptions
): void {
  const { isMounted } = options;

  // 检查组件是否已卸载
  if (!isMounted()) {
    return;
  }

  switch (message.type) {
    case 'cognitive_step':
      processCognitiveStep(message, options);
      break;

    case 'content_chunk':
      processContentChunk(message, options);
      break;

    case 'data_structure':
      processDataStructure(message, options);
      break;

    case 'error':
      processError(message, options);
      break;

    case 'done':
      processDone(options);
      break;

    default:
      if (process.env.NODE_ENV === 'development') {
        reportError(new Error(`Unknown stream message type: ${message.type}`), {
          context: 'processStreamMessage',
          messageType: message.type
        });
      }
      break;
  }
}

/**
 * 处理认知步骤消息
 */
function processCognitiveStep(
  message: StreamMessage,
  options: ProcessMessageOptions
): void {
  const { onStepsUpdate, onTipUpdate, isMounted } = options;

  if (!isMounted()) return;

  if (message.payload && typeof message.payload === 'object' && 'steps' in message.payload) {
    const steps = message.payload.steps as CognitiveStep[];
    onStepsUpdate(steps);
  }

  if (message.payload && typeof message.payload === 'object' && 'tip' in message.payload) {
    const tip = message.payload.tip as string;
    onTipUpdate(tip);
  }
}

/**
 * 处理内容块消息
 */
function processContentChunk(
  message: StreamMessage,
  options: ProcessMessageOptions
): void {
  const { onContentUpdate, isMounted } = options;

  if (!isMounted()) return;

  const chunk = message.payload as string;
  onContentUpdate(chunk);
}

/**
 * 处理数据结构消息（最终结果）
 */
function processDataStructure(
  message: StreamMessage,
  options: ProcessMessageOptions
): void {
  const { onDataComplete, onError, isMounted } = options;

  if (!isMounted()) return;

  hydrationSafeLog('📊 Processing data_structure message:', message.payload);

  // 提取最终数据：兼容 { status, data } 包装或直接数据
  if (message.payload && typeof message.payload === 'object' && 'status' in message.payload) {
    const wrapped = message.payload as { status: string; data?: StreamResponseData; error?: string };
    hydrationSafeLog('📦 Wrapped data structure:', wrapped);

    if (wrapped.status === 'success' && wrapped.data) {
      hydrationSafeLog('✅ Setting final data and calling onComplete');
      onDataComplete(wrapped.data);
    } else if (wrapped.error) {
      const errorMsg = toText(wrapped.error) || '处理过程中出现错误';
      onError(errorMsg);
    }
  } else if (message.payload && typeof message.payload === 'object' && 'error' in message.payload) {
    const errorMsg = toText((message.payload as Record<string, unknown>).error) || '处理过程中出现错误';
    onError(errorMsg);
  } else {
    onDataComplete(message.payload as StreamResponseData);
  }
}

/**
 * 处理错误消息
 */
function processError(
  message: StreamMessage,
  options: ProcessMessageOptions
): void {
  const { onError, isMounted } = options;

  if (!isMounted()) return;

  let errorMsg = '处理过程中出现错误';

  if (typeof message.payload === 'string') {
    errorMsg = toText(message.payload);
  } else if (message.payload && typeof message.payload === 'object') {
    const payloadObj = message.payload as Record<string, unknown>;
    const code = payloadObj.code as string | undefined;
    errorMsg = toText(payloadObj.message ?? payloadObj.error ?? errorMsg);

    // 根据错误代码提供用户友好的消息
    errorMsg = getUserFriendlyErrorMessage(code, errorMsg);
  }

  onError(errorMsg);
}

/**
 * 处理完成消息
 */
function processDone(options: ProcessMessageOptions): void {
  const { onDone, isMounted } = options;

  if (!isMounted()) return;
  onDone();
}

/**
 * 将错误代码转换为用户友好的消息
 */
function getUserFriendlyErrorMessage(code: string | undefined, originalMessage: string): string {
  if (!code) return originalMessage;

  switch (code) {
    case 'TIMEOUT':
      return '请求超时，已尝试降级重试。可以重新尝试或切换到 Lite 档位。';
    case 'NETWORK':
    case 'UNKNOWN':
      return '网络抖动或连接被中止，可重试一次。';
    default:
      return originalMessage;
  }
}

/**
 * 解析SSE行为消息对象
 */
export function parseSSELine(line: string): StreamMessage | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  try {
    const jsonStr = line.substring(6);
    const message = JSON.parse(jsonStr) as StreamMessage;
    return message;
  } catch (error) {
    hydrationSafeLog('⚠️ Failed to parse SSE line:', line);
    if (process.env.NODE_ENV === 'development') {
      reportError(new Error(`Failed to parse SSE line: ${line.substring(0, 100)}`), {
        context: 'parseSSELine',
        error
      });
    }
    return null;
  }
}

