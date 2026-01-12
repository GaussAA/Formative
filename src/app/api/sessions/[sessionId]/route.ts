/**
 * Single Session API
 * GET /api/sessions/[sessionId] - Get session details
 * DELETE /api/sessions/[sessionId] - Delete a session
 */

import { NextResponse } from 'next/server';
import { db } from '@/db/connection';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';
import memory from '@/lib/memory';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/sessions/[sessionId]
 * Returns full session details including messages and summary
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    const sessionData = await memory.getSession(sessionId);

    if (!sessionData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sessionData,
    });
  } catch (error) {
    logger.error('Failed to fetch session', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch session',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[sessionId]
 * Deletes a session and all associated data
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    await memory.deleteSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete session', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete session',
      },
      { status: 500 }
    );
  }
}
