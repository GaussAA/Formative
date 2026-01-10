/**
 * Local JSON Storage Implementation
 * MVP版本使用本地JSON文件存储会话数据
 */

import fs from 'fs/promises';
import path from 'path';
import { SessionMemory, Message, SessionState, StagesSummary, Stage } from '@/types';
import { MemoryStorage } from './interface';
import logger from '@/lib/logger';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

/**
 * Node.js 错误类型守卫
 */
function isNodeError(error: unknown): error is { code: string } & Error {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}

export class LocalJSONStorage implements MemoryStorage {
  constructor() {
    this.ensureDataDir();
  }

  private async ensureDataDir() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory', { error });
    }
  }

  private getSessionPath(sessionId: string): string {
    return path.join(DATA_DIR, `${sessionId}.json`);
  }

  private async readSession(sessionId: string): Promise<SessionMemory | null> {
    try {
      const filePath = this.getSessionPath(sessionId);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null;
      }
      logger.error('Failed to read session', { sessionId, error });
      return null;
    }
  }

  private async writeSession(sessionId: string, memory: SessionMemory): Promise<void> {
    try {
      const filePath = this.getSessionPath(sessionId);
      await fs.writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to write session', { sessionId, error });
      throw error;
    }
  }

  private createDefaultSession(sessionId: string): SessionMemory {
    return {
      messages: [],
      state: {
        sessionId,
        currentStage: Stage.INIT,
        completeness: 0,
        profile: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      summary: {},
    };
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    const session = await this.readSession(sessionId);
    return session?.messages || [];
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    let session = await this.readSession(sessionId);
    if (!session) {
      session = this.createDefaultSession(sessionId);
    }
    session.messages.push(message);
    session.state.updatedAt = Date.now();
    await this.writeSession(sessionId, session);
    logger.debug('Message added', { sessionId, role: message.role });
  }

  async clearMessages(sessionId: string): Promise<void> {
    const session = await this.readSession(sessionId);
    if (session) {
      session.messages = [];
      session.state.updatedAt = Date.now();
      await this.writeSession(sessionId, session);
    }
  }

  async getState(sessionId: string): Promise<SessionState | null> {
    const session = await this.readSession(sessionId);
    return session?.state || null;
  }

  async setState(sessionId: string, state: SessionState): Promise<void> {
    let session = await this.readSession(sessionId);
    if (!session) {
      session = this.createDefaultSession(sessionId);
    }
    session.state = { ...state, updatedAt: Date.now() };
    await this.writeSession(sessionId, session);
    logger.debug('State updated', { sessionId, stage: state.currentStage });
  }

  async getSummary(sessionId: string): Promise<StagesSummary> {
    const session = await this.readSession(sessionId);
    return session?.summary || {};
  }

  async updateSummary(sessionId: string, summary: Partial<StagesSummary>): Promise<void> {
    let session = await this.readSession(sessionId);
    if (!session) {
      session = this.createDefaultSession(sessionId);
    }
    session.summary = { ...session.summary, ...summary };
    session.state.updatedAt = Date.now();
    await this.writeSession(sessionId, session);
    logger.debug('Summary updated', { sessionId, stages: Object.keys(summary) });
  }

  async getSession(sessionId: string): Promise<SessionMemory | null> {
    return this.readSession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = this.getSessionPath(sessionId);
      await fs.unlink(filePath);
      logger.info('Session deleted', { sessionId });
    } catch (error: unknown) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        logger.error('Failed to delete session', { sessionId, error });
      }
    }
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    const session = await this.readSession(sessionId);
    return session !== null;
  }
}
