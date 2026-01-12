/**
 * Sessions API
 * GET /api/sessions - List all sessions
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { sessions } from '@/db/schema';
import { desc } from 'drizzle-orm';
import logger from '@/lib/logger';

/**
 * GET /api/sessions
 * Returns a list of all sessions ordered by updatedAt
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 50;

    const db = await getDb();
    const allSessions = await db
      .select({
        sessionId: sessions.sessionId,
        projectName: sessions.projectName,
        currentStage: sessions.currentStage,
        completeness: sessions.completeness,
        completed: sessions.completed,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
      })
      .from(sessions)
      .orderBy(desc(sessions.updatedAt))
      .limit(limit);

    // Format timestamps as ISO strings
    const formattedSessions = allSessions.map((session) => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: formattedSessions,
    });
  } catch (error) {
    logger.error('Failed to fetch sessions', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sessions',
      },
      { status: 500 }
    );
  }
}
