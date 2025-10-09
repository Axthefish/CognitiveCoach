/**
 * ============================================================================
 * StreamingWrapper - SSE 流式包装器（API 路由层）
 * ============================================================================
 * 
 * ⚠️ 注意区分：
 * - StreamingWrapper (本文件)：将 Service 响应包装为 SSE 流，用于 API 路由
 * - StreamManager (stream-manager.ts)：管理全局流式状态和 AbortController
 * 
 * 架构设计：
 * ┌─────────────────────────────────────────────────────────┐
 * │                    API Route Layer                       │
 * │  /api/coach-stream (route.ts)                           │
 * ├─────────────────────────────────────────────────────────┤
 * │              Streaming Wrapper (本文件)                   │
 * │  - wrapServiceAsStream()                                 │
 * │  - StreamingProgressSimulator                            │
 * │  - 认知步骤管理                                            │
 * │  - 微学习提示                                              │
 * ├─────────────────────────────────────────────────────────┤
 * │                   Service Layer                          │
 * │  S0/S1/S2/S3/S4 Services                                │
 * │  返回 NextResponse (非流式)                               │
 * └─────────────────────────────────────────────────────────┘
 * 
 * 职责分工：
 * - StreamManager (lib/stream-manager.ts): 
 *   * 全局流式状态管理
 *   * AbortController 生命周期
 *   * 使用场景：Zustand Store、需要中止控制的地方
 * 
 * - StreamingWrapper (本文件):
 *   * 将非流式 Service 包装为 SSE 流
 *   * 进度模拟和可视化反馈
 *   * 认知步骤管理（4步标准流程）
 *   * 微学习提示注入
 *   * 使用场景：API Route 层
 *   * 依赖：内部不直接依赖 StreamManager（职责分离）
 * 
 * SSE 流式消息格式：
 * ```
 * data: {"type":"cognitive_step","payload":{"steps":[...],"tip":"...","traceId":"..."}}
 * 
 * data: {"type":"data_structure","payload":{"framework":[...]}}
 * 
 * data: {"type":"error","payload":{"code":"SCHEMA","message":"...","traceId":"..."}}
 * 
 * data: {"type":"done","payload":null}
 * ```
 * 
 * 进度模拟流程：
 * 1. start() - 发送初始步骤和微学习提示
 * 2. nextStep() - 逐步推进认知步骤状态
 * 3. 调用实际 Service（在步骤进行中）
 * 4. complete() - 所有步骤标记为完成
 * 5. 发送最终数据结构
 * 
 * 使用示例：
 * ```typescript
 * import { wrapServiceAsStream } from '@/lib/streaming-wrapper';
 * 
 * // 在 API Route 中
 * const stream = new ReadableStream({
 *   async start(controller) {
 *     const encoder = new TextEncoder();
 *     const traceId = generateTraceId();
 *     
 *     await wrapServiceAsStream(
 *       controller,
 *       encoder,
 *       'generateFramework',
 *       async () => await s1Service.generateFramework(payload),
 *       traceId
 *     );
 *     
 *     controller.close();
 *   }
 * });
 * ```
 */

import { logger } from './logger';
import type { CoachAction, CognitiveStep } from './api-types';

/**
 * SSE 消息类型
 */
export type SSEMessageType = 
  | 'cognitive_step'
  | 'content_chunk'
  | 'data_structure'
  | 'error'
  | 'done';

/**
 * SSE 消息
 */
export interface SSEMessage<T = unknown> {
  type: SSEMessageType;
  payload: T;
}

/**
 * 创建SSE消息字符串
 */
export function createSSEMessage<T>(type: SSEMessageType, payload: T): string {
  return `data: ${JSON.stringify({ type, payload })}\n\n`;
}

/**
 * 认知步骤配置
 */
