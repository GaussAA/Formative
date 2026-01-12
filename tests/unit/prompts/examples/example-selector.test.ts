/**
 * Unit tests for ExampleSelector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExampleSelector } from '@/lib/prompts/examples/example-selector';
import type { PromptExample } from '@/types';

describe('ExampleSelector', () => {
  let selector: ExampleSelector;
  let pool: PromptExample[];

  beforeEach(() => {
    selector = new ExampleSelector();
    pool = [
      {
        id: 'ex1',
        input: 'create authentication system',
        output: 'auth code',
        tags: ['auth', 'security'],
        metadata: { complexity: 'complex' },
        stats: { usageCount: 10, successCount: 9, successRate: 0.9 },
      },
      {
        id: 'ex2',
        input: 'simple database query',
        output: 'query code',
        tags: ['database', 'simple'],
        metadata: { complexity: 'simple' },
        stats: { usageCount: 20, successCount: 15, successRate: 0.75 },
      },
      {
        id: 'ex3',
        input: 'build REST API',
        output: 'API code',
        tags: ['api', 'backend'],
        metadata: { complexity: 'medium' },
        stats: { usageCount: 5, successCount: 4, successRate: 0.8 },
      },
      {
        id: 'ex4',
        input: 'user login functionality',
        output: 'login code',
        tags: ['auth', 'user'],
        metadata: { complexity: 'medium' },
        stats: { usageCount: 15, successCount: 12, successRate: 0.8 },
      },
      {
        id: 'ex5',
        input: 'data validation',
        output: 'validation code',
        tags: ['validation', 'data'],
        metadata: { complexity: 'simple' },
        // No stats yet
      },
    ];
  });

  describe('select', () => {
    it('should return empty array for empty pool', () => {
      const results = selector.select([], { count: 3 });
      expect(results).toEqual([]);
    });

    it('should return all if pool smaller than count', () => {
      const results = selector.select(pool.slice(0, 2), { count: 5 });
      expect(results).toHaveLength(2);
    });

    it('should select by default strategy', () => {
      const results = selector.select(pool, { count: 2 });
      expect(results).toHaveLength(2);
    });

    it('should filter by minSuccessRate', () => {
      const results = selector.select(pool, {
        count: 5,
        minSuccessRate: 0.8,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.stats?.successRate && r.stats.successRate >= 0.8)).toBe(true);
    });

    it('should filter by tags', () => {
      const results = selector.select(pool, {
        count: 5,
        tags: ['auth'],
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.tags?.includes('auth'))).toBe(true);
    });

    it('should filter by both tags and success rate', () => {
      const results = selector.select(pool, {
        count: 5,
        tags: ['auth'],
        minSuccessRate: 0.75,
      });

      expect(results.every(r =>
        r.tags?.includes('auth') &&
        r.stats?.successRate &&
        r.stats.successRate >= 0.75
      )).toBe(true);
    });
  });

  describe('selectDiverse', () => {
    it('should select diverse examples', () => {
      const results = selector.selectDiverse(pool, 3);

      expect(results).toHaveLength(3);
      // Should have different tags/complexities
      const complexities = new Set(results.map(r => r.metadata?.complexity));
      expect(complexities.size).toBeGreaterThan(1);
    });

    it('should return all if pool smaller than count', () => {
      const results = selector.selectDiverse(pool.slice(0, 2), 5);
      expect(results).toHaveLength(2);
    });

    it('should prioritize variety in tags', () => {
      const results = selector.selectDiverse(pool, 4);

      const allTags = new Set<string>();
      results.forEach(r => r.tags?.forEach(t => allTags.add(t)));

      // Should have diverse tags
      expect(allTags.size).toBeGreaterThan(2);
    });
  });

  describe('selectByPerformance', () => {
    it('should select top performing examples', () => {
      const results = selector.selectByPerformance(pool, 3);

      expect(results).toHaveLength(3);
      // First should have highest success rate
      expect(results[0].stats?.successRate).toBeGreaterThanOrEqual(
        results[results.length - 1].stats?.successRate || 0
      );
    });

    it('should include examples without stats when needed', () => {
      const noStatsPool = pool.slice(-1); // Only ex5 without stats
      const results = selector.selectByPerformance(noStatsPool, 1);

      expect(results).toHaveLength(1);
    });

    it('should sort by success rate then usage count', () => {
      const results = selector.selectByPerformance(pool, 4);

      // ex1 has 0.9 success rate, ex4 has 0.8 success rate
      // Higher success rate should come first
      const ex1Index = results.findIndex(r => r.id === 'ex1');
      const ex4Index = results.findIndex(r => r.id === 'ex4');

      expect(ex1Index).toBeLessThan(ex4Index);
      expect(results[0].stats?.successRate).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('selectBySemantic', () => {
    it('should select semantically similar examples', () => {
      const results = selector.selectBySemantic(pool, 2, 'user authentication and login');

      expect(results).toHaveLength(2);
      // Should prefer examples related to authentication/login
      expect(results.some(r => r.id === 'ex1' || r.id === 'ex4')).toBe(true);
    });

    it('should fallback to diverse when no query provided', () => {
      const results = selector.selectBySemantic(pool, 2, '');

      expect(results).toHaveLength(2);
    });
  });

  describe('selectRecent', () => {
    it('should select most recent examples', () => {
      const datedPool: PromptExample[] = [
        { id: 'old', input: 'old', output: 'old', createdAt: 1000 },
        { id: 'new', input: 'new', output: 'new', createdAt: 5000 },
        { id: 'newest', input: 'newest', output: 'newest', createdAt: 10000 },
      ];

      const results = selector.selectRecent(datedPool, 2);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('newest');
      expect(results[1].id).toBe('new');
    });
  });

  describe('selectForContext', () => {
    it('should filter by complexity', () => {
      const results = selector.selectForContext(pool, 5, {
        complexity: 'simple',
      });

      expect(results.every(r => r.metadata?.complexity === 'simple')).toBe(true);
    });

    it('should filter by tags', () => {
      const results = selector.selectForContext(pool, 5, {
        tags: ['auth'],
      });

      expect(results.every(r => r.tags?.includes('auth'))).toBe(true);
    });

    it('should use semantic selection when query provided', () => {
      const results = selector.selectForContext(pool, 2, {
        query: 'authentication system',
      });

      expect(results).toHaveLength(2);
      expect(results.some(r => r.tags?.includes('auth'))).toBe(true);
    });

    it('should combine multiple filters', () => {
      const results = selector.selectForContext(pool, 5, {
        tags: ['auth'],
        complexity: 'medium',
        minSuccessRate: 0.75,
      });

      expect(results.every(r =>
        r.tags?.includes('auth') &&
        r.metadata?.complexity === 'medium' &&
        r.stats?.successRate &&
        r.stats.successRate >= 0.75
      )).toBe(true);
    });
  });

  describe('getOptimalCount', () => {
    it('should return 0 for empty pool', () => {
      const count = selector.getOptimalCount([], 10, 1000);
      expect(count).toBe(0);
    });

    it('should respect maxCount', () => {
      const count = selector.getOptimalCount(pool, 2, 10000);
      expect(count).toBeLessThanOrEqual(2);
    });

    it('should fit in token budget', () => {
      const count = selector.getOptimalCount(pool, 10, 200); // Only 1 example fits

      expect(count).toBeLessThanOrEqual(2); // Rough estimate: 200 tokens / ~200 per example
    });

    it('should not exceed available examples', () => {
      const count = selector.getOptimalCount(pool.slice(0, 2), 10, 10000);
      expect(count).toBeLessThanOrEqual(2);
    });
  });
});
