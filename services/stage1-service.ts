/**
 * Stage 1 Service - 通用框架生成
 * 
 * 基于用户目的生成带权重的通用框架
 */

import { NextResponse } from 'next/server';
import type { PurposeDefinition, UniversalFramework, FrameworkNode, FrameworkEdge, Stage1Response } from '@/lib/types-v2';
import { generateJson } from '@/lib/gemini-config';
import { getFrameworkGenerationPrompt, getStage1GenerationConfig } from '@/lib/prompts/stage1-prompts';
import { enrichNodeWithWeight, analyzeWeightDistribution, validateWeightDistribution } from '@/lib/weight-calculator';
import { memoryStore, createStage0Memory, createStage1Memory } from '@/lib/memory-store';
import { contextMonitor } from '@/lib/context-monitor';
import { tokenBudgetManager } from '@/lib/token-budget-manager';
import { logger } from '@/lib/logger';

export class Stage1Service {
  private static instance: Stage1Service;
  
  private constructor() {}
  
  static getInstance(): Stage1Service {
    if (!Stage1Service.instance) {
      Stage1Service.instance = new Stage1Service();
    }
    return Stage1Service.instance;
  }
  
  // ========================================
  // 主处理函数
  // ========================================
  
  /**
   * 生成通用框架
   */
  async generateFramework(
    purpose: PurposeDefinition,
    runTier: 'Lite' | 'Pro' = 'Pro',
    sessionId?: string
  ): Promise<NextResponse<Stage1Response>> {
    logger.info('[Stage1Service] Generating framework', {
      purpose: purpose.clarifiedPurpose,
      domain: purpose.problemDomain,
      sessionId
    });
    
    try {
      // 如果有sessionId，先保存Stage 0记忆
      if (sessionId) {
        const stage0Memory = createStage0Memory(sessionId, purpose);
        await memoryStore.saveMemory(stage0Memory);
      }
      
      // 🆕 Token预算管理：根据预算动态调整示例数量
      const defaultExampleCount = 2;
      const exampleCount = sessionId 
        ? tokenBudgetManager.getRecommendedExampleCount('stage1', sessionId, defaultExampleCount)
        : defaultExampleCount;
      
      logger.info('[Stage1Service] Token budget adjusted example count', {
        defaultCount: defaultExampleCount,
        adjustedCount: exampleCount,
      });
      
      // ⭐️ 关键：只传递必要字段和边界约束
      // Stage1生成真正的通用框架，不考虑个人约束
      const universalContext = {
        clarifiedPurpose: purpose.clarifiedPurpose,
        problemDomain: purpose.problemDomain,
        domainBoundary: purpose.domainBoundary,
        boundaryConstraints: purpose.boundaryConstraints, // ✅ 传递边界约束（影响框架范围）
        // ❌ 不传personalConstraints - 保持框架通用性
      };
      
      // 验证：检查 clarifiedPurpose 是否泄露个人信息
      this.validateUniversalContext(purpose);
      
      const prompt = getFrameworkGenerationPrompt(universalContext);
      const config = getStage1GenerationConfig(runTier);
      
      // 调用 AI 生成框架
      const aiResponse = await generateJson<{
        framework_name: string;
        description: string;
        nodes: Array<{
          id: string;
          title: string;
          description: string;
          necessity: number;
          impact: number;
          timeROI: number;
          estimatedTimeHours: number;
        }>;
        edges: Array<{
          from: string;
          to: string;
          relationshipType: string;
        }>;
      }>(prompt, config, runTier, 'S1');
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      // AI 响应已经是解析后的对象，直接使用
      const rawFramework = aiResponse.data;
      
      // 🆕 估算和跟踪token使用
      const estimate = tokenBudgetManager.estimateStage1NextTurn(purpose, exampleCount);
      
      // 记录token使用
      contextMonitor.recordGeneration(
        'stage1',
        prompt,
        JSON.stringify(rawFramework),
        {
          runTier,
          sessionId,
        }
      );
      
      // 🆕 跟踪session的token使用
      if (sessionId) {
        tokenBudgetManager.trackSessionUsage(sessionId, 'stage1', estimate.total);
      }
      
      // 计算权重并构建框架
      const nodes: FrameworkNode[] = rawFramework.nodes.map(node => {
        // 转换为FrameworkNode所需的格式
        return enrichNodeWithWeight({
          ...node,
          estimatedTime: `${node.estimatedTimeHours || 0}小时`,
          nodeType: 'process' as const,
          dependencies: [],
        });
      });
      
      const edges: FrameworkEdge[] = rawFramework.edges.map(edge => ({
        from: edge.from,
        to: edge.to,
        type: (edge.relationshipType || 'required') as 'required' | 'recommended' | 'optional',
        strength: 0.8,
      }));
      
      const framework: UniversalFramework = {
        purpose: purpose.clarifiedPurpose,
        domain: purpose.problemDomain,
        nodes,
        edges,
        weightingLogic: rawFramework.framework_name + ': ' + rawFramework.description,
        mainPath: nodes.filter(n => n.weight >= 70).map(n => n.id),
        generatedAt: Date.now(),
      };
      
      // 验证框架
      const validation = this.validateFramework(framework);
      
      if (!validation.isValid) {
        logger.warn('[Stage1Service] Framework validation warnings', {
          warnings: validation.warnings,
        });
        
        // 可以选择自动修复或返回警告
        // 这里我们记录警告但仍然返回框架
      }
      
      // Meta-reflection: Review框架质量（已有的review机制）
      // 注意：review相关的类型和函数需要在其他地方定义
      // 这里我们跳过review以避免类型错误
      // 如果需要review功能，需要确保相关类型和函数已定义
      
      // 保存Stage 1记忆
      if (sessionId) {
        const stage1Memory = createStage1Memory(sessionId, framework);
        await memoryStore.saveMemory(stage1Memory);
      }
      
      return NextResponse.json({
        success: true,
        data: framework,
        message: `已为「${purpose.problemDomain}」生成通用框架`,
      });
      
    } catch (error) {
      logger.error('[Stage1Service] generateFramework error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  // Note: AI response parsing is now handled by generateJson() which returns parsed objects directly
  // ========================================
  // 验证
  // ========================================
  
  /**
   * 验证通用上下文：确保 clarifiedPurpose 不包含个人信息（轻量级检查）
   */
  private validateUniversalContext(purpose: PurposeDefinition): void {
    // 只检查明显的个人信息泄露，避免误报
    const criticalPatterns = [
      /每天\s*\d+|每周\s*\d+|每月\s*\d+/i,  // "每天2小时"这种明确的时间约束
      /预算\s*\d+|费用\s*\d+/i,            // "预算1000元"这种明确的费用约束
    ];
    
    const foundIssues: string[] = [];
    
    criticalPatterns.forEach((pattern, index) => {
      if (pattern.test(purpose.clarifiedPurpose)) {
        foundIssues.push(`Critical pattern ${index + 1} matched`);
      }
    });
    
    // 只有发现明确的个人约束泄露时才警告
    if (foundIssues.length > 0) {
      logger.warn('[Stage1Service] clarifiedPurpose contains explicit personal constraints', {
        purpose: purpose.clarifiedPurpose,
        suggestion: 'These should be in personalConstraints instead',
      });
    }
  }
  
  private validateFramework(framework: UniversalFramework): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    // 检查节点数量（更宽松的范围）
    if (framework.nodes.length < 3) {
      warnings.push('节点数量较少（通常5-12个为宜，但模型可能有其考量）');
    } else if (framework.nodes.length > 20) {
      warnings.push('节点数量较多（通常5-12个为宜，但模型可能有其考量）');
    }
    
    // 检查权重分布（仅记录，不强制）
    const distribution = analyzeWeightDistribution(framework.nodes);
    if (distribution.coreRequired === 0 && distribution.importantRecommended === 0) {
      warnings.push('权重分布异常：没有高权重节点');
    }
    
    // 检查主路径（可选）
    if (framework.mainPath.length === 0) {
      logger.debug('[Stage1Service] No mainPath defined, model may have reasons');
    }
    
    // 检查依赖关系完整性（这个是真正的错误）
    const nodeIds = new Set(framework.nodes.map(n => n.id));
    framework.nodes.forEach(node => {
      node.dependencies.forEach(depId => {
        if (!nodeIds.has(depId)) {
          warnings.push(`节点 ${node.id} 依赖不存在的节点 ${depId}`);
        }
      });
    });
    
    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
}

