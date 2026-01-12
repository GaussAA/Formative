/**
 * Database Connection
 * SQLite database connection using sql.js (pure JavaScript) with Drizzle ORM
 */

import initSqlJs, { SqlJsStatic, Database } from 'sql.js';
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/logger';

/**
 * Get the database path from environment or default
 * This function reads the environment variable each time to support testing
 */
function getDbPath(): string {
  return process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'formative.db');
}

/**
 * Ensure the data directory exists
 */
function ensureDataDir(): void {
  const dbDir = path.dirname(getDbPath());
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

let SQL: SqlJsStatic | null = null;
let sqlite: Database | null = null;
let _drizzleDb: SQLJsDatabase<Record<string, never>> | null = null;

/**
 * Find the sql.js WASM file in node_modules
 * Handles pnpm's nested structure
 */
function findWasmFile(): string | null {
  const possiblePaths = [
    // Standard node_modules
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];

  // Try to find in pnpm store
  const nodeModulesRoot = path.join(process.cwd(), 'node_modules', '.pnpm');
  if (fs.existsSync(nodeModulesRoot)) {
    // List all sql.js directories in pnpm store
    const sqlJsDirs = fs.readdirSync(nodeModulesRoot)
      .filter((dir: string) => dir.startsWith('sql.js@'))
      .map((dir: string) => path.join(nodeModulesRoot, dir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'));

    possiblePaths.push(...sqlJsDirs);
  }

  for (const wasmPath of possiblePaths) {
    if (fs.existsSync(wasmPath)) {
      return wasmPath;
    }
  }

  return null;
}

/**
 * Initialize the database connection
 * Loads existing database file or creates a new one
 */
export async function initDatabase(): Promise<void> {
  if (sqlite) {
    return; // Already initialized
  }

  const dbPath = getDbPath();
  ensureDataDir();

  try {
    // Find and load the WASM file
    const wasmPath = findWasmFile();

    let initOptions;
    if (wasmPath) {
      logger.debug('Found sql.js WASM file', { path: wasmPath });
      // Load WASM as buffer and pass to initSqlJs
      const wasmBinary = fs.readFileSync(wasmPath);
      initOptions = {
        locateFile: (file: string) => wasmPath,
      };
      SQL = await initSqlJs(initOptions);
    } else {
      logger.warn('sql.js WASM file not found locally, using CDN fallback');
      // Fall back to CDN (will require internet connection)
      SQL = await initSqlJs();
    }

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

    // Enable foreign key constraints
    sqlite.run('PRAGMA foreign_keys = ON');

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
    const dbPath = getDbPath();
    const data = sqlite.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    logger.debug('Database saved to disk', { path: dbPath });
  } catch (error) {
    logger.error('Failed to save database', { error });
  }
}

/**
 * Close the database connection
 * Saves the database and closes the connection
 * Should be called before process exit to avoid libuv assertion errors
 */
export async function closeDatabase(): Promise<void> {
  try {
    if (sqlite) {
      // Save database before closing
      saveDatabase();

      // Close the database connection
      sqlite.close();
      sqlite = null;
    }

    // Clear cached instances
    _drizzleDb = null;
    SQL = null;

    logger.debug('Database connection closed');
  } catch (error) {
    logger.error('Failed to close database', { error });
    // Don't throw - we want to exit cleanly even if close fails
  }
}

/**
 * Legacy db export for backward compatibility
 * This will throw if database is not initialized
 */
export const db = new Proxy({} as SQLJsDatabase<Record<string, never>>, {
  get(target, prop) {
    if (!_drizzleDb) {
      throw new Error('Database not initialized. Call initDatabase() or getDb() first.');
    }
    return (_drizzleDb as any)[prop];
  },
});
