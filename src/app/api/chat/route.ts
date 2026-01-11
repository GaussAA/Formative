import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { runWorkflow, continueWorkflow } from '@/lib/graph';
import logger from '@/lib/logger';
import {
  createSSEReadableStream,
  SSE_HEADERS,
  type SSEMetadata,
} from '@/lib/streaming/stream-utils';
import { getRateLimiter, getRateLimitHeaders, RateLimitPresets } from '@/lib/middleware/rate-limiter';
import {
  validateRequest,
  ValidationErrorException,
  schemas,
} from '@/lib/middleware/input-validator';

export async function POST(request: NextRequest) {
  try {
    // P0-1: Rate limiting check
    const chatRateLimiter = getRateLimiter('chat', RateLimitPresets.CHAT);
    const rateLimitResult = await chatRateLimiter.check(request);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        sessionId: request.headers.get('x-session-id'),
      });
      return NextResponse.json(
        {
          error: true,
          message: 'Too many requests. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // P0-2: Input validation
    const body = await request.json();
    const validated = validateRequest(schemas.chat, body);
    const { message, sessionId } = validated;

    // Check if streaming response is requested
    const url = new URL(request.url);
    const enableStream = url.searchParams.get('stream') === 'true';

    // If no sessionId, create new session
    const finalSessionId = sessionId || uuidv4();
    const isNewSession = !sessionId;

    logger.info('Chat API called', {
      sessionId: finalSessionId,
      isNewSession,
      stream: enableStream,
    });

    // Run or continue workflow
    const result = isNewSession
      ? await runWorkflow(finalSessionId, message)
      : await continueWorkflow(finalSessionId, message);

    // Streaming response mode
    if (enableStream) {
      // If no response from workflow, provide a fallback message
      const responseText = result.response || '抱歉，我暂时无法处理您的请求。请检查 LLM API 配置。';

      // 准备流式响应元数据（包含 options、profile 等）
      const streamMetadata: SSEMetadata = {
        options: result.options || [],
        profile: result.profile || {},
        currentStage: result.currentStage,
        completeness: result.completeness || 0,
      };

      // 创建 SSE 流式响应（带元数据）
      const readableStream = createSSEReadableStream(responseText, streamMetadata);

      return new Response(readableStream, {
        headers: {
          ...SSE_HEADERS,
          // 在流式响应中包含 sessionId 作为自定义头
          'X-Session-Id': finalSessionId,
        },
      });
    }

    // 非流式响应（原有逻辑）
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
  } catch (error: unknown) {
    // Handle validation errors
    if (error instanceof ValidationErrorException) {
      logger.warn('Chat API validation failed', { errors: error.errors });
      return NextResponse.json(error.toJSON(), { status: 400 });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Chat API error', { error: errorMessage, stack: errorStack });

    // Distinguish different types of errors
    let responseMessage = 'System error, please try again later';
    let statusCode = 500;

    if (
      errorMessage.includes('LLM_API_KEY') ||
      errorMessage.includes('401') ||
      errorMessage.includes('Unauthorized')
    ) {
      responseMessage =
        '❌ LLM API Key 错误或未配置。请在 .env.local 文件中设置正确的 LLM_API_KEY。';
      statusCode = 503;
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      responseMessage = '❌ 无法连接到 LLM 服务。请检查 LLM_BASE_URL 配置和网络连接。';
      statusCode = 503;
    } else if (errorMessage.includes('信息提取失败')) {
      responseMessage = `❌ ${errorMessage}`;
      statusCode = 503;
    } else if (errorMessage.includes('Failed to parse JSON')) {
      responseMessage = '❌ LLM 返回格式错误，请重试或检查模型配置。';
      statusCode = 503;
    } else if (errorMessage.includes('环境变量配置错误')) {
      responseMessage = '❌ 环境变量配置错误。请检查 .env.local 文件中的配置。';
      statusCode = 500;
    }

    return NextResponse.json(
      {
        error: true,
        message: responseMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: statusCode }
    );
  }
}
