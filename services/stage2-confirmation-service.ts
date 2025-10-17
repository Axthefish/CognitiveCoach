/**
 * Stage 2 Confirmation Service - 用户确认服务
 * 
 * 处理用户对Stage 1提炼结果的确认
 */

import { NextResponse } from 'next/server';
import type { ClarifiedMission, ConfirmationState, Stage2ConfirmationResponse } from '@/lib/types-v2';
import { logger } from '@/lib/logger';

export class Stage2ConfirmationService {
  private static instance: Stage2ConfirmationService;
  
  private constructor() {}
  
  static getInstance(): Stage2ConfirmationService {
    if (!Stage2ConfirmationService.instance) {
      Stage2ConfirmationService.instance = new Stage2ConfirmationService();
    }
    return Stage2ConfirmationService.instance;
  }
  
  /**
   * 处理用户确认
   */
  async processConfirmation(
    mission: ClarifiedMission,
    userConfirmed: boolean,
    feedback?: string
  ): Promise<NextResponse<Stage2ConfirmationResponse>> {
    logger.info('[Stage2ConfirmationService] Processing confirmation', {
      userConfirmed,
      hasFeedback: !!feedback,
    });
    
    try {
      const confirmationState: ConfirmationState = {
        clarifiedMission: mission,
        userConfirmed,
        feedback,
      };
      
      if (userConfirmed) {
        // 用户确认，可以进入Stage 3
        return NextResponse.json({
          success: true,
          data: confirmationState,
          message: 'Great! Now generating your universal framework...',
          nextAction: 'proceed',
        });
      } else {
        // 用户不确认，返回Stage 1重新澄清
        return NextResponse.json({
          success: true,
          data: confirmationState,
          message: feedback 
            ? `Got it. Let me refine based on your feedback: "${feedback}"`
            : 'No problem. Let me refine the mission statement for you.',
          nextAction: 'refine',
        });
      }
      
    } catch (error) {
      logger.error('[Stage2ConfirmationService] processConfirmation error', { error });
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }
}


