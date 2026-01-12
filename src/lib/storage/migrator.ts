/**
 * Database Migration Script
 * Runs Drizzle migrations to create/update database schema
 */

import { migrate } from 'drizzle-orm/sql-js/migrator';
import { initDatabase, saveDatabase, getDb, closeDatabase } from '@/db/connection';
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

    // Close database connection before exit
    await closeDatabase();
  } catch (error) {
    logger.error('Database migration failed', { error });
    await closeDatabase();
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  (async () => {
    await runMigrations();
    // Add small delay to allow libuv to clean up handles
    // This prevents assertion errors on Windows
    await new Promise((resolve) => setTimeout(resolve, 100));
    process.exit(0);
  })().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
