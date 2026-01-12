/**
 * Example Selector
 *
 * Few-shot 示例选择器
 * 支持：
 * - 智能示例选择
 * - 多样性选择
 * - 性能导向选择
 * - 语义匹配
 */

import type { PromptExample, SelectionParams } from '@/types';
import logger from '@/lib/logger';

/**
 * ExampleSelector
 *
 * Few-shot 示例选择器
 */
export class ExampleSelector {
  /**
   * Select examples based on parameters
   *
   * @param pool - Available examples pool
   * @param params - Selection parameters
   * @returns Selected examples
   */
  select(pool: PromptExample[], params: SelectionParams): PromptExample[] {
    if (pool.length === 0) {
      return [];
    }

    const {
      count = 3,
      strategy = 'diverse',
      query,
      minSuccessRate,
      tags,
    } = params;

    let candidates = [...pool];

    // Filter by minimum success rate
    if (minSuccessRate !== undefined) {
      candidates = candidates.filter(
        e => e.stats?.successRate && e.stats.successRate >= minSuccessRate
      );
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      candidates = candidates.filter(e =>
        tags.some(tag => e.tags?.includes(tag))
      );
    }

    // Apply selection strategy
    let selected: PromptExample[];

    switch (strategy) {
      case 'diverse':
        selected = this.selectDiverse(candidates, count);
        break;

      case 'performance':
        selected = this.selectByPerformance(candidates, count);
        break;

      case 'semantic':
        selected = this.selectBySemantic(candidates, count, query || '');
        break;

      case 'recent':
        selected = this.selectRecent(candidates, count);
        break;

      default:
        selected = candidates.slice(0, count);
    }

    logger.debug('Examples selected', {
      poolSize: pool.length,
      candidates: candidates.length,
      selected: selected.length,
      strategy,
    });

    return selected;
  }

  /**
   * Select diverse examples
   * Ensures variety in tags, complexity, and content
   *
   * @param pool - Available examples
   * @param count - Number to select
   * @returns Diverse examples
   */
  selectDiverse(pool: PromptExample[], count: number): PromptExample[] {
    if (pool.length <= count) {
      return pool;
    }

    const selected: PromptExample[] = [];
    const usedTags = new Set<string>();
    const usedComplexities = new Set<string>();

    // First pass: select examples with unique tags/complexities
    for (const example of pool) {
      if (selected.length >= count) break;

      const hasNewTag = example.tags?.some(tag => !usedTags.has(tag));
      const hasNewComplexity = example.metadata?.complexity &&
        !usedComplexities.has(example.metadata.complexity);

      if (hasNewTag || hasNewComplexity || selected.length === 0) {
        selected.push(example);

        example.tags?.forEach(tag => usedTags.add(tag));
        if (example.metadata?.complexity) {
          usedComplexities.add(example.metadata.complexity);
        }
      }
    }

    // Second pass: fill remaining slots
    if (selected.length < count) {
      const remaining = pool.filter(e => !selected.includes(e));
      const needed = count - selected.length;

      selected.push(...this.selectByPerformance(remaining, needed));
    }

    return selected;
  }

  /**
   * Select examples by performance
   * Prioritizes examples with high success rates
   *
   * @param pool - Available examples
   * @param count - Number to select
   * @returns Top performing examples
   */
  selectByPerformance(pool: PromptExample[], count: number): PromptExample[] {
    // Filter to examples with stats
    const withStats = pool.filter(e => e.stats && e.stats.usageCount > 0);

    if (withStats.length >= count) {
      // Sort by success rate, then by usage count
      return withStats
        .sort((a, b) => {
          const rateDiff = (b.stats?.successRate || 0) - (a.stats?.successRate || 0);
          if (rateDiff !== 0) return rateDiff;
          return (b.stats?.usageCount || 0) - (a.stats?.usageCount || 0);
        })
        .slice(0, count);
    }

    // Not enough examples with stats, return mixed
    const withStatsCount = withStats.length;
    const withoutStats = pool.filter(e => !e.stats || e.stats.usageCount === 0);

    return [
      ...this.selectByPerformance(withStats, withStatsCount),
      ...withoutStats.slice(0, count - withStatsCount),
    ];
  }

