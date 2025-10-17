/**
 * Stage 1 Clarification Service - 目标澄清服务
 * 
 * 使用初始问题识别prompt，将用户模糊输入提炼为清晰的Mission Statement
 */

import { NextResponse } from 'next/server';
import type { ChatMessage, ClarifiedMission, Stage1ClarificationResponse } from '@/lib/types-v2';
import { generateJson } from '@/lib/gemini-config';
import {
  getClarificationPrompt,
  getStage1ClarificationConfig,
  isVagueInput,
  getGuidanceForVagueInput,
} from '@/lib/prompts/stage1-clarification-prompts';
import { logger } from '@/lib/logger';
import { handleNoApiKeyResult } from '@/lib/api-fallback';

export class Stage1ClarificationService {
  private static instance: Stage1ClarificationService;
  
  private constructor() {}
  
  static getInstance(): Stage1ClarificationService {
    if (!Stage1ClarificationService.instance) {
      Stage1ClarificationService.instance = new Stage1ClarificationService();
    }
    return Stage1ClarificationService.instance;
  }
  
  /**
   * 处理初始输入
   */
  async processInitialInput(userInput: string): Promise<NextResponse<Stage1ClarificationResponse>> {
    logger.info('[Stage1ClarificationService] Processing initial input');
    
    try {
      // 检查是否过于模糊
      if (isVagueInput(userInput)) {
        return NextResponse.json({
          success: true,
          message: getGuidanceForVagueInput(),
          nextAction: 'continue_dialogue',
        });
      }
      
      // 调用 AI 生成 Mission Statement
      const prompt = getClarificationPrompt(userInput);
      const config = getStage1ClarificationConfig();
      
      const aiResponse = await generateJson<{
        needsMoreInfo?: boolean;
        missionStatement?: string;
        subject?: string;
        desiredOutcome?: string;
        context?: string;
        keyLevers?: string[];
        confidence?: number;
        questionAsked?: string;
      }>(prompt, config, 'Pro', 'S1');
      
      // 检查是否是NO_API_KEY错误
      const fallbackResponse = handleNoApiKeyResult(aiResponse, 'S1');
      if (fallbackResponse) {
        return fallbackResponse as NextResponse<Stage1ClarificationResponse>;
      }
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      const result = aiResponse.data;
      
      // 判断是否需要更多信息
      if (result.needsMoreInfo) {
        return NextResponse.json({
          success: true,
          message: result.questionAsked || 'Could you provide more details?',
          nextAction: 'continue_dialogue',
        });
      }
      
      // 构建 ClarifiedMission
      const mission: ClarifiedMission = {
        rawInput: userInput,
        missionStatement: result.missionStatement || '',
        subject: result.subject || '',
        desiredOutcome: result.desiredOutcome || '',
        context: result.context || '',
        keyLevers: result.keyLevers || [],
        conversationHistory: [],
        confidence: result.confidence || 0.8,
        generatedAt: Date.now(),
      };
      
      // 如果confidence足够高，返回确认
      if (mission.confidence >= 0.85) {
        return NextResponse.json({
          success: true,
          data: mission,
          message: mission.missionStatement,
          nextAction: 'confirm',
        });
      } else {
        // 需要进一步澄清
        return NextResponse.json({
          success: true,
          data: mission,
          message: 'Let me refine this further. ' + (result.questionAsked || ''),
          nextAction: 'continue_dialogue',
        });
      }
      
    } catch (error) {
      logger.error('[Stage1ClarificationService] processInitialInput error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
  
  /**
   * 处理后续对话
   */
  async processContinuation(
    userInput: string,
    conversationHistory: ChatMessage[],
    currentMission?: Partial<ClarifiedMission>
  ): Promise<NextResponse<Stage1ClarificationResponse>> {
    logger.info('[Stage1ClarificationService] Processing continuation', {
      historyLength: conversationHistory.length,
    });
    
    try {
      const prompt = getClarificationPrompt(userInput, conversationHistory);
      const config = getStage1ClarificationConfig();
      
      const aiResponse = await generateJson<{
        needsMoreInfo?: boolean;
        missionStatement?: string;
        subject?: string;
        desiredOutcome?: string;
        context?: string;
        keyLevers?: string[];
        confidence?: number;
        questionAsked?: string;
      }>(prompt, config, 'Pro', 'S1');
      
      // 检查是否是NO_API_KEY错误
      const fallbackResponse = handleNoApiKeyResult(aiResponse, 'S1');
      if (fallbackResponse) {
        return fallbackResponse as NextResponse<Stage1ClarificationResponse>;
      }
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }
      
      const result = aiResponse.data;
      
      // 判断是否需要更多信息
      if (result.needsMoreInfo) {
        return NextResponse.json({
          success: true,
          data: currentMission as ClarifiedMission,
          message: result.questionAsked || 'Could you tell me more?',
          nextAction: 'continue_dialogue',
        });
      }
      
      // 构建最终的 ClarifiedMission
      const mission: ClarifiedMission = {
        rawInput: currentMission?.rawInput || conversationHistory[0]?.content || '',
        missionStatement: result.missionStatement || currentMission?.missionStatement || '',
        subject: result.subject || currentMission?.subject || '',
        desiredOutcome: result.desiredOutcome || currentMission?.desiredOutcome || '',
        context: result.context || currentMission?.context || '',
        keyLevers: result.keyLevers || currentMission?.keyLevers || [],
        conversationHistory,
        confidence: result.confidence || 1.0,
        generatedAt: Date.now(),
      };
      
      return NextResponse.json({
        success: true,
        data: mission,
        message: mission.missionStatement,
        nextAction: 'confirm',
      });
      
    } catch (error) {
      logger.error('[Stage1ClarificationService] processContinuation error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
}

