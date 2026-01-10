/**
 * API 响应处理工具
 * 提供统一的 API 响应格式和错误处理
 */

import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

/**
 * 成功响应
 *
 * @param data - 返回的数据
 * @returns NextResponse 成功响应
 */
export function successResponse<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data });
}

/**
 * 错误响应
 *
 * @param message - 错误消息
 * @param status - HTTP 状态码
 * @returns NextResponse 错误响应
 */
export function errorResponse(message: string, status = 500): NextResponse<ApiResponse> {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

/**
 * 带错误处理的异步处理器
 *
 * @param handler - 异步处理函数
 * @returns NextResponse 统一格式的响应
 */
export async function withErrorHandler<T>(
  handler: () => Promise<T>
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    const data = await handler();
    return successResponse(data);
  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message) as NextResponse<ApiResponse<T>>;
  }
}

/**
 * 验证请求体
 *
 * @param body - 请求体
 * @param requiredFields - 必需字段列表
 * @returns 验证结果
 */
export function validateRequestBody<T extends Record<string, unknown>>(
  body: T,
  requiredFields: (keyof T)[]
): { valid: boolean; missing?: string[] } {
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(String(field));
    }
  }

  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  };
}
