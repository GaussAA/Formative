/**
 * LRU (Least Recently Used) Cache Implementation
 *
 * Provides a simple in-memory cache with automatic eviction of least recently used items.
 * Suitable for caching LLM responses to reduce API calls and costs.
 */

/**
 * Generic LRU Cache class
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  /**
   * @param maxSize - Maximum number of items to store (default: 200)
   */
  constructor(maxSize: number = 200) {
    this.cache = new Map<K, V>();
    this.maxSize = maxSize;
  }

  /**
   * Get a value from the cache
   * Updates the item as "recently used" when accessed
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Get a value from the cache with type narrowing
   * Use this when you know the value type is more specific than V
   */
  getAs<T = V>(key: K): T | undefined {
    return this.get(key) as T | undefined;
  }

  /**
   * Set a value in the cache
   * Evicts the least recently used item if cache is full
   */
  set(key: K, value: V): void {
    // Remove existing entry if present (will be re-added at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict least recently used item if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // Add new entry
    this.cache.set(key, value);
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove a specific item from the cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      capacity: `${this.cache.size}/${this.maxSize}`,
      utilization: `${Math.round((this.cache.size / this.maxSize) * 100)}%`,
    };
  }
}

/**
 * Simple hash function for generating cache keys from strings
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Global LLM cache instance
 * Stores up to 200 cached LLM responses
 */
export const llmCache = new LRUCache<string, unknown>(200);

/**
 * Periodically clear the cache to prevent memory bloat
 * Clears every 10 minutes
 */
if (typeof window === 'undefined') {
  // Server-side only
  setInterval(() => {
    llmCache.clear();
  }, 10 * 60 * 1000);
}
