/**
 * Example Registry
 *
 * Few-shot 示例注册表
 * 支持：
 * - 示例存储与检索
 * - 相似度搜索
 * - 标签过滤
 * - 示例版本管理
 */

import type { PromptExample, ExampleQuery, ExampleSearchParams } from '@/types';
import logger from '@/lib/logger';

/**
 * ExampleRegistry
 *
 * Few-shot 示例注册表
 */
export class ExampleRegistry {
  private readonly examples: Map<string, PromptExample[]> = new Map();
  private readonly examplesById: Map<string, PromptExample> = new Map();

  /**
   * Load examples for agent type
   *
   * @param agentType - Agent type identifier
   * @returns Array of examples
   */
  loadExamples(agentType: string): PromptExample[] {
    const examples = this.examples.get(agentType) || [];

    logger.debug('Examples loaded', {
      agentType,
      count: examples.length,
    });

    return examples;
  }

  /**
   * Add example for agent type
   *
   * @param agentType - Agent type identifier
   * @param example - Example to add
   */
  addExample(agentType: string, example: PromptExample): void {
    // Generate ID if not provided
    if (!example.id) {
      example.id = `${agentType}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    example.createdAt = example.createdAt || Date.now();
    example.version = example.version || '1.0.0';

    if (!this.examples.has(agentType)) {
      this.examples.set(agentType, []);
    }

    this.examples.get(agentType)!.push(example);
    this.examplesById.set(example.id, example);

    logger.debug('Example added', {
      agentType,
      exampleId: example.id,
      tags: example.tags,
    });
  }

  /**
   * Search examples by similarity
   *
   * @param query - Query string
   * @param agentType - Agent type identifier
   * @param topK - Number of results to return
   * @returns Array of similar examples
   */
  async searchBySimilarity(query: string, agentType: string, topK: number = 5): Promise<PromptExample[]> {
    const examples = this.loadExamples(agentType);

    if (examples.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const scored = examples.map(example => ({
      example,
      score: this.calculateSimilarity(query, example),
    }));

    // Sort by score (descending) and take top K
    const topExamples = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.example);

    logger.debug('Similarity search completed', {
      agentType,
      query,
      resultCount: topExamples.length,
      topScore: scored[0]?.score || 0,
    });

    return topExamples;
  }

  /**
   * Get examples by tags
   *
   * @param agentType - Agent type identifier
   * @param tags - Tags to filter by
   * @returns Filtered examples
   */
  getByTags(agentType: string, tags: string[]): PromptExample[] {
    const examples = this.loadExamples(agentType);

    const filtered = examples.filter(example =>
      tags.some(tag => example.tags?.includes(tag))
    );

    logger.debug('Examples filtered by tags', {
      agentType,
      tags,
      resultCount: filtered.length,
    });

    return filtered;
  }

  /**
   * Get example by ID
   *
   * @param exampleId - Example ID
   * @returns Example or undefined
   */
  getById(exampleId: string): PromptExample | undefined {
    return this.examplesById.get(exampleId);
  }

  /**
   * Search examples with advanced filters
   *
   * @param params - Search parameters
   * @returns Filtered examples
   */
  search(params: ExampleSearchParams): PromptExample[] {
    let examples = params.agentType
      ? this.loadExamples(params.agentType)
      : Array.from(this.examplesById.values());

    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      examples = examples.filter(example =>
        params.tags!.some(tag => example.tags?.includes(tag))
      );
    }

    // Filter by performance
    if (params.minSuccessRate !== undefined) {
      examples = examples.filter(example =>
        example.stats?.successRate &&
        example.stats.successRate >= params.minSuccessRate!
      );
    }

    // Filter by complexity
    if (params.complexity) {
      examples = examples.filter(example =>
        example.metadata?.complexity === params.complexity
      );
    }

    // Filter by language
    if (params.language) {
      examples = examples.filter(example =>
        example.metadata?.language === params.language
      );
    }

    // Sort by performance if requested
    if (params.sortBy === 'performance') {
      examples = examples.sort((a, b) =>
        (b.stats?.successRate || 0) - (a.stats?.successRate || 0)
      );
    } else if (params.sortBy === 'recent') {
      examples = examples.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    // Limit results
    if (params.limit) {
      examples = examples.slice(0, params.limit);
    }

    logger.debug('Examples searched', {
      params,
      resultCount: examples.length,
    });

    return examples;
  }

  /**
   * Update example stats
   *
   * @param exampleId - Example ID
   * @param success - Whether the example led to success
   */
  recordUsage(exampleId: string, success: boolean): void {
    const example = this.examplesById.get(exampleId);

    if (!example) {
      return;
    }

    if (!example.stats) {
      example.stats = {
        usageCount: 0,
        successCount: 0,
        successRate: 0,
      };
    }

    example.stats.usageCount += 1;

    if (success) {
      example.stats.successCount += 1;
    }

    example.stats.successRate = example.stats.successCount / example.stats.usageCount;
    example.lastUsedAt = Date.now();

    logger.debug('Example usage recorded', {
      exampleId,
      success,
      successRate: example.stats.successRate,
    });
  }

  /**
   * Get top performing examples
   *
   * @param agentType - Agent type identifier
   * @param limit - Number of examples to return
   * @returns Top performing examples
   */
  getTopPerforming(agentType: string, limit: number = 10): PromptExample[] {
    const examples = this.loadExamples(agentType);

    const withStats = examples.filter(e => e.stats && e.stats.usageCount > 0);

    return withStats
      .sort((a, b) => (b.stats?.successRate || 0) - (a.stats?.successRate || 0))
      .slice(0, limit);
  }

  /**
   * Get all registered agent types
   *
   * @returns Array of agent type identifiers
   */
  getAgentTypes(): string[] {
    return Array.from(this.examples.keys());
  }

  /**
   * Get statistics
   *
   * @returns Registry statistics
   */
  getStats(): {
    totalExamples: number;
    byAgentType: Record<string, number>;
    withStats: number;
  } {
    const byAgentType: Record<string, number> = {};

    for (const [agentType, examples] of this.examples.entries()) {
      byAgentType[agentType] = examples.length;
    }

    const withStats = Array.from(this.examplesById.values()).filter(
      e => e.stats && e.stats.usageCount > 0
    ).length;

    return {
      totalExamples: this.examplesById.size,
      byAgentType,
      withStats,
    };
  }

  /**
   * Calculate similarity between query and example
   *
   * @private
   */
  private calculateSimilarity(query: string, example: PromptExample): number {
    const queryLower = query.toLowerCase();
    const queryWords = new Set(queryLower.split(/\s+/).filter(w => w.length > 2));

    let score = 0;

    // Check input similarity
    const exampleInput = (example.input || '').toLowerCase();
    const inputWords = new Set(exampleInput.split(/\s+/));

    // Word overlap score
    const overlap = [...queryWords].filter(w => inputWords.has(w)).length;
    score += (overlap / queryWords.size) * 0.5;

    // Tag matching
    if (example.tags) {
      for (const tag of example.tags) {
        if (queryLower.includes(tag.toLowerCase())) {
          score += 0.2;
        }
      }
    }

    // Description matching
    if (example.description) {
      const descLower = example.description.toLowerCase();
      const descOverlap = [...queryWords].filter(w => descLower.includes(w)).length;
      score += (descOverlap / queryWords.size) * 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Clear all examples
   *
   * @param agentType - Optional agent type to clear
   */
  clear(agentType?: string): void {
    if (agentType) {
      const examples = this.examples.get(agentType) || [];
      examples.forEach(e => this.examplesById.delete(e.id));
      this.examples.delete(agentType);

      logger.debug('Examples cleared for agent type', { agentType });
    } else {
      this.examples.clear();
      this.examplesById.clear();

      logger.debug('All examples cleared');
    }
  }

  /**
   * Export examples as JSON
   *
   * @param agentType - Agent type to export
   * @returns JSON string
   */
  export(agentType?: string): string {
    const data = agentType
      ? { agentType, examples: this.loadExamples(agentType) }
      : {
          allAgentTypes: this.getAgentTypes(),
          examples: Array.from(this.examplesById.values()),
        };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import examples from JSON
   *
   * @param json - JSON string or object
   */
  import(json: string | object): void {
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    if (data.agentType && Array.isArray(data.examples)) {
      // Single agent type import
      for (const example of data.examples) {
        this.addExample(data.agentType, example);
      }
    } else if (Array.isArray(data.examples)) {
      // Multi agent type import
      for (const example of data.examples) {
        if (example.agentType) {
          this.addExample(example.agentType, example);
        }
      }
    }

    logger.info('Examples imported', {
      totalImported: Array.isArray(data.examples) ? data.examples.length : 0,
    });
  }
}

// Default export
export default ExampleRegistry;