const COGNITIVE_STEPS: Record<CoachAction, CognitiveStep[]> = {
  refineGoal: [
    { id: 'parse-input', message: '解析和理解你的目标描述...', status: 'pending' },
    { id: 'extract-intent', message: '抽取核心意图和关键要素...', status: 'pending' },
    { id: 'generate-clarification', message: '生成精准的目标表述...', status: 'pending' },
    { id: 'validate-feasibility', message: '评估目标的可行性和完整性...', status: 'pending' },
  ],
  generateFramework: [
    { id: 'analyze-goal', message: '深入分析你的学习目标...', status: 'pending' },
    { id: 'brainstorm-concepts', message: '头脑风暴相关概念和领域...', status: 'pending' },
    { id: 'structure-hierarchy', message: '构建分层知识结构树...', status: 'pending' },
    { id: 'refine-categories', message: '优化类别和子主题的清晰度...', status: 'pending' },
  ],
  generateSystemDynamics: [
    { id: 'analyze-relationships', message: '分析知识点之间的关系...', status: 'pending' },
    { id: 'identify-sequence', message: '识别最优学习序列...', status: 'pending' },
    { id: 'craft-analogy', message: '制作生动的比喻来阐明系统...', status: 'pending' },
    { id: 'generate-diagram', message: '生成 Mermaid 可视化图表...', status: 'pending' },
  ],
  generateActionPlan: [
    { id: 'analyze-context', message: '分析学习背景和需求...', status: 'pending' },
    { id: 'design-progression', message: '设计渐进式学习路径...', status: 'pending' },
    { id: 'create-kpis', message: '制定关键绩效指标...', status: 'pending' },
    { id: 'optimize-plan', message: '优化行动计划的可执行性...', status: 'pending' },
  ],
  analyzeProgress: [
    { id: 'analyze-data', message: '分析学习进度数据...', status: 'pending' },
    { id: 'identify-patterns', message: '识别学习模式和趋势...', status: 'pending' },
    { id: 'assess-challenges', message: '评估挑战和瓶颈...', status: 'pending' },
    { id: 'generate-insights', message: '生成洞察和建议...', status: 'pending' },
  ],
  consult: [
    { id: 'parse-question', message: '理解你的问题...', status: 'pending' },
    { id: 'gather-context', message: '收集相关上下文信息...', status: 'pending' },
    { id: 'generate-response', message: '生成详细回答...', status: 'pending' },
  ],
};

/**
 * 微学习提示
 */
const MICRO_LEARNING_TIPS: Record<CoachAction, string[]> = {
  refineGoal: [
    "清晰的目标是成功的一半：SMART原则帮你把模糊想法变成具体方向。",
    "问对问题比找答案更重要：深入思考'为什么'能让目标更有意义。",
    "目标应该激发你的热情，而不是让你感到压力。",
  ],
  generateFramework: [
    "知识框架就像是学习的地图，它能帮助你看清全貌，避免迷失方向。",
    "分层学习法：先掌握核心概念，再深入细节，最后连接成网络。",
    "记住费曼技巧：如果你无法用简单的话解释一个概念，说明你还没有真正理解它。",
  ],
  generateSystemDynamics: [
    "系统思维：理解各部分如何相互作用，比单独学习每个部分更重要。",
    "学习路径的设计遵循认知负荷理论：逐步增加复杂度，避免信息过载。",
    "好的比喻能让抽象概念变得具体，大大提高学习效率和记忆效果。",
  ],
  generateActionPlan: [
    "SMART 目标原则：具体、可衡量、可达成、相关性强、有时限。",
    "习惯叠加法：将新习惯附加在已有习惯之后，更容易坚持。",
    "定期复盘和调整计划，灵活性是成功学习的关键。",
  ],
  analyzeProgress: [
    "反思是学习的加速器：定期思考什么有效、什么需要改进。",
    "庆祝小胜利：认可进步能维持学习动力，无论进步多么微小。",
    "遗忘曲线告诉我们：及时复习比延后复习效率高得多。",
  ],
  consult: [
    "提问是学习的催化剂：好的问题能开启新的思维路径。",
    "苏格拉底式对话：通过问答深入探索，比直接给答案更有价值。",
    "联系实际：将理论知识与个人经验连接，理解更深刻。",
  ],
};

/**
 * 获取认知步骤
 */
export function getCognitiveSteps(action: CoachAction): CognitiveStep[] {
  return COGNITIVE_STEPS[action] || [
    { id: 'processing', message: '处理你的请求...', status: 'pending' },
  ];
}

/**
 * 获取随机微学习提示
 */
