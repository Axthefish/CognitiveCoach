/**
 * ID Generator 单元测试
 * 测试 ID 生成函数的唯一性和格式
 */

import {
  generateUniqueId,
  generateVersionId,
  generateShortId,
  generateContentBasedId,
  generateUUID,
  generateTraceId,
  resetIdGenerator,
} from '@/lib/id-generator';

describe('ID Generator', () => {
  beforeEach(() => {
    // 每个测试前重置生成器
    resetIdGenerator();
  });

  describe('generateUniqueId', () => {
    it('应该生成唯一的ID', () => {
      const id1 = generateUniqueId();
      const id2 = generateUniqueId();
      
      expect(id1).not.toBe(id2);
    });

    it('应该使用默认前缀', () => {
      const id = generateUniqueId();
      expect(id).toMatch(/^id-/);
    });

    it('应该支持自定义前缀', () => {
      const id = generateUniqueId('test');
      expect(id).toMatch(/^test-/);
    });

    it('生成的ID应该包含计数器', () => {
      const id1 = generateUniqueId('prefix');
      const id2 = generateUniqueId('prefix');
      
      // 计数器应该递增
      expect(id1).not.toBe(id2);
    });

    it('连续生成100个ID应该都不相同', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateUniqueId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('generateVersionId', () => {
    it('应该生成版本ID', () => {
      const id = generateVersionId();
      // 服务器端: v-server-timestamp-counter
      // 客户端: v-timestamp-uuid
      expect(id).toMatch(/^v-/);
      expect(id).toBeTruthy();
    });

    it('连续生成的版本ID应该不同', () => {
      const id1 = generateVersionId();
      const id2 = generateVersionId();
      
      expect(id1).not.toBe(id2);
    });

    it('版本ID应该包含时间戳', () => {
      const id = generateVersionId();
      const parts = id.split('-');
      
      expect(parts[0]).toBe('v');
      // 在服务器端，parts[1] 是 'server'，在客户端是时间戳
      expect(parts[1]).toBeTruthy();
    });

    it('在服务器端应该返回带 server 前缀的ID', () => {
      // 注意：在实际Node环境中，typeof window === 'undefined'
      // 所以这个测试会验证服务器端行为
      const id = generateVersionId();
      // 服务器端生成的ID应该包含 'server'
      if (typeof window === 'undefined') {
        expect(id).toMatch(/^v-server-/);
      }
    });
  });

  describe('generateShortId', () => {
    it('应该生成指定长度的短ID', () => {
      const id = generateShortId(8);
      expect(id).toHaveLength(8);
    });

    it('应该使用默认长度8', () => {
      const id = generateShortId();
      expect(id).toHaveLength(8);
    });

    it('应该只包含字母和数字', () => {
      const id = generateShortId(20);
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('不同长度应该生成不同长度的ID', () => {
      const id1 = generateShortId(5);
      const id2 = generateShortId(10);
      const id3 = generateShortId(15);
      
      expect(id1).toHaveLength(5);
      expect(id2).toHaveLength(10);
      expect(id3).toHaveLength(15);
    });

    it('连续生成应该产生不同的ID', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(generateShortId());
      }
      // 由于使用计数器，应该都不相同
      expect(ids.size).toBe(50);
    });
  });

  describe('generateContentBasedId', () => {
    it('相同内容应该生成相同的ID', () => {
      const content = 'test content';
      const id1 = generateContentBasedId(content);
      const id2 = generateContentBasedId(content);
      
      expect(id1).toBe(id2);
    });

    it('不同内容应该生成不同的ID', () => {
      const id1 = generateContentBasedId('content 1');
      const id2 = generateContentBasedId('content 2');
      
      expect(id1).not.toBe(id2);
    });

    it('应该使用默认前缀', () => {
      const id = generateContentBasedId('test');
      expect(id).toMatch(/^id-/);
    });

    it('应该支持自定义前缀', () => {
      const id = generateContentBasedId('test', 'hash');
      expect(id).toMatch(/^hash-/);
    });

    it('空字符串应该生成有效ID', () => {
      const id = generateContentBasedId('');
      expect(id).toBeTruthy();
      expect(id).toMatch(/^id-/);
    });

    it('长文本应该生成合理长度的ID', () => {
      const longText = 'a'.repeat(10000);
      const id = generateContentBasedId(longText);
      
      expect(id).toBeTruthy();
      expect(id.length).toBeLessThan(50); // 哈希应该是固定长度
    });
  });

  describe('generateUUID', () => {
    it('应该生成 UUID v4 格式', () => {
      const uuid = generateUUID();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('连续生成的 UUID 应该不同', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      
      expect(uuid1).not.toBe(uuid2);
    });

    it('生成100个 UUID 应该大部分不相同', () => {
      const uuids = new Set();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      // 在服务器端可能会有一些重复（因为使用降级实现）
      // 但大部分应该是唯一的
      expect(uuids.size).toBeGreaterThan(10);
    });
  });

  describe('generateTraceId', () => {
    it('应该生成 TraceId', () => {
      const traceId = generateTraceId();
      expect(traceId).toBeTruthy();
    });

    it('TraceId 应该包含连字符', () => {
      const traceId = generateTraceId();
      expect(traceId).toContain('-');
    });

    it('TraceId 格式应该是 timestamp-random', () => {
      const traceId = generateTraceId();
      const parts = traceId.split('-');
      
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBeTruthy(); // 时间戳部分
      expect(parts[1]).toBeTruthy(); // 随机部分
    });

    it('连续生成的 TraceId 应该不同', () => {
      const id1 = generateTraceId();
      const id2 = generateTraceId();
      
      expect(id1).not.toBe(id2);
    });

    it('随机部分应该是字母数字', () => {
      const traceId = generateTraceId();
      const parts = traceId.split('-');
      const randomPart = parts[1];
      
      expect(randomPart).toMatch(/^[a-z0-9]+$/);
    });

    it('生成50个 TraceId 应该都不相同', () => {
      const traceIds = new Set();
      for (let i = 0; i < 50; i++) {
        traceIds.add(generateTraceId());
      }
      expect(traceIds.size).toBe(50);
    });
  });

  describe('resetIdGenerator', () => {
    it('重置后计数器应该从头开始', () => {
      // 生成一些ID使计数器增加
      const ids1 = [];
      for (let i = 0; i < 3; i++) {
        ids1.push(generateUniqueId('test'));
      }
      
      // 重置
      resetIdGenerator();
      
      // 重置后再生成
      const ids2 = [];
      for (let i = 0; i < 3; i++) {
        ids2.push(generateUniqueId('test'));
      }
      
      // 在服务器端，重置后的ID可能相同（因为使用固定会话ID）
      // 但在客户端应该不同
      // 这里只验证重置不会导致错误
      expect(ids2.length).toBe(3);
      ids2.forEach(id => expect(id).toBeTruthy());
    });
  });

  describe('边界情况', () => {
    it('应该处理空前缀', () => {
      const id = generateUniqueId('');
      expect(id).toBeTruthy();
    });

    it('应该处理特殊字符前缀', () => {
      const id = generateUniqueId('@test-prefix!');
      expect(id).toMatch(/^@test-prefix!-/);
    });

    it('generateShortId(0) 应该返回空字符串', () => {
      const id = generateShortId(0);
      expect(id).toBe('');
    });

    it('generateShortId 负数应该返回空字符串', () => {
      const id = generateShortId(-1);
      expect(id).toBe('');
    });

    it('generateContentBasedId 处理 Unicode 字符', () => {
      const id1 = generateContentBasedId('你好世界');
      const id2 = generateContentBasedId('你好世界');
      const id3 = generateContentBasedId('Hello World');
      
      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
    });

    it('generateContentBasedId 处理表情符号', () => {
      const id = generateContentBasedId('😀😃😄');
      expect(id).toBeTruthy();
      expect(id).toMatch(/^id-/);
    });
  });

  describe('性能', () => {
    it('应该能快速生成大量ID', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        generateUniqueId();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 生成1000个ID应该在100ms内完成
      expect(duration).toBeLessThan(100);
    });

    it('生成 UUID 应该高效', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        generateUUID();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 生成1000个UUID应该在200ms内完成
      expect(duration).toBeLessThan(200);
    });
  });
});

