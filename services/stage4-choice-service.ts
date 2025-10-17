/**
 * Stage 4 Choice Service - 个性化选择服务
 * 
 * 询问用户是否需要个性化调整
 */

import { NextResponse } from 'next/server';
import type { PersonalizationChoice, Stage4ChoiceResponse } from '@/lib/types-v2';
import { logger } from '@/lib/logger';

export class Stage4ChoiceService {
  private static instance: Stage4ChoiceService;
  
  private constructor() {}
  
  static getInstance(): Stage4ChoiceService {
    if (!Stage4ChoiceService.instance) {
      Stage4ChoiceService.instance = new Stage4ChoiceService();
    }
    return Stage4ChoiceService.instance;
  }
  
  /**
   * 处理用户选择
   */
  async processChoice(
    wantsPersonalization: boolean,
    reason?: string
  ): Promise<NextResponse<Stage4ChoiceResponse>> {
    logger.info('[Stage4ChoiceService] Processing choice', {
      wantsPersonalization,
      hasReason: !!reason,
    });
    
    try {
      const choice: PersonalizationChoice = {
        wantsPersonalization,
        timestamp: Date.now(),
        reason,
      };
      
      if (wantsPersonalization) {
        // 用户选择个性化，进入Stage 5-6
        return NextResponse.json({
          success: true,
          data: choice,
          message: 'Perfect! Let\'s analyze the framework and identify the key areas to focus on for your specific situation.',
          nextAction: 'personalize',
        });
      } else {
        // 用户选择跳过，直接完成
        return NextResponse.json({
          success: true,
          data: choice,
          message: 'Understood. The universal framework is ready for you to use. You can always come back for personalization later.',
          nextAction: 'complete',
        });
      }
      
    } catch (error) {
      logger.error('[Stage4ChoiceService] processChoice error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
}


