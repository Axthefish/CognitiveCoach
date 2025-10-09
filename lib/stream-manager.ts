/**
 * ============================================================================
 * StreamManager - 全局流式状态管理器（客户端状态层）
 * ============================================================================
 * 
 * ⚠️ 注意区分：
 * - StreamManager (本文件)：管理全局流式状态和 AbortController 生命周期
 * - StreamingWrapper (streaming-wrapper.ts)：将 Service 响应包装为 SSE 流
 * 
 * 职责：
 * - 管理流式请求的生命周期（启动、进行中、完成、中止、错误）
 * - 提供 AbortController 的统一管理，防止内存泄漏
 * - 解决竞态条件：确保同一时间只有一个活跃流
 * - 状态机模式：清晰的状态转换和验证
 * 
 * 使用场景：
 * - Zustand Store (lib/store.ts) - 管理全局流式状态
 * - 需要中止流式请求的任何地方
 * 
 * 使用示例：
 * ```typescript
 * import { globalStreamManager } from '@/lib/stream-manager';
 * 
 * // 启动新的流
 * const controller = globalStreamManager.start('S1');
 * if (!controller) {
 *   console.error('Cannot start stream');
 *   return;
 * }
 * 
 * // 标记流式处理正在进行
 * globalStreamManager.markStreaming();
 * 
 * // 使用 controller 进行 fetch
 * fetch('/api/endpoint', { signal: controller.signal })
 *   .then(() => globalStreamManager.complete())
 *   .catch(() => globalStreamManager.error('Fetch failed'));
 * 
 * // 中止流
 * globalStreamManager.abort('User cancelled');
 * 
 * // 订阅状态变化
 * const unsubscribe = globalStreamManager.subscribe((state) => {
 *   console.log('Stream state:', state.status);
 * });
 * ```
 * 
 * 状态转换图：
 * ```
 * IDLE ──start()──> STARTING ──markStreaming()──> STREAMING
 *   ↑                  │                              │
 *   │                  │                              │
 *   │                  └──abort()──> ABORTED          │
 *   │                                   │              │
 *   └───────────────cleanup()───────────┘              │
 *                                                      │
 * STREAMING ──complete()──> COMPLETING ──cleanup()──> IDLE
 *     │
 *     └──error()──> ERROR ──cleanup()──> IDLE
 * ```
 */

import { hydrationSafeLog } from './hydration-safe';

/**
 * 流式状态枚举
 */
export enum StreamStatus {
  IDLE = 'idle',
  STARTING = 'starting',
  STREAMING = 'streaming',
  PAUSING = 'pausing',
  COMPLETING = 'completing',
  ABORTED = 'aborted',
  ERROR = 'error',
}

/**
 * 流式状态信息
 */
export interface StreamState {
  status: StreamStatus;
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | null;
  controller: AbortController | null;
  startTime: number | null;
  error: string | null;
}

/**
 * 流式状态管理器
 * 使用状态机模式管理流式请求的生命周期
 */
export class StreamManager {
  private state: StreamState = {
    status: StreamStatus.IDLE,
    stage: null,
    controller: null,
    startTime: null,
    error: null,
  };

  private listeners: Set<(state: StreamState) => void> = new Set();

  /**
   * 获取当前状态
   */
  getState(): Readonly<StreamState> {
    return { ...this.state };
  }

  /**
   * 检查是否正在流式处理
   */
  isActive(): boolean {
    return this.state.status === StreamStatus.STREAMING ||
           this.state.status === StreamStatus.STARTING;
  }

  /**
   * 检查是否可以启动新的流
   */
  canStart(): boolean {
    return this.state.status === StreamStatus.IDLE ||
           this.state.status === StreamStatus.ABORTED ||
           this.state.status === StreamStatus.ERROR ||
           this.state.status === StreamStatus.COMPLETING;
  }

