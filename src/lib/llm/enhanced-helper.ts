/**
 * Enhanced LLM Helper with intelligent caching
 *
 * Integrates with CacheManager for:
 * - Multi-level caching with metadata
 * - Cache warming for common queries
 * - Detailed statistics and monitoring
 * - Intelligent cache invalidation
 */

import { getCacheManager, generateCacheKey, type CacheHitResult } from '../cache/cache-manager';
import { callLLM as baseCallLLM, createLLM, type LLMCreateConfig } from './helper';
import { buildMessages } from './messageBuilder';
import logger from '@/lib/logger';
import type { ConversationMessage } from './types';

/**
 * Enhanced LLM call options
 */
export interface EnhancedLLMOptions {
  /** Agent type for cache metadata */
  agentType: string;
  /** Skip cache for this call */
  skipCache?: boolean;
  /** Custom TTL for cache entry */
  cacheTTL?: number;
  /** Tags for cache grouping */
  cacheTags?: string[];
}

/**
 * Enhanced LLM call result with cache information
 */
export interface EnhancedLLMResult<T> {
  /** The response value */
  data: T;
  /** Cache hit information */
  cacheHit?: CacheHitResult<T>;
  /** Whether the result came from cache */
  fromCache: boolean;
  /** Time taken for the call (milliseconds) */
  duration: number;
}

/**
 * Call LLM with intelligent caching
 * @param systemPrompt - System prompt
 * @param userMessage - User message
 * @param options - Enhanced LLM options
 * @returns Enhanced result with cache information
 */
