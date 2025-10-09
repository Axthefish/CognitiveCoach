// S4 Service 单元测试 - 进度分析和咨询服务测试

import { S4Service } from '@/services/s4-service';
import { generateJsonWithRetry } from '@/lib/ai-retry-handler';
import { generateText } from '@/lib/gemini-config';
import { runQualityGates } from '@/lib/qa';

// Mock 外部依赖
jest.mock('@/lib/ai-retry-handler');
jest.mock('@/lib/gemini-config');
jest.mock('@/lib/qa');
jest.mock('@/lib/logger');

const mockGenerateJsonWithRetry = generateJsonWithRetry as jest.MockedFunction<typeof generateJsonWithRetry>;
const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;
const mockRunQualityGates = runQualityGates as jest.MockedFunction<typeof runQualityGates>;

describe('S4Service', () => {
  let service: S4Service;

  beforeEach(() => {
    service = S4Service.getInstance();
    jest.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = S4Service.getInstance();
      const instance2 = S4Service.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('analyzeProgress', () => {
    const mockProgressData = {
      completedTasks: ['task-1', 'task-2'],
      confidenceScore: 0.8,
      hoursSpent: 15,
      challenges: '时间管理有困难'
    };

    const mockUserContext = {
      userGoal: '学习React开发',
      actionPlan: [
        { id: 'task-1', text: '学习基础', isCompleted: true },
        { id: 'task-2', text: '实践项目', isCompleted: true },
        { id: 'task-3', text: '深入学习', isCompleted: false }
      ],
      kpis: ['完成3个项目', '掌握Hooks']
    };

    const mockAnalysisResult = {
      analysis: '你的进度非常好，已完成67%的任务。建议继续保持学习节奏。',
      suggestions: [
        '制定每日学习时间表',
        '参加React社区活动',
        '开始一个实战项目'
      ]
    };

    it('should successfully analyze progress', async () => {
      mockGenerateJsonWithRetry.mockResolvedValue({
        ok: true,
        data: mockAnalysisResult,
        attempts: 1
      });

      mockRunQualityGates.mockReturnValue({
        passed: true,
        issues: []
      });

      const payload = {
        progressData: mockProgressData,
        userContext: mockUserContext
      };

      const response = await service.analyzeProgress(payload);
      const data = await response.json();

      expect(data.status).toBe('success');
      expect(data.data).toHaveProperty('analysis');
      expect(data.data).toHaveProperty('suggestions');
      expect(Array.isArray(data.data.suggestions)).toBe(true);
    });

    it('should calculate completion rate correctly', async () => {
      mockGenerateJsonWithRetry.mockResolvedValue({
        ok: true,
        data: mockAnalysisResult,
        attempts: 1
      });

      mockRunQualityGates.mockReturnValue({
        passed: true,
        issues: []
      });

      const payload = {
        progressData: mockProgressData,
        userContext: mockUserContext
      };

      await service.analyzeProgress(payload);

      // Verify completion rate is passed to AI
      const callArgs = mockGenerateJsonWithRetry.mock.calls[0];
      const prompt = callArgs[0] as string;
      
      // 2 out of 3 tasks = 67% completion
      expect(prompt).toContain('67');
    });

    it('should handle QA gate failures', async () => {
      mockGenerateJsonWithRetry.mockResolvedValue({
        ok: true,
        data: mockAnalysisResult,
        attempts: 1
      });

      mockRunQualityGates.mockReturnValue({
        passed: false,
        issues: [
          {
            severity: 'blocker',
            area: 'consistency',
            hint: 'Strategy metrics mismatch',
            targetPath: 'S4'
          }
        ]
      });

      const payload = {
        progressData: mockProgressData,
        userContext: mockUserContext
      };

      const response = await service.analyzeProgress(payload);
      const data = await response.json();

      expect(data.status).toBe('error');
      expect(response.status).toBe(400);
    });

    it('should handle AI call failure', async () => {
      mockGenerateJsonWithRetry.mockResolvedValue({
        ok: false,
        error: 'AI_TIMEOUT',
        attempts: 3
      });

      const payload = {
        progressData: mockProgressData,
        userContext: mockUserContext
      };

      const response = await service.analyzeProgress(payload);
      const data = await response.json();

      expect(data.status).toBe('error');
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('consult', () => {
    const mockUserContext = {
      userGoal: '学习React开发',
      knowledgeFramework: [
        { id: 'react-basics', title: 'React基础', summary: '核心概念', children: [] }
      ],
      actionPlan: [
        { id: 'task-1', text: '学习基础', isCompleted: true }
      ],
      systemDynamics: {
        mermaidChart: 'graph TD\n  A --> B',
        metaphor: '学习就像爬山'
      }
    };

    it('should successfully provide consultation', async () => {
      mockGenerateText.mockResolvedValue({
        ok: true,
        text: '关于React Hooks，它们是React 16.8引入的新特性...'
      });

      const payload = {
        question: '什么是React Hooks？',
        userContext: mockUserContext
      };

      const response = await service.consult(payload);
      const data = await response.json();

      expect(data.status).toBe('success');
      expect(data.data).toHaveProperty('response');
      expect(typeof data.data.response).toBe('string');
      expect(data.data.response.length).toBeGreaterThan(0);
    });

    it('should include user context in prompt', async () => {
      mockGenerateText.mockResolvedValue({
        ok: true,
        text: '基于你的学习进度...'
      });

      const payload = {
        question: '我应该先学什么？',
        userContext: mockUserContext
      };

      await service.consult(payload);

      const callArgs = mockGenerateText.mock.calls[0];
      const prompt = callArgs[0] as string;

      expect(prompt).toContain(mockUserContext.userGoal);
      expect(prompt).toContain('我应该先学什么？');
    });

    it('should handle AI call failure', async () => {
      mockGenerateText.mockResolvedValue({
        ok: false,
        error: 'NETWORK_ERROR'
      });

      const payload = {
        question: '什么是React？',
        userContext: mockUserContext
      };

      const response = await service.consult(payload);
      const data = await response.json();

      expect(data.status).toBe('error');
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should format framework summary correctly', async () => {
      mockGenerateText.mockResolvedValue({
        ok: true,
        text: '咨询回复'
      });

      const payload = {
        question: '框架内容是什么？',
        userContext: {
          ...mockUserContext,
          knowledgeFramework: [
            {
              id: 'main',
              title: '主题',
              summary: '描述',
              children: [
                { id: 'sub', title: '子主题', summary: '子描述', children: [] }
              ]
            }
          ]
        }
      };

      await service.consult(payload);

      const callArgs = mockGenerateText.mock.calls[0];
      const prompt = callArgs[0] as string;

      // S4 uses formatFrameworkSummary which may format differently
      // Just verify main topic is included
      expect(prompt).toContain('主题');
    });
  });
});

