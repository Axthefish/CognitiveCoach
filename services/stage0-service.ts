/**
 * Stage 0 Service - 目的澄清与问题域框定
 * 
 * 通过多轮对话，从用户的模糊输入中提取明确的目的和问题域
 */

import { NextResponse } from 'next/server';
import type { ChatMessage, PurposeDefinition, Stage0Response } from '@/lib/types-v2';
import { generateJson } from '@/lib/gemini-config';
import {
  getInitialCollectionPrompt,
  getDeepDivePrompt,
  getConfirmationPrompt,
  getStage0GenerationConfig,
  isVagueInput,
  getGuidanceForVagueInput,
} from '@/lib/prompts/stage0-prompts';
import { logger } from '@/lib/logger';
import { handleError } from '@/lib/app-errors';

export class Stage0Service {
  private static instance: Stage0Service;
  
  private constructor() {}
  
  static getInstance(): Stage0Service {
    if (!Stage0Service.instance) {
      Stage0Service.instance = new Stage0Service();
    }
    return Stage0Service.instance;
  }
  
  // ========================================
  // 主处理函数
  // ========================================
  
  /**
   * 处理初始输入
   */
  async processInitialInput(userInput: string): Promise<NextResponse<Stage0Response>> {
    logger.info('[Stage0Service] Processing initial input');
    
    try {
      // 检查是否过于模糊
      if (isVagueInput(userInput)) {
        return NextResponse.json({
          success: true,
          data: {
            rawInput: userInput,
            clarifiedPurpose: '',
            problemDomain: '',
            domainBoundary: '',
            keyConstraints: [],
            conversationHistory: [],
            confidence: 0,
            clarificationState: 'COLLECTING',
          },
          message: getGuidanceForVagueInput(),
          nextAction: 'continue_dialogue',
        });
      }
      
      // 调用 AI 进行初始分析
      const prompt = getInitialCollectionPrompt(userInput);
      const config = getStage0GenerationConfig();
      
      const aiResponse = await generateJson<{
        analysis: {
          possible_domains: string[];
          possible_purposes: string[];
          initial_clues: string[];
        };
        next_question: string;
      }>(prompt, config, 'Pro', 'S0');
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      // AI 响应已经是解析后的对象
      const analysis = aiResponse.data;
      
      return NextResponse.json({
        success: true,
        data: {
          rawInput: userInput,
          clarifiedPurpose: analysis.analysis.possible_purposes[0] || '',
          problemDomain: analysis.analysis.possible_domains[0] || '',
          domainBoundary: '',
          keyConstraints: analysis.analysis.initial_clues || [],
          conversationHistory: [],
          confidence: 0.3,
          clarificationState: 'COLLECTING',
        },
        message: analysis.next_question,
        nextAction: 'continue_dialogue',
      });
      
    } catch (error) {
      logger.error('[Stage0Service] processInitialInput error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  /**
   * 处理后续对话轮次
   */
  async processContinuation(
    conversationHistory: ChatMessage[],
    currentDefinition: Partial<PurposeDefinition>
  ): Promise<NextResponse<Stage0Response>> {
    logger.info('[Stage0Service] Processing continuation', {
      historyLength: conversationHistory.length,
    });
    
    try {
      const prompt = getDeepDivePrompt(conversationHistory, currentDefinition);
      const config = getStage0GenerationConfig();
      
      const aiResponse = await generateJson<{
        assessment: {
          clarity_score: number;
          missing_info: string[];
          confidence: number;
        };
        action: 'continue' | 'confirm';
        next_question?: string;
      }>(prompt, config, 'Pro', 'S0');
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      // AI 响应已经是解析后的对象
      const result = aiResponse.data;
      
      // 根据 AI 的判断决定下一步
      if (result.action === 'confirm') {
        // 进入确认阶段
        return this.generateConfirmation(conversationHistory);
      } else {
        // 继续追问
        return NextResponse.json({
          success: true,
          data: {
            ...currentDefinition,
            confidence: result.assessment.confidence,
            clarificationState: 'REFINING',
          } as PurposeDefinition,
          message: result.next_question,
          nextAction: 'continue_dialogue',
        });
      }
      
    } catch (error) {
      logger.error('[Stage0Service] processContinuation error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  /**
   * 生成最终确认
   */
  async generateConfirmation(
    conversationHistory: ChatMessage[]
  ): Promise<NextResponse<Stage0Response>> {
    logger.info('[Stage0Service] Generating confirmation');
    
    try {
      const prompt = getConfirmationPrompt(conversationHistory);
      const config = getStage0GenerationConfig(); // 最后一轮
      
      const aiResponse = await generateJson<{
        final_understanding: {
          clarified_purpose: string;
          problem_domain: string;
          domain_boundary: string;
          key_constraints: string[];
        };
        confirmation_message: string;
      }>(prompt, config, 'Pro', 'S0');
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      // AI 响应已经是解析后的对象
      const responseData = aiResponse.data;
      const finalDefinition: PurposeDefinition = {
        rawInput: conversationHistory[0]?.content || '',
        clarifiedPurpose: responseData.final_understanding.clarified_purpose,
        problemDomain: responseData.final_understanding.problem_domain,
        domainBoundary: responseData.final_understanding.domain_boundary,
        keyConstraints: responseData.final_understanding.key_constraints,
        conversationHistory,
        confidence: 1.0,
        clarificationState: 'COMPLETED',
      };
      
      return NextResponse.json({
        success: true,
        data: finalDefinition,
        message: finalDefinition.clarifiedPurpose,
        nextAction: 'confirm',
      });
      
    } catch (error) {
      logger.error('[Stage0Service] generateConfirmation error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  /**
   * 用户确认后完成 Stage 0
   */
  async completeStage0(
    definition: PurposeDefinition,
    userConfirmed: boolean
  ): Promise<NextResponse<Stage0Response>> {
    if (userConfirmed) {
      return NextResponse.json({
        success: true,
        data: {
          ...definition,
          clarificationState: 'COMPLETED',
          confidence: 1.0,
        },
        message: '太好了！现在我会为你生成通用框架。',
        nextAction: 'complete',
      });
    } else {
      // 用户不确认，回到收集阶段
      return NextResponse.json({
        success: true,
        data: {
          ...definition,
          clarificationState: 'REFINING',
          confidence: definition.confidence * 0.8,
        },
        message: '好的，让我重新理解。请告诉我哪里需要调整？',
        nextAction: 'continue_dialogue',
      });
    }
  }
  
  // ========================================
  // 解析函数
  // ========================================
  
  private parseInitialResponse(aiResponse: string) {
    try {
      // 提取 JSON（可能在代码块中）
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      const parsed = JSON.parse(jsonStr);
      
      return {
        possible_domains: parsed.analysis?.possible_domains || [],
        possible_purposes: parsed.analysis?.possible_purposes || [],
        initial_clues: parsed.analysis?.initial_clues || [],
        next_question: parsed.next_question || '能否详细说说你的情况？',
      };
    } catch (error) {
      logger.error('[Stage0Service] Failed to parse initial response', { error, aiResponse });
      
      // 降级：提取文本
      return {
        possible_domains: ['未分类'],
        possible_purposes: ['待明确'],
        initial_clues: [],
        next_question: '能否详细说说你想做什么？以及为什么想做这件事？',
      };
    }
  }
  
  private parseContinuationResponse(aiResponse: string) {
    try {
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      const parsed = JSON.parse(jsonStr);
      
      return {
        assessment: {
          clarity_score: parsed.assessment?.clarity_score || 0.5,
          missing_info: parsed.assessment?.missing_info || [],
          confidence: parsed.assessment?.confidence || 0.5,
        },
        action: parsed.action || 'continue',
        next_question: parsed.next_question || '还有什么补充的吗？',
      };
    } catch (error) {
      logger.error('[Stage0Service] Failed to parse continuation response', { error, aiResponse });
      
      return {
        assessment: {
          clarity_score: 0.5,
          missing_info: ['需要更多信息'],
          confidence: 0.5,
        },
        action: 'continue' as const,
        next_question: '能否再详细说明一下？',
      };
    }
  }
  
  private parseConfirmationResponse(
    aiResponse: string,
    conversationHistory: ChatMessage[]
  ): PurposeDefinition {
    try {
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      const parsed = JSON.parse(jsonStr);
      
      return {
        rawInput: conversationHistory[0]?.content || '',
        clarifiedPurpose: parsed.clarified_purpose || '',
        problemDomain: parsed.problem_domain || '',
        domainBoundary: parsed.domain_boundary || '',
        keyConstraints: parsed.key_constraints || [],
        conversationHistory,
        confidence: parsed.confidence || 0.8,
        clarificationState: 'CONFIRMING',
      };
    } catch (error) {
      logger.error('[Stage0Service] Failed to parse confirmation response', { error, aiResponse });
      
      // 降级：基于对话历史生成简单总结
      return {
        rawInput: conversationHistory[0]?.content || '',
        clarifiedPurpose: '基于对话的目的（AI生成失败）',
        problemDomain: '待确认',
        domainBoundary: '待确认',
        keyConstraints: [],
        conversationHistory,
        confidence: 0.5,
        clarificationState: 'CONFIRMING',
      };
    }
  }
}

