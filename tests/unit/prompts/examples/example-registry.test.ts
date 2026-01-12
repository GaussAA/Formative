/**
 * Unit tests for ExampleRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExampleRegistry } from '@/lib/prompts/examples/example-registry';
import type { PromptExample } from '@/types';

describe('ExampleRegistry', () => {
  let registry: ExampleRegistry;

  beforeEach(() => {
    registry = new ExampleRegistry();
  });

  describe('addExample and loadExamples', () => {
    it('should add and load examples', () => {
      const example: PromptExample = {
        input: 'test input',
        output: 'test output',
      };

      registry.addExample('extractor', example);

      const loaded = registry.loadExamples('extractor');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].input).toBe('test input');
    });

    it('should generate ID if not provided', () => {
      const example: PromptExample = {
        input: 'test',
        output: 'result',
      };

      registry.addExample('test-agent', example);

      const loaded = registry.loadExamples('test-agent');
      expect(loaded[0].id).toBeDefined();
      expect(loaded[0].id).toMatch(/^test-agent-/);
    });

    it('should add metadata', () => {
      const example: PromptExample = {
        input: 'test',
        output: 'result',
        metadata: { complexity: 'simple', language: 'en' },
      };

      registry.addExample('test-agent', example);

      const loaded = registry.loadExamples('test-agent');
      expect(loaded[0].metadata?.complexity).toBe('simple');
    });
  });

  describe('searchBySimilarity', () => {
    beforeEach(() => {
      const examples: PromptExample[] = [
        {
          input: 'create a user authentication system',
          output: 'authentication code',
          tags: ['auth', 'security'],
        },
        {
          input: 'build a database schema',
          output: 'schema code',
          tags: ['database', 'design'],
        },
        {
          input: 'implement REST API endpoints',
          output: 'API code',
          tags: ['api', 'backend'],
        },
      ];

      examples.forEach(e => registry.addExample('planner', e));
    });

    it('should return similar examples', async () => {
      const results = await registry.searchBySimilarity('user login and authentication', 'planner', 2);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for non-existent agent', async () => {
      const results = await registry.searchBySimilarity('test', 'non-existent', 5);

      expect(results).toEqual([]);
    });

    it('should respect topK limit', async () => {
      const results = await registry.searchBySimilarity('database', 'planner', 1);

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getByTags', () => {
    beforeEach(() => {
      const examples: PromptExample[] = [
        { input: 'test1', output: 'result1', tags: ['auth', 'security'] },
        { input: 'test2', output: 'result2', tags: ['database', 'design'] },
        { input: 'test3', output: 'result3', tags: ['auth', 'backend'] },
      ];

      examples.forEach(e => registry.addExample('planner', e));
    });

    it('should filter by single tag', () => {
      const results = registry.getByTags('planner', ['auth']);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.tags?.includes('auth'))).toBe(true);
    });

    it('should filter by multiple tags (OR logic)', () => {
      const results = registry.getByTags('planner', ['auth', 'database']);

      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty for non-matching tags', () => {
      const results = registry.getByTags('planner', ['frontend']);

      expect(results).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('should return example by ID', () => {
      const example: PromptExample = {
        id: 'test-123',
        input: 'test',
        output: 'result',
      };

      registry.addExample('agent', example);

      const found = registry.getById('test-123');
      expect(found).toBeDefined();
      expect(found?.input).toBe('test');
    });

    it('should return undefined for non-existent ID', () => {
      const found = registry.getById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      const examples: PromptExample[] = [
        {
          input: 'test1',
          output: 'result1',
          tags: ['auth'],
          stats: { usageCount: 10, successCount: 9, successRate: 0.9 },
        },
        {
          input: 'test2',
          output: 'result2',
          tags: ['database'],
          stats: { usageCount: 5, successCount: 2, successRate: 0.4 },
        },
        {
          input: 'test3',
          output: 'result3',
          tags: ['api'],
          metadata: { complexity: 'complex', language: 'en' },
        },
      ];

      examples.forEach(e => registry.addExample('planner', e));
    });

    it('should filter by minSuccessRate', () => {
      const results = registry.search({
        agentType: 'planner',
        minSuccessRate: 0.8,
      });

      expect(results).toHaveLength(1);
      expect(results[0].stats?.successRate).toBeGreaterThanOrEqual(0.8);
    });

    it('should filter by complexity', () => {
      const results = registry.search({
        agentType: 'planner',
        complexity: 'complex',
      });

      expect(results).toHaveLength(1);
      expect(results[0].metadata?.complexity).toBe('complex');
    });

    it('should sort by performance', () => {
      const results = registry.search({
        agentType: 'planner',
        sortBy: 'performance',
      });

      expect(results[0].stats?.successRate).toBeGreaterThanOrEqual(
        results[results.length - 1].stats?.successRate || 0
      );
    });

    it('should limit results', () => {
      const results = registry.search({
        agentType: 'planner',
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('recordUsage', () => {
    it('should record successful usage', () => {
      const example: PromptExample = { id: 'test-1', input: 'test', output: 'result' };

      registry.addExample('agent', example);
      registry.recordUsage('test-1', true);

      const found = registry.getById('test-1');
      expect(found?.stats?.usageCount).toBe(1);
      expect(found?.stats?.successCount).toBe(1);
      expect(found?.stats?.successRate).toBe(1);
    });

    it('should record failed usage', () => {
      const example: PromptExample = { id: 'test-1', input: 'test', output: 'result' };

      registry.addExample('agent', example);
      registry.recordUsage('test-1', false);
      registry.recordUsage('test-1', true);

      const found = registry.getById('test-1');
      expect(found?.stats?.usageCount).toBe(2);
      expect(found?.stats?.successCount).toBe(1);
      expect(found?.stats?.successRate).toBe(0.5);
    });
  });

  describe('getTopPerforming', () => {
    beforeEach(() => {
      const examples: PromptExample[] = [
        {
          id: 'ex1',
          input: 'test1',
          output: 'result1',
          stats: { usageCount: 10, successCount: 9, successRate: 0.9 },
        },
        {
          id: 'ex2',
          input: 'test2',
          output: 'result2',
          stats: { usageCount: 5, successCount: 4, successRate: 0.8 },
        },
        {
          id: 'ex3',
          input: 'test3',
          output: 'result3',
          stats: { usageCount: 20, successCount: 18, successRate: 0.9 },
        },
      ];

      examples.forEach(e => registry.addExample('planner', e));
    });

    it('should return top performing examples', () => {
      const results = registry.getTopPerforming('planner', 2);

      expect(results.length).toBe(2);
      // Should be sorted by success rate, then by usage count
      expect(results[0].stats?.successRate).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      const examples: PromptExample[] = [
        { id: 'ex1', input: 'test1', output: 'result1' },
        { id: 'ex2', input: 'test2', output: 'result2' },
      ];

      examples.forEach(e => registry.addExample('agent', e));

      // Add one with stats
      registry.recordUsage('ex1', true);

      const stats = registry.getStats();

      expect(stats.totalExamples).toBe(2);
      expect(stats.byAgentType.agent).toBe(2);
      expect(stats.withStats).toBe(1);
    });
  });

  describe('export and import', () => {
    it('should export and import examples', () => {
      const example: PromptExample = {
        id: 'test-1',
        input: 'test input',
        output: 'test output',
        tags: ['test'],
      };

      registry.addExample('agent', example);

      const exported = registry.export('agent');
      const newRegistry = new ExampleRegistry();
      newRegistry.import(exported);

      const imported = newRegistry.loadExamples('agent');
      expect(imported).toHaveLength(1);
      expect(imported[0].id).toBe('test-1');
    });
  });

  describe('clear', () => {
    it('should clear examples for agent type', () => {
      registry.addExample('agent1', { input: 'test1', output: 'result1' });
      registry.addExample('agent2', { input: 'test2', output: 'result2' });

      registry.clear('agent1');

      expect(registry.loadExamples('agent1')).toHaveLength(0);
      expect(registry.loadExamples('agent2')).toHaveLength(1);
    });

    it('should clear all examples', () => {
      registry.addExample('agent1', { input: 'test1', output: 'result1' });
      registry.addExample('agent2', { input: 'test2', output: 'result2' });

      registry.clear();

      expect(registry.getStats().totalExamples).toBe(0);
    });
  });
});
