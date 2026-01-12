/**
 * Database Migration Script
 * Runs Drizzle migrations to create/update database schema
 */

import { migrate } from 'drizzle-orm/sql-js/migrator';
import { initDatabase, saveDatabase, getDb } from '@/db/connection';
import logger from '@/lib/logger';

/**
 * Run all pending database migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    logger.info('Initializing database...');
    await initDatabase();

    logger.info('Running database migrations...');
    const db = await getDb();
    await migrate(db, { migrationsFolder: './src/db/migrations' });

    // Save database to disk after migrations
    saveDatabase();

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Database migration failed', { error });
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  (async () => {
    await runMigrations();
    process.exit(0);
  })().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
