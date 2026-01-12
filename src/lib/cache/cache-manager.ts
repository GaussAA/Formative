/**
 * Cache Manager - Centralized caching strategy for LLM operations
 *
 * Features:
 * - Multi-level caching (L1 memory + optional L2 persistent)
 * - Semantic similarity-based cache lookup
 * - Prompt-aware caching at different levels
 * - Intelligent cache warming and eviction
 * - Comprehensive statistics and monitoring
 */

import { IntelligentCache, getCache, type CacheStats, type CacheEntryOptions } from './intelligent-cache';
import logger from '@/lib/logger';
import { hashString } from './lru-cache';

/**
 * Cache level configuration
 */
export interface CacheLevelConfig {
  /** Level name (e.g., 'l1', 'l2') */
  name: string;
  /** Maximum number of entries */
  maxSize: number;
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** Priority for eviction (higher = less likely to be evicted) */
  priority: number;
}

/**
 * Cache entry metadata
 */
interface CacheMetadata {
  /** Agent type that created this entry */
  agentType: string;
  /** Template used (if applicable) */
  template?: string;
  /** Token count of the request */
  requestTokens?: number;
  /** Token count of the response */
  responseTokens?: number;
  /** Number of times this entry was reused */
  reuseCount: number;
  /** Last validated timestamp */
  lastValidatedAt: number;
}

/**
 * Semantic cache key with embedding
 */
interface SemanticCacheKey {
  /** Original text key */
  textKey: string;
  /** Computed embedding (placeholder for future implementation) */
  embedding?: number[];
  /** Semantic similarity threshold (0-1) */
  similarityThreshold: number;
}

/**
 * Cache hit result with metadata
 */
export interface CacheHitResult<T> {
  /** Cached value */
  value: T;
  /** Cache level that provided the hit */
  level: string;
  /** Metadata about the cache entry */
  metadata: CacheMetadata;
  /** Time saved by cache hit (milliseconds) */
  timeSaved: number;
}

/**
 * Cache miss result
 */
export interface CacheMissResult {
  /** Reason for cache miss */
  reason: 'not_found' | 'expired' | 'evicted' | 'bypassed';
  /** Suggested action */
  suggestion?: string;
}

/**
 * Cache manager configuration
 */
export interface CacheManagerConfig {
  /** Enable L1 (memory) cache */
  enableL1: boolean;
  /** Enable L2 (persistent) cache - not yet implemented */
  enableL2: boolean;
  /** Enable semantic similarity caching - not yet implemented */
  enableSemantic: boolean;
  /** Enable cache warming */
  enableWarming: boolean;
  /** Global default TTL (milliseconds) */
  globalDefaultTTL: number;
  /** Cache level configurations */
  levels: CacheLevelConfig[];
}

/**
 * Default cache manager configuration
 */
const DEFAULT_CONFIG: CacheManagerConfig = {
  enableL1: true,
  enableL2: false, // Future: persistent cache
  enableSemantic: false, // Future: semantic caching
  enableWarming: true,
  globalDefaultTTL: 600000, // 10 minutes
  levels: [
    {
      name: 'l1',
      maxSize: 500,
      defaultTTL: 600000, // 10 minutes
      priority: 1,
    },
  ],
};

/**
 * Cache Manager class
 */
export class CacheManager {
  private config: CacheManagerConfig;
  private l1Cache: IntelligentCache<string, { value: unknown; metadata: CacheMetadata }>;
  private stats = {
    hits: 0,
    misses: 0,
    semanticHits: 0,
    warmingHits: 0,
    totalRequests: 0,
    totalTimeSaved: 0,
  };

  // Cache warming data - frequently used prompts
  private warmupData: Map<string, { value: unknown; metadata: CacheMetadata }> = new Map();

  constructor(config: Partial<CacheManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize L1 cache
    this.l1Cache = new IntelligentCache({
      maxSize: this.config.levels[0]?.maxSize ?? 500,
      defaultTTL: this.config.levels[0]?.defaultTTL ?? this.config.globalDefaultTTL,
      cleanupInterval: 60000, // 1 minute
      trackFrequency: true,
      trackMemory: true,
    });

    // Initialize cache warming
    if (this.config.enableWarming) {
      this.initializeWarmup();
    }

    logger.info('CacheManager initialized', {
      config: this.config,
      l1Stats: this.l1Cache.getStats(),
    });
  }

