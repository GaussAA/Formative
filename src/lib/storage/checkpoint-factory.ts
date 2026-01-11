/**
 * Checkpoint Storage Factory (P1 - Reliability Optimization)
 *
 * Provides unified checkpoint storage interface.
 * Currently supports:
 * - Memory (default, for development)
 *
 * Future support (when packages become available):
 * - SQLite (for small-scale production)
 * - Redis (for distributed systems)
 * - PostgreSQL (for large-scale production)
 */

import { MemorySaver, type BaseCheckpointSaver } from '@langchain/langgraph';
import logger from '@/lib/logger';

/**
 * Checkpoint storage types
 */
export enum CheckpointStorage {
  MEMORY = 'memory',
  // Future: SQLITE = 'sqlite',
  // Future: REDIS = 'redis',
  // Future: POSTGRES = 'postgres',
}

/**
 * Checkpoint storage configuration
 */
export interface CheckpointConfig {
  /** Storage type */
  type: CheckpointStorage;
  /* Future configs for other storage types */
}

/**
 * Checkpoint Factory class
 */
export class CheckpointFactory {
  private static instances: Map<string, BaseCheckpointSaver> = new Map();

  /**
   * Create or get checkpoint saver instance
   * @param config - Checkpoint configuration
   * @returns Checkpoint saver instance
   */
  static async create(config?: CheckpointConfig): Promise<BaseCheckpointSaver> {
    const storageType = config?.type || CheckpointStorage.MEMORY;
    const cacheKey = JSON.stringify(config || { type: storageType });

    // Return cached instance if available
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!;
    }

    let saver: BaseCheckpointSaver;

    switch (storageType) {
      case CheckpointStorage.MEMORY:
      default:
        saver = new MemorySaver();
        logger.info('MemorySaver created');
        break;
    }

    // Cache instance
    this.instances.set(cacheKey, saver);

    logger.info('CheckpointSaver created', { type: storageType });

    return saver;
  }

  /**
   * Clear all cached instances
   */
  static clear(): void {
    this.instances.clear();
    logger.info('All checkpoint instances cleared');
  }

  /**
   * Get configuration from environment variables
   */
  static getFromEnv(): CheckpointConfig {
    const storageType = (process.env.CHECKPOINT_STORAGE as CheckpointStorage) || CheckpointStorage.MEMORY;

    const config: CheckpointConfig = { type: storageType };

    // Future: Add config parsing for other storage types

    return config;
  }
}

/**
 * Get global checkpointer singleton (for backward compatibility)
 */
let globalCheckpointer: BaseCheckpointSaver | null = null;

export async function getCheckpointer(): Promise<BaseCheckpointSaver> {
  if (!globalCheckpointer) {
    const config = CheckpointFactory.getFromEnv();
    globalCheckpointer = await CheckpointFactory.create(config);
    logger.info('Global checkpointer initialized', { type: config.type });
  }
  return globalCheckpointer;
}

/**
 * Reset global checkpointer (for testing)
 */
export function resetCheckpointer(): void {
  globalCheckpointer = null;
}

export default CheckpointFactory;
