/**
 * Unit tests for CacheManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CacheManager,
  generateCacheKey,
  generateTemplateCacheKey,
  getCacheManager,
  resetGlobalCacheManager,
} from '@/lib/cache/cache-manager';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    // Reset global cache manager before each test
    resetGlobalCacheManager();
    cacheManager = new CacheManager({
      enableL1: true,
      enableL2: false,
      enableSemantic: false,
      enableWarming: true,
      globalDefaultTTL: 600000,
      levels: [
        {
          name: 'l1',
          maxSize: 100,
          defaultTTL: 600000,
          priority: 1,
        },
      ],
    });
  });

  afterEach(() => {
    cacheManager.destroy();
    resetGlobalCacheManager();
  });

  describe('Basic operations', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      const agentType = 'test-agent';

      cacheManager.set(key, value, agentType);
      const result = cacheManager.get(key, agentType);

      expect(result?.value).toEqual(value);
      expect(result?.level).toBe('l1');
      expect(result?.metadata.agentType).toBe(agentType);
    });

    it('should return undefined for non-existent keys', () => {
      const result = cacheManager.get('non-existent', 'test-agent');
      expect(result).toBeUndefined();
    });

    it('should delete values', () => {
      const key = 'test-key';
      cacheManager.set(key, { data: 'test' }, 'test-agent');

      const deleted = cacheManager.delete(key);
      expect(deleted).toBe(true);

      const result = cacheManager.get(key, 'test-agent');
      expect(result).toBeUndefined();
    });

    it('should clear all values', () => {
      cacheManager.set('key1', { data: 'test1' }, 'agent1');
      cacheManager.set('key2', { data: 'test2' }, 'agent2');

      cacheManager.clear();

      expect(cacheManager.get('key1', 'agent1')).toBeUndefined();
      expect(cacheManager.get('key2', 'agent2')).toBeUndefined();
    });
  });

  describe('Cache statistics', () => {
    it('should track hits and misses', () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      cacheManager.set(key, value, 'test-agent');

      // Hit
      cacheManager.get(key, 'test-agent');
      // Miss
      cacheManager.get('non-existent', 'test-agent');

      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should calculate hit rate correctly', () => {
      const key1 = 'key1';
      const key2 = 'key2';

      cacheManager.set(key1, { data: 'value1' }, 'test-agent');
      cacheManager.set(key2, { data: 'value2' }, 'test-agent');

      cacheManager.get(key1, 'test-agent'); // hit
      cacheManager.get(key2, 'test-agent'); // hit
      cacheManager.get('non-existent', 'test-agent'); // miss

      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBe(2 / 3);
    });

    it('should track time saved', () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      cacheManager.set(key, value, 'test-agent');
      const result = cacheManager.get(key, 'test-agent');

      expect(result?.timeSaved).toBeGreaterThanOrEqual(0);
    });

    it('should reset statistics', () => {
      cacheManager.set('key', { data: 'value' }, 'test-agent');
      cacheManager.get('key', 'test-agent');
      cacheManager.get('non-existent', 'test-agent');

      cacheManager.resetStats();

      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Invalidation', () => {
    it('should invalidate by agent type', () => {
      cacheManager.set('key1', { data: 'value1' }, 'agent1');
      cacheManager.set('key2', { data: 'value2' }, 'agent1');
      cacheManager.set('key3', { data: 'value3' }, 'agent2');

      const count = cacheManager.invalidateByAgent('agent1');
      expect(count).toBe(2);

      expect(cacheManager.get('key1', 'agent1')).toBeUndefined();
      expect(cacheManager.get('key2', 'agent1')).toBeUndefined();
      expect(cacheManager.get('key3', 'agent2')).toBeDefined();
    });

    it('should invalidate by tags', () => {
      cacheManager.set('key1', { data: 'value1' }, 'agent1', { tags: ['tag1', 'tag2'] });
      cacheManager.set('key2', { data: 'value2' }, 'agent1', { tags: ['tag2', 'tag3'] });
      cacheManager.set('key3', { data: 'value3' }, 'agent1', { tags: ['tag4'] });

      const count = cacheManager.invalidateByTags(['tag2']);
      expect(count).toBe(2);
    });
  });

  describe('getOrSet pattern', () => {
    it('should return cached value if exists', async () => {
      const key = 'test-key';
      const value = { data: 'cached-value' };

      cacheManager.set(key, value, 'test-agent');

      const factory = vi.fn().mockResolvedValue({ data: 'new-value' });
      const result = await cacheManager.getOrSet(key, factory, 'test-agent');

      expect(result).toEqual(value);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const key = 'test-key';
      const value = { data: 'new-value' };

      const factory = vi.fn().mockResolvedValue(value);
      const result = await cacheManager.getOrSet(key, factory, 'test-agent');

      expect(result).toEqual(value);
      expect(factory).toHaveBeenCalledTimes(1);

      // Verify cached
      const cached = cacheManager.get(key, 'test-agent');
      expect(cached?.value).toEqual(value);
    });
  });

  describe('Cache warming', () => {
    it('should warm up cache with provided data', () => {
      const warmupData = [
        { key: 'key1', value: { data: 'value1' }, agentType: 'agent1' },
        { key: 'key2', value: { data: 'value2' }, agentType: 'agent2', ttl: 300000 },
      ];

      cacheManager.warmup(warmupData);

      const result1 = cacheManager.get('key1', 'agent1');
      const result2 = cacheManager.get('key2', 'agent2');

      expect(result1?.value).toEqual({ data: 'value1' });
      expect(result2?.value).toEqual({ data: 'value2' });
    });

    it('should track warmup size in stats', () => {
      const warmupData = [
        { key: 'key1', value: { data: 'value1' }, agentType: 'agent1' },
        { key: 'key2', value: { data: 'value2' }, agentType: 'agent2' },
      ];

      cacheManager.warmup(warmupData);

      const stats = cacheManager.getStats();
      expect(stats.warmupSize).toBe(2);
    });
  });

  describe('Export and import', () => {
    it('should export cache data', () => {
      cacheManager.set('key1', { data: 'value1' }, 'agent1');
      cacheManager.set('key2', { data: 'value2' }, 'agent2');

      const exported = cacheManager.export();

      expect(exported).toHaveLength(2);
      expect(exported[0]).toHaveProperty('key');
      expect(exported[0]).toHaveProperty('value');
      expect(exported[0]).toHaveProperty('metadata');
    });

    it('should import cache data', () => {
      const importData = [
        {
          key: 'key1',
          value: { data: 'value1' },
          metadata: { agentType: 'agent1', reuseCount: 0, lastValidatedAt: Date.now() },
        },
        {
          key: 'key2',
          value: { data: 'value2' },
          metadata: { agentType: 'agent2', reuseCount: 0, lastValidatedAt: Date.now() },
        },
      ];

      cacheManager.import(importData);

      const result1 = cacheManager.get('key1', 'agent1');
      const result2 = cacheManager.get('key2', 'agent2');

      expect(result1?.value).toEqual({ data: 'value1' });
      expect(result2?.value).toEqual({ data: 'value2' });
    });
  });

  describe('Metadata tracking', () => {
    it('should track reuse count', () => {
      const key = 'test-key';
      cacheManager.set(key, { data: 'value' }, 'test-agent');

      cacheManager.get(key, 'test-agent');
      cacheManager.get(key, 'test-agent');
      cacheManager.get(key, 'test-agent');

      const result = cacheManager.get(key, 'test-agent');
      expect(result?.metadata.reuseCount).toBe(4);
    });

    it('should track last validated timestamp', () => {
      const key = 'test-key';
      cacheManager.set(key, { data: 'value' }, 'test-agent');

      const beforeValidation = Date.now();
      cacheManager.get(key, 'test-agent');
      const afterValidation = Date.now();

      const result = cacheManager.get(key, 'test-agent');
      expect(result?.metadata.lastValidatedAt).toBeGreaterThanOrEqual(beforeValidation);
      expect(result?.metadata.lastValidatedAt).toBeLessThanOrEqual(afterValidation);
    });
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent keys for same input', () => {
    const params = {
      agentType: 'test-agent',
      systemPrompt: 'You are a helpful assistant.',
      userMessage: 'Hello, world!',
    };

    const key1 = generateCacheKey(params);
    const key2 = generateCacheKey(params);

    expect(key1).toBe(key2);
  });

  it('should generate different keys for different inputs', () => {
    const params1 = {
      agentType: 'test-agent',
      systemPrompt: 'You are a helpful assistant.',
      userMessage: 'Hello, world!',
    };

    const params2 = {
      agentType: 'test-agent',
      systemPrompt: 'You are a helpful assistant.',
      userMessage: 'Goodbye, world!',
    };

    const key1 = generateCacheKey(params1);
    const key2 = generateCacheKey(params2);

    expect(key1).not.toBe(key2);
  });

  it('should include conversation history in key when provided', () => {
    const params1 = {
      agentType: 'test-agent',
      systemPrompt: 'You are a helpful assistant.',
      userMessage: 'Hello',
      conversationHistory: [{ role: 'user', content: 'Previous message' }],
    };

    const params2 = {
      agentType: 'test-agent',
      systemPrompt: 'You are a helpful assistant.',
      userMessage: 'Hello',
      conversationHistory: [{ role: 'user', content: 'Different message' }],
    };

    const key1 = generateCacheKey(params1);
    const key2 = generateCacheKey(params2);

    expect(key1).not.toBe(key2);
  });

  it('should truncate long system prompts', () => {
    const longPrompt = 'a'.repeat(1000);
    const params = {
      agentType: 'test-agent',
      systemPrompt: longPrompt,
      userMessage: 'Hello',
    };

    const key = generateCacheKey(params);
    expect(key).toContain('test-agent');
    expect(key.length).toBeLessThan(200); // Should be reasonably short
  });
});

describe('generateTemplateCacheKey', () => {
  it('should generate consistent keys regardless of property order', () => {
    const params1 = {
      templateType: 'test-template',
      variables: { b: 'value2', a: 'value1' },
    };

    const params2 = {
      templateType: 'test-template',
      variables: { a: 'value1', b: 'value2' },
    };

    const key1 = generateTemplateCacheKey(params1);
    const key2 = generateTemplateCacheKey(params2);

    expect(key1).toBe(key2);
  });

  it('should generate different keys for different variables', () => {
    const params1 = {
      templateType: 'test-template',
      variables: { a: 'value1' },
    };

    const params2 = {
      templateType: 'test-template',
      variables: { a: 'value2' },
    };

    const key1 = generateTemplateCacheKey(params1);
    const key2 = generateTemplateCacheKey(params2);

    expect(key1).not.toBe(key2);
  });
});

describe('Global cache manager', () => {
  afterEach(() => {
    resetGlobalCacheManager();
  });

  it('should return singleton instance', () => {
    const manager1 = getCacheManager();
    const manager2 = getCacheManager();

    expect(manager1).toBe(manager2);
  });

  it('should use custom config on first call', () => {
    const manager = getCacheManager({ globalDefaultTTL: 300000 });

    expect(manager).toBeDefined();
  });

  it('should ignore custom config on subsequent calls', () => {
    const manager1 = getCacheManager({ globalDefaultTTL: 300000 });
    const manager2 = getCacheManager({ globalDefaultTTL: 600000 });

    expect(manager1).toBe(manager2);
  });

  it('should reset global instance', () => {
    const manager1 = getCacheManager();
    resetGlobalCacheManager();
    const manager2 = getCacheManager();

    expect(manager1).not.toBe(manager2);
  });
});
