import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Stage } from '@/types';
import { formValidatorNode } from '@/lib/agents/form-validator';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profile } = body;

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile data is required' },
        { status: 400 }
      );
    }

    const sessionId = uuidv4();

    logger.info('Form submission received', { sessionId, profile });

    // 调用表单验证器
    const validatorResult = await formValidatorNode({
      sessionId,
      userInput: '',
      currentStage: Stage.REQUIREMENT_COLLECTION,
      completeness: 0,
      profile,
      summary: {},
      messages: [],
      needMoreInfo: false,
      missingFields: [],
      askedQuestions: [],
      stop: false,
      response: '',
      options: undefined,
      nextQuestion: undefined,
      finalSpec: undefined,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    logger.info('Form validation completed', {
      sessionId,
      currentStage: validatorResult.currentStage,
      needMoreInfo: validatorResult.needMoreInfo,
    });

    // 构造响应
    return NextResponse.json({
      sessionId,
      response: validatorResult.response || '表单已提交，正在处理...',
      options: validatorResult.options || [],
      currentStage: validatorResult.currentStage,
      completeness: validatorResult.completeness || 0,
      profile,
      stop: false,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Form submission API error', {
      error: errorMessage,
      stack: errorStack,
    });

    return NextResponse.json(
      {
        error: true,
        message: '表单处理失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
