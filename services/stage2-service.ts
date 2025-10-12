/**
 * Stage 2 Service - 个性化方案生成
 * 
 * 动态收集用户信息并生成个性化方案
 */

import { NextResponse } from 'next/server';
import type {
  UniversalFramework,
  DynamicQuestion,
  UserContextInfo,
  PersonalizedPlan,
  Stage2Response,
  FrameworkNode,
} from '@/lib/types-v2';
import { generateJson } from '@/lib/gemini-config';
import {
  getMissingInfoAnalysisPrompt,
  getPersonalizedPlanPrompt,
  getStage2GenerationConfig,
} from '@/lib/prompts/stage2-prompts';
import { enrichNodeWithWeight, analyzeWeightDistribution } from '@/lib/weight-calculator';
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';

export class Stage2Service {
  private static instance: Stage2Service;
  
  private constructor() {}
  
  static getInstance(): Stage2Service {
    if (!Stage2Service.instance) {
      Stage2Service.instance = new Stage2Service();
    }
    return Stage2Service.instance;
  }
  
  // ========================================
  // 主处理函数
  // ========================================
  
  /**
   * 分析缺失信息并生成动态问题
   */
  async analyzeMissingInfo(
    framework: UniversalFramework
  ): Promise<NextResponse<Stage2Response>> {
    logger.info('[Stage2Service] Analyzing missing information', {
      nodeCount: framework.nodes.length,
    });
    
    try {
      const prompt = getMissingInfoAnalysisPrompt(framework);
      const config = getStage2GenerationConfig();
      
      // 调用 AI 分析缺失信息
      const aiResponse = await generateJson<{
        missing_info_analysis: string;
        questions: Array<{
          id: string;
          questionType: 'baseline' | 'resource' | 'context' | 'motivation';
          questionText: string;
          impactOnFramework: string;
          priority: 'high' | 'medium' | 'low';
        }>;
      }>(prompt, config, 'Pro', 'S2');
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      // AI 响应已经是解析后的对象
      const responseData = aiResponse.data;
      const questions: DynamicQuestion[] = responseData.questions.map((q, index) => ({
        id: q.id || `q${index + 1}`,
        question: q.questionText,
        whyMatters: q.impactOnFramework,
        affects: [],
        impactLevel: q.priority === 'high' ? 5 : q.priority === 'medium' ? 3 : 1,
      }));
      
      // 验证问题
      const validation = this.validateQuestions(questions, framework);
      
      if (!validation.isValid) {
        logger.warn('[Stage2Service] Question validation warnings', {
          warnings: validation.warnings,
        });
      }
      
      return NextResponse.json({
        success: true,
        data: {
          questions,
        },
        message: '我需要了解一些关于你的信息，以便为你定制方案',
        nextAction: 'collect_info',
      });
      
    } catch (error) {
      logger.error('[Stage2Service] analyzeMissingInfo error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  /**
   * 生成个性化方案
   */
  async generatePersonalizedPlan(
    framework: UniversalFramework,
    collectedInfo: UserContextInfo[]
  ): Promise<NextResponse<Stage2Response>> {
    logger.info('[Stage2Service] Generating personalized plan', {
      infoCount: collectedInfo.length,
    });
    
    try {
      // 准备用户信息
      const userInfo = collectedInfo.map(info => ({
        questionId: info.questionId,
        answer: info.answer,
      }));
      
      const prompt = getPersonalizedPlanPrompt(framework, userInfo);
      const config = getStage2GenerationConfig();
      
      // 调用 AI 生成方案
      const aiResponse = await generateJson<{
        adjustment_rationale: string;
        updated_weights: Array<{
          nodeId: string;
          newWeight: number;
          reason: string;
        }>;
        action_steps: Array<{
          id: string;
          title: string;
          description: string;
          priority: 'high' | 'medium' | 'low';
          estimatedTimeHours: number;
          linkedNodeIds: string[];
        }>;
        milestones: Array<{
          id: string;
          title: string;
          description: string;
          timelineWeeks: number;
        }>;
        personalized_tips: Array<{
          category: string;
          tip: string;
        }>;
      }>(prompt, config, 'Pro', 'S2');
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      // AI 响应已经是解析后的对象
      const responseData = aiResponse.data;
      
      // 更新节点权重
      const updatedNodes = framework.nodes.map(node => {
        const update = responseData.updated_weights.find(u => u.nodeId === node.id);
        return update ? { ...node, weight: update.newWeight } : node;
      });
      
      const plan: PersonalizedPlan = {
        adjustmentRationale: responseData.adjustment_rationale,
        updatedFramework: {
          ...framework,
          nodes: updatedNodes,
        },
        actionSteps: responseData.action_steps.map((step, index) => ({
          id: step.id || `step${index + 1}`,
          title: step.title,
          description: step.description,
          relatedNodeId: step.linkedNodeIds[0] || '',
          startTime: '第1周',
          endTime: '第2周',
          priority: step.priority,
          prerequisites: [],
        })),
        milestones: responseData.milestones.map((m, index) => ({
          id: m.id || `milestone${index + 1}`,
          title: m.title,
          successCriteria: [m.description],
          expectedTime: `第${m.timelineWeeks}周`,
          relatedSteps: [],
        })),
        personalizedTips: responseData.personalized_tips.map(t => t.tip),
      };
      
      // 验证方案
      const validation = this.validatePlan(plan);
      
      if (!validation.isValid) {
        logger.warn('[Stage2Service] Plan validation warnings', {
          warnings: validation.warnings,
        });
      }
      
      return NextResponse.json({
        success: true,
        data: {
          plan,
        },
        message: '已为你生成个性化方案',
        nextAction: 'complete',
      });
      
    } catch (error) {
      logger.error('[Stage2Service] generatePersonalizedPlan error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  // ========================================
  // 解析函数
  // ========================================
  
  private parseQuestionsResponse(aiResponse: string): DynamicQuestion[] {
    try {
      // 提取 JSON
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      const parsed = JSON.parse(jsonStr);
      
      const questions = parsed.questions || [];
      
      return questions.map((q: Partial<DynamicQuestion>, index: number) => ({
        id: q.id || `q${index + 1}`,
        question: q.question || '',
        whyMatters: q.whyMatters || '',
        affects: q.affects || [],
        impactLevel: q.impactLevel || 3,
        questionType: q.questionType || 'context',
      }));
      
    } catch (error) {
      logger.error('[Stage2Service] Failed to parse questions response', { error, aiResponse: aiResponse.slice(0, 200) });
      
      // 降级：返回通用问题
      return [
        {
          id: 'q1',
          question: '你目前在这个领域有哪些基础？',
          whyMatters: '了解你的起点，避免重复学习',
          affects: [],
          impactLevel: 4,
          questionType: 'baseline',
        },
        {
          id: 'q2',
          question: '你每周可以投入多少时间？',
          whyMatters: '帮助规划合理的时间表',
          affects: [],
          impactLevel: 5,
          questionType: 'resource',
        },
        {
          id: 'q3',
          question: '你最希望在哪些方面取得突破？',
          whyMatters: '确定优先级和重点',
          affects: [],
          impactLevel: 4,
          questionType: 'motivation',
        },
      ];
    }
  }
  
  private parsePlanResponse(
    aiResponse: string,
    originalFramework: UniversalFramework,
    collectedInfo: UserContextInfo[]
  ): PersonalizedPlan {
    try {
      // 提取 JSON
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      const parsed = JSON.parse(jsonStr);
      
      // 处理调整后的框架
      let adjustedFramework = parsed.adjustedFramework;
      
      // 确保节点有正确的权重和颜色
      if (adjustedFramework && adjustedFramework.nodes) {
        const enrichedNodes: FrameworkNode[] = adjustedFramework.nodes.map((node: Partial<FrameworkNode>) => {
          // 如果节点已有 weightBreakdown，使用它；否则保持原框架的权重
          if (node.weightBreakdown) {
            return enrichNodeWithWeight({
              id: node.id || '',
              title: node.title || '',
              description: node.description || '',
              estimatedTime: node.estimatedTime || '',
              nodeType: node.nodeType || 'process',
              dependencies: node.dependencies || [],
              weightBreakdown: node.weightBreakdown,
            });
          } else {
            // 找到原节点
            const originalNode = originalFramework.nodes.find(n => n.id === node.id);
            return {
              ...node,
              weight: node.weight || originalNode?.weight || 50,
              color: node.color || originalNode?.color || 'LIGHT_BLUE',
            } as FrameworkNode;
          }
        });
        
        adjustedFramework = {
          ...adjustedFramework,
          nodes: enrichedNodes,
          generatedAt: Date.now(),
        };
      } else {
        // 如果没有调整后的框架，使用原框架
        adjustedFramework = originalFramework;
      }
      
      return {
        adjustedFramework,
        actionSteps: parsed.actionSteps || [],
        milestones: parsed.milestones || [],
        personalizedTips: parsed.personalizedTips || [],
        collectedInfo,
        adjustmentRationale: parsed.adjustmentRationale || '基于你的实际情况进行了调整',
        generatedAt: Date.now(),
      };
      
    } catch (error) {
      logger.error('[Stage2Service] Failed to parse plan response', { error, aiResponse: aiResponse.slice(0, 200) });
      
      // 降级：返回原框架和基础方案
      return {
        adjustedFramework: originalFramework,
        actionSteps: [],
        milestones: [],
        personalizedTips: ['方案生成遇到问题，请稍后重试'],
        collectedInfo,
        adjustmentRationale: '使用原始框架',
        generatedAt: Date.now(),
      };
    }
  }
  
  // ========================================
  // 验证函数
  // ========================================
  
  private validateQuestions(
    questions: DynamicQuestion[],
    framework: UniversalFramework
  ): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    // 检查问题数量
    if (questions.length < 2) {
      warnings.push('问题数量过少（建议3-5个）');
    } else if (questions.length > 8) {
      warnings.push('问题数量过多（建议3-5个）');
    }
    
    // 检查问题质量
    questions.forEach((q, index) => {
      if (!q.question || q.question.length < 10) {
        warnings.push(`问题 ${index + 1} 过于简短`);
      }
      
      if (!q.whyMatters || q.whyMatters.length < 10) {
        warnings.push(`问题 ${index + 1} 缺少重要性说明`);
      }
      
      if (q.impactLevel < 1 || q.impactLevel > 5) {
        warnings.push(`问题 ${index + 1} 的影响力等级无效`);
      }
      
      // 检查 affects 字段是否引用了有效的节点
      if (q.affects && q.affects.length > 0) {
        const nodeIds = new Set(framework.nodes.map(n => n.id));
        q.affects.forEach(nodeId => {
          if (!nodeIds.has(nodeId)) {
            warnings.push(`问题 ${index + 1} 引用了不存在的节点 ${nodeId}`);
          }
        });
      }
    });
    
    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
  
  private validatePlan(plan: PersonalizedPlan): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    // 检查行动步骤
    if (plan.actionSteps.length === 0) {
      warnings.push('缺少行动步骤');
    }
    
    // 检查里程碑
    if (plan.milestones.length === 0) {
      warnings.push('缺少里程碑');
    }
    
    // 检查个性化建议
    if (plan.personalizedTips.length === 0) {
      warnings.push('缺少个性化建议');
    }
    
    // 检查步骤与框架节点的关联
    const nodeIds = new Set(plan.adjustedFramework.nodes.map(n => n.id));
    plan.actionSteps.forEach((step, index) => {
      if (step.relatedNodeId && !nodeIds.has(step.relatedNodeId)) {
        warnings.push(`步骤 ${index + 1} 关联了不存在的节点 ${step.relatedNodeId}`);
      }
      
      if (!step.title || step.title.length < 5) {
        warnings.push(`步骤 ${index + 1} 标题过短`);
      }
      
      if (!step.description || step.description.length < 10) {
        warnings.push(`步骤 ${index + 1} 描述过短`);
      }
    });
    
    // 检查权重分布
    const distribution = analyzeWeightDistribution(plan.adjustedFramework.nodes);
    if (distribution.total === 0 || (distribution.coreRequired === 0 && distribution.importantRecommended === 0)) {
      warnings.push('调整后的框架权重异常');
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
}

