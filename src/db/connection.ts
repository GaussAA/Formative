/**
 * Database Connection
 * SQLite database connection using sql.js (pure JavaScript) with Drizzle ORM
 */

import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/logger';

const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'formative.db');

// Ensure data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let SQL: SqlJsStatic | null = null;
let sqlite: Database | null = null;
let _drizzleDb: SQLJsDatabase<Record<string, never>> | null = null;

/**
 * Initialize the database connection
 * Loads existing database file or creates a new one
 */
export async function initDatabase(): Promise<void> {
  if (sqlite) {
    return; // Already initialized
  }

  try {
    SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      sqlite = new SQL.Database(buffer);
      logger.info('Database loaded from file', { path: dbPath });
    } else {
      sqlite = new SQL.Database();
      logger.info('New database created', { path: dbPath });
    }

    // Enable WAL mode for better concurrent performance
    sqlite.run('PRAGMA journal_mode = WAL');

    _drizzleDb = drizzle(sqlite);
  } catch (error) {
    logger.error('Failed to initialize database', { error });
    throw error;
  }
}

/**
 * Get the drizzle database instance
 * Initializes the database if needed
 */
export async function getDb(): Promise<SQLJsDatabase<Record<string, never>>> {
  if (!_drizzleDb) {
    await initDatabase();
  }
  return _drizzleDb!;
}

/**
 * Get a cached synchronous database instance
 * Must call initDatabase() first
 * @deprecated Use getDb() instead
 */
export function getDbSync(): SQLJsDatabase<Record<string, never>> {
  if (!_drizzleDb) {
    throw new Error('Database not initialized. Call initDatabase() or getDb() first.');
  }
  return _drizzleDb;
}

/**
 * Save database to disk
 * Should be called after writes to persist changes
 */
export function saveDatabase(): void {
  if (!sqlite) {
    return;
  }

  try {
    const data = sqlite.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    logger.debug('Database saved to disk', { path: dbPath });
  } catch (error) {
    logger.error('Failed to save database', { error });
  }
}

/**
 * Legacy db export for backward compatibility
 * This will throw if database is not initialized
 */
export const db = new Proxy({} as SQLJsDatabase<Record<string, never>>, {
  get(target, prop) {
    if (!_drizzleDb) {
      throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return (_drizzleDb as any)[prop];
  },
});
