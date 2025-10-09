/**
 * StreamManager 单元测试
 * 测试流式状态管理的核心功能
 */

import { StreamManager, StreamStatus } from '@/lib/stream-manager';

describe('StreamManager', () => {
  let manager: StreamManager;

  beforeEach(() => {
    // 每个测试前创建新实例
    manager = new StreamManager();
  });

  afterEach(() => {
    // 清理
    manager.reset();
  });

  describe('初始状态', () => {
    it('应该以 IDLE 状态初始化', () => {
      const state = manager.getState();
      expect(state.status).toBe(StreamStatus.IDLE);
      expect(state.stage).toBeNull();
      expect(state.controller).toBeNull();
      expect(state.error).toBeNull();
    });

    it('canStart() 应该返回 true', () => {
      expect(manager.canStart()).toBe(true);
    });

    it('isActive() 应该返回 false', () => {
      expect(manager.isActive()).toBe(false);
    });
  });

  describe('启动流', () => {
    it('应该成功启动新流', () => {
      const controller = manager.start('S1');
      
      expect(controller).not.toBeNull();
      expect(controller).toBeInstanceOf(AbortController);
      
      const state = manager.getState();
      expect(state.status).toBe(StreamStatus.STARTING);
      expect(state.stage).toBe('S1');
      expect(state.controller).toBe(controller);
      expect(state.startTime).not.toBeNull();
    });

    it('应该为不同阶段创建独立的流', () => {
      const stages: Array<'S0' | 'S1' | 'S2' | 'S3' | 'S4'> = ['S0', 'S1', 'S2', 'S3', 'S4'];
      
      stages.forEach(stage => {
        manager.reset();
        const controller = manager.start(stage);
        
        expect(controller).not.toBeNull();
        expect(manager.getState().stage).toBe(stage);
      });
    });
  });

  describe('流式状态转换', () => {
    it('STARTING -> STREAMING', () => {
      manager.start('S1');
      manager.markStreaming();
      
      expect(manager.getState().status).toBe(StreamStatus.STREAMING);
      expect(manager.isActive()).toBe(true);
    });

    it('STREAMING -> COMPLETING -> IDLE', (done) => {
      manager.start('S1');
      manager.markStreaming();
      manager.complete();
      
      expect(manager.getState().status).toBe(StreamStatus.COMPLETING);
      
      // cleanup 会在 200ms 后将状态重置为 IDLE
      setTimeout(() => {
        expect(manager.getState().status).toBe(StreamStatus.IDLE);
        done();
      }, 250);
    });

    it('STREAMING -> ABORTED', (done) => {
      manager.start('S1');
      manager.markStreaming();
      manager.abort('Test abort');
      
      // abort 事件需要时间传播
      setTimeout(() => {
        expect(manager.getState().status).toBe(StreamStatus.ABORTED);
        done();
      }, 150);
    });

    it('STREAMING -> ERROR -> ABORTED', (done) => {
      manager.start('S1');
      manager.markStreaming();
      manager.error('Test error');
      
      const state = manager.getState();
      expect(state.error).toBe('Test error');
      
      // error() 会调用 abort()，导致异步状态变化
      setTimeout(() => {
        // 最终状态应该是 ABORTED（因为 abort 被调用）
        expect(manager.getState().status).toBe(StreamStatus.ABORTED);
        done();
      }, 150);
    });
  });

  describe('中止控制', () => {
    it('应该正确中止流', () => {
      const controller = manager.start('S1');
      expect(controller?.signal.aborted).toBe(false);
      
      manager.abort('User cancelled');
      expect(controller?.signal.aborted).toBe(true);
    });

    it('重复中止不应该引发错误', () => {
      manager.start('S1');
      
      expect(() => {
        manager.abort('First abort');
        manager.abort('Second abort');
      }).not.toThrow();
    });
  });

  describe('状态检查', () => {
    it('isActive() 在 STARTING 状态应该返回 true', () => {
      manager.start('S1');
      expect(manager.isActive()).toBe(true);
    });

    it('isActive() 在 STREAMING 状态应该返回 true', () => {
      manager.start('S1');
      manager.markStreaming();
      expect(manager.isActive()).toBe(true);
    });

    it('isActive() 在其他状态应该返回 false', () => {
      manager.start('S1');
      manager.complete();
      expect(manager.isActive()).toBe(false);
    });

    it('canStart() 在活跃状态应该返回 false', () => {
      manager.start('S1');
      expect(manager.canStart()).toBe(false);
    });
  });

  describe('状态订阅', () => {
    it('应该能够订阅状态变化', () => {
      const listener = jest.fn();
      
      const unsubscribe = manager.subscribe(listener);
      
      // 订阅时立即收到当前状态
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: StreamStatus.IDLE })
      );
      
      unsubscribe();
    });

    it('订阅者应该收到状态更新', () => {
      const listener = jest.fn();
      manager.subscribe(listener);
      
      listener.mockClear(); // 清除初始调用
      
      manager.start('S1');
      
      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ 
          status: StreamStatus.STARTING,
          stage: 'S1'
        })
      );
    });

    it('取消订阅应该停止接收更新', () => {
      const listener = jest.fn();
      const unsubscribe = manager.subscribe(listener);
      
      listener.mockClear();
      unsubscribe();
      
      manager.start('S1');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('重置', () => {
    it('应该重置所有状态', () => {
      manager.start('S1');
      manager.markStreaming();
      manager.reset();
      
      const state = manager.getState();
      expect(state.status).toBe(StreamStatus.IDLE);
      expect(state.stage).toBeNull();
      expect(state.controller).toBeNull();
      expect(state.error).toBeNull();
    });

    it('重置时应该中止当前流', () => {
      const controller = manager.start('S1');
      manager.reset();
      
      expect(controller?.signal.aborted).toBe(true);
    });
  });

  describe('调试信息', () => {
    it('应该提供调试信息', () => {
      manager.start('S1');
      
      const debugInfo = manager.getDebugInfo();
      
      expect(debugInfo).toHaveProperty('status');
      expect(debugInfo).toHaveProperty('stage');
      expect(debugInfo).toHaveProperty('hasController');
      expect(debugInfo).toHaveProperty('isAborted');
      expect(debugInfo).toHaveProperty('uptime');
      expect(debugInfo).toHaveProperty('listenersCount');
    });

    it('debugInfo 应该反映当前状态', () => {
      const debugInfo1 = manager.getDebugInfo();
      expect(debugInfo1.status).toBe(StreamStatus.IDLE);
      expect(debugInfo1.hasController).toBe(false);
      
      manager.start('S2');
      
      const debugInfo2 = manager.getDebugInfo();
      expect(debugInfo2.status).toBe(StreamStatus.STARTING);
      expect(debugInfo2.stage).toBe('S2');
      expect(debugInfo2.hasController).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('在没有启动流时调用 complete() 不应该出错', () => {
      expect(() => {
        manager.complete();
      }).not.toThrow();
    });

    it('在没有启动流时调用 error() 不应该出错', () => {
      expect(() => {
        manager.error('Test error');
      }).not.toThrow();
    });

    it('在没有 controller 时调用 abort() 不应该出错', () => {
      expect(() => {
        manager.abort('Test abort');
      }).not.toThrow();
    });
  });

  describe('内存管理', () => {
    it('完成后应该清理 controller 引用', (done) => {
      manager.start('S1');
      manager.complete();
      
      // 等待 cleanup 完成
      setTimeout(() => {
        expect(manager.getState().controller).toBeNull();
        done();
      }, 250);
    });

    it('中止后应该清理 controller 引用', (done) => {
      manager.start('S1');
      manager.abort('Test');
      
      // 等待 cleanup 完成
      setTimeout(() => {
        expect(manager.getState().controller).toBeNull();
        done();
      }, 250);
    });
  });
});

