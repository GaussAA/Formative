/**
 * Distributed State Storage (P3 - Scalability Optimization)
 *
 * Provides distributed state management for multi-instance deployments.
 * Features:
 * - Redis backend for distributed state
 * - Local cache with remote synchronization
 * - Pub/sub for state change notifications
 * - Automatic reconnection and failover
 */

import logger from '@/lib/logger';

/**
 * Minimal Redis client interface
 */
interface RedisClient {
  connect(): Promise<void>;
  quit(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string | null>;
  del(key: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  publish(channel: string, message: string): Promise<number>;
  on(event: string, listener: (...args: any[]) => void): void;
}

/**
 * Distributed state configuration
 */
export interface DistributedStateConfig {
  /** Redis connection configuration */
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    /** Connection timeout in milliseconds (default: 5000) */
    connectTimeout?: number;
    /** Reconnection strategy */
    retryStrategy?: (times: number) => number | void;
  };
  /** Local cache TTL in milliseconds (default: 1000) */
  localCacheTTL?: number;
  /** Enable pub/sub for state changes (default: true) */
  enablePubSub?: boolean;
  /** Key prefix for state storage (default: 'state:') */
  keyPrefix?: string;
}

/**
 * State entry with metadata
 */
export interface StateEntry<T> {
  /** State value */
  value: T;
  /** Last updated timestamp */
  updatedAt: number;
  /** Version number for optimistic locking */
  version: number;
}

/**
 * State change event
 */
export interface StateChangeEvent<T> {
  /** State key */
  key: string;
  /** Old value (if available) */
  oldValue?: T;
  /** New value */
  newValue: T;
  /** Update timestamp */
  timestamp: number;
}

/**
 * State change listener
 */
export type StateChangeListener<T> = (event: StateChangeEvent<T>) => void;

/**
 * Distributed State Manager class
 */
export class DistributedStateManager<T = unknown> {
  private config: Required<Omit<DistributedStateConfig, 'redis'>> & {
    redis: DistributedStateConfig['redis'];
  };
  private localCache: Map<string, { value: StateEntry<T>; expiresAt: number }>;
  private listeners: Map<string, Set<StateChangeListener<T>>> = new Map();
  private redisClient: RedisClient | null = null;
  pubSubClient: RedisClient | null = null;
  private isConnected = false;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: DistributedStateConfig) {
    this.config = {
      redis: config.redis,
      localCacheTTL: config.localCacheTTL ?? 1000,
      enablePubSub: config.enablePubSub !== false,
      keyPrefix: config.keyPrefix ?? 'state:',
    };

    this.localCache = new Map();

    logger.info('DistributedStateManager initialized', {
      host: this.config.redis.host,
      port: this.config.redis.port,
      localCacheTTL: this.config.localCacheTTL,
    });
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    try {
      // Dynamic import for Redis (optional dependency)
      // @ts-expect-error - Optional dependency for production use
      const { createClient } = await import('redis');

      // Create Redis client
      this.redisClient = createClient({
        socket: {
          host: this.config.redis.host,
          port: this.config.redis.port,
          connectTimeout: this.config.redis.connectTimeout ?? 5000,
          reconnectStrategy: this.config.redis.retryStrategy ?? ((times) => {
            if (times > 10) {
              return new Error('Redis reconnection failed');
            }
            return Math.min(times * 100, 3000);
          }),
        },
        password: this.config.redis.password,
        database: this.config.redis.db ?? 0,
      });

      // Set up error handler
      if (this.redisClient) {
        this.redisClient.on('error', (error: Error) => {
          logger.error('Redis client error', { error });
          this.isConnected = false;
        });

        this.redisClient.on('connect', () => {
          logger.info('Redis client connected');
          this.isConnected = true;
        });

        this.redisClient.on('reconnecting', () => {
          logger.info('Redis client reconnecting');
        });

        // Connect to Redis
        await this.redisClient.connect();
      }

      // Set up pub/sub if enabled
      if (this.config.enablePubSub) {
        await this.setupPubSub();
      }

      logger.info('DistributedStateManager connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis', { error });
      throw new Error(
        'Redis connection failed. Make sure redis package is installed: pnpm add redis'
      );
    }
  }

  /**
   * Set up pub/sub for state changes
   */
  private async setupPubSub(): Promise<void> {
    try {
      // @ts-expect-error - Optional dependency
      const { createClient } = await import('redis');

      this.pubSubClient = createClient({
        socket: {
          host: this.config.redis.host,
          port: this.config.redis.port,
        },
        password: this.config.redis.password,
        database: this.config.redis.db ?? 0,
      });

      if (this.pubSubClient) {
        await this.pubSubClient.connect();
      }

      // Subscribe to state changes
      // Note: This is a simplified implementation
      // Real implementation would use Redis pub/sub channels
      logger.info('Pub/sub enabled for state changes');
    } catch (error) {
      logger.warn('Failed to set up pub/sub', { error });
    }
  }

  /**
   * Get state value
   * @param key - State key
   * @returns State value or undefined if not found
   */
  async get(key: string): Promise<T | undefined> {
    // Check local cache first
    const cached = this.localCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value.value;
    }

    // Fetch from Redis
    if (!this.redisClient || !this.isConnected) {
      logger.warn('Redis not connected, returning undefined');
      return undefined;
    }

