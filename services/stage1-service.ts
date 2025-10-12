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
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';

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
    runTier: 'Lite' | 'Pro' = 'Pro'
  ): Promise<NextResponse<Stage1Response>> {
    logger.info('[Stage1Service] Generating framework', {
      purpose: purpose.clarifiedPurpose,
      domain: purpose.problemDomain,
    });
    
    try {
      const prompt = getFrameworkGenerationPrompt(purpose);
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
      
      // 计算权重并构建框架
      const nodes: FrameworkNode[] = rawFramework.nodes.map(node => enrichNodeWithWeight(node));
      
      const edges: FrameworkEdge[] = rawFramework.edges.map(edge => ({
        from: edge.from,
        to: edge.to,
        relationshipType: edge.relationshipType,
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
  
  // ========================================
  // 解析和验证
  // ========================================
  
  private parseFrameworkResponse(
    aiResponse: string,
    purpose: PurposeDefinition
  ): UniversalFramework {
    try {
      // 提取 JSON
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      const parsed = JSON.parse(jsonStr);
      
      const frameworkData = parsed.framework || parsed;
      
      // 为每个节点计算权重和颜色
      const enrichedNodes: FrameworkNode[] = frameworkData.nodes.map((node: Partial<FrameworkNode>) => 
        enrichNodeWithWeight({
          id: node.id || `node-${Date.now()}-${Math.random()}`,
          title: node.title || '未命名节点',
          description: node.description || '',
          estimatedTime: node.estimatedTime || '待定',
          nodeType: node.nodeType || 'process',
          dependencies: node.dependencies || [],
          weightBreakdown: node.weightBreakdown,
        })
      );
      
      return {
        purpose: purpose.clarifiedPurpose,
        domain: purpose.problemDomain,
        nodes: enrichedNodes,
        edges: frameworkData.edges || [],
        weightingLogic: frameworkData.weightingLogic || '基于用户目的的权重计算',
        mainPath: frameworkData.mainPath || [],
        generatedAt: Date.now(),
      };
      
    } catch (error) {
      logger.error('[Stage1Service] Failed to parse framework response', { error, aiResponse: aiResponse.slice(0, 200) });
      throw new Error('框架生成失败，请重试');
    }
  }
  
  private validateFramework(framework: UniversalFramework): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    // 检查节点数量
    if (framework.nodes.length < 3) {
      warnings.push('节点数量过少（建议5-12个）');
    } else if (framework.nodes.length > 15) {
      warnings.push('节点数量过多（建议5-12个）');
    }
    
    // 检查权重分布
    const distribution = analyzeWeightDistribution(framework.nodes);
    const distValidation = validateWeightDistribution(distribution);
    warnings.push(...distValidation.warnings);
    
    // 检查主路径
    if (framework.mainPath.length === 0) {
      warnings.push('缺少主路径定义');
    }
    
    // 检查依赖关系完整性
    const nodeIds = new Set(framework.nodes.map(n => n.id));
    framework.nodes.forEach(node => {
      node.dependencies.forEach(depId => {
        if (!nodeIds.has(depId)) {
          warnings.push(`节点 ${node.id} 的依赖 ${depId} 不存在`);
        }
      });
    });
    
    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
}

