/**
 * SQLiteStorage Unit Tests
 * Tests for SQLite-based storage implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SQLiteStorage } from '@/lib/storage/db-storage';
import { initDatabase, closeDatabase, getDb } from '@/db/connection';
import { sessions, messages, stageSummaries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import type { SessionState, Message, StagesSummary, Stage } from '@/types';
import * as fs from 'fs';
import * as path from 'path';
import { migrate } from 'drizzle-orm/sql-js/migrator';

// Use a test database file
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-storage.db');

describe('SQLiteStorage', () => {
  let storage: SQLiteStorage;

  beforeEach(async () => {
    // Clean up test database before each test
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Mock DATABASE_URL to use test database
    vi.stubEnv('DATABASE_URL', TEST_DB_PATH);

    // Initialize database
    await initDatabase();

    // Run migrations to create schema
    const testDb = await getDb();
    await migrate(testDb, { migrationsFolder: './src/db/migrations' });

    // Create new storage instance
    storage = new SQLiteStorage();
  });

  afterEach(async () => {
    // Close database and clean up
    await closeDatabase();

    // Clean up test database file
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    vi.unstubAllEnvs();
  });

  describe('Message Operations', () => {
    describe('getMessages', () => {
      it('should return empty array for non-existent session', async () => {
        const messages = await storage.getMessages('non-existent');
        expect(messages).toEqual([]);
      });

      it('should retrieve all messages for a session in chronological order', async () => {
        const sessionId = 'msg-order-test';

        // First create a session state
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: { projectName: 'Test' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        // Add messages with different timestamps
        const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
        await storage.addMessage(sessionId, {
          role: 'user',
          content: 'First',
          timestamp: baseTime,
        });
        await storage.addMessage(sessionId, {
          role: 'assistant',
          content: 'Second',
          timestamp: baseTime + 1000,
        });
        await storage.addMessage(sessionId, {
          role: 'user',
          content: 'Third',
          timestamp: baseTime + 2000,
        });

        const retrieved = await storage.getMessages(sessionId);
        expect(retrieved).toHaveLength(3);
        expect(retrieved[0]?.content).toBe('First');
        expect(retrieved[1]?.content).toBe('Second');
        expect(retrieved[2]?.content).toBe('Third');
      });

      it('should deserialize message options correctly', async () => {
        const sessionId = 'options-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        const options = [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
        ];

        await storage.addMessage(sessionId, {
          role: 'assistant',
          content: 'Choose an option',
          timestamp: Date.now(),
          options,
        });

        const retrieved = await storage.getMessages(sessionId);
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0]?.options).toEqual(options);
      });
    });

    describe('addMessage', () => {
      it('should add a message to an existing session', async () => {
        const sessionId = 'add-msg-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        const message: Message = {
          role: 'user',
          content: 'Hello World',
          timestamp: Date.now(),
        };

        await storage.addMessage(sessionId, message);

        const retrieved = await storage.getMessages(sessionId);
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0]?.content).toBe('Hello World');
        expect(retrieved[0]?.role).toBe('user');
      });

      it('should support all message roles', async () => {
        const sessionId = 'roles-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        await storage.addMessage(sessionId, { role: 'system', content: 'System', timestamp: Date.now() });
        await storage.addMessage(sessionId, { role: 'user', content: 'User', timestamp: Date.now() });
        await storage.addMessage(sessionId, { role: 'assistant', content: 'Assistant', timestamp: Date.now() });

        const retrieved = await storage.getMessages(sessionId);
        expect(retrieved).toHaveLength(3);
        expect(retrieved.map((m) => m.role)).toEqual(['system', 'user', 'assistant']);
      });
    });

    describe('clearMessages', () => {
      it('should clear all messages for a session', async () => {
        const sessionId = 'clear-msg-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        await storage.addMessage(sessionId, { role: 'user', content: 'Test', timestamp: Date.now() });
        await storage.addMessage(sessionId, { role: 'assistant', content: 'Response', timestamp: Date.now() });

        expect(await storage.getMessages(sessionId)).toHaveLength(2);

        await storage.clearMessages(sessionId);

        expect(await storage.getMessages(sessionId)).toEqual([]);
      });

      it('should update session timestamp when clearing messages', async () => {
        const sessionId = 'clear-timestamp-test';
        const baseTime = Date.now();
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: baseTime,
          updatedAt: baseTime,
        };
        await storage.setState(sessionId, state);

        await storage.addMessage(sessionId, { role: 'user', content: 'Test', timestamp: baseTime });

        // Wait at least 1 second to ensure timestamp difference (SQLite uses second precision)
        await new Promise((resolve) => setTimeout(resolve, 1100));

        await storage.clearMessages(sessionId);

        const updatedState = await storage.getState(sessionId);
        // SQLite stores timestamps with second precision, so round to seconds for comparison
        expect(Math.floor((updatedState?.updatedAt || 0) / 1000)).toBeGreaterThan(Math.floor(baseTime / 1000));
      });
    });
  });

  describe('State Operations', () => {
    describe('getState', () => {
      it('should return null for non-existent session', async () => {
        const state = await storage.getState('non-existent');
        expect(state).toBeNull();
      });

      it('should retrieve session state correctly', async () => {
        const sessionId = 'get-state-test';
        const originalState: SessionState = {
          sessionId,
          currentStage: 3,
          completeness: 75,
          profile: {
            projectName: 'Test Project',
            productGoal: 'Test goal',
            coreFunctions: ['func1', 'func2'],
          },
          createdAt: 1704067200000, // 2024-01-01
          updatedAt: 1704153600000, // 2024-01-02
        };

        await storage.setState(sessionId, originalState);

        const retrieved = await storage.getState(sessionId);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.sessionId).toBe(sessionId);
        expect(retrieved?.currentStage).toBe(3);
        expect(retrieved?.completeness).toBe(75);
        expect(retrieved?.profile).toEqual(originalState.profile);
      });

      it('should handle empty profile', async () => {
        const sessionId = 'empty-profile-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await storage.setState(sessionId, state);

        const retrieved = await storage.getState(sessionId);
        expect(retrieved?.profile).toEqual({});
      });
    });

    describe('setState', () => {
      it('should create a new session', async () => {
        const sessionId = 'new-session-test';
        const state: SessionState = {
          sessionId,
          currentStage: 1,
          completeness: 25,
          profile: { projectName: 'New Session' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await storage.setState(sessionId, state);

        const exists = await storage.sessionExists(sessionId);
        expect(exists).toBe(true);
      });

      it('should update existing session', async () => {
        const sessionId = 'update-state-test';
        const originalState: SessionState = {
          sessionId,
          currentStage: 1,
          completeness: 25,
          profile: { projectName: 'Original' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await storage.setState(sessionId, originalState);

        // Update state
        const updatedState: SessionState = {
          ...originalState,
          currentStage: 2,
          completeness: 50,
        };

        await storage.setState(sessionId, updatedState);

        const retrieved = await storage.getState(sessionId);
        expect(retrieved?.currentStage).toBe(2);
        expect(retrieved?.completeness).toBe(50);
      });

      it('should preserve createdAt on update', async () => {
        const sessionId = 'preserve-created-test';
        const originalTime = 1704067200000;
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: originalTime,
          updatedAt: originalTime,
        };

        await storage.setState(sessionId, state);

        // Update with different createdAt (should be preserved)
        const updatedState: SessionState = {
          ...state,
          updatedAt: Date.now(),
        };

        await storage.setState(sessionId, updatedState);

        const retrieved = await storage.getState(sessionId);
        expect(retrieved?.createdAt).toBe(originalTime);
      });
    });
  });

  describe('Summary Operations', () => {
    describe('getSummary', () => {
      it('should return empty object for non-existent session', async () => {
        const summary = await storage.getSummary('non-existent');
        expect(summary).toEqual({});
      });

      it('should return empty object for session with no summaries', async () => {
        const sessionId = 'no-summary-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        const summary = await storage.getSummary(sessionId);
        expect(summary).toEqual({});
      });

      it('should retrieve all stage summaries', async () => {
        const sessionId = 'multi-summary-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        const summaries: StagesSummary = {
          1: {
            productGoal: 'Test goal',
            targetUsers: 'Test users',
            coreFunctions: ['func1'],
          },
          2: {
            risks: ['risk1'],
            selectedApproach: 'approach1',
          },
          3: {
            techStack: {
              category: 'fullstack',
              frontend: 'React',
            },
            reasoning: 'Test reasoning',
          },
        };

        await storage.updateSummary(sessionId, summaries);

        const retrieved = await storage.getSummary(sessionId);
        expect(retrieved).toEqual(summaries);
      });
    });

    describe('updateSummary', () => {
      it('should create new stage summary', async () => {
        const sessionId = 'create-summary-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        const summaryData = {
          productGoal: 'New goal',
          targetUsers: 'New users',
          coreFunctions: ['new func'],
        };

        await storage.updateSummary(sessionId, { 1: summaryData });

        const retrieved = await storage.getSummary(sessionId);
        expect(retrieved[1]).toEqual(summaryData);
      });

      it('should update existing stage summary', async () => {
        const sessionId = 'update-summary-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        const original = {
          productGoal: 'Original',
          targetUsers: 'Users',
          coreFunctions: ['func1'],
        };

        await storage.updateSummary(sessionId, { 1: original });

        const updated = {
          productGoal: 'Updated',
          targetUsers: 'Users',
          coreFunctions: ['func1', 'func2'],
        };

        await storage.updateSummary(sessionId, { 1: updated });

        const retrieved = await storage.getSummary(sessionId);
        expect(retrieved[1]).toEqual(updated);
      });

      it('should support partial updates', async () => {
        const sessionId = 'partial-update-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        // Add stage 1
        await storage.updateSummary(sessionId, {
          1: {
            productGoal: 'Goal',
            targetUsers: 'Users',
            coreFunctions: ['func1'],
          },
        });

        // Add stage 2 (should keep stage 1)
        await storage.updateSummary(sessionId, {
          2: {
            risks: ['risk1'],
            selectedApproach: 'approach',
          },
        });

        const retrieved = await storage.getSummary(sessionId);
        expect(retrieved[1]).toBeDefined();
        expect(retrieved[2]).toBeDefined();
      });
    });
  });

  describe('Session Operations', () => {
    describe('getSession', () => {
      it('should return null for non-existent session', async () => {
        const session = await storage.getSession('non-existent');
        expect(session).toBeNull();
      });

      it('should retrieve complete session data', async () => {
        const sessionId = 'full-session-test';
        const state: SessionState = {
          sessionId,
          currentStage: 2,
          completeness: 50,
          profile: { projectName: 'Full Session' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        const messages: Message[] = [
          { role: 'user', content: 'Hello', timestamp: Date.now() },
          { role: 'assistant', content: 'Hi', timestamp: Date.now() },
        ];
        for (const msg of messages) {
          await storage.addMessage(sessionId, msg);
        }

        const summaries: StagesSummary = {
          1: {
            productGoal: 'Goal',
            targetUsers: 'Users',
            coreFunctions: ['func1'],
          },
        };
        await storage.updateSummary(sessionId, summaries);

        const session = await storage.getSession(sessionId);
        expect(session).not.toBeNull();
        expect(session?.messages).toHaveLength(2);
        expect(session?.state.sessionId).toBe(sessionId);
        expect(session?.summary).toEqual(summaries);
      });
    });

    describe('deleteSession', () => {
      it('should delete session and all related data', async () => {
        const sessionId = 'delete-session-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);
        await storage.addMessage(sessionId, { role: 'user', content: 'Test', timestamp: Date.now() });

        expect(await storage.sessionExists(sessionId)).toBe(true);

        await storage.deleteSession(sessionId);

        expect(await storage.sessionExists(sessionId)).toBe(false);
        expect(await storage.getMessages(sessionId)).toEqual([]);
      });
    });

    describe('sessionExists', () => {
      it('should return false for non-existent session', async () => {
        const exists = await storage.sessionExists('non-existent');
        expect(exists).toBe(false);
      });

      it('should return true for existing session', async () => {
        const sessionId = 'exists-test';
        const state: SessionState = {
          sessionId,
          currentStage: 0,
          completeness: 0,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        const exists = await storage.sessionExists(sessionId);
        expect(exists).toBe(true);
      });
    });

    describe('getAllSessions', () => {
      it('should return empty array when no sessions exist', async () => {
        const sessions = await storage.getAllSessions();
        expect(sessions).toEqual([]);
      });

      it('should return all sessions ordered by updatedAt', async () => {
        const baseTime = Date.now();

        // Create sessions with different timestamps
        const session1: SessionState = {
          sessionId: 'session-1',
          currentStage: 1,
          completeness: 25,
          profile: { projectName: 'Session 1' },
          createdAt: baseTime,
          updatedAt: baseTime + 3000,
        };
        await storage.setState('session-1', session1);

        const session2: SessionState = {
          sessionId: 'session-2',
          currentStage: 2,
          completeness: 50,
          profile: { projectName: 'Session 2' },
          createdAt: baseTime,
          updatedAt: baseTime + 1000,
        };
        await storage.setState('session-2', session2);

        const session3: SessionState = {
          sessionId: 'session-3',
          currentStage: 3,
          completeness: 75,
          profile: { projectName: 'Session 3' },
          createdAt: baseTime,
          updatedAt: baseTime + 2000,
        };
        await storage.setState('session-3', session3);

        const all = await storage.getAllSessions();
        expect(all).toHaveLength(3);
        // Should be ordered by updatedAt descending
        expect(all[0]?.sessionId).toBe('session-1');
        expect(all[1]?.sessionId).toBe('session-3');
        expect(all[2]?.sessionId).toBe('session-2');
      });

      it('should respect limit parameter', async () => {
        const baseTime = Date.now();
        for (let i = 1; i <= 5; i++) {
          const state: SessionState = {
            sessionId: `limit-test-${i}`,
            currentStage: 0,
            completeness: 0,
            profile: { projectName: `Session ${i}` },
            createdAt: baseTime,
            updatedAt: baseTime + i * 1000,
          };
          await storage.setState(`limit-test-${i}`, state);
        }

        const limited = await storage.getAllSessions(3);
        expect(limited).toHaveLength(3);
      });
    });

    describe('markSessionCompleted', () => {
      it('should mark session as completed', async () => {
        const sessionId = 'complete-test';
        const state: SessionState = {
          sessionId,
          currentStage: 3,
          completeness: 75,
          profile: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.setState(sessionId, state);

        await storage.markSessionCompleted(sessionId);

        const updated = await storage.getState(sessionId);
        expect(updated?.currentStage).toBe(7); // Stage.COMPLETED
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow', async () => {
      const sessionId = 'workflow-test';

      // 1. Create session
      const state: SessionState = {
        sessionId,
        currentStage: 0,
        completeness: 0,
        profile: { projectName: 'Workflow Test' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await storage.setState(sessionId, state);
      expect(await storage.sessionExists(sessionId)).toBe(true);

      // 2. Add messages
      await storage.addMessage(sessionId, { role: 'user', content: 'Hello', timestamp: Date.now() });
      await storage.addMessage(sessionId, { role: 'assistant', content: 'Hi there!', timestamp: Date.now() });
      expect(await storage.getMessages(sessionId)).toHaveLength(2);

      // 3. Update state
      state.currentStage = 1;
      state.completeness = 25;
      await storage.setState(sessionId, state);

      // 4. Add summary
      await storage.updateSummary(sessionId, {
        1: {
          productGoal: 'Test goal',
          targetUsers: 'Test users',
          coreFunctions: ['func1'],
        },
      });

      // 5. Verify complete session
      const session = await storage.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.messages).toHaveLength(2);
      expect(session?.state.currentStage).toBe(1);
      expect(session?.summary[1]).toBeDefined();

      // 6. Mark completed
      await storage.markSessionCompleted(sessionId);
      const completed = await storage.getState(sessionId);
      expect(completed?.currentStage).toBe(7);
    });
  });
});
