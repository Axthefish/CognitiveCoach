/**
 * Context Manager 单元测试
 * 
 * 测试对话压缩、Token估算和智能压缩策略
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ContextManager, contextManager } from '@/lib/context-manager';
import type { ChatMessage } from '@/lib/types-v2';

// Mock Gemini AI for compaction tests
jest.mock('@/lib/gemini-config', () => ({
  generateText: jest.fn().mockResolvedValue('对话摘要：用户讨论了学习Python的计划，重点关注数据分析。提到零基础、3个月时限和工作应用场景。关键决策包括选择Pandas作为核心工具，以及循序渐进的学习路径。')
}));

describe('ContextManager', () => {
  
  // ========================================
  // Token估算测试
  // ========================================
  
  describe('Token Estimation', () => {
    it('should estimate Chinese text correctly', () => {
      const chineseText = '我想学习Python编程';
      const tokens = contextManager.estimateTokens(chineseText);
      
      // 中文约1.5字符/token，9个字 ≈ 6 tokens
      expect(tokens).toBeGreaterThan(4);
      expect(tokens).toBeLessThan(10);
    });
    
    it('should estimate English text correctly', () => {
      const englishText = 'I want to learn Python programming';
      const tokens = contextManager.estimateTokens(englishText);
      
      // 英文约4字符/token，35个字符 ≈ 9 tokens
      expect(tokens).toBeGreaterThan(6);
      expect(tokens).toBeLessThan(12);
    });
    
    it('should estimate mixed language text', () => {
      const mixedText = '我想学习Python，it is very useful';
      const tokens = contextManager.estimateTokens(mixedText);
      
      expect(tokens).toBeGreaterThan(8);
      expect(tokens).toBeLessThan(15);
    });
    
    it('should handle empty text', () => {
      const tokens = contextManager.estimateTokens('');
      expect(tokens).toBe(0);
    });
    
    it('should estimate message list tokens', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: '你好，我想学Python',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: '很好，为什么想学Python呢？',
          timestamp: Date.now(),
        },
      ];
      
      const tokens = contextManager.estimateMessagesTokens(messages);
      
      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBeLessThan(30);
    });
    
    it('should handle special characters', () => {
      const specialText = '!@#$%^&*()_+-={}[]|:;<>?,./';
      const tokens = contextManager.estimateTokens(specialText);
      
      expect(tokens).toBeGreaterThan(0);
    });
    
    it('should handle very long text', () => {
      const longText = '这是一段很长的文本。'.repeat(100);
      const tokens = contextManager.estimateTokens(longText);
      
      // 应该能处理长文本
      expect(tokens).toBeGreaterThan(500);
    });
  });
  
  // ========================================
  // 压缩判断测试
  // ========================================
  
  describe('Compaction Decision', () => {
    it('should not compact short conversations', () => {
      const shortMessages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hi', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: 'Hello', timestamp: Date.now() },
      ];
      
      const shouldCompact = contextManager.shouldCompact(shortMessages);
      
      expect(shouldCompact).toBe(false);
    });
    
    it('should compact long conversations', () => {
      // 创建长对话
      const longMessages: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: '这是一段比较长的对话内容，包含了很多详细的信息和讨论'.repeat(5),
        timestamp: Date.now(),
      }));
      
      const shouldCompact = contextManager.shouldCompact(longMessages);
      
      expect(shouldCompact).toBe(true);
    });
    
    it('should respect custom maxTokens threshold', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: '短消息', timestamp: Date.now() },
      ];
      
      // 使用很低的阈值
      const shouldCompact = contextManager.shouldCompact(messages, 1);
      
      expect(shouldCompact).toBe(true);
    });
    
    it('should handle empty message list', () => {
      const shouldCompact = contextManager.shouldCompact([]);
      
      expect(shouldCompact).toBe(false);
    });
  });
  
  // ========================================
  // 压缩功能测试
  // ========================================
  
  describe('Compaction Functionality', () => {
    it('should not compact when under threshold', async () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hi', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: 'Hello', timestamp: Date.now() },
      ];
      
      const result = await contextManager.compactHistory(messages);
      
      expect(result.wasCompacted).toBe(false);
      expect(result.compactedMessages).toEqual(messages);
      expect(result.compressionRatio).toBe(1.0);
    });
    
    it('should compact long conversations', async () => {
      // 创建10轮对话（20条消息）
      const messages: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `这是第${Math.floor(i/2) + 1}轮对话的${i % 2 === 0 ? '用户' : 'AI'}消息，包含一些详细的讨论内容。`,
        timestamp: Date.now() + i * 1000,
      }));
      
      const result = await contextManager.compactHistory(messages, {
        maxTokens: 100,  // 设置很低的阈值强制压缩
        recentTurnsToKeep: 3,
      });
      
      expect(result.wasCompacted).toBe(true);
      expect(result.compactedMessages.length).toBeLessThan(messages.length);
      expect(result.compactedTokens).toBeLessThan(result.originalTokens);
      expect(result.compressionRatio).toBeLessThan(1.0);
      expect(result.summary).toBeTruthy();
    });
    
    it('should preserve recent turns', async () => {
      const messages: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `消息 ${i}`,
        timestamp: Date.now() + i * 1000,
      }));
      
      const recentTurnsToKeep = 3;
      const result = await contextManager.compactHistory(messages, {
        maxTokens: 50,
        recentTurnsToKeep,
      });
      
      if (result.wasCompacted) {
        // 应该保留最近3轮（6条消息）+ 1条摘要消息
        const expectedRecentMessages = recentTurnsToKeep * 2;
        expect(result.compactedMessages.length).toBe(expectedRecentMessages + 1);
        
        // 检查保留的是最后几条消息
        const lastMessage = result.compactedMessages[result.compactedMessages.length - 1];
        expect(lastMessage.content).toContain('19');
      }
    });
    
    it('should create summary message', async () => {
      const messages: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `重要信息 ${i}`,
        timestamp: Date.now(),
      }));
      
      const result = await contextManager.compactHistory(messages, {
        maxTokens: 30,
        recentTurnsToKeep: 2,
      });
      
      if (result.wasCompacted) {
        // 第一条应该是摘要消息
        const summaryMessage = result.compactedMessages[0];
        expect(summaryMessage.role).toBe('system');
        expect(summaryMessage.content).toContain('conversation_summary');
        expect(summaryMessage.content).toContain(result.summary);
      }
    });
    
    it('should respect summaryMaxTokens', async () => {
      const messages: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `这是很长的对话内容，包含大量细节信息`.repeat(10),
        timestamp: Date.now(),
      }));
      
      const summaryMaxTokens = 100;
      const result = await contextManager.compactHistory(messages, {
        maxTokens: 500,
        recentTurnsToKeep: 2,
        summaryMaxTokens,
      });
      
      if (result.wasCompacted) {
        const summaryTokens = contextManager.estimateTokens(result.summary);
        // 摘要应该大致在限制范围内（允许一些偏差）
        expect(summaryTokens).toBeLessThan(summaryMaxTokens * 1.5);
      }
    });
  });
  
  // ========================================
  // 智能压缩测试
  // ========================================
  
  describe('Smart Compaction', () => {
    it('should not compact very short conversations', async () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hi', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: 'Hello', timestamp: Date.now() },
      ];
      
      const result = await contextManager.smartCompact(messages);
      
      expect(result.wasCompacted).toBe(false);
    });
    
    it('should adjust retention based on conversation length', async () => {
      // 创建非常长的对话
      const longMessages: ChatMessage[] = Array.from({ length: 40 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `对话内容 ${i}`,
        timestamp: Date.now(),
      }));
      
      const result = await contextManager.smartCompact(longMessages);
      
      // 智能压缩应该根据长度调整策略
      expect(result.wasCompacted).toBe(true);
      expect(result.compactedTokens).toBeLessThan(result.originalTokens);
    });
    
    it('should handle edge case of exactly threshold tokens', async () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'A'.repeat(500), timestamp: Date.now() },
      ];
      
      const result = await contextManager.smartCompact(messages);
      
      // 应该能处理边界情况
      expect(result).toBeDefined();
    });
  });
  
  // ========================================
  // 批量压缩测试
  // ========================================
  
  describe('Batch Compaction', () => {
    it('should compact multiple conversations', async () => {
      const conv1: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `c1-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Conversation 1 Message ${i}`,
        timestamp: Date.now(),
      }));
      
      const conv2: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `c2-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Conversation 2 Message ${i}`,
        timestamp: Date.now(),
      }));
      
      const results = await contextManager.batchCompact([conv1, conv2], {
        maxTokens: 50,
        recentTurnsToKeep: 2,
      });
      
      expect(results.length).toBe(2);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
    });
    
    it('should handle empty batch', async () => {
      const results = await contextManager.batchCompact([]);
      
      expect(results).toEqual([]);
    });
    
    it('should handle mixed length conversations', async () => {
      const shortConv: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hi', timestamp: Date.now() },
      ];
      
      const longConv: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
        timestamp: Date.now(),
      }));
      
      const results = await contextManager.batchCompact([shortConv, longConv], {
        maxTokens: 50,
      });
      
      expect(results.length).toBe(2);
      // 短对话不应该被压缩
      expect(results[0].wasCompacted).toBe(false);
      // 长对话可能被压缩
    });
  });
  
  // ========================================
  // 边缘情况测试
  // ========================================
  
  describe('Edge Cases', () => {
    it('should handle empty message list', async () => {
      const result = await contextManager.compactHistory([]);
      
      expect(result.wasCompacted).toBe(false);
      expect(result.compactedMessages).toEqual([]);
    });
    
    it('should handle single message', async () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];
      
      const result = await contextManager.compactHistory(messages);
      
      expect(result.wasCompacted).toBe(false);
      expect(result.compactedMessages).toEqual(messages);
    });
    
    it('should handle messages with empty content', async () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: '', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: '', timestamp: Date.now() },
      ];
      
      const result = await contextManager.compactHistory(messages);
      
      expect(result).toBeDefined();
    });
    
    it('should handle messages with very long content', async () => {
      const longContent = 'A'.repeat(10000);
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: longContent, timestamp: Date.now() },
      ];
      
      const result = await contextManager.compactHistory(messages, {
        maxTokens: 100,
      });
      
      expect(result).toBeDefined();
    });
    
    it('should handle special characters in messages', async () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: '!@#$%^&*()_+-={}[]|:;<>?,./~`', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: '™®©€£¥', timestamp: Date.now() },
      ];
      
      const result = await contextManager.compactHistory(messages);
      
      expect(result).toBeDefined();
    });
    
    it('should handle messages with emojis', async () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: '😀 😃 😄 😁 😆 😅 🤣', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: '👍 👎 👏 🙌 🤝', timestamp: Date.now() },
      ];
      
      const tokens = contextManager.estimateMessagesTokens(messages);
      
      expect(tokens).toBeGreaterThan(0);
    });
  });
  
  // ========================================
  // 性能测试
  // ========================================
  
  describe('Performance', () => {
    it('should estimate tokens quickly', () => {
      const text = '这是一段测试文本'.repeat(100);
      
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        contextManager.estimateTokens(text);
      }
      const duration = Date.now() - start;
      
      // 1000次估算应该在100ms内完成
      expect(duration).toBeLessThan(100);
    });
    
    it('should handle large message lists efficiently', () => {
      const messages: ChatMessage[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
        timestamp: Date.now(),
      }));
      
      const start = Date.now();
      contextManager.estimateMessagesTokens(messages);
      const duration = Date.now() - start;
      
      // 应该能快速处理大量消息
      expect(duration).toBeLessThan(200);
    });
  });
  
  // ========================================
  // 集成场景测试
  // ========================================
  
  describe('Integration Scenarios', () => {
    it('should handle typical Stage 0 conversation flow', async () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: '我想学Python', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: '很好！你为什么想学Python呢？', timestamp: Date.now() },
        { id: '3', role: 'user', content: '工作需要，想做数据分析', timestamp: Date.now() },
        { id: '4', role: 'assistant', content: '明白了。你的编程基础如何？', timestamp: Date.now() },
        { id: '5', role: 'user', content: '零基础，没写过代码', timestamp: Date.now() },
        { id: '6', role: 'assistant', content: '好的。有时间限制吗？', timestamp: Date.now() },
        { id: '7', role: 'user', content: '希望3个月内能用起来', timestamp: Date.now() },
      ];
      
      // 7轮对话，不应该触发压缩
      const tokens = contextManager.estimateMessagesTokens(messages);
      expect(tokens).toBeLessThan(3000);
      
      const shouldCompact = contextManager.shouldCompact(messages);
      expect(shouldCompact).toBe(false);
    });
    
    it('should handle long Stage 0 conversation with compaction', async () => {
      // 创建15轮对话
      const messages: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `这是第${Math.floor(i/2) + 1}轮对话。用户在讨论学习Python的各种细节，包括时间安排、学习资源、遇到的困难等等。`,
        timestamp: Date.now() + i * 1000,
      }));
      
      const shouldCompact = contextManager.shouldCompact(messages);
      expect(shouldCompact).toBe(true);
      
      const result = await contextManager.smartCompact(messages);
      expect(result.wasCompacted).toBe(true);
      expect(result.compressionRatio).toBeLessThan(0.8);  // 至少节省20%
    });
  });
});

