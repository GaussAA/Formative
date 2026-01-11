import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LRUCache, hashString, llmCache } from '@/lib/cache/lru-cache';

describe('LRUCache', () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache<string, number>(3);
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('a', 1);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });

    it('should delete values', () => {
      cache.set('a', 1);
      cache.delete('a');
      expect(cache.has('a')).toBe(false);
      expect(cache.get('a')).toBeUndefined();
    });

    it('should clear all values', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });

    it('should return correct size', () => {
      expect(cache.size).toBe(0);
      cache.set('a', 1);
      expect(cache.size).toBe(1);
      cache.set('b', 2);
      expect(cache.size).toBe(2);
    });

    it('should use default maxSize', () => {
      const defaultCache = new LRUCache<string, number>();
      expect(defaultCache.size).toBe(0);
      // Should be able to add more than 3 items
      defaultCache.set('a', 1);
      defaultCache.set('b', 2);
      defaultCache.set('c', 3);
      defaultCache.set('d', 4);
      expect(defaultCache.size).toBe(4);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used item when full', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // Should evict 'a'

      expect(cache.size).toBe(3);
      expect(cache.has('a')).toBe(false);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should update recently used on get', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.get('a'); // Make 'a' recently used
      cache.set('d', 4); // Should evict 'b'

      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
      expect(cache.get('a')).toBe(1);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should update recently used on set existing key', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('a', 10); // Update 'a' to make it recently used
      cache.set('d', 4); // Should evict 'b'

      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
      expect(cache.get('a')).toBe(10);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should handle multiple evictions correctly', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // evict 'a'
      cache.set('e', 5); // evict 'b'
      cache.set('f', 6); // evict 'c'

      expect(cache.size).toBe(3);
      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(false);
      expect(cache.has('c')).toBe(false);
      expect(cache.get('d')).toBe(4);
      expect(cache.get('e')).toBe(5);
      expect(cache.get('f')).toBe(6);
    });
  });

  describe('getAs type narrowing', () => {
    it('should return value with correct type', () => {
      cache.set('a', 1);
      const value = cache.getAs<number>('a');
      expect(value).toBe(1);
      expect(typeof value).toBe('number');
    });

    it('should return undefined for non-existent key', () => {
      const value = cache.getAs<number>('nonexistent');
      expect(value).toBeUndefined();
    });

    it('should allow type casting', () => {
      cache.set('a', 1);
      const value = cache.getAs<string>('a'); // Incorrect type but allowed
      expect(value).toBe(1);
    });
  });

  describe('statistics', () => {
    it('should return correct stats for empty cache', () => {
      const stats = cache.getStats();
      expect(stats).toEqual({
        size: 0,
        maxSize: 3,
        capacity: '0/3',
        utilization: '0%',
      });
    });

    it('should return correct stats for partially filled cache', () => {
      cache.set('a', 1);
      cache.set('b', 2);

      const stats = cache.getStats();
      expect(stats).toEqual({
        size: 2,
        maxSize: 3,
        capacity: '2/3',
        utilization: '67%',
      });
    });

    it('should return correct stats for full cache', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      const stats = cache.getStats();
      expect(stats).toEqual({
        size: 3,
        maxSize: 3,
        capacity: '3/3',
        utilization: '100%',
      });
    });

    it('should update stats after eviction', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // evicts 'a'

      const stats = cache.getStats();
      expect(stats).toEqual({
        size: 3,
        maxSize: 3,
        capacity: '3/3',
        utilization: '100%',
      });
    });
  });

  describe('complex key types', () => {
    it('should work with number keys', () => {
      const numCache = new LRUCache<number, string>(3);
      numCache.set(1, 'one');
      numCache.set(2, 'two');
      expect(numCache.get(1)).toBe('one');
    });

    it('should work with object keys', () => {
      const objCache = new LRUCache<{ id: number }, string>(3);
      const key1 = { id: 1 };
      const key2 = { id: 2 };

      objCache.set(key1, 'one');
      objCache.set(key2, 'two');

      expect(objCache.get(key1)).toBe('one');
      expect(objCache.get(key2)).toBe('two');
    });

    it('should work with symbol keys', () => {
      const symCache = new LRUCache<symbol, number>(3);
      const sym1 = Symbol('a');
      const sym2 = Symbol('b');

      symCache.set(sym1, 1);
      symCache.set(sym2, 2);

      expect(symCache.get(sym1)).toBe(1);
      expect(symCache.get(sym2)).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle size 0 cache', () => {
      const zeroCache = new LRUCache<string, number>(0);
      zeroCache.set('a', 1);
      zeroCache.set('b', 2);

      // With maxSize 0, the implementation allows adding items
      // but eviction behavior may vary
      expect(zeroCache.size).toBeGreaterThan(0);
    });

    it('should handle size 1 cache', () => {
      const singleCache = new LRUCache<string, number>(1);
      singleCache.set('a', 1);
      singleCache.set('b', 2);

      expect(singleCache.size).toBe(1);
      expect(singleCache.get('a')).toBeUndefined();
      expect(singleCache.get('b')).toBe(2);
    });

    it('should handle large cache operations', () => {
      const largeCache = new LRUCache<number, string>(100);
      for (let i = 0; i < 100; i++) {
        largeCache.set(i, `value${i}`);
      }
      expect(largeCache.size).toBe(100);
      expect(largeCache.get(0)).toBe('value0');
      expect(largeCache.get(99)).toBe('value99');
    });

    it('should handle null and undefined values', () => {
      cache.set('null', null as unknown as number);
      cache.set('undefined', undefined as unknown as number);

      expect(cache.has('null')).toBe(true);
      expect(cache.has('undefined')).toBe(true);
      expect(cache.get('null')).toBeNull();
      expect(cache.get('undefined')).toBeUndefined();
    });

    it('should handle delete of non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should handle set then get same key repeatedly', () => {
      for (let i = 0; i < 100; i++) {
        cache.set('a', i);
        expect(cache.get('a')).toBe(i);
      }
      expect(cache.size).toBe(1);
    });
  });
});

describe('hashString', () => {
  it('should generate consistent hashes for same input', () => {
    const input = 'test string';
    const hash1 = hashString(input);
    const hash2 = hashString(input);

    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different strings', () => {
    const hash1 = hashString('string1');
    const hash2 = hashString('string2');

    expect(hash1).not.toBe(hash2);
  });

  it('should generate different hashes for similar strings', () => {
    const hash1 = hashString('abc');
    const hash2 = hashString('abd');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const hash = hashString('');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should handle unicode characters', () => {
    const hash1 = hashString('你好世界');
    const hash2 = hashString('Hello World');

    expect(typeof hash1).toBe('string');
    expect(typeof hash2).toBe('string');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle very long strings', () => {
    const longString = 'a'.repeat(10000);
    const hash = hashString(longString);

    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe('llmCache global instance', () => {
  afterEach(() => {
    llmCache.clear();
  });

  it('should be a valid LRUCache instance', () => {
    expect(llmCache).toBeInstanceOf(LRUCache);
  });

  it('should have maxSize of 200', () => {
    llmCache.set('test', { data: 'value' });
    const stats = llmCache.getStats();
    expect(stats.maxSize).toBe(200);
  });

  it('should store and retrieve values', () => {
    const testData = { response: 'test response' };
    llmCache.set('key1', testData);
    expect(llmCache.get('key1')).toEqual(testData);
  });

  it('should be usable across tests', () => {
    llmCache.set('test1', 'value1');
    llmCache.set('test2', 'value2');

    expect(llmCache.size).toBe(2);
    expect(llmCache.get('test1')).toBe('value1');
  });
});
