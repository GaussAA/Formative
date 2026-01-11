/**
 * Intelligent Cache (P2 - Performance Optimization)
 *
 * Provides smart caching with TTL, access frequency tracking, and LRU eviction.
 * Features:
 * - TTL (Time To Live) support per entry
 * - Access frequency tracking for better eviction decisions
 * - LRU (Least Recently Used) eviction policy
 * - Statistics for cache performance monitoring
 * - Optional semantic similarity lookup (placeholder for future)
 */

import logger from '@/lib/logger';

/**
 * Cache entry with metadata
 */
interface CacheEntry<V> {
  /** Cached value */
  value: V;
  /** When the entry was created (timestamp) */
  createdAt: number;
  /** When the entry was last accessed (timestamp) */
  lastAccessedAt: number;
  /** Number of times accessed */
  accessCount: number;
  /** Time to live in milliseconds (0 = no expiration) */
  ttl: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of entries */
  size: number;
  /** Maximum number of entries */
  maxSize: number;
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Number of evicted entries */
  evictions: number;
  /** Number of expired entries removed */
  expired: number;
  /** Current memory usage estimate (bytes) */
  memoryUsage: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum number of entries (default: 200) */
  maxSize?: number;
  /** Default TTL in milliseconds (0 = no expiration, default: 600000 = 10min) */
  defaultTTL?: number;
  /** Cleanup interval in milliseconds (default: 60000 = 1min) */
  cleanupInterval?: number;
  /** Enable access frequency tracking (default: true) */
  trackFrequency?: boolean;
  /** Enable memory estimation (default: true) */
  trackMemory?: boolean;
}

/**
 * Cache options for individual entries
 */
export interface CacheEntryOptions {
  /** Custom TTL for this entry (0 = use default) */
  ttl?: number;
  /** Custom tags for grouping */
  tags?: string[];
}

/**
 * Intelligent Cache class
 */
export class IntelligentCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private config: Required<CacheConfig>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expired: 0,
  };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 200,
      defaultTTL: config.defaultTTL ?? 600000, // 10 minutes
      cleanupInterval: config.cleanupInterval ?? 60000, // 1 minute
      trackFrequency: config.trackFrequency ?? true,
      trackMemory: config.trackMemory ?? true,
    };

    // Start periodic cleanup
    this.startCleanup();

    logger.info('IntelligentCache initialized', {
      maxSize: this.config.maxSize,
      defaultTTL: this.config.defaultTTL,
      cleanupInterval: this.config.cleanupInterval,
    });
  }

  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache entry options
   */
  set(key: K, value: V, options: CacheEntryOptions = {}): void {
    const now = Date.now();
    const ttl = options.ttl ?? this.config.defaultTTL;

    // Evict LRU entry if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      ttl,
    });

    logger.debug('Cache entry set', { key, ttl });
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.expired++;
      this.stats.misses++;
      logger.debug('Cache entry expired', { key });
      return undefined;
    }

    // Update access metadata
    if (this.config.trackFrequency) {
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Check if a key exists and is not expired
   * @param key - Cache key
   * @returns True if key exists and is valid
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.expired++;
      return false;
    }

    return true;
  }

  /**
   * Delete a specific entry
   * @param key - Cache key
   * @returns True if entry was deleted
   */
  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache entry deleted', { key });
    }
    return deleted;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { entries: size });
  }

  /**
   * Get all cache keys
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry<V>): boolean {
    if (entry.ttl === 0) {
      return false; // No expiration
    }
    return Date.now() - entry.createdAt > entry.ttl;
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let lruKey: K | undefined;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < lruTime) {
        lruTime = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey !== undefined) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
      logger.debug('Cache entry evicted (LRU)', { key: lruKey });
    }
  }

  /**
   * Periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl > 0 && now - entry.createdAt > entry.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.stats.expired += expiredCount;
      logger.debug('Cache cleanup completed', { expired: expiredCount });
    }
  }

  /**
   * Estimate memory usage of the cache
   */
  private estimateMemory(): number {
    if (!this.config.trackMemory) {
      return 0;
    }

    // Rough estimation based on JavaScript object overhead
    // This is not precise but gives an idea of memory usage
    let totalSize = 0;

    for (const [key, value] of this.cache.entries()) {
      // Estimate size based on JSON stringification
      try {
        const keySize = JSON.stringify(key).length * 2; // UTF-16
        const valueSize = JSON.stringify(value).length * 2;
        totalSize += keySize + valueSize + 100; // Add overhead for Map entry
      } catch {
        // If circular reference, skip
        totalSize += 200; // Rough estimate
      }
    }

    return totalSize;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      evictions: this.stats.evictions,
      expired: this.stats.expired,
      memoryUsage: this.estimateMemory(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expired: 0,
    };
    logger.debug('Cache statistics reset');
  }

  /**
   * Get or set pattern - useful for caching computed values
   * @param key - Cache key
   * @param factory - Function to compute value if not cached
   * @param options - Cache entry options
   * @returns Cached or computed value
   */
  async getOrSet(
    key: K,
    factory: () => V | Promise<V>,
    options: CacheEntryOptions = {}
  ): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, options);
    return value;
  }

  /**
   * Invalidate entries by tags
   * @param tags - Tags to invalidate
   */
  invalidateByTags(tags: string[]): number {
    // Note: This is a placeholder for tag-based invalidation
    // To implement this, we'd need to store tags in the cache entry
    // and maintain a reverse index
    logger.debug('Tag-based invalidation', { tags });
    return 0;
  }

  /**
   * Destroy the cache (stop cleanup timer)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
    logger.info('Cache destroyed');
  }
}

/**
 * Pre-configured cache instances
 */
export const CachePresets = {
  /** LLM response cache (200 entries, 10min TTL) */
  LLM_RESPONSE: { maxSize: 200, defaultTTL: 600000, cleanupInterval: 60000 },
  /** API response cache (100 entries, 5min TTL) */
  API_RESPONSE: { maxSize: 100, defaultTTL: 300000, cleanupInterval: 30000 },
  /** Session cache (50 entries, 1hr TTL) */
  SESSION: { maxSize: 50, defaultTTL: 3600000, cleanupInterval: 120000 },
  /** Static content cache (1000 entries, 1day TTL) */
  STATIC: { maxSize: 1000, defaultTTL: 86400000, cleanupInterval: 300000 },
} as const;

/**
 * Singleton instances
 */
const caches: Map<string, IntelligentCache<unknown, unknown>> = new Map();

/**
 * Get or create a named cache
 * @param name - Cache name
 * @param config - Cache configuration (only used on first creation)
 * @returns IntelligentCache instance
 */
export function getCache<K, V>(
  name: string,
  config?: CacheConfig
): IntelligentCache<K, V> {
  if (!caches.has(name)) {
    caches.set(name, new IntelligentCache<K, V>(config));
  }
  return caches.get(name) as IntelligentCache<K, V>;
}

/**
 * Reset all caches (for testing)
 */
export function resetCaches(): void {
  for (const cache of caches.values()) {
    cache.destroy();
  }
  caches.clear();
}

export default IntelligentCache;
