/**
 * Stage 7 Personalization Service - 个性化方案生成服务
 * 
 * 使用特殊性整合prompt生成Personal Action Framework
 */

import { NextResponse } from 'next/server';
import type {
  UniversalFramework,
  HighLeveragePoint,
  UserContextInfo,
  PersonalizedActionFramework,
  PersonalInsight,
  PersonalizedModule,
  PersonalizedAction,
  Stage7PersonalizedResponse,
} from '@/lib/types-v2';
import { generateJson } from '@/lib/gemini-config';
import {
  getPersonalizedFrameworkPrompt,
  getStage7PersonalizationConfig,
} from '@/lib/prompts/stage7-personalization-prompts';
import { logger } from '@/lib/logger';
import { handleNoApiKeyResult } from '@/lib/api-fallback';

export class Stage7PersonalizationService {
  private static instance: Stage7PersonalizationService;
  
  private constructor() {}
  
  static getInstance(): Stage7PersonalizationService {
    if (!Stage7PersonalizationService.instance) {
      Stage7PersonalizationService.instance = new Stage7PersonalizationService();
    }
    return Stage7PersonalizationService.instance;
  }
  
  /**
   * 生成个性化行动框架
   */
  async generatePersonalizedFramework(
    framework: UniversalFramework,
    diagnosticPoints: HighLeveragePoint[],
    userAnswers: UserContextInfo[]
  ): Promise<NextResponse<Stage7PersonalizedResponse>> {
    logger.info('[Stage7PersonalizationService] Generating personalized framework', {
      diagnosticPointsCount: diagnosticPoints.length,
      userAnswersCount: userAnswers.length,
    });
    
    try {
      const prompt = getPersonalizedFrameworkPrompt(framework, diagnosticPoints, userAnswers);
      const config = getStage7PersonalizationConfig();
      
      const aiResponse = await generateJson<{
        personalInsights: Array<{
          diagnosticPoint: string;
          derivedInsight: string;
        }>;
        personalizedFramework: {
          nodes: Array<{
            id: string;
            title: string;
            description: string;
            weight: number;
            adjustedWeight?: number;
            personalStatus: 'strength' | 'opportunity' | 'maintenance';
            coachNote: string;
            nextMoves?: string[];
            estimatedTime: string;
            nodeType: string;
            dependencies: string[];
            weightBreakdown?: {
              necessity: number;
              impact: number;
              timeROI: number;
            };
          }>;
          edges: Array<{
            from: string;
            to: string;
            type: string;
            strength: number;
            description?: string;
          }>;
        };
        emergingSuperpower: string;
        firstStep: string;
      }>(prompt, config, 'Pro', 'S7');
      
      // 检查是否是NO_API_KEY错误
      const fallbackResponse = handleNoApiKeyResult(aiResponse, 'S7');
      if (fallbackResponse) {
        return fallbackResponse as NextResponse<Stage7PersonalizedResponse>;
      }
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      const result = aiResponse.data;
      
      // 构建PersonalInsights
      const personalInsights: PersonalInsight[] = result.personalInsights.map(insight => ({
        diagnosticPoint: insight.diagnosticPoint,
        derivedInsight: insight.derivedInsight,
      }));
      
      // 构建PersonalizedActionMap
      // 按照status分组节点
      const strengthNodes = result.personalizedFramework.nodes.filter(n => n.personalStatus === 'strength');
      const opportunityNodes = result.personalizedFramework.nodes.filter(n => n.personalStatus === 'opportunity');
      const maintenanceNodes = result.personalizedFramework.nodes.filter(n => n.personalStatus === 'maintenance');
      
      const modules: PersonalizedModule[] = [
        {
          moduleName: 'Strength Zone',
          actions: strengthNodes.map(node => ({
            action: node.title,
            status: 'strength' as const,
            coachNote: node.coachNote,
          })),
        },
        {
          moduleName: 'Opportunity Zone',
          actions: opportunityNodes.map(node => ({
            action: node.title,
            status: 'opportunity' as const,
            coachNote: node.coachNote,
            nextMoves: node.nextMoves,
          })),
        },
        {
          moduleName: 'Maintenance Zone',
          actions: maintenanceNodes.map(node => ({
            action: node.title,
            status: 'maintenance' as const,
            coachNote: node.coachNote,
          })),
        },
      ];
      
      // 构建调整后的框架
      const adjustedFramework: UniversalFramework = {
        ...framework,
        nodes: result.personalizedFramework.nodes.map(node => ({
          id: node.id,
          title: node.title,
          description: node.description,
          weight: node.adjustedWeight || node.weight,
          estimatedTime: node.estimatedTime,
          nodeType: node.nodeType as 'input' | 'process' | 'output' | 'parallel',
          color: 'BLUE' as const, // 会根据weight重新计算
          dependencies: node.dependencies,
          weightBreakdown: node.weightBreakdown,
        })),
        edges: result.personalizedFramework.edges.map(edge => ({
          from: edge.from,
          to: edge.to,
          type: edge.type as 'required' | 'recommended' | 'optional',
          strength: edge.strength,
          description: edge.description,
        })),
      };
      
      const personalizedFramework: PersonalizedActionFramework = {
        personalInsights,
        personalizedFramework: adjustedFramework,
        actionMap: {
          modules,
        },
        emergingSuperpower: result.emergingSuperpower,
        firstStep: result.firstStep,
        generatedAt: Date.now(),
      };
      
      logger.info('[Stage7PersonalizationService] Personalized framework generated', {
        insightsCount: personalInsights.length,
        modulesCount: modules.length,
      });
      
      return NextResponse.json({
        success: true,
        data: personalizedFramework,
        message: 'Your personalized action framework is ready!',
      });
      
    } catch (error) {
      logger.error('[Stage7PersonalizationService] generatePersonalizedFramework error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
}