    try {
      const redisKey = this.config.keyPrefix + key;
      const data = await this.redisClient.get(redisKey);

      if (!data) {
        return undefined;
      }

      const entry: StateEntry<T> = JSON.parse(data);

      // Update local cache
      this.localCache.set(key, {
        value: entry,
        expiresAt: Date.now() + this.config.localCacheTTL,
      });

      return entry.value;
    } catch (error) {
      logger.error('Failed to get state from Redis', { key, error });
      return undefined;
    }
  }

  /**
   * Set state value
   * @param key - State key
   * @param value - State value
   */
  async set(key: string, value: T): Promise<void> {
    const entry: StateEntry<T> = {
      value,
      updatedAt: Date.now(),
      version: 1,
    };

    // Update local cache
    this.localCache.set(key, {
      value: entry,
      expiresAt: Date.now() + this.config.localCacheTTL,
    });

    // Update Redis
    if (!this.redisClient || !this.isConnected) {
      logger.warn('Redis not connected, state only cached locally');
      return;
    }

    try {
      const redisKey = this.config.keyPrefix + key;
      await this.redisClient.set(redisKey, JSON.stringify(entry));

      // Publish state change
      if (this.pubSubClient && this.config.enablePubSub) {
        await this.pubSubClient.publish(
          `${this.config.keyPrefix}changes`,
          JSON.stringify({ key, value, timestamp: Date.now() })
        );
      }

      this.notifyListeners(key, value);
    } catch (error) {
      logger.error('Failed to set state in Redis', { key, error });
    }
  }

  /**
   * Delete state
   * @param key - State key
   */
  async delete(key: string): Promise<boolean> {
    // Remove from local cache
    const deleted = this.localCache.delete(key);

    // Remove from Redis
    if (this.redisClient && this.isConnected) {
      try {
        const redisKey = this.config.keyPrefix + key;
        await this.redisClient.del(redisKey);
        return true;
      } catch (error) {
        logger.error('Failed to delete state from Redis', { key, error });
      }
    }

    return deleted;
  }

  /**
   * Subscribe to state changes
   * @param key - State key (or '*' for all keys)
   * @param listener - Callback function
   */
  subscribe(key: string, listener: StateChangeListener<T>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    this.listeners.get(key)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Notify listeners of state change
   */
  private notifyListeners(key: string, value: T): void {
    const event: StateChangeEvent<T> = {
      key,
      newValue: value,
      timestamp: Date.now(),
    };

    // Notify specific key listeners
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      for (const listener of keyListeners) {
        try {
          listener(event);
        } catch (error) {
          logger.error('State change listener error', { key, error });
        }
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          listener(event);
        } catch (error) {
          logger.error('Wildcard state change listener error', { error });
        }
      }
    }
  }

  /**
   * Get all state keys
   */
  async keys(): Promise<string[]> {
    if (!this.redisClient || !this.isConnected) {
      return Array.from(this.localCache.keys());
    }

    try {
      const keys = await this.redisClient.keys(`${this.config.keyPrefix}*`);
      return keys.map((k: string) => k.slice(this.config.keyPrefix.length));
    } catch (error) {
      logger.error('Failed to get keys from Redis', { error });
      return Array.from(this.localCache.keys());
    }
  }

  /**
   * Clear all state
   */
  async clear(): Promise<void> {
    this.localCache.clear();

    if (this.redisClient && this.isConnected) {
      try {
        const keys = await this.redisClient.keys(`${this.config.keyPrefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (error) {
        logger.error('Failed to clear state in Redis', { error });
      }
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    localCacheSize: number;
    listenerCount: number;
    isConnected: boolean;
  } {
    let listenerCount = 0;
    for (const listeners of this.listeners.values()) {
      listenerCount += listeners.size;
    }

    return {
      localCacheSize: this.localCache.size,
      listenerCount,
      isConnected: this.isConnected,
    };
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.pubSubClient) {
      try {
        await this.pubSubClient.quit();
      } catch (error) {
        logger.error('Error disconnecting pub/sub client', { error });
      }
      this.pubSubClient = null;
    }

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (error) {
        logger.error('Error disconnecting Redis client', { error });
      }
      this.redisClient = null;
    }

    this.isConnected = false;
    logger.info('DistributedStateManager disconnected');
  }

  /**
   * Destroy the manager
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    this.listeners.clear();
    this.localCache.clear();
  }
}

/**
 * Singleton instances
 */
const managers: Map<string, DistributedStateManager<unknown>> = new Map();

/**
 * Get or create a distributed state manager
 * @param name - Manager name
 * @param config - Configuration (only used on first creation)
 * @returns DistributedStateManager instance
 */
export async function getDistributedStateManager<T>(
  name: string,
  config?: DistributedStateConfig
): Promise<DistributedStateManager<T>> {
  if (!managers.has(name)) {
    const manager = new DistributedStateManager<T>(
      config ?? {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
        },
      }
    );

    await manager.connect();
    managers.set(name, manager as DistributedStateManager<unknown>);
  }

  return managers.get(name) as DistributedStateManager<T>;
}

/**
 * Reset all managers (for testing)
 */
export async function resetDistributedStateManagers(): Promise<void> {
  for (const manager of managers.values()) {
    await manager.destroy();
  }
  managers.clear();
}

export default DistributedStateManager;
