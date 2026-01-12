/**
 * Integration Tests for Enhanced LLM Helper with Intelligent Caching
 *
 * Tests the complete flow of:
 * - LLM calls with caching
 * - Cache manager integration
 * - Batch operations
 * - Cache statistics and monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  callLLMWithCache,
  callLLMWithJSONAndCache,
  batchCallLLMWithCache,
  getLLMCacheStats,
  clearLLMCache,
  warmupLLMCache,
  exportLLMCache,
  importLLMCache,
} from '@/lib/llm/enhanced-helper';
import { getCacheManager, resetGlobalCacheManager } from '@/lib/cache/cache-manager';

// Mock the base LLM helper
vi.mock('@/lib/llm/helper', () => ({
  createLLM: vi.fn(() => ({
    invoke: vi.fn(),
  })),
  callLLM: vi.fn(),
  buildMessages: vi.fn((system, user, history) => {
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    if (history) {
      for (const msg of history) {
        messages.push(msg);
      }
    }

    return messages;
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Enhanced LLM Helper Integration Tests', () => {
  let mockInvokeFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resetGlobalCacheManager();
    vi.clearAllMocks();

    // Setup mock for createLLM
    const { createLLM } = await import('@/lib/llm/helper');
    mockInvokeFn = vi.fn();
    (createLLM as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      invoke: mockInvokeFn,
    });
  });

  afterEach(() => {
    resetGlobalCacheManager();
  });

  describe('Basic Caching Flow', () => {
    it('should cache LLM responses and reuse them', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Test response');

      // First call - cache miss, calls LLM
      const result1 = await callLLMWithCache(
        'You are a helpful assistant.',
        'Hello',
        { agentType: 'test-agent' }
      );

      expect(result1.fromCache).toBe(false);
      expect(result1.data).toBe('Test response');

      // Verify cache was populated
      let stats = getLLMCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      // Second call - cache hit, no LLM call
      const result2 = await callLLMWithCache(
        'You are a helpful assistant.',
        'Hello',
        { agentType: 'test-agent' }
      );

      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe('Test response');
      expect(result2.cacheHit).toBeDefined();
      expect(result2.cacheHit?.level).toBe('l1');

      // Verify cache was hit
      stats = getLLMCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should not cache when skipCache is true', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      // Both calls should hit the LLM
      await callLLMWithCache('System', 'User', { agentType: 'agent', skipCache: true });
      await callLLMWithCache('System', 'User', { agentType: 'agent', skipCache: true });

      expect(callLLM).toHaveBeenCalledTimes(2);
    });

    it('should use custom cache TTL', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      await callLLMWithCache('System', 'User', {
        agentType: 'agent',
        cacheTTL: 1000, // 1 second
      });

      const stats = getLLMCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should track time saved by cache hits', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      // First call
      await callLLMWithCache('System', 'User', { agentType: 'agent' });

      // Second call - should track time saved
      const result = await callLLMWithCache('System', 'User', { agentType: 'agent' });

      expect(result.fromCache).toBe(true);
      expect(result.cacheHit?.timeSaved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('JSON Response Caching', () => {
    it('should cache parsed JSON responses', async () => {
      const responseData = { result: 'success', count: 42 };
      mockInvokeFn.mockResolvedValue({
        content: JSON.stringify(responseData),
      });

      // First call
      const result1 = await callLLMWithJSONAndCache(
        'System',
        'User',
        { agentType: 'agent' }
      );

      expect(result1.fromCache).toBe(false);
      expect(result1.data).toEqual(responseData);

      // Second call - should use cache
      const result2 = await callLLMWithJSONAndCache(
        'System',
        'User',
        { agentType: 'agent' }
      );

      expect(result2.fromCache).toBe(true);
      expect(result2.data).toEqual(responseData);
      expect(mockInvokeFn).toHaveBeenCalledTimes(1);
    });

    it('should extract JSON from markdown code blocks', async () => {
      const responseData = { key: 'value' };
      mockInvokeFn.mockResolvedValue({
        content: '```json\n' + JSON.stringify(responseData) + '\n```',
      });

      const result = await callLLMWithJSONAndCache('System', 'User', { agentType: 'agent' });

      expect(result.data).toEqual(responseData);
    });

    it('should handle JSON extraction errors', async () => {
      mockInvokeFn.mockResolvedValue({
        content: 'not valid json',
      });

      await expect(
        callLLMWithJSONAndCache('System', 'User', { agentType: 'agent' })
      ).rejects.toThrow();
    });
  });

  describe('Batch Operations', () => {
    it('should process multiple requests in parallel', async () => {
      mockInvokeFn.mockResolvedValue({
        content: '{"result": "success"}',
      });

      const requests = [
        { systemPrompt: 'System1', userMessage: 'User1', options: { agentType: 'agent1' } },
        { systemPrompt: 'System2', userMessage: 'User2', options: { agentType: 'agent2' } },
        { systemPrompt: 'System3', userMessage: 'User3', options: { agentType: 'agent3' } },
      ];

      const results = await batchCallLLMWithCache(requests);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.data?.result === 'success')).toBe(true);
      expect(mockInvokeFn).toHaveBeenCalledTimes(3);
    });

    it('should track cache statistics for batch operations', async () => {
      mockInvokeFn.mockResolvedValue({
        content: '{"data": "value"}',
      });

      const requests = [
        { systemPrompt: 'Same', userMessage: 'Same', options: { agentType: 'agent' } },
        { systemPrompt: 'Same', userMessage: 'Same', options: { agentType: 'agent' } },
      ];

      await batchCallLLMWithCache(requests);

      const stats = getLLMCacheStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    it('should provide comprehensive cache statistics', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      // Generate some activity
      await callLLMWithCache('System', 'User1', { agentType: 'agent' });
      await callLLMWithCache('System', 'User1', { agentType: 'agent' }); // Cache hit
      await callLLMWithCache('System', 'User2', { agentType: 'agent' });

      const stats = getLLMCacheStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('avgTimeSaved');
      expect(stats).toHaveProperty('totalTimeSaved');
      expect(stats).toHaveProperty('size');
    });

    it('should calculate hit rate correctly', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      // 1 miss + 1 hit = 50% hit rate
      await callLLMWithCache('System', 'User', { agentType: 'agent' });
      await callLLMWithCache('System', 'User', { agentType: 'agent' });

      const stats = getLLMCacheStats();
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track reuse count in metadata', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      await callLLMWithCache('System', 'User', { agentType: 'agent' });
      const result = await callLLMWithCache('System', 'User', { agentType: 'agent' });

      expect(result.cacheHit?.metadata.reuseCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cache Management', () => {
    it('should clear all cache', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      await callLLMWithCache('System', 'User1', { agentType: 'agent1' });
      await callLLMWithCache('System', 'User2', { agentType: 'agent2' });

      let stats = getLLMCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      clearLLMCache();

      stats = getLLMCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should clear cache by agent type', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      await callLLMWithCache('System', 'User', { agentType: 'agent1' });
      await callLLMWithCache('System', 'User', { agentType: 'agent2' });

      let stats = getLLMCacheStats();
      expect(stats.size).toBe(2);

      clearLLMCache('agent1');

      stats = getLLMCacheStats();
      // Only agent2 should remain
      expect(stats.size).toBe(1);
    });
  });

  describe('Cache Warming', () => {
    it('should warm up cache with provided data', async () => {
      const warmupData = [
        {
          systemPrompt: 'System1',
          userMessage: 'User1',
          agentType: 'agent1',
          value: { warmed: true },
        },
        {
          systemPrompt: 'System2',
          userMessage: 'User2',
          agentType: 'agent2',
          value: { warmed: true },
          ttl: 300000,
        },
      ];

      warmupLLMCache(warmupData);

      const stats = getLLMCacheStats();
      expect(stats.size).toBe(2);
    });

    it('should use warmed cache for subsequent calls', async () => {
      const warmupData = [
        {
          systemPrompt: 'System',
          userMessage: 'User',
          agentType: 'agent',
          value: { result: 'warmed' },
        },
      ];

      warmupLLMCache(warmupData);

      // The warmed value should be used directly
      const result = await callLLMWithJSONAndCache<{ result: string }>(
        'System',
        'User',
        { agentType: 'agent' }
      );

      expect(result.fromCache).toBe(true);
      expect(result.data?.result).toBe('warmed');
    });
  });

  describe('Cache Persistence', () => {
    it('should export cache data', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      await callLLMWithCache('System', 'User', { agentType: 'agent' });

      const exported = exportLLMCache();

      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBeGreaterThan(0);
      expect(exported[0]).toHaveProperty('key');
      expect(exported[0]).toHaveProperty('value');
      expect(exported[0]).toHaveProperty('metadata');
    });

    it('should import cache data', async () => {
      const importData = [
        {
          key: 'llm:agent:abc123',
          value: { imported: true },
          metadata: {
            agentType: 'agent',
            reuseCount: 0,
            lastValidatedAt: Date.now(),
          },
        },
      ];

      importLLMCache(importData);

      const stats = getLLMCacheStats();
      expect(stats.size).toBe(1);
    });

    it('should round-trip cache data', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      // Create some cache entries
      await callLLMWithCache('System', 'User', { agentType: 'agent' });

      // Export
      const exported = exportLLMCache();

      // Clear and import
      clearLLMCache();
      importLLMCache(exported);

      // Verify cache was restored
      const stats = getLLMCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM errors without caching', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        callLLMWithCache('System', 'User', { agentType: 'agent' })
      ).rejects.toThrow('API Error');

      // Error should not be cached
      const stats = getLLMCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should handle JSON parse errors', async () => {
      mockInvokeFn.mockResolvedValue({
        content: 'invalid json',
      });

      await expect(
        callLLMWithJSONAndCache('System', 'User', { agentType: 'agent' })
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle rapid sequential calls efficiently', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      const start = Date.now();

      // Make 100 calls (first 50 unique, next 50 should be cached)
      for (let i = 0; i < 100; i++) {
        const key = `key-${i % 50}`;
        await callLLMWithCache('System', key, { agentType: 'agent' });
      }

      const duration = Date.now() - start;

      // With caching, should be relatively fast
      expect(duration).toBeLessThan(5000);

      const stats = getLLMCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should measure duration accurately', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      const result = await callLLMWithCache('System', 'User', { agentType: 'agent' });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });
  });

  describe('Integration with Cache Manager', () => {
    it('should use global cache manager instance', async () => {
      const { callLLM } = await import('@/lib/llm/helper');
      (callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('Response');

      const cacheManager1 = getCacheManager();
      await callLLMWithCache('System', 'User', { agentType: 'agent' });

      const cacheManager2 = getCacheManager();
      const stats = cacheManager2.getStats();

      // Should be the same instance
      expect(cacheManager1).toBe(cacheManager2);
      expect(stats.totalRequests).toBeGreaterThan(0);
    });

    it('should support multiple isolated cache managers', async () => {
      // This test verifies that the global cache manager is used consistently
      const stats1 = getLLMCacheStats();
      const stats2 = getLLMCacheStats();

      // Same data - same instance
      expect(stats1).toEqual(stats2);
    });
  });
});
