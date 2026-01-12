/**
 * Example Tracker
 *
 * Few-shot 示例效果追踪
 * 支持：
 * - 使用记录
 * - 效果统计
 * - 性能分析
 * - 自动优化建议
 */

import type { PromptExample, ExampleUsage, ExampleStats } from '@/types';
import logger from '@/lib/logger';

/**
 * ExampleStatsWithDetails
 *
 * Extended stats with tracking details
 */
interface ExampleStatsWithDetails extends ExampleStats {
  firstUsedAt?: number;
  lastUsedAt?: number;
  avgLatency?: number;
  recentSuccessRate?: number; // Success rate in last N uses
}

/**
 * ExampleTracker
 *
 * 示例效果追踪器
 */
export class ExampleTracker {
  private readonly usage: Map<string, ExampleUsage[]> = new Map();
  private readonly stats: Map<string, ExampleStatsWithDetails> = new Map();
  private readonly maxHistorySize = 1000;

  /**
   * Record example usage
   *
   * @param usage - Usage data
   */
  record(usage: ExampleUsage): void {
    const { exampleId, timestamp = Date.now() } = usage;

    if (!this.usage.has(exampleId)) {
      this.usage.set(exampleId, []);
    }

    const history = this.usage.get(exampleId)!;
    history.push({ ...usage, timestamp });

    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // Update stats
    this.updateStats(exampleId);

    logger.debug('Example usage recorded', {
      exampleId,
      success: usage.success,
      latency: usage.latency,
    });
  }

  /**
   * Get statistics for an example
   *
   * @param exampleId - Example ID
   * @returns Example statistics
   */
  getStats(exampleId: string): ExampleStatsWithDetails | undefined {
    return this.stats.get(exampleId);
  }

  /**
   * Get top performing examples
   *
   * @param agentType - Agent type filter
   * @param limit - Number of results
   * @returns Top performing example IDs
   */
  getTopPerforming(agentType?: string, limit: number = 10): string[] {
    const allStats = Array.from(this.stats.entries());

    let filtered = allStats;

    // Filter by agent type if provided
    if (agentType) {
      const agentExamples = this.getExamplesForAgent(agentType);
      filtered = allStats.filter(([id]) => agentExamples.includes(id));
    }

    // Filter to examples with meaningful usage
    const withUsage = filtered.filter(([, s]) => s.usageCount >= 5);

    // Sort by success rate, then by usage count
    return withUsage
      .sort(([, a], [, b]) => {
        const rateDiff = b.successRate - a.successRate;
        if (rateDiff !== 0) return rateDiff;
        return b.usageCount - a.usageCount;
      })
      .slice(0, limit)
      .map(([id]) => id);
  }

  /**
   * Get worst performing examples
   *
   * @param agentType - Agent type filter
   * @param limit - Number of results
   * @returns Worst performing example IDs
   */
  getWorstPerforming(agentType?: string, limit: number = 10): string[] {
    const allStats = Array.from(this.stats.entries());

    let filtered = allStats;

    if (agentType) {
      const agentExamples = this.getExamplesForAgent(agentType);
      filtered = allStats.filter(([id]) => agentExamples.includes(id));
    }

    // Filter to examples with meaningful usage
    const withUsage = filtered.filter(([, s]) => s.usageCount >= 5);

    // Sort by success rate ascending (worst first)
    return withUsage
      .sort(([, a], [, b]) => a.successRate - b.successRate)
      .slice(0, limit)
      .map(([id]) => id);
  }

  /**
   * Get improvement suggestions
   *
   * @param exampleId - Example ID
   * @returns Array of suggestions
   */
  getSuggestions(exampleId: string): string[] {
    const stats = this.stats.get(exampleId);
    const suggestions: string[] = [];

    if (!stats || stats.usageCount < 5) {
      return ['Not enough usage data to provide suggestions'];
    }

    // Check success rate
    if (stats.successRate < 0.7) {
      suggestions.push('Low success rate detected - consider revising the example');
    }

    // Check latency
    if (stats.avgLatency && stats.avgLatency > 5000) {
      suggestions.push('High latency detected - example may be too complex');
    }

    // Check recent performance trend
    if (stats.recentSuccessRate !== undefined) {
      const diff = stats.recentSuccessRate - stats.successRate;

      if (diff < -0.2) {
        suggestions.push('Recent performance declining - example may be outdated');
      } else if (diff > 0.2) {
        suggestions.push('Recent performance improving - example is effective');
      }
    }

    // Check usage frequency
    if (stats.usageCount < 10) {
      suggestions.push('Low usage frequency - example may not be relevant');
    }

    return suggestions.length > 0 ? suggestions : ['Example performing well'];
  }

