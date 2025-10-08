// QA质量检查测试

import { runQualityGates, normalizeId } from '@/lib/qa';

describe('qa', () => {
  describe('normalizeId', () => {
    it('should normalize IDs correctly', () => {
      expect(normalizeId('React Basics')).toBe('react-basics');
      expect(normalizeId('  TypeScript  ')).toBe('typescript');
      expect(normalizeId('Web-Development')).toBe('web-development');
      expect(normalizeId('Node.js Core')).toBe('node-js-core');
    });
    
    it('should handle special characters', () => {
      expect(normalizeId('C++ Programming')).toBe('c---programming');
      expect(normalizeId('API/REST')).toBe('api-rest');
    });
  });
  
  describe('runQualityGates', () => {
    describe('S1 validation', () => {
      it('should pass for valid S1 output', () => {
        const output = [
          {
            id: 'node-1',
            title: 'Node 1',
            summary: 'Summary 1'
          }
        ];
        
        const result = runQualityGates('S1', output);
        
        expect(result.passed).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
      
      it('should fail for invalid S1 schema', () => {
        const output = [
          {
            id: 'node-1',
            // missing title and summary
          }
        ];
        
        const result = runQualityGates('S1', output);
        
        expect(result.passed).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0]?.area).toBe('schema');
      });
    });
    
    describe('S2 validation', () => {
      it('should pass for valid S2 output', () => {
        const output = {
          mermaidChart: 'graph TD\n  A --> B',
          metaphor: 'Test metaphor',
          nodes: [{ id: 'a', title: 'A' }]
        };
        
        const result = runQualityGates('S2', output);
        
        expect(result.passed).toBe(true);
      });
      
      it('should check S1->S2 consistency', () => {
        const framework = [
          { id: 'node-1', title: 'Node 1', summary: 'S1' },
          { id: 'node-2', title: 'Node 2', summary: 'S2' }
        ];
        
        const output = {
          mermaidChart: 'graph TD',
          metaphor: 'Test',
          nodes: [{ id: 'node-1', title: 'Node 1' }] // missing node-2
        };
        
        const result = runQualityGates('S2', output, { framework });
        
        // Should warn about missing coverage
        expect(result.issues.some(i => i.area === 'coverage' || i.area === 'consistency')).toBe(true);
      });
    });
    
    describe('S3 validation', () => {
      it('should check strategySpec completeness', () => {
        const output = {
          actionPlan: [{ id: '1', text: 'Task 1', isCompleted: false }],
          kpis: ['KPI 1'],
          strategySpec: {
            metrics: [
              {
                metricId: 'metric-1',
                what: 'What',
                why: 'Why',
                // missing required fields
              }
            ]
          },
          telemetry: {}
        };
        
        const nodes = [{ id: 'metric-1' }];
        const result = runQualityGates('S3', output, { nodes });
        
        // Should have actionability issues
        const actionabilityIssues = result.issues.filter(i => i.area === 'actionability');
        expect(actionabilityIssues.length).toBeGreaterThan(0);
      });
      
      it('should check node coverage', () => {
        const output = {
          actionPlan: [{ id: '1', text: 'Task', isCompleted: false }],
          kpis: ['KPI'],
          strategySpec: {
            metrics: []
          },
          telemetry: {}
        };
        
        const nodes = [{ id: 'node-1' }, { id: 'node-2' }];
        const result = runQualityGates('S3', output, { nodes });
        
        // Should fail due to uncovered nodes
        expect(result.passed).toBe(false);
        const coverageIssues = result.issues.filter(i => i.area === 'coverage');
        expect(coverageIssues.length).toBeGreaterThan(0);
      });
    });
  });
});