export async function callLLMWithCache<T = unknown>(
  systemPrompt: string,
  userMessage: string,
  options: EnhancedLLMOptions
): Promise<EnhancedLLMResult<T>> {
  const startTime = Date.now();
  const cacheManager = getCacheManager();

  // Generate cache key
  const cacheKey = generateCacheKey({
    agentType: options.agentType,
    systemPrompt,
    userMessage,
  });

  // Check cache (unless skipped)
  if (!options.skipCache) {
    const cached = cacheManager.get<T>(cacheKey, options.agentType);
    if (cached) {
      const duration = Date.now() - startTime;
      logger.info('LLM cache hit', {
        agentType: options.agentType,
        timeSaved: cached.timeSaved,
        reuseCount: cached.metadata.reuseCount,
      });

      return {
        data: cached.value,
        cacheHit: cached,
        fromCache: true,
        duration,
      };
    }
  }

  // Cache miss - call LLM
  try {
    const result = await baseCallLLM(systemPrompt, userMessage);

    // Store in cache
    cacheManager.set(cacheKey, result, options.agentType, {
      ttl: options.cacheTTL,
      tags: options.cacheTags,
    });

    const duration = Date.now() - startTime;
    logger.debug('LLM call completed', {
      agentType: options.agentType,
      duration,
      fromCache: false,
    });

    return {
      data: result as T,
      fromCache: false,
      duration,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Enhanced LLM call failed', {
      agentType: options.agentType,
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * Call LLM with JSON parsing and intelligent caching
 * @param systemPrompt - System prompt
 * @param userMessage - User message
 * @param options - Enhanced LLM options
 * @returns Enhanced result with cache information
 */
export async function callLLMWithJSONAndCache<T = unknown>(
  systemPrompt: string,
  userMessage: string,
  options: EnhancedLLMOptions
): Promise<EnhancedLLMResult<T>> {
  const startTime = Date.now();
  const cacheManager = getCacheManager();

  // Generate cache key
  const cacheKey = generateCacheKey({
    agentType: options.agentType,
    systemPrompt,
    userMessage,
  });

  // Check cache (unless skipped)
  if (!options.skipCache) {
    const cached = cacheManager.get<T>(cacheKey, options.agentType);
    if (cached) {
      const duration = Date.now() - startTime;
      logger.info('LLM JSON cache hit', {
        agentType: options.agentType,
        timeSaved: cached.timeSaved,
        reuseCount: cached.metadata.reuseCount,
      });

      return {
        data: cached.value,
        cacheHit: cached,
        fromCache: true,
        duration,
      };
    }
  }

  // Cache miss - need to call LLM
  // We'll use the base callLLM function and parse JSON
  try {
    const llm = createLLM({ agentType: options.agentType });
    const messages = buildMessages(systemPrompt, userMessage);
    const response = await llm.invoke(messages);
    const content = response.content.toString();

    // Extract JSON from response
    let jsonStr = content;
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1];
    } else {
      // Try to extract JSON object
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      const firstBracket = content.indexOf('[');
      const lastBracket = content.lastIndexOf(']');

      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = content.substring(firstBrace, lastBrace + 1);
      } else if (firstBracket !== -1 && lastBracket !== -1) {
        jsonStr = content.substring(firstBracket, lastBracket + 1);
      }
    }

    const parsed = JSON.parse(jsonStr.trim()) as T;

    // Store in cache
    cacheManager.set(cacheKey, parsed, options.agentType, {
      ttl: options.cacheTTL,
      tags: options.cacheTags,
    });

    const duration = Date.now() - startTime;
    logger.debug('LLM JSON call completed', {
      agentType: options.agentType,
      duration,
      fromCache: false,
    });

    return {
      data: parsed,
      fromCache: false,
      duration,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Enhanced LLM JSON call failed', {
      agentType: options.agentType,
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * Batch LLM calls with intelligent caching
 * @param requests - Array of LLM requests
 * @returns Array of enhanced results
 */
export async function batchCallLLMWithCache<T = unknown>(
  requests: Array<{
    systemPrompt: string;
    userMessage: string;
    options: EnhancedLLMOptions;
  }>
): Promise<EnhancedLLMResult<T>[]> {
  logger.info('Batch LLM call', { count: requests.length });

  // Process requests in parallel
  const results = await Promise.all(
    requests.map((request) => callLLMWithJSONAndCache<T>(request.systemPrompt, request.userMessage, request.options))
  );

  const cacheHits = results.filter((r) => r.fromCache).length;
  logger.info('Batch LLM call completed', {
    total: requests.length,
    cacheHits,
    cacheMisses: requests.length - cacheHits,
  });

  return results;
}

/**
 * Get cache statistics for LLM operations
 * @returns Cache statistics
 */
export function getLLMCacheStats() {
  const cacheManager = getCacheManager();
  return cacheManager.getStats();
}

/**
 * Clear LLM cache
 * @param agentType - Optional agent type to clear specific cache
 */
export function clearLLMCache(agentType?: string): void {
  const cacheManager = getCacheManager();

  if (agentType) {
    const count = cacheManager.invalidateByAgent(agentType);
    logger.info('LLM cache cleared by agent', { agentType, count });
  } else {
    cacheManager.clear();
    logger.info('LLM cache cleared');
  }
}

/**
 * Warm up LLM cache with common prompts
 * @param data - Array of warmup data
 */
export function warmupLLMCache<T = unknown>(
  data: Array<{
    systemPrompt: string;
    userMessage: string;
    agentType: string;
    value: T;
    ttl?: number;
  }>
): void {
  const cacheManager = getCacheManager();

  const warmupData = data.map((item) => ({
    key: generateCacheKey({
      agentType: item.agentType,
      systemPrompt: item.systemPrompt,
      userMessage: item.userMessage,
    }),
    value: item.value,
    agentType: item.agentType,
    ttl: item.ttl,
  }));

  cacheManager.warmup(warmupData);
  logger.info('LLM cache warmed up', { entries: data.length });
}

/**
 * Export cache data for persistence
 * @returns Array of cache entries
 */
export function exportLLMCache() {
  const cacheManager = getCacheManager();
  return cacheManager.export();
}

/**
 * Import cache data
 * @param data - Array of cache entries to import
 */
export function importLLMCache(
  data: Array<{
    key: string;
    value: unknown;
    metadata: { agentType: string; reuseCount: number; lastValidatedAt: number };
  }>
): void {
  const cacheManager = getCacheManager();
  cacheManager.import(data);
  logger.info('LLM cache imported', { entries: data.length });
}