  /**
   * Compare two examples
   *
   * @param exampleIdA - First example ID
   * @param exampleIdB - Second example ID
   * @returns Comparison result
   */
  compare(exampleIdA: string, exampleIdB: string): {
    exampleIdA: string;
    exampleIdB: string;
    better: string | null;
    reason: string;
    statsA: ExampleStatsWithDetails;
    statsB: ExampleStatsWithDetails;
  } {
    const statsA = this.stats.get(exampleIdA);
    const statsB = this.stats.get(exampleIdB);

    if (!statsA || !statsB) {
      throw new Error('Statistics not found for one or both examples');
    }

    let better: string | null = null;
    let reason = '';

    // Compare success rates
    const rateDiff = statsA.successRate - statsB.successRate;

    if (Math.abs(rateDiff) > 0.1) {
      better = rateDiff > 0 ? exampleIdA : exampleIdB;
      reason = `${Math.abs(rateDiff * 100).toFixed(1)}% difference in success rate`;
    } else {
      // Compare usage count if rates are similar
      if (statsA.usageCount > statsB.usageCount * 1.5) {
        better = exampleIdA;
        reason = 'Significantly more usage data';
      } else if (statsB.usageCount > statsA.usageCount * 1.5) {
        better = exampleIdB;
        reason = 'Significantly more usage data';
      } else {
        reason = 'Performance is similar';
      }
    }

    return {
      exampleIdA,
      exampleIdB,
      better,
      reason,
      statsA,
      statsB,
    };
  }

  /**
   * Get usage history for an example
   *
   * @param exampleId - Example ID
   * @param limit - Maximum number of records
   * @returns Usage history
   */
  getHistory(exampleId: string, limit?: number): ExampleUsage[] {
    const history = this.usage.get(exampleId) || [];

    if (limit) {
      return history.slice(-limit);
    }

    return history;
  }

  /**
   * Get overall statistics
   *
   * @returns Overall tracker statistics
   */
  getOverallStats(): {
    totalExamples: number;
    totalUsage: number;
    avgSuccessRate: number;
    topExamples: string[];
  } {
    const allStats = Array.from(this.stats.values());

    if (allStats.length === 0) {
      return {
        totalExamples: 0,
        totalUsage: 0,
        avgSuccessRate: 0,
        topExamples: [],
      };
    }

    const totalUsage = allStats.reduce((sum, s) => sum + s.usageCount, 0);
    const avgSuccessRate = allStats.reduce((sum, s) => sum + s.successRate, 0) / allStats.length;
    const topExamples = this.getTopPerforming(undefined, 5);

    return {
      totalExamples: allStats.length,
      totalUsage,
      avgSuccessRate,
      topExamples,
    };
  }

  /**
   * Clear tracking data
   *
   * @param exampleId - Optional specific example ID
   * @param olderThan - Optional age threshold
   */
  clear(exampleId?: string, olderThan?: number): void {
    const cutoff = olderThan ? Date.now() - olderThan : 0;

    if (exampleId) {
      const history = this.usage.get(exampleId);

      if (history) {
        if (olderThan) {
          // Remove old records
          const filtered = history.filter(u => u.timestamp >= cutoff);
          this.usage.set(exampleId, filtered);
        } else {
          // Remove all records
          this.usage.delete(exampleId);
        }

        this.updateStats(exampleId);
      }
    } else if (olderThan) {
      // Clear old records for all examples
      for (const [id, history] of this.usage.entries()) {
        const filtered = history.filter(u => u.timestamp >= cutoff);

        if (filtered.length === 0) {
          this.usage.delete(id);
          this.stats.delete(id);
        } else {
          this.usage.set(id, filtered);
          this.updateStats(id);
        }
      }
    } else {
      // Clear all
      this.usage.clear();
      this.stats.clear();
    }

    logger.debug('Tracker data cleared', { exampleId, olderThan });
  }

  /**
   * Update statistics for an example
   *
   * @private
   */
  private updateStats(exampleId: string): void {
    const history = this.usage.get(exampleId);

    if (!history || history.length === 0) {
      this.stats.delete(exampleId);
      return;
    }

    const successful = history.filter(u => u.success);
    const usageCount = history.length;
    const successCount = successful.length;
    const successRate = successCount / usageCount;

    // Calculate latency
    const latencies = history.filter(u => u.latency !== undefined).map(u => u.latency!);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : undefined;

    // Calculate recent success rate (last 20 uses)
    const recent = history.slice(-20);
    const recentSuccessRate = recent.length > 0
      ? recent.filter(u => u.success).length / recent.length
      : undefined;

    this.stats.set(exampleId, {
      usageCount,
      successCount,
      successRate,
      firstUsedAt: history[0].timestamp,
      lastUsedAt: history[history.length - 1].timestamp,
      avgLatency,
      recentSuccessRate,
    });
  }

  /**
   * Get example IDs for an agent type
   * This requires cross-referencing with the registry
   *
   * @private
   */
  private getExamplesForAgent(agentType: string): string[] {
    // This is a simplified version - in production, would integrate with ExampleRegistry
    // For now, return all example IDs that match the agent pattern
    const allIds = Array.from(this.usage.keys());

    return allIds.filter(id => id.startsWith(`${agentType}-`));
  }

  /**
   * Export tracking data
   *
   * @returns JSON string
   */
  export(): string {
    const data = {
      stats: Object.fromEntries(this.stats),
      overall: this.getOverallStats(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import tracking data
   *
   * @param json - JSON string or object
   */
  import(json: string | object): void {
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    if (data.stats) {
      for (const [id, stats] of Object.entries(data.stats)) {
        this.stats.set(id, stats as ExampleStatsWithDetails);
      }
    }

    logger.info('Tracker data imported', {
      examplesCount: Object.keys(data.stats || {}).length,
    });
  }
}

// Default export
export default ExampleTracker;
