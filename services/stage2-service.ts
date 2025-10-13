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
import { memoryStore, createStage2Memory } from '@/lib/memory-store';
import { contextMonitor } from '@/lib/context-monitor';
import { tokenBudgetManager } from '@/lib/token-budget-manager';
import { validateStage2Questions, validateStage2Plan } from '@/lib/output-validator';
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
   * 
   * @param framework - Stage1 生成的通用框架
   * @param personalConstraints - 从 Stage0 传递过来的个人约束
   * @param conversationInsights - 从 Stage0 传递的对话关键洞察
   * @param sessionId - 会话ID
   */
  async analyzeMissingInfo(
    framework: UniversalFramework,
    personalConstraints: string[],
    conversationInsights?: string,
    sessionId?: string
  ): Promise<NextResponse<Stage2Response>> {
    logger.info('[Stage2Service] Analyzing missing information', {
      nodeCount: framework.nodes.length,
      personalConstraintsCount: personalConstraints.length,
      hasInsights: !!conversationInsights,
      sessionId
    });
    
    try {
      // 可选：加载前面stage的记忆以提供context
      if (sessionId) {
        const previousMemories = await memoryStore.queryMemory({
          sessionId,
          limit: 2
        });
        
        if (previousMemories.length > 0) {
          logger.debug('[Stage2Service] Loaded previous stage memories', {
            memoryCount: previousMemories.length
          });
        }
      }
      
      // ⭐️ 传入 personalConstraints 和 conversationInsights 用于个性化
      const prompt = getMissingInfoAnalysisPrompt(
        framework, 
        personalConstraints,
        conversationInsights
      );
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
        questionType: q.questionType,
        questionText: q.questionText,
        impactOnFramework: q.impactOnFramework,
        priority: q.priority,
        question: q.questionText,
        whyMatters: q.impactOnFramework,
        affects: [],
        impactLevel: q.priority === 'high' ? 5 : q.priority === 'medium' ? 3 : 1,
      }));
      
      // 🆕 使用新的验证器
      const validation = validateStage2Questions(questions);
      
      if (!validation.isValid) {
        logger.warn('[Stage2Service] Question validation issues', {
          errorCount: validation.errorCount,
          warningCount: validation.warningCount,
          issues: validation.issues.map(i => i.checkName),
        });
      }
      
      // 🆕 估算和跟踪token使用
      const estimate = tokenBudgetManager.estimateStage2NextTurn(framework.nodes.length, 1);
      
      // 记录token使用
      contextMonitor.recordGeneration(
        'stage2',
        prompt,
        JSON.stringify(responseData),
        {
          runTier: 'Pro',
          sessionId,
        }
      );
      
      // 🆕 跟踪session的token使用
      if (sessionId) {
        tokenBudgetManager.trackSessionUsage(sessionId, 'stage2', estimate.total);
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
    collectedInfo: UserContextInfo[],
    sessionId?: string
  ): Promise<NextResponse<Stage2Response>> {
    logger.info('[Stage2Service] Generating personalized plan', {
      infoCount: collectedInfo.length,
      sessionId
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
        adjustedFramework: {
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
        collectedInfo,
        generatedAt: Date.now(),
      };
      
      // 验证方案
      const validation = this.validatePlan(plan);
      
      if (!validation.isValid) {
        logger.warn('[Stage2Service] Plan validation warnings', {
          warnings: validation.warnings,
        });
      }
      
      // 保存 Stage 2 记忆
      if (sessionId) {
        const stage2Memory = createStage2Memory(sessionId, plan);
        await memoryStore.saveMemory(stage2Memory);
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
    
    // 检查问题数量（更宽松）
    if (questions.length < 1) {
      warnings.push('至少需要1个问题');
    } else if (questions.length > 10) {
      warnings.push('问题数量较多（通常3-5个，但模型可能有其考量）');
    }
    
    // 检查关键字段是否存在（轻量级检查）
    questions.forEach((q, index) => {
      if (!q.question) {
        warnings.push(`问题 ${index + 1} 缺少question字段`);
      }
      
      if (!q.whyMatters) {
        warnings.push(`问题 ${index + 1} 缺少whyMatters字段`);
      }
      
      // 检查 affects 引用的节点是否存在（真正的错误）
      if (q.affects && q.affects.length > 0) {
        const nodeIds = new Set(framework.nodes.map(n => n.id));
        q.affects.forEach(nodeId => {
          if (!nodeIds.has(nodeId)) {
            warnings.push(`问题 ${index + 1} 引用不存在的节点 ${nodeId}`);
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
    
    // 检查关键组件是否存在（轻量级）
    if (plan.actionSteps.length === 0) {
      warnings.push('缺少行动步骤');
    }
    
    if (plan.personalizedTips.length === 0) {
      logger.debug('[Stage2Service] No personalized tips provided');
    }
    
    // 检查步骤与节点的关联（真正的错误）
    const nodeIds = new Set(plan.adjustedFramework.nodes.map(n => n.id));
    plan.actionSteps.forEach((step, index) => {
      if (step.relatedNodeId && !nodeIds.has(step.relatedNodeId)) {
        warnings.push(`步骤 ${index + 1} 关联不存在的节点 ${step.relatedNodeId}`);
      }
    });
    
    // 检查权重分布（轻量级）
    const distribution = analyzeWeightDistribution(plan.adjustedFramework.nodes);
    if (distribution.total === 0) {
      warnings.push('权重分布异常：所有节点权重为0');
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
}

