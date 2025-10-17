/**
 * Stage 5-6 Diagnostic Service - 权重分析和诊断提问服务
 * 
 * 使用框架提取提问prompt分析高杠杆点并生成诊断问题
 */

import { NextResponse } from 'next/server';
import type {
  UniversalFramework,
  WeightAnalysis,
  DiagnosticQuestion,
  HighLeveragePoint,
  Stage56DiagnosticResponse,
  UserContextInfo,
} from '@/lib/types-v2';
import { generateJson } from '@/lib/gemini-config';
import {
  getHighLeverageAnalysisPrompt,
  getStage5DiagnosticConfig,
} from '@/lib/prompts/stage5-diagnostic-prompts';
import { logger } from '@/lib/logger';
import { handleNoApiKeyResult } from '@/lib/api-fallback';

export class Stage56DiagnosticService {
  private static instance: Stage56DiagnosticService;
  
  private constructor() {}
  
  static getInstance(): Stage56DiagnosticService {
    if (!Stage56DiagnosticService.instance) {
      Stage56DiagnosticService.instance = new Stage56DiagnosticService();
    }
    return Stage56DiagnosticService.instance;
  }
  
  /**
   * Stage 5: 分析权重，识别高杠杆点
   */
  async analyzeWeights(
    framework: UniversalFramework
  ): Promise<NextResponse<Stage56DiagnosticResponse>> {
    logger.info('[Stage56DiagnosticService] Analyzing weights');
    
    try {
      const fokalPoint = framework.purpose; // 使用purpose作为focal point
      const prompt = getHighLeverageAnalysisPrompt(framework, fokalPoint);
      const config = getStage5DiagnosticConfig();
      
      const aiResponse = await generateJson<{
        highLeveragePoints: Array<{
          id: string;
          technicalName: string;
          coachTitle: string;
          coachExplanation: string;
          question: string;
          affectedNodeIds: string[];
          reasoning: string;
        }>;
        analysisRationale: string;
      }>(prompt, config, 'Pro', 'S5');
      
      // 检查是否是NO_API_KEY错误
      const fallbackResponse = handleNoApiKeyResult(aiResponse, 'S5');
      if (fallbackResponse) {
        return fallbackResponse as NextResponse<Stage56DiagnosticResponse>;
      }
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      const result = aiResponse.data;
      
      // 构建WeightAnalysis
      const highLeveragePoints: HighLeveragePoint[] = result.highLeveragePoints.map(hlp => ({
        id: hlp.id,
        technicalName: hlp.technicalName,
        coachTitle: hlp.coachTitle,
        coachExplanation: hlp.coachExplanation,
        question: hlp.question,
        affectedNodeIds: hlp.affectedNodeIds,
        reasoning: hlp.reasoning,
      }));
      
      const analysis: WeightAnalysis = {
        framework,
        highLeveragePoints,
        analysisRationale: result.analysisRationale,
        generatedAt: Date.now(),
      };
      
      // 转换为DiagnosticQuestion格式
      const questions: DiagnosticQuestion[] = highLeveragePoints.map((hlp, index) => ({
        id: hlp.id,
        question: hlp.question,
        whyMatters: hlp.coachExplanation,
        affects: hlp.affectedNodeIds,
        impactLevel: 5 - index, // 前面的问题影响力更高
        questionType: 'baseline' as const,
        leveragePointId: hlp.id,
        coachExplanation: hlp.coachExplanation,
      }));
      
      logger.info('[Stage56DiagnosticService] Weight analysis completed', {
        leveragePointsCount: highLeveragePoints.length,
        questionsCount: questions.length,
      });
      
      return NextResponse.json({
        success: true,
        data: {
          analysis,
          questions,
        },
        message: `Identified ${highLeveragePoints.length} key focus areas for your personalization.`,
        nextAction: 'questioning',
      });
      
    } catch (error) {
      logger.error('[Stage56DiagnosticService] analyzeWeights error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  /**
   * Stage 6: 收集用户答案，准备进入Stage 7
   */
  async collectAnswers(
    userAnswers: UserContextInfo[]
  ): Promise<NextResponse<Stage56DiagnosticResponse>> {
    logger.info('[Stage56DiagnosticService] Collecting answers', {
      answerCount: userAnswers.length,
    });
    
    try {
      // 验证是否有足够的答案
      if (userAnswers.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Please answer at least one question before proceeding.',
        }, { status: 400 });
      }
      
      return NextResponse.json({
        success: true,
        message: `Great! I've collected ${userAnswers.length} answers. Now generating your personalized action framework...`,
        nextAction: 'generate_plan',
      });
      
    } catch (error) {
      logger.error('[Stage56DiagnosticService] collectAnswers error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
}


