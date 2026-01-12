/**
 * Memory Module Entry Point
 * Provides unified memory storage access interface
 */

import { SQLiteStorage } from '../storage/db-storage';
import { MemoryStorage } from './interface';

// Use SQLite for persistent storage
const storage: MemoryStorage = new SQLiteStorage();

export default storage;
export type { MemoryStorage } from './interface';
export { SQLiteStorage } from '../storage/db-storage';
