/**
 * IndexedDB 会话管理模块
 * 用于在浏览器本地存储和管理项目生成历史记录
 */

import { Stage, StageData } from '@/types';

const DB_NAME = 'FormativeDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export interface SessionRecord {
  sessionId: string;
  projectName: string;
  createdAt: number;
  updatedAt: number;
  completed: boolean;
  currentStage: Stage;
  stageData: StageData;
}

class SessionStorage {
  private db: IDBDatabase | null = null;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建对象存储（如果不存在）
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });

          // 创建索引
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
          objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          objectStore.createIndex('completed', 'completed', { unique: false });
        }
      };
    });
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Database initialization failed');
    }
    return this.db;
  }

  /**
   * 保存会话
   */
  async saveSession(session: SessionRecord): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save session'));
    });
  }

  /**
   * 获取单个会话
   */
  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(sessionId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get session'));
    });
  }

  /**
   * 获取所有会话（按更新时间倒序）
   */
  async getAllSessions(): Promise<SessionRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result || [];
        // 按更新时间倒序排序
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(sessions);
      };
      request.onerror = () => reject(new Error('Failed to get sessions'));
    });
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(sessionId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete session'));
    });
  }

  /**
   * 清空所有会话
   */
  async clearAllSessions(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear sessions'));
    });
  }

  /**
   * 获取会话数量
   */
  async getSessionCount(): Promise<number> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get session count'));
    });
  }
}

// 导出单例
const sessionStorage = new SessionStorage();
export default sessionStorage;
