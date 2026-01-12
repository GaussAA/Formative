/**
 * Database Connection Unit Tests
 * Tests for database initialization, connection management, and CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDatabase, getDb, saveDatabase, closeDatabase } from '@/db/connection';
import { sessions, messages, stageSummaries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { migrate } from 'drizzle-orm/sql-js/migrator';

// Use a test database file
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-connection.db');

describe('Database Connection', () => {
  beforeEach(async () => {
    // Clean up test database before each test
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Mock DATABASE_URL to use test database
    vi.stubEnv('DATABASE_URL', TEST_DB_PATH);

    // Initialize database for each test
    await initDatabase();

    // Run migrations to create schema
    const db = await getDb();
    await migrate(db, { migrationsFolder: './src/db/migrations' });
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

  describe('initDatabase', () => {
    it('should initialize database successfully', async () => {
      const db = await getDb();
      expect(db).toBeDefined();
      expect(typeof db.select).toBe('function');
    });

    it('should be idempotent - calling multiple times should not create multiple instances', async () => {
      await initDatabase();
      await initDatabase();
      await initDatabase();

      const db = await getDb();
      const result = await db.select().from(sessions);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getDb', () => {
    it('should return a database instance', async () => {
      const db = await getDb();

      expect(db).toBeDefined();
      expect(typeof db.select).toBe('function');
      expect(typeof db.insert).toBe('function');
      expect(typeof db.delete).toBe('function');
      expect(typeof db.update).toBe('function');
    });
  });

  describe('saveDatabase', () => {
    it('should create database file on save', async () => {
      expect(fs.existsSync(TEST_DB_PATH)).toBe(false);

      saveDatabase();

      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });

    it('should persist data to disk', async () => {
      const db = await getDb();

      // Insert a test session
      await db.insert(sessions).values({
        sessionId: 'test-session-persist',
        projectName: 'Test Project',
        currentStage: 0,
        completeness: 0,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Save to disk
      saveDatabase();

      // Close and reopen database
      await closeDatabase();
      await initDatabase();
      const newDb = await getDb();

      // Verify data persists
      const result = await newDb.select().from(sessions).where(eq(sessions.sessionId, 'test-session-persist'));
      expect(result).toHaveLength(1);
      expect(result[0]?.sessionId).toBe('test-session-persist');
      expect(result[0]?.projectName).toBe('Test Project');
    });

    it('should not throw if database is not initialized', () => {
      expect(() => saveDatabase()).not.toThrow();
    });
  });

  describe('closeDatabase', () => {
    it('should close the database connection', async () => {
      const db = await getDb();

      // Insert some data
      await db.insert(sessions).values({
        sessionId: 'test-session-close',
        projectName: 'Close Test',
        currentStage: 0,
        completeness: 0,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      saveDatabase();
      await closeDatabase();

      // Verify database file exists
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });

    it('should not throw if database is not initialized', async () => {
      await expect(closeDatabase()).resolves.not.toThrow();
    });

    it('should allow re-opening after closing', async () => {
      await closeDatabase();

      // Should be able to open again
      await initDatabase();
      const db = await getDb();

      expect(db).toBeDefined();
    });
  });

  describe('CRUD Operations', () => {
    describe('Sessions', () => {
      it('should create a new session', async () => {
        const db = await getDb();

        await db.insert(sessions).values({
          sessionId: 'test-session-create',
          projectName: 'Test Project',
          currentStage: 1,
          completeness: 25,
          completed: false,
          profile: JSON.stringify({ projectName: 'Test Project' }),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await db.select().from(sessions).where(eq(sessions.sessionId, 'test-session-create'));
        expect(result).toHaveLength(1);
        expect(result[0]?.projectName).toBe('Test Project');
      });

      it('should read session data', async () => {
        const db = await getDb();

        const createdAt = new Date('2024-01-01T00:00:00Z');
        const updatedAt = new Date('2024-01-01T01:00:00Z');

        await db.insert(sessions).values({
          sessionId: 'test-session-read',
          projectName: 'Read Test Project',
          currentStage: 2,
          completeness: 50,
          completed: false,
          createdAt,
          updatedAt,
        });

        const result = await db.select().from(sessions).where(eq(sessions.sessionId, 'test-session-read'));
        expect(result).toHaveLength(1);
        expect(result[0]?.currentStage).toBe(2);
        expect(result[0]?.completeness).toBe(50);
      });

      it('should update session data', async () => {
        const db = await getDb();

        await db.insert(sessions).values({
          sessionId: 'test-session-update',
          projectName: 'Update Test',
          currentStage: 1,
          completeness: 25,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.update(sessions)
          .set({ completeness: 75, currentStage: 3 })
          .where(eq(sessions.sessionId, 'test-session-update'));

        const result = await db.select().from(sessions).where(eq(sessions.sessionId, 'test-session-update'));
        expect(result[0]?.completeness).toBe(75);
        expect(result[0]?.currentStage).toBe(3);
      });

      it('should delete session data', async () => {
        const db = await getDb();

        await db.insert(sessions).values({
          sessionId: 'test-session-delete',
          projectName: 'Delete Test',
          currentStage: 0,
          completeness: 0,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.delete(sessions).where(eq(sessions.sessionId, 'test-session-delete'));

        const result = await db.select().from(sessions).where(eq(sessions.sessionId, 'test-session-delete'));
        expect(result).toHaveLength(0);
      });
    });

    describe('Messages', () => {
      it('should create messages for a session', async () => {
        const db = await getDb();

        // First create a session
        await db.insert(sessions).values({
          sessionId: 'test-msg-session',
          projectName: 'Message Test',
          currentStage: 0,
          completeness: 0,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Insert messages
        await db.insert(messages).values([
          {
            sessionId: 'test-msg-session',
            role: 'user',
            content: 'Hello',
            timestamp: new Date(),
          },
          {
            sessionId: 'test-msg-session',
            role: 'assistant',
            content: 'Hi there!',
            timestamp: new Date(),
          },
        ]);

        const result = await db.select().from(messages).where(eq(messages.sessionId, 'test-msg-session'));
        expect(result).toHaveLength(2);
        expect(result[0]?.role).toBe('user');
        expect(result[1]?.role).toBe('assistant');
      });

      it('should allow manual cascade delete messages when session is deleted', async () => {
        const db = await getDb();

        // Create session with messages
        await db.insert(sessions).values({
          sessionId: 'test-cascade',
          projectName: 'Cascade Test',
          currentStage: 0,
          completeness: 0,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(messages).values({
          sessionId: 'test-cascade',
          role: 'user',
          content: 'Test message',
          timestamp: new Date(),
        });

        // Verify message was created
        const beforeDelete = await db.select().from(messages).where(eq(messages.sessionId, 'test-cascade'));
        expect(beforeDelete).toHaveLength(1);

        // Delete messages first, then session (manual cascade for sql.js)
        await db.delete(messages).where(eq(messages.sessionId, 'test-cascade'));
        await db.delete(sessions).where(eq(sessions.sessionId, 'test-cascade'));

        // Messages should be deleted
        const messagesResult = await db.select().from(messages).where(eq(messages.sessionId, 'test-cascade'));
        expect(messagesResult).toHaveLength(0);
      });
    });

    describe('Stage Summaries', () => {
      it('should create stage summaries', async () => {
        const db = await getDb();

        await db.insert(sessions).values({
          sessionId: 'test-summary-session',
          projectName: 'Summary Test',
          currentStage: 0,
          completeness: 0,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const summaryData = {
          productGoal: 'Test goal',
          targetUsers: 'Test users',
          coreFunctions: ['func1', 'func2'],
        };

        await db.insert(stageSummaries).values({
          sessionId: 'test-summary-session',
          stage: 1,
          data: JSON.stringify(summaryData),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await db.select().from(stageSummaries).where(eq(stageSummaries.sessionId, 'test-summary-session'));
        expect(result).toHaveLength(1);
        expect(result[0]?.stage).toBe(1);
        expect(JSON.parse(result[0]!.data)).toEqual(summaryData);
      });
    });
  });

  describe('JSON Data Handling', () => {
    it('should store and retrieve JSON profile data', async () => {
      const db = await getDb();

      const profile = {
        projectName: 'JSON Test',
        productGoal: 'Test JSON handling',
        targetUsers: 'Developers',
        coreFunctions: ['Function 1', 'Function 2'],
        needsDataStorage: true,
        needsAuth: false,
      };

      await db.insert(sessions).values({
        sessionId: 'test-json-profile',
        projectName: profile.projectName,
        currentStage: 0,
        completeness: 0,
        completed: false,
        profile: JSON.stringify(profile),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await db.select().from(sessions).where(eq(sessions.sessionId, 'test-json-profile'));
      expect(result).toHaveLength(1);

      const retrievedProfile = JSON.parse(result[0]!.profile!);
      expect(retrievedProfile).toEqual(profile);
    });

    it('should handle null profile data', async () => {
      const db = await getDb();

      await db.insert(sessions).values({
        sessionId: 'test-null-profile',
        projectName: 'Null Profile Test',
        currentStage: 0,
        completeness: 0,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await db.select().from(sessions).where(eq(sessions.sessionId, 'test-null-profile'));
      expect(result).toHaveLength(1);
      expect(result[0]?.profile).toBeNull();
    });
  });

  describe('Timestamp Handling', () => {
    it('should store and retrieve Date objects correctly', async () => {
      const db = await getDb();

      const now = new Date();
      const past = new Date('2024-01-01T00:00:00Z');

      await db.insert(sessions).values({
        sessionId: 'test-timestamps',
        projectName: 'Timestamp Test',
        currentStage: 0,
        completeness: 0,
        completed: false,
        createdAt: past,
        updatedAt: now,
      });

      const result = await db.select().from(sessions).where(eq(sessions.sessionId, 'test-timestamps'));
      expect(result).toHaveLength(1);

      // SQLite stores timestamps with second precision, so we need to round
      // to seconds for comparison
      const retrievedCreatedAt = result[0]!.createdAt;
      const retrievedUpdatedAt = result[0]!.updatedAt;

      // Round to seconds for comparison
      expect(Math.floor(retrievedCreatedAt.getTime() / 1000)).toBe(Math.floor(past.getTime() / 1000));
      expect(Math.floor(retrievedUpdatedAt.getTime() / 1000)).toBe(Math.floor(now.getTime() / 1000));

      // Also verify they're valid Date objects
      expect(retrievedCreatedAt.toISOString()).toContain('2024-01-01');
    });
  });
});
