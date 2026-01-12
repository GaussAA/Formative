/**
 * Unit tests for ExampleTracker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExampleTracker } from '@/lib/prompts/examples/example-tracker';
import type { ExampleUsage } from '@/types';

describe('ExampleTracker', () => {
  let tracker: ExampleTracker;

  beforeEach(() => {
    tracker = new ExampleTracker();
  });

  describe('record', () => {
    it('should record example usage', () => {
      const usage: ExampleUsage = {
        exampleId: 'ex-1',
        success: true,
        latency: 100,
      };

      tracker.record(usage);

      const stats = tracker.getStats('ex-1');
      expect(stats).toBeDefined();
      expect(stats?.usageCount).toBe(1);
      expect(stats?.successCount).toBe(1);
      expect(stats?.successRate).toBe(1);
    });

    it('should track multiple usages', () => {
      tracker.record({ exampleId: 'ex-1', success: true });
      tracker.record({ exampleId: 'ex-1', success: false });
      tracker.record({ exampleId: 'ex-1', success: true });

      const stats = tracker.getStats('ex-1');
      expect(stats?.usageCount).toBe(3);
      expect(stats?.successCount).toBe(2);
      expect(stats?.successRate).toBe(2 / 3);
    });

    it('should calculate average latency', () => {
      tracker.record({ exampleId: 'ex-1', success: true, latency: 100 });
      tracker.record({ exampleId: 'ex-1', success: true, latency: 200 });
      tracker.record({ exampleId: 'ex-1', success: true, latency: 300 });

      const stats = tracker.getStats('ex-1');
      expect(stats?.avgLatency).toBe(200);
    });
  });

  describe('getStats', () => {
    it('should return undefined for non-existent example', () => {
      const stats = tracker.getStats('non-existent');
      expect(stats).toBeUndefined();
    });

    it('should return complete stats', () => {
      tracker.record({ exampleId: 'ex-1', success: true, latency: 150, timestamp: 1000 });
      tracker.record({ exampleId: 'ex-1', success: false, latency: 200, timestamp: 2000 });

      const stats = tracker.getStats('ex-1');

      expect(stats).toMatchObject({
        usageCount: 2,
        successCount: 1,
        successRate: 0.5,
        firstUsedAt: 1000,
        lastUsedAt: 2000,
        avgLatency: 175,
      });
    });

    it('should calculate recent success rate', () => {
      // Add 25 uses: first 10 successful, next 10 mixed, last 5 failing
      for (let i = 0; i < 10; i++) {
        tracker.record({ exampleId: 'ex-1', success: true });
      }
      for (let i = 0; i < 10; i++) {
        tracker.record({ exampleId: 'ex-1', success: i % 2 === 0 });
      }
      for (let i = 0; i < 5; i++) {
        tracker.record({ exampleId: 'ex-1', success: false });
      }

      const stats = tracker.getStats('ex-1');
      expect(stats?.recentSuccessRate).toBeDefined();
    });
  });

  describe('getTopPerforming', () => {
    beforeEach(() => {
      // Create examples with different performance
      tracker.record({ exampleId: 'ex-1', success: true });
      tracker.record({ exampleId: 'ex-1', success: true });
      tracker.record({ exampleId: 'ex-1', success: true });
      tracker.record({ exampleId: 'ex-1', success: false }); // 0.75 rate

      tracker.record({ exampleId: 'ex-2', success: true });
      tracker.record({ exampleId: 'ex-2', success: true });
      tracker.record({ exampleId: 'ex-2', success: true });
      tracker.record({ exampleId: 'ex-2', success: true });
      tracker.record({ exampleId: 'ex-2', success: true }); // 1.0 rate

      tracker.record({ exampleId: 'agent-1-ex', success: true });
      tracker.record({ exampleId: 'agent-1-ex', success: true });
      tracker.record({ exampleId: 'agent-1-ex', success: false });
      tracker.record({ exampleId: 'agent-1-ex', success: false });
      tracker.record({ exampleId: 'agent-1-ex', success: false }); // 0.4 rate
    });

    it('should return top performing examples', () => {
      const top = tracker.getTopPerforming(undefined, 2);

      expect(top).toHaveLength(2);
      expect(top[0]).toBe('ex-2'); // Has 1.0 success rate
    });

    it('should filter by agent type', () => {
      const top = tracker.getTopPerforming('agent-1', 5);

      expect(top).toContain('agent-1-ex');
      expect(top).not.toContain('ex-1');
      expect(top).not.toContain('ex-2');
    });

    it('should require minimum usage for ranking', () => {
      tracker.record({ exampleId: 'ex-3', success: true }); // Only 1 use

      const top = tracker.getTopPerforming(undefined, 10);

      // ex-3 should not be in top due to low usage
      expect(top.includes('ex-3')).toBe(false);
    });
  });

  describe('getWorstPerforming', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        tracker.record({ exampleId: 'bad-1', success: i < 3 }); // 0.3 rate
      }
      for (let i = 0; i < 10; i++) {
        tracker.record({ exampleId: 'bad-2', success: i < 5 }); // 0.5 rate
      }
      for (let i = 0; i < 10; i++) {
        tracker.record({ exampleId: 'good-1', success: i < 9 }); // 0.9 rate
      }
    });

    it('should return worst performing examples', () => {
      const worst = tracker.getWorstPerforming(undefined, 2);

      expect(worst).toHaveLength(2);
      expect(worst[0]).toBe('bad-1'); // Has 0.3 success rate
    });
  });

  describe('getSuggestions', () => {
    it('should suggest improvements for low success rate', () => {
      for (let i = 0; i < 10; i++) {
        tracker.record({ exampleId: 'ex-1', success: false });
        tracker.record({ exampleId: 'ex-1', success: false });
        tracker.record({ exampleId: 'ex-1', success: true });
      }

      const suggestions = tracker.getSuggestions('ex-1');

      expect(suggestions.some(s => s.includes('Low success rate'))).toBe(true);
    });

    it('should suggest improvements for high latency', () => {
      for (let i = 0; i < 5; i++) {
        tracker.record({ exampleId: 'ex-1', success: true, latency: 6000 });
      }

      const suggestions = tracker.getSuggestions('ex-1');

      expect(suggestions.some(s => s.includes('latency'))).toBe(true);
    });

    it('should note when data is insufficient', () => {
      tracker.record({ exampleId: 'ex-1', success: true });

      const suggestions = tracker.getSuggestions('ex-1');

      expect(suggestions.some(s => s.includes('Not enough'))).toBe(true);
    });

    it('should confirm good performance', () => {
      for (let i = 0; i < 10; i++) {
        tracker.record({ exampleId: 'ex-1', success: true });
      }

      const suggestions = tracker.getSuggestions('ex-1');

      expect(suggestions.some(s => s.includes('well'))).toBe(true);
    });
  });

  describe('compare', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        tracker.record({ exampleId: 'ex-a', success: true });
        tracker.record({ exampleId: 'ex-b', success: i < 7 }); // 0.7 rate
      }
    });

    it('should compare two examples', () => {
      const comparison = tracker.compare('ex-a', 'ex-b');

      expect(comparison.exampleIdA).toBe('ex-a');
      expect(comparison.exampleIdB).toBe('ex-b');
      expect(comparison.better).toBe('ex-a');
      expect(comparison.reason).toContain('success rate');
    });

    it('should throw for non-existent example', () => {
      expect(() => {
        tracker.compare('ex-a', 'non-existent');
      }).toThrow();
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      tracker.record({ exampleId: 'ex-1', success: true, timestamp: 1000 });
      tracker.record({ exampleId: 'ex-1', success: false, timestamp: 2000 });
      tracker.record({ exampleId: 'ex-1', success: true, timestamp: 3000 });
    });

    it('should return usage history', () => {
      const history = tracker.getHistory('ex-1');

      expect(history).toHaveLength(3);
      expect(history[0].success).toBe(true);
      expect(history[1].success).toBe(false);
    });

    it('should limit history size', () => {
      const history = tracker.getHistory('ex-1', 2);

      expect(history).toHaveLength(2);
    });

    it('should return empty for non-existent example', () => {
      const history = tracker.getHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('getOverallStats', () => {
    beforeEach(() => {
      tracker.record({ exampleId: 'ex-1', success: true });
      tracker.record({ exampleId: 'ex-1', success: true });
      tracker.record({ exampleId: 'ex-1', success: false });
      tracker.record({ exampleId: 'ex-2', success: true });
      tracker.record({ exampleId: 'ex-2', success: true });
    });

    it('should return overall statistics', () => {
      const stats = tracker.getOverallStats();

      expect(stats.totalExamples).toBe(2);
      expect(stats.totalUsage).toBe(5);
      expect(stats.avgSuccessRate).toBeCloseTo(0.8, 1);
    });

    it('should return zero stats when empty', () => {
      const emptyTracker = new ExampleTracker();
      const stats = emptyTracker.getOverallStats();

      expect(stats.totalExamples).toBe(0);
      expect(stats.totalUsage).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear specific example', () => {
      tracker.record({ exampleId: 'ex-1', success: true, timestamp: 1000 });
      tracker.record({ exampleId: 'ex-1', success: true, timestamp: 2000 });
      tracker.record({ exampleId: 'ex-2', success: true, timestamp: 2000 });

      tracker.clear('ex-1');

      expect(tracker.getStats('ex-1')).toBeUndefined();
      expect(tracker.getStats('ex-2')).toBeDefined();
    });

    it('should clear old records based on age', () => {
      const now = Date.now();
      tracker.record({ exampleId: 'ex-1', success: true, timestamp: now - 5000 });
      tracker.record({ exampleId: 'ex-1', success: true, timestamp: now - 1000 });

      // Clear records older than 3000ms
      tracker.clear('ex-1', 3000);

      const stats = tracker.getStats('ex-1');
      expect(stats?.usageCount).toBe(1);
    });

    it('should clear all records', () => {
      tracker.record({ exampleId: 'ex-1', success: true });
      tracker.record({ exampleId: 'ex-2', success: true });

      tracker.clear();

      expect(tracker.getOverallStats().totalExamples).toBe(0);
    });
  });

  describe('export and import', () => {
    it('should export and import tracking data', () => {
      tracker.record({ exampleId: 'ex-1', success: true });
      tracker.record({ exampleId: 'ex-2', success: false });

      const exported = tracker.export();
      const newTracker = new ExampleTracker();
      newTracker.import(exported);

      const stats = newTracker.getOverallStats();
      expect(stats.totalExamples).toBe(2);
    });
  });
});