  /**
   * Select examples by semantic similarity to query
   *
   * @param pool - Available examples
   * @param count - Number to select
   * @param query - Query string
   * @returns Semantically similar examples
   */
  selectBySemantic(pool: PromptExample[], count: number, query: string): PromptExample[] {
    if (!query) {
      return this.selectDiverse(pool, count);
    }

    // Score by similarity
    const scored = pool.map(example => ({
      example,
      score: this.calculateSemanticScore(query, example),
    }));

    // Sort by score and take top K
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(s => s.example);
  }

  /**
   * Select recent examples
   *
   * @param pool - Available examples
   * @param count - Number to select
   * @returns Most recent examples
   */
  selectRecent(pool: PromptExample[], count: number): PromptExample[] {
    return [...pool]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, count);
  }

  /**
   * Calculate semantic similarity score
   *
   * @private
   */
  private calculateSemanticScore(query: string, example: PromptExample): number {
    const queryLower = query.toLowerCase();
    const queryWords = new Set(queryLower.split(/\s+/).filter(w => w.length > 2));

    let score = 0;

    // Input matching
    if (example.input) {
      const inputLower = example.input.toLowerCase();
      const inputWords = new Set(inputLower.split(/\s+/));
      const overlap = [...queryWords].filter(w => inputWords.has(w)).length;
      score += (overlap / queryWords.size) * 0.4;
    }

    // Output matching
    if (example.output) {
      const outputLower = example.output.toLowerCase();
      const outputWords = new Set(outputLower.split(/\s+/));
      const overlap = [...queryWords].filter(w => outputWords.has(w)).length;
      score += (overlap / queryWords.size) * 0.3;
    }

    // Description matching
    if (example.description) {
      const descLower = example.description.toLowerCase();
      const descWords = new Set(descLower.split(/\s+/));
      const overlap = [...queryWords].filter(w => descWords.has(w)).length;
      score += (overlap / queryWords.size) * 0.2;
    }

    // Tag matching
    if (example.tags) {
      for (const tag of example.tags) {
        if (queryLower.includes(tag.toLowerCase())) {
          score += 0.1;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Select examples for specific context
   * Combines multiple strategies for optimal selection
   *
   * @param pool - Available examples
   * @param count - Number to select
   * @param context - Selection context
   * @returns Contextually relevant examples
   */
  selectForContext(
    pool: PromptExample[],
    count: number,
    context: {
      query?: string;
      tags?: string[];
      complexity?: 'simple' | 'medium' | 'complex';
      minSuccessRate?: number;
    }
  ): PromptExample[] {
    let candidates = [...pool];

    // Filter by complexity
    if (context.complexity) {
      candidates = candidates.filter(
        e => e.metadata?.complexity === context.complexity
      );
    }

    // Filter by tags
    if (context.tags && context.tags.length > 0) {
      candidates = candidates.filter(e =>
        context.tags!.some(tag => e.tags?.includes(tag))
      );
    }

    // Filter by success rate
    if (context.minSuccessRate !== undefined) {
      candidates = candidates.filter(
        e => e.stats?.successRate && e.stats.successRate >= context.minSuccessRate!
      );
    }

    // If query provided, use semantic selection
    if (context.query) {
      return this.selectBySemantic(candidates, count, context.query);
    }

    // Otherwise use diverse selection
    return this.selectDiverse(candidates, count);
  }

  /**
   * Get optimal count based on context
   *
   * @param available - Available examples
   * @param maxCount - Maximum allowed
   * @param targetTokenCount - Target token budget
   * @returns Optimal example count
   */
  getOptimalCount(
    available: PromptExample[],
    maxCount: number,
    targetTokenCount: number
  ): number {
    if (available.length === 0) {
      return 0;
    }

    // Estimate tokens per example (rough estimate)
    const avgExampleTokens = 200; // Approximate

    // Calculate how many examples fit in budget
    const budgetFitCount = Math.floor(targetTokenCount / avgExampleTokens);

    // Return minimum of budget fit, max count, and available
    return Math.min(budgetFitCount, maxCount, available.length);
  }
}

// Default export
export default ExampleSelector;
