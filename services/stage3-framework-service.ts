/**
 * Stage 3 Framework Generation Service - 通用框架生成服务
 * 
 * 基于确认的Mission Statement生成Universal Action System
 */

import { NextResponse } from 'next/server';
import type { ClarifiedMission, UniversalFramework, Stage3FrameworkResponse, FrameworkNode, FrameworkEdge } from '@/lib/types-v2';
import { generateJson } from '@/lib/gemini-config';
import {
  getUniversalFrameworkPrompt,
  getStage3FrameworkConfig,
} from '@/lib/prompts/stage3-framework-prompts';
import { getColorForWeight } from '@/lib/types-v2';
import { logger } from '@/lib/logger';
import { handleNoApiKeyResult } from '@/lib/api-fallback';

export class Stage3FrameworkService {
  private static instance: Stage3FrameworkService;
  
  private constructor() {}
  
  static getInstance(): Stage3FrameworkService {
    if (!Stage3FrameworkService.instance) {
      Stage3FrameworkService.instance = new Stage3FrameworkService();
    }
    return Stage3FrameworkService.instance;
  }
  
  /**
   * 生成通用框架
   */
  async generateFramework(mission: ClarifiedMission): Promise<NextResponse<Stage3FrameworkResponse>> {
    logger.info('[Stage3FrameworkService] Generating universal framework');
    
    try {
      const prompt = getUniversalFrameworkPrompt(mission);
      const config = getStage3FrameworkConfig();
      
      const aiResponse = await generateJson<{
        systemName: string;
        systemGoal: string;
        nodes: Array<{
          id: string;
          title: string;
          description: string;
          weight: number;
          weightBreakdown: {
            necessity: number;
            impact: number;
            timeROI: number;
            reasoning: string;
          };
          estimatedTime: string;
          nodeType: 'input' | 'process' | 'output' | 'parallel';
          dependencies: string[];
        }>;
        edges: Array<{
          from: string;
          to: string;
          type: 'required' | 'recommended' | 'optional';
          strength: number;
          description?: string;
        }>;
        mainPath: string[];
        weightingLogic: string;
      }>(prompt, config, 'Pro', 'S3');
      
      // 检查是否是NO_API_KEY错误
      const fallbackResponse = handleNoApiKeyResult(aiResponse, 'S3');
      if (fallbackResponse) {
        return fallbackResponse as NextResponse<Stage3FrameworkResponse>;
      }
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      const result = aiResponse.data;
      
      // 构建 UniversalFramework
      const nodes: FrameworkNode[] = result.nodes.map(node => ({
        id: node.id,
        title: node.title,
        description: node.description,
        weight: node.weight,
        estimatedTime: node.estimatedTime,
        nodeType: node.nodeType,
        color: getColorForWeight(node.weight),
        dependencies: node.dependencies,
        weightBreakdown: {
          necessity: node.weightBreakdown.necessity,
          impact: node.weightBreakdown.impact,
          timeROI: node.weightBreakdown.timeROI,
        },
      }));
      
      const edges: FrameworkEdge[] = result.edges.map(edge => ({
        from: edge.from,
        to: edge.to,
        type: edge.type,
        strength: edge.strength,
        description: edge.description,
      }));
      
      const framework: UniversalFramework = {
        purpose: mission.missionStatement,
        domain: mission.context,
        nodes,
        edges,
        weightingLogic: result.weightingLogic,
        mainPath: result.mainPath,
        generatedAt: Date.now(),
      };
      
      logger.info('[Stage3FrameworkService] Framework generated successfully', {
        nodeCount: framework.nodes.length,
        edgeCount: framework.edges.length,
      });
      
      return NextResponse.json({
        success: true,
        data: framework,
        message: `Generated ${framework.nodes.length} nodes and ${framework.edges.length} connections.`,
      });
      
    } catch (error) {
      logger.error('[Stage3FrameworkService] generateFramework error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
}

