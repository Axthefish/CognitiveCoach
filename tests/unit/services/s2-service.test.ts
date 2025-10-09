// S2 Service 单元测试 - 系统动力学生成测试

import { S2Service } from '@/services/s2-service';
import { generateJsonWithRetry } from '@/lib/ai-retry-handler';
import { runQualityGates } from '@/lib/qa';
import type { SystemDynamics } from '@/lib/schemas';

// Mock 外部依赖
jest.mock('@/lib/ai-retry-handler');
jest.mock('@/lib/qa');
jest.mock('@/lib/logger');

const mockGenerateJsonWithRetry = generateJsonWithRetry as jest.MockedFunction<typeof generateJsonWithRetry>;
const mockRunQualityGates = runQualityGates as jest.MockedFunction<typeof runQualityGates>;

describe('S2Service', () => {
  let service: S2Service;

  beforeEach(() => {
    service = S2Service.getInstance();
    jest.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = S2Service.getInstance();
      const instance2 = S2Service.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('generateSystemDynamics', () => {
    const mockFramework = [
      {
        id: 'react-basics',
        title: 'React基础',
        summary: '学习React核心概念',
        children: [
          {
            id: 'jsx',
            title: 'JSX语法',
            summary: 'React的模板语法'
          }
        ]
      }
    ];

    const mockSystemDynamics: SystemDynamics = {
      mermaidChart: 'graph TD\n  A[Start] --> B[End]',
      metaphor: '学习React就像学习骑自行车，需要平衡理论和实践',
      nodes: [
        { id: 'react-basics', title: 'React基础' },
        { id: 'jsx', title: 'JSX语法' }
      ],
      mainPath: ['react-basics', 'jsx'],
      loops: [],
      nodeAnalogies: [],
      evidence: [],
      confidence: 0.8,
      applicability: '适用于初学者学习React基础'
    };

    it('should successfully generate system dynamics', async () => {
      // Mock AI call success
      mockGenerateJsonWithRetry.mockResolvedValue({
        ok: true,
        data: mockSystemDynamics,
        attempts: 1
      });

      // Mock QA gates pass
      mockRunQualityGates.mockReturnValue({
        passed: true,
        issues: []
      });

      const payload = {
        framework: mockFramework,
        runTier: 'Pro' as const
      };

      const response = await service.generateSystemDynamics(payload);
      const data = await response.json();

      expect(data.status).toBe('success');
      expect(data.data).toHaveProperty('mermaidChart');
      expect(data.data).toHaveProperty('metaphor');
      expect(data.data.mermaidChart).toContain('graph TD');
    });

    it('should handle AI call failure', async () => {
      mockGenerateJsonWithRetry.mockResolvedValue({
        ok: false,
        error: 'AI_TIMEOUT',
        attempts: 3
      });

      const payload = {
        framework: mockFramework,
        runTier: 'Pro' as const
      };

      const response = await service.generateSystemDynamics(payload);
      const data = await response.json();

      expect(data.status).toBe('error');
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle invalid Mermaid chart format', async () => {
      const invalidDynamics = {
        ...mockSystemDynamics,
        mermaidChart: 'invalid chart format'
      };

      mockGenerateJsonWithRetry.mockResolvedValue({
        ok: true,
        data: invalidDynamics,
        attempts: 1
      });

      const payload = {
        framework: mockFramework,
        runTier: 'Pro' as const
      };

      const response = await service.generateSystemDynamics(payload);
      const data = await response.json();

      expect(data.status).toBe('error');
      // Error message may be localized or use createStageError
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle QA gate failures', async () => {
      mockGenerateJsonWithRetry.mockResolvedValue({
        ok: true,
        data: mockSystemDynamics,
        attempts: 1
      });

      mockRunQualityGates.mockReturnValue({
        passed: false,
        issues: [
          {
            severity: 'blocker',
            area: 'consistency',
            hint: 'Missing node references',
            targetPath: 'S2'
          }
        ]
      });

      const payload = {
        framework: mockFramework,
        runTier: 'Pro' as const
      };

      const response = await service.generateSystemDynamics(payload);
      const data = await response.json();

      expect(data.status).toBe('error');
      expect(response.status).toBe(400);
    });

    it('should work with Lite tier', async () => {
      mockGenerateJsonWithRetry.mockResolvedValue({
        ok: true,
        data: mockSystemDynamics,
        attempts: 1
      });

      mockRunQualityGates.mockReturnValue({
        passed: true,
        issues: []
      });

      const payload = {
        framework: mockFramework,
        runTier: 'Lite' as const
      };

      const response = await service.generateSystemDynamics(payload);
      const data = await response.json();

      expect(data.status).toBe('success');
      expect(mockGenerateJsonWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.any(Object),
        'Lite',
        's2'
      );
    });
  });
});

