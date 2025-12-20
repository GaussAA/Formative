/**
 * Memory Storage Interface
 * 定义记忆存储的统一接口，支持本地JSON和Redis实现
 */

import { SessionMemory, Message, SessionState, StagesSummary } from '@/types';

export interface MemoryStorage {
  // 消息操作
  getMessages(sessionId: string): Promise<Message[]>;
  addMessage(sessionId: string, message: Message): Promise<void>;
  clearMessages(sessionId: string): Promise<void>;

  // 状态操作
  getState(sessionId: string): Promise<SessionState | null>;
  setState(sessionId: string, state: SessionState): Promise<void>;

  // 摘要操作
  getSummary(sessionId: string): Promise<StagesSummary>;
  updateSummary(sessionId: string, summary: Partial<StagesSummary>): Promise<void>;

  // 会话操作
  getSession(sessionId: string): Promise<SessionMemory | null>;
  deleteSession(sessionId: string): Promise<void>;
  sessionExists(sessionId: string): Promise<boolean>;
}
