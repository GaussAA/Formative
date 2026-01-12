/**
 * SQLite Storage Implementation
 * Implements MemoryStorage interface using SQLite + Drizzle ORM
 */

import { MemoryStorage } from '@/lib/memory/interface';
import type { SessionMemory, Message, SessionState, StagesSummary } from '@/types';
import { db, initDatabase, saveDatabase } from '@/db/connection';
import { sessions, messages, stageSummaries } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Stage } from '@/types';
import logger from '@/lib/logger';

/**
 * JSON serialization helper with error handling
 */
function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    logger.error('Failed to stringify data', { error });
    return '{}';
  }
}

/**
 * JSON deserialization helper with error handling
 */
function safeParse<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logger.error('Failed to parse JSON', { json, error });
    return null;
  }
}

/**
 * SQLite-based storage implementation
 * Provides persistent storage for sessions, messages, and stage summaries
 */
export class SQLiteStorage implements MemoryStorage {
  private initialized = false;

  constructor() {
    // Initialize database on first access
    this.ensureInitialized();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initDatabase();
      this.initialized = true;
    }
  }

  /**
   * Save database after write operations
   */
  private persist(): void {
    saveDatabase();
  }

  // ========== Message Operations ==========

  async getMessages(sessionId: string): Promise<Message[]> {
    await this.ensureInitialized();
    try {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp);

      return rows.map((row) => ({
        role: row.role as 'user' | 'assistant' | 'system',
        content: row.content,
        timestamp: row.timestamp.getTime(),
        options: safeParse(row.options) || undefined,
      }));
    } catch (error) {
      logger.error('Failed to get messages', { sessionId, error });
      return [];
    }
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    await this.ensureInitialized();
    try {
      await db.insert(messages).values({
        sessionId,
        role: message.role,
        content: message.content,
        timestamp: new Date(message.timestamp),
        options: message.options ? safeStringify(message.options) : null,
      });
      await this.updateSessionTimestamp(sessionId);
      this.persist();
      logger.debug('Message added', { sessionId, role: message.role });
    } catch (error) {
      logger.error('Failed to add message', { sessionId, error });
      throw error;
    }
  }

  async clearMessages(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    try {
      await db.delete(messages).where(eq(messages.sessionId, sessionId));
      await this.updateSessionTimestamp(sessionId);
      this.persist();
      logger.debug('Messages cleared', { sessionId });
    } catch (error) {
      logger.error('Failed to clear messages', { sessionId, error });
      throw error;
    }
  }

  // ========== State Operations ==========

  async getState(sessionId: string): Promise<SessionState | null> {
    await this.ensureInitialized();
    try {
      const session = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId))
        .limit(1);

      if (session.length === 0) {
        return null;
      }

      const row = session[0]!;
      return {
        sessionId: row.sessionId,
        currentStage: row.currentStage as Stage,
        completeness: row.completeness,
        profile: safeParse(row.profile) || {},
        createdAt: row.createdAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
      };
    } catch (error) {
      logger.error('Failed to get state', { sessionId, error });
      return null;
    }
  }

  async setState(sessionId: string, state: SessionState): Promise<void> {
    await this.ensureInitialized();
    try {
      await db
        .insert(sessions)
        .values({
          sessionId,
          projectName: state.profile.projectName,
          currentStage: state.currentStage,
          completeness: state.completeness,
          profile: safeStringify(state.profile),
          createdAt: new Date(state.createdAt),
          updatedAt: new Date(state.updatedAt),
        })
        .onConflictDoUpdate({
          target: sessions.sessionId,
          set: {
            projectName: state.profile.projectName,
            currentStage: state.currentStage,
            completeness: state.completeness,
            profile: safeStringify(state.profile),
            updatedAt: new Date(state.updatedAt),
          },
        });
      this.persist();
      logger.debug('State updated', { sessionId, stage: state.currentStage });
    } catch (error) {
      logger.error('Failed to set state', { sessionId, error });
      throw error;
    }
  }

  // ========== Summary Operations ==========

  async getSummary(sessionId: string): Promise<StagesSummary> {
    await this.ensureInitialized();
    try {
      const rows = await db
        .select()
        .from(stageSummaries)
        .where(eq(stageSummaries.sessionId, sessionId));

      const summary: StagesSummary = {};
      for (const row of rows) {
        const stageData = safeParse(row.data);
        if (stageData) {
          (summary as Record<number, unknown>)[row.stage as number] = stageData;
        }
      }

      return summary;
    } catch (error) {
      logger.error('Failed to get summary', { sessionId, error });
      return {};
    }
  }

  async updateSummary(sessionId: string, summary: Partial<StagesSummary>): Promise<void> {
    await this.ensureInitialized();
    try {
      // Update or insert each stage summary
      for (const [stageKey, data] of Object.entries(summary)) {
        const stage = Number(stageKey) as Stage;
        const dataJson = safeStringify(data);

        await db
          .insert(stageSummaries)
          .values({
            sessionId,
            stage,
            data: dataJson,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [stageSummaries.sessionId, stageSummaries.stage],
            set: {
              data: dataJson,
              updatedAt: new Date(),
            },
          });
      }

      await this.updateSessionTimestamp(sessionId);
      this.persist();
      logger.debug('Summary updated', { sessionId, stages: Object.keys(summary) });
    } catch (error) {
      logger.error('Failed to update summary', { sessionId, error });
      throw error;
    }
  }

  // ========== Session Operations ==========

  async getSession(sessionId: string): Promise<SessionMemory | null> {
    await this.ensureInitialized();
    try {
      const [msgs, state, summary] = await Promise.all([
        this.getMessages(sessionId),
        this.getState(sessionId),
        this.getSummary(sessionId),
      ]);

      if (!state) {
        return null;
      }

      return {
        messages: msgs,
        state,
        summary,
      };
    } catch (error) {
      logger.error('Failed to get session', { sessionId, error });
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    try {
      // Manually delete related data first (sql.js doesn't support cascade delete)
      await db.delete(stageSummaries).where(eq(stageSummaries.sessionId, sessionId));
      await db.delete(messages).where(eq(messages.sessionId, sessionId));

      // Then delete the session
      await db.delete(sessions).where(eq(sessions.sessionId, sessionId));

      this.persist();
      logger.info('Session deleted', { sessionId });
    } catch (error) {
      logger.error('Failed to delete session', { sessionId, error });
      throw error;
    }
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    await this.ensureInitialized();
    try {
      const session = await db
        .select({ id: sessions.sessionId })
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId))
        .limit(1);

      return session.length > 0;
    } catch (error) {
      logger.error('Failed to check session existence', { sessionId, error });
      return false;
    }
  }

  // ========== Helper Methods ==========

  /**
   * Update the session's updatedAt timestamp
   */
  private async updateSessionTimestamp(sessionId: string): Promise<void> {
    try {
      await db
        .update(sessions)
        .set({ updatedAt: new Date() })
        .where(eq(sessions.sessionId, sessionId));
    } catch (error) {
      logger.error('Failed to update session timestamp', { sessionId, error });
    }
  }

  /**
   * Get all sessions (for admin/history views)
   */
  async getAllSessions(limit = 50): Promise<SessionState[]> {
    await this.ensureInitialized();
    try {
      const rows = await db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.updatedAt))
        .limit(limit);

      return rows.map((row) => ({
        sessionId: row.sessionId,
        currentStage: row.currentStage as Stage,
        completeness: row.completeness,
        profile: safeParse(row.profile) || {},
        createdAt: row.createdAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
      }));
    } catch (error) {
      logger.error('Failed to get all sessions', { error });
      return [];
    }
  }

  /**
   * Mark a session as completed
   */
  async markSessionCompleted(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    try {
      await db
        .update(sessions)
        .set({
          completed: true,
          currentStage: Stage.COMPLETED,
          updatedAt: new Date(),
        })
        .where(eq(sessions.sessionId, sessionId));
      this.persist();
      logger.info('Session marked as completed', { sessionId });
    } catch (error) {
      logger.error('Failed to mark session as completed', { sessionId, error });
      throw error;
    }
  }
}