export function getRandomTip(action: CoachAction): string {
  const tips = MICRO_LEARNING_TIPS[action] || [
    "学习是一个持续的过程，保持耐心和好奇心是关键。",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

/**
 * 流式进度模拟器
 * 在调用实际服务时提供进度反馈
 */
export class StreamingProgressSimulator {
  private steps: CognitiveStep[];
  private currentIndex: number = 0;
  private intervals: NodeJS.Timeout[] = [];

  constructor(
    private action: CoachAction,
    private controller: ReadableStreamDefaultController<Uint8Array>,
    private encoder: TextEncoder,
    private traceId: string
  ) {
    this.steps = [...getCognitiveSteps(action)];
  }

  /**
   * 启动进度模拟
   */
  start(): void {
    // 发送初始步骤和提示（包含 traceId）
    const tip = getRandomTip(this.action);
    this.sendMessage('cognitive_step', {
      steps: this.steps,
      tip,
      traceId: this.traceId,
    });

    // 启动心跳（每9秒发送一次更新）
    const heartbeatInterval = setInterval(() => {
      this.sendMessage('cognitive_step', {
        steps: this.steps,
        tip: getRandomTip(this.action),
        traceId: this.traceId,
      });
    }, 9000);

    this.intervals.push(heartbeatInterval);
  }

  /**
   * 进入下一步
   */
  nextStep(delay: number = 800): Promise<void> {
    return new Promise((resolve) => {
      if (this.currentIndex > 0 && this.currentIndex <= this.steps.length) {
        this.steps[this.currentIndex - 1].status = 'completed';
      }

      if (this.currentIndex < this.steps.length) {
        setTimeout(() => {
          this.steps[this.currentIndex].status = 'in_progress';
          this.sendMessage('cognitive_step', { steps: this.steps });
          this.currentIndex++;
          resolve();
        }, delay);
      } else {
        resolve();
      }
    });
  }

  /**
   * 完成所有步骤
   */
  complete(): void {
    this.steps.forEach(step => {
      if (step.status !== 'completed') {
        step.status = 'completed';
      }
    });
    this.sendMessage('cognitive_step', { steps: this.steps });
    this.cleanup();
  }

  /**
   * 标记错误
   */
  error(): void {
    if (this.currentIndex < this.steps.length) {
      this.steps[this.currentIndex].status = 'error';
    }
    this.sendMessage('cognitive_step', { steps: this.steps });
    this.cleanup();
  }

  /**
   * 发送消息
   */
  private sendMessage(type: SSEMessageType, payload: unknown): void {
    try {
      this.controller.enqueue(
        this.encoder.encode(createSSEMessage(type, payload))
      );
    } catch (error) {
      logger.error('Failed to send SSE message:', error);
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }
}

/**
 * 包装Service响应为流式响应
 * 
 * 使用示例：
 * ```typescript
 * await wrapServiceAsStream(
 *   controller,
 *   encoder,
 *   'generateFramework',
 *   async () => await s1Service.generateFramework(payload),
 *   traceId
 * );
 * ```
 */
export async function wrapServiceAsStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  action: CoachAction,
  serviceCall: () => Promise<Response>,
  traceId: string,
  options?: {
    onProgress?: (step: number) => void;
    stepDelays?: number[];
  }
): Promise<void> {
  const simulator = new StreamingProgressSimulator(action, controller, encoder, traceId);
  
  try {
    // 启动进度模拟
    simulator.start();

    // 逐步推进（视觉效果）
    const delays = options?.stepDelays || [1000, 1200, 1000, 800];
    const steps = getCognitiveSteps(action).length;
    
    for (let i = 0; i < Math.min(steps - 1, 3); i++) {
      await simulator.nextStep(delays[i] || 800);
      options?.onProgress?.(i);
    }

    // 调用实际的Service
    const response = await serviceCall();
    const responseData = await response.json();

    // 完成最后一步
    await simulator.nextStep(500);
    
    // 完成所有步骤
    simulator.complete();

    // 发送最终数据
    controller.enqueue(
      encoder.encode(createSSEMessage('data_structure', responseData))
    );
  } catch (error) {
    logger.error('Service call failed in streaming wrapper:', { traceId, error });
    simulator.error();
    
    // 发送错误消息（包含 traceId）
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    controller.enqueue(
      encoder.encode(
        createSSEMessage('error', {
          code: 'UNKNOWN',
          message: errorMessage,
          traceId,
        })
      )
    );
    
    throw error;
  }
}