  /**
   * Get a value from cache with metadata
   * @param key - Cache key
   * @param agentType - Agent type for metadata
   * @returns Cache hit result or undefined if miss
   */
  get<T = unknown>(
    key: string,
    agentType: string
  ): CacheHitResult<T> | undefined {
    this.stats.totalRequests++;
    const startTime = Date.now();

    // Check L1 cache
    const entry = this.l1Cache.get(key);
    if (entry) {
      this.stats.hits++;
      const timeSaved = Date.now() - startTime;
      this.stats.totalTimeSaved += timeSaved;

      // Update reuse count
      entry.metadata.reuseCount++;
      entry.metadata.lastValidatedAt = Date.now();

      logger.debug('Cache hit (L1)', {
        key: key.slice(0, 50),
        agentType,
        reuseCount: entry.metadata.reuseCount,
        timeSaved,
      });

      return {
        value: entry.value as T,
        level: 'l1',
        metadata: entry.metadata,
        timeSaved,
      };
    }

    this.stats.misses++;
    logger.debug('Cache miss', { key: key.slice(0, 50), agentType });
    return undefined;
  }

  /**
   * Set a value in cache with metadata
   * @param key - Cache key
   * @param value - Value to cache
   * @param agentType - Agent type for metadata
   * @param options - Cache entry options
   */
  set<T = unknown>(
    key: string,
    value: T,
    agentType: string,
    options: CacheEntryOptions = {}
  ): void {
    const metadata: CacheMetadata = {
      agentType,
      template: options.tags?.join(','),
      reuseCount: 0,
      lastValidatedAt: Date.now(),
    };

    this.l1Cache.set(key, { value, metadata }, options);

    // Add to warmup data if frequently accessed
    if (this.config.enableWarming && this.shouldWarmup(key)) {
      this.warmupData.set(key, { value, metadata });
    }

    logger.debug('Cache entry set', {
      key: key.slice(0, 50),
      agentType,
      ttl: options.ttl ?? this.config.globalDefaultTTL,
    });
  }

  /**
   * Get or set pattern - useful for caching computed values
   * @param key - Cache key
   * @param factory - Function to compute value if not cached
   * @param agentType - Agent type for metadata
   * @param options - Cache entry options
   * @returns Cached or computed value
   */
  async getOrSet<T = unknown>(
    key: string,
    factory: () => T | Promise<T>,
    agentType: string,
    options: CacheEntryOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key, agentType);
    if (cached) {
      return cached.value;
    }

