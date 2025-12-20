import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { runWorkflow, continueWorkflow } from '@/lib/graph';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // 如果没有sessionId，创建新会话
    const finalSessionId = sessionId || uuidv4();
    const isNewSession = !sessionId;

    logger.info('Chat API called', { sessionId: finalSessionId, isNewSession });

    // 运行或继续工作流
    const result = isNewSession
      ? await runWorkflow(finalSessionId, message)
      : await continueWorkflow(finalSessionId, message);

    // 构造响应
    return NextResponse.json({
      sessionId: finalSessionId,
      response: result.response || '收到您的消息，正在处理...',
      options: result.options || [],
      currentStage: result.currentStage,
      completeness: result.completeness || 0,
      stop: result.stop || false,
      finalSpec: result.finalSpec,
      profile: result.profile || {}, // 返回当前需求画像
      askedQuestions: result.askedQuestions || [], // 返回已问问题
    });
  } catch (error: any) {
    logger.error('Chat API error', { error: error.message, stack: error.stack });

    // 区分不同类型的错误
    let errorMessage = '系统错误，请稍后重试';
    let statusCode = 500;

    if (error.message.includes('LLM_API_KEY')) {
      errorMessage = '❌ LLM配置错误：请检查.env文件中的API密钥配置';
      statusCode = 503;
    } else if (error.message.includes('信息提取失败')) {
      errorMessage = `❌ ${error.message}`;
      statusCode = 503;
    } else if (error.message.includes('Failed to parse JSON')) {
      errorMessage = '❌ LLM返回格式错误，请重试或检查模型配置';
      statusCode = 503;
    }

    return NextResponse.json(
      {
        error: true,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: statusCode }
    );
  }
}