  /**
   * 启动流式处理
   */
  start(stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4'): AbortController | null {
    // 检查是否可以启动
    if (!this.canStart()) {
      hydrationSafeLog('⚠️ StreamManager: Cannot start new stream, current status:', this.state.status);
      
      // 如果当前正在流式处理，先中止
      if (this.isActive()) {
        this.abort('Starting new stream');
      }
    }

    // 创建新的 AbortController
    const controller = new AbortController();
    
    // 更新状态
    this.updateState({
      status: StreamStatus.STARTING,
      stage,
      controller,
      startTime: Date.now(),
      error: null,
    });

    hydrationSafeLog('🚀 StreamManager: Stream started', { stage });

    // 监听 abort 事件
    controller.signal.addEventListener('abort', () => {
      this.handleAbort();
    });

    return controller;
  }

  /**
   * 标记流式处理正在进行
   */
  markStreaming(): void {
    if (this.state.status === StreamStatus.STARTING) {
      this.updateState({ status: StreamStatus.STREAMING });
      hydrationSafeLog('📡 StreamManager: Streaming in progress');
    }
  }

  /**
   * 完成流式处理
   */
  complete(): void {
    if (this.isActive()) {
      const duration = this.state.startTime ? Date.now() - this.state.startTime : 0;
      
      this.updateState({
        status: StreamStatus.COMPLETING,
      });

      hydrationSafeLog('✅ StreamManager: Stream completed', {
        stage: this.state.stage,
        duration: `${duration}ms`,
      });

      // 清理资源
      this.cleanup();
    }
  }

  /**
   * 中止流式处理
   */
  abort(reason?: string): void {
    if (this.state.controller && !this.state.controller.signal.aborted) {
      hydrationSafeLog('🛑 StreamManager: Aborting stream', {
        reason,
        stage: this.state.stage,
      });

      try {
        this.state.controller.abort();
      } catch (error) {
        hydrationSafeLog('⚠️ StreamManager: Error aborting controller', error);
      }
    }
  }

  /**
   * 处理 abort 事件
   */
  private handleAbort(): void {
    this.updateState({
      status: StreamStatus.ABORTED,
    });

    hydrationSafeLog('⏹️ StreamManager: Stream aborted');

    // 延迟清理，确保 abort 事件完全传播
    setTimeout(() => this.cleanup(), 100);
  }

  /**
   * 标记错误
   */
  error(errorMessage: string): void {
    hydrationSafeLog('❌ StreamManager: Stream error', { error: errorMessage });

    this.updateState({
      status: StreamStatus.ERROR,
      error: errorMessage,
    });

    // 中止当前流
    this.abort('Error occurred');
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    // 清理 AbortController 引用
    const oldController = this.state.controller;
    
    this.updateState({
      controller: null,
      startTime: null,
    });

    // 确保 controller 被垃圾回收
    if (oldController) {
      // 移除所有事件监听器（如果有API支持）
      // 现代浏览器会自动清理，这里只是确保引用被释放
      hydrationSafeLog('🧹 StreamManager: Cleaned up controller');
    }

    // 重置为 IDLE 状态
    setTimeout(() => {
      if (this.state.status === StreamStatus.COMPLETING ||
          this.state.status === StreamStatus.ABORTED) {
        this.updateState({
          status: StreamStatus.IDLE,
          stage: null,
          error: null,
        });
      }
    }, 200);
  }

  /**
   * 重置管理器
   */
  reset(): void {
    hydrationSafeLog('🔄 StreamManager: Resetting');
    
    // 中止当前流
    this.abort('Reset');
    
    // 重置状态
    this.state = {
      status: StreamStatus.IDLE,
      stage: null,
      controller: null,
      startTime: null,
      error: null,
    };

    this.notifyListeners();
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (state: StreamState) => void): () => void {
    this.listeners.add(listener);
    
    // 立即通知当前状态
    listener(this.getState());
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 更新状态并通知监听器
   */
  private updateState(updates: Partial<StreamState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };

    this.notifyListeners();
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        hydrationSafeLog('⚠️ StreamManager: Error in listener', error);
      }
    });
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      status: this.state.status,
      stage: this.state.stage,
      hasController: !!this.state.controller,
      isAborted: this.state.controller?.signal.aborted ?? null,
      error: this.state.error,
      uptime: this.state.startTime ? Date.now() - this.state.startTime : null,
      listenersCount: this.listeners.size,
    };
  }
}

// 创建全局实例（用于 Zustand store）
export const globalStreamManager = new StreamManager();