    const value = await factory();
    this.set(key, value, agentType, options);
    return value;
  }

  /**
   * Delete a cache entry
   * @param key - Cache key
   */
  delete(key: string): boolean {
    const deleted = this.l1Cache.delete(key);
    this.warmupData.delete(key);
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.l1Cache.clear();
    this.warmupData.clear();
    logger.info('CacheManager cleared');
  }

  /**
   * Invalidate cache entries by agent type
   * @param agentType - Agent type to invalidate
   * @returns Number of entries invalidated
   */
  invalidateByAgent(agentType: string): number {
    let count = 0;
    const keys = this.l1Cache.keys();

    for (const key of keys) {
      const entry = this.l1Cache.get(key);
      if (entry?.metadata.agentType === agentType) {
        this.l1Cache.delete(key);
        count++;
      }
    }

    logger.info('Cache invalidated by agent', { agentType, count });
    return count;
  }

  /**
   * Invalidate cache entries by tags
   * @param tags - Tags to invalidate
   * @returns Number of entries invalidated
   */
  invalidateByTags(tags: string[]): number {
    let count = 0;
    const keys = this.l1Cache.keys();

    for (const key of keys) {
      const entry = this.l1Cache.get(key);
      if (entry?.metadata.template) {
        const entryTags = entry.metadata.template.split(',');
        if (tags.some((tag) => entryTags.includes(tag))) {
          this.l1Cache.delete(key);
          count++;
        }
      }
    }

    logger.info('Cache invalidated by tags', { tags, count });
    return count;
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats() {
    const l1Stats = this.l1Cache.getStats();
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const avgTimeSaved = this.stats.hits > 0 ? this.stats.totalTimeSaved / this.stats.hits : 0;

    return {
      ...l1Stats,
      hits: this.stats.hits,
      misses: this.stats.misses,
      semanticHits: this.stats.semanticHits,
      warmingHits: this.stats.warmingHits,
      totalRequests,
      hitRate,
      avgTimeSaved,
      totalTimeSaved: this.stats.totalTimeSaved,
      warmupSize: this.warmupData.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      semanticHits: 0,
      warmingHits: 0,
      totalRequests: 0,
      totalTimeSaved: 0,
    };
    this.l1Cache.resetStats();
    logger.debug('CacheManager statistics reset');
  }

  /**
   * Determine if a key should be added to warmup data
   */
  private shouldWarmup(key: string): boolean {
    // Simple heuristic: keys with certain patterns are good candidates
    const warmupPatterns = [
      'system:',
      'template:',
      'prompt:',
    ];

    return warmupPatterns.some((pattern) => key.includes(pattern));
  }

  /**
   * Initialize cache warming with pre-defined data
   */
  private initializeWarmup(): void {
    // Pre-populate with common system prompts
    // This is a placeholder - in a real system, you might:
    // 1. Load from a persistent cache
    // 2. Load from a file
    // 3. Load from a database

    logger.debug('Cache warming initialized', { entries: this.warmupData.size });
  }

  /**
   * Warm up cache with provided data
   * @param data - Array of { key, value, agentType } to warm up
   */
  warmup<T = unknown>(
    data: Array<{ key: string; value: T; agentType: string; ttl?: number }>
  ): void {
    for (const { key, value, agentType, ttl } of data) {
      this.warmupData.set(key, {
        value,
        metadata: {
          agentType,
          reuseCount: 0,
          lastValidatedAt: Date.now(),
        },
      });

      // Also add to L1 cache
      this.l1Cache.set(key, { value, metadata: { agentType, reuseCount: 0, lastValidatedAt: Date.now() } }, { ttl });
    }

    logger.info('Cache warmed up', { entries: data.length });
  }

  /**
   * Export cache data for persistence
   * @returns Array of cache entries
   */
  export(): Array<{ key: string; value: unknown; metadata: CacheMetadata }> {
    const result: Array<{ key: string; value: unknown; metadata: CacheMetadata }> = [];
    const keys = this.l1Cache.keys();

    for (const key of keys) {
      const entry = this.l1Cache.get(key);
      if (entry) {
        result.push({
          key,
          value: entry.value,
          metadata: entry.metadata,
        });
      }
    }

    return result;
  }

  /**
   * Import cache data
   * @param data - Array of cache entries to import
   */
  import(data: Array<{ key: string; value: unknown; metadata: CacheMetadata }>): void {
    for (const { key, value, metadata } of data) {
      this.l1Cache.set(key, { value, metadata });
    }

    logger.info('Cache imported', { entries: data.length });
  }

  /**
   * Destroy the cache manager
   */
  destroy(): void {
    this.l1Cache.destroy();
    this.warmupData.clear();
    logger.info('CacheManager destroyed');
  }
}

/**
 * Generate a cache key for LLM calls
 * @param params - Parameters for cache key generation
 * @returns Cache key string
 */
export function generateCacheKey(params: {
  agentType: string;
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}): string {
  // Create a normalized key from the parameters
  const keyData = {
    agent: params.agentType,
    system: params.systemPrompt.slice(0, 500), // Truncate long prompts
    user: params.userMessage,
    // Include conversation history hash if present
    history: params.conversationHistory
      ? hashString(JSON.stringify(params.conversationHistory))
      : undefined,
  };

  return `llm:${params.agentType}:${hashString(JSON.stringify(keyData))}`;
}

/**
 * Generate a cache key for template rendering
 * @param params - Parameters for template cache key
 * @returns Cache key string
 */
export function generateTemplateCacheKey(params: {
  templateType: string;
  variables: Record<string, unknown>;
}): string {
  const sortedVars = Object.keys(params.variables)
    .sort()
    .reduce((acc, key) => ({ ...acc, [key]: params.variables[key] }), {});

  return `template:${params.templateType}:${hashString(JSON.stringify(sortedVars))}`;
}

/**
 * Global singleton cache manager instance
 */
let globalCacheManager: CacheManager | null = null;

/**
 * Get or create the global cache manager
 * @param config - Optional configuration (only used on first creation)
 * @returns CacheManager instance
 */
export function getCacheManager(config?: Partial<CacheManagerConfig>): CacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager(config);
  }
  return globalCacheManager;
}

/**
 * Reset the global cache manager (for testing)
 */
export function resetGlobalCacheManager(): void {
  if (globalCacheManager) {
    globalCacheManager.destroy();
    globalCacheManager = null;
  }
}

export default CacheManager;
