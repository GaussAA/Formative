/**
 * Cost Analyzer
 *
 * LLM 调用成本分析与预测
 * 支持：
 * - 成本追踪
 * - 按维度分析
 * - 成本预测
 * - 优化建议
 */

import type {
  LLMLCallCost,
  CostFilters,
  CostSummary,
  AgentCostBreakdown,
  OptimizationSuggestion,
  CostForecast,
  TimePeriod,
} from '@/types';
import logger from '@/lib/logger';

// Default pricing (can be overridden)
const DEFAULT_PRICING = {
  'gpt-4': {
    input: 0.03,  // per 1K tokens
    output: 0.06,
  },
  'gpt-4-turbo': {
    input: 0.01,
    output: 0.03,
  },
  'gpt-3.5-turbo': {
    input: 0.0005,
    output: 0.0015,
  },
};

/**
 * CostAnalyzer
 *
 * 成本分析器
 */
export class CostAnalyzer {
  private readonly costs: LLMLCallCost[] = [];
  private readonly pricing: Record<string, { input: number; output: number }>;

  constructor(pricing?: typeof DEFAULT_PRICING) {
    this.pricing = pricing || DEFAULT_PRICING;
    logger.debug('CostAnalyzer initialized', {
      models: Object.keys(this.pricing),
    });
  }

  /**
   * Record LLM call cost
   *
   * @param cost - Cost data
   */
  recordCost(cost: LLMLCallCost): void {
    this.costs.push({
      ...cost,
      timestamp: cost.timestamp || Date.now(),
    });

    // Keep only last 10,000 records
    if (this.costs.length > 10000) {
      this.costs.shift();
    }

    logger.debug('LLM call cost recorded', {
      agentType: cost.agentType,
      model: cost.model,
      cost: cost.totalCost,
    });
  }

  /**
   * Get cost summary with filters
   *
   * @param filters - Filter criteria
   * @returns Cost summary
   */
  getSummary(filters?: CostFilters): CostSummary {
    const filtered = this.filterCosts(filters);

    const totalCost = filtered.reduce((sum, c) => sum + c.totalCost, 0);
    const totalTokens = filtered.reduce((sum, c) => sum + c.totalTokens, 0);
    const totalCalls = filtered.length;

    // Group by model
    const byModel: Record<string, { cost: number; tokens: number; calls: number }> = {};
    // Group by agent
    const byAgent: Record<string, { cost: number; tokens: number; calls: number }> = {};

    filtered.forEach(cost => {
      // By model
      if (!byModel[cost.model]) {
        byModel[cost.model] = { cost: 0, tokens: 0, calls: 0 };
      }
      byModel[cost.model].cost += cost.totalCost;
      byModel[cost.model].tokens += cost.totalTokens;
      byModel[cost.model].calls += 1;

      // By agent
      if (!byAgent[cost.agentType]) {
        byAgent[cost.agentType] = { cost: 0, tokens: 0, calls: 0 };
      }
      byAgent[cost.agentType].cost += cost.totalCost;
      byAgent[cost.agentType].tokens += cost.totalTokens;
      byAgent[cost.agentType].calls += 1;
    });

    return {
      totalCost,
      totalTokens,
      totalCalls,
      avgCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
      avgTokensPerCall: totalCalls > 0 ? totalTokens / totalCalls : 0,
      byModel,
      byAgent,
      period: filters?.period || 'all',
    };
  }

  /**
   * Get cost breakdown for specific agent
   *
   * @param agentType - Agent type
   * @param period - Time period
   * @returns Agent cost breakdown
   */
  getCostByAgent(agentType: string, period?: TimePeriod): AgentCostBreakdown {
    const filtered = this.filterCosts({ agentTypes: [agentType], period });

    const totalCost = filtered.reduce((sum, c) => sum + c.totalCost, 0);
    const totalInputTokens = filtered.reduce((sum, c) => sum + c.inputTokens, 0);
    const totalOutputTokens = filtered.reduce((sum, c) => sum + c.outputTokens, 0);

    // Calculate hourly distribution
    const hourlyDistribution: Record<number, number> = {};
    filtered.forEach(cost => {
      const hour = new Date(cost.timestamp).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + cost.totalCost;
    });

    // Find peak hour
    let peakHour = 0;
    let peakCost = 0;
    for (const [hour, cost] of Object.entries(hourlyDistribution)) {
      if (cost > peakCost) {
        peakCost = cost;
        peakHour = parseInt(hour, 10);
      }
    }

    return {
      agentType,
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      totalCalls: filtered.length,
      avgCostPerCall: filtered.length > 0 ? totalCost / filtered.length : 0,
      hourlyDistribution,
      peakHour,
      peakCost,
    };
  }

  /**
   * Get optimization suggestions
   *
   * @returns Array of suggestions
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const summary = this.getSummary();

    // Check for expensive models
    for (const [model, data] of Object.entries(summary.byModel)) {
      const pricing = this.pricing[model as keyof typeof DEFAULT_PRICING];
      if (!pricing) continue;

      const avgCost = data.cost / data.calls;
      if (avgCost > 0.10) {
        // Model is expensive, suggest cheaper alternative
        const cheaper = Object.entries(this.pricing)
          .filter(([m, p]) => p.input < pricing.input)
          .sort((a, b) => a[1].input - b[1].input)[0];

        if (cheaper) {
          const [cheaperModel, cheaperPricing] = cheaper;
          const potentialSavings = ((pricing.input - cheaperPricing.input) / pricing.input) * 100;

          suggestions.push({
            type: 'model_upgrade',
            priority: potentialSavings > 50 ? 'high' : 'medium',
            suggestion: `Consider switching from ${model} to ${cheaperModel}`,
            currentCost: data.cost,
            potentialSavings: data.cost * (potentialSavings / 100),
            reason: `${model} is expensive, ${cheaperModel} could save ${potentialSavings.toFixed(1)}%`,
          });
        }
      }
    }

    // Check for high token usage
    const highTokenAgents = Object.entries(summary.byAgent)
      .filter(([, data]) => data.tokens / data.calls > 5000)
      .sort((a, b) => b[1].tokens - a[1].tokens);

    for (const [agent, data] of highTokenAgents) {
      suggestions.push({
        type: 'token_optimization',
        priority: data.tokens / data.calls > 10000 ? 'high' : 'low',
        suggestion: `Implement context compression for ${agent}`,
        currentCost: data.cost,
        potentialSavings: data.cost * 0.2, // Estimate 20% savings
        reason: `High token usage (${Math.round(data.tokens / data.calls)} tokens/call), compression could reduce costs`,
      });
    }

    // Check for caching opportunities
    const repeatedCalls = this.findRepeatedCalls();
    for (const { agentType, count, totalCost } of repeatedCalls) {
      suggestions.push({
        type: 'caching',
        priority: count > 10 ? 'high' : 'medium',
        suggestion: `Implement response caching for ${agentType}`,
        currentCost: totalCost,
        potentialSavings: totalCost * 0.8, // Could save 80% with perfect caching
        reason: `${count} identical or similar calls detected, caching could significantly reduce costs`,
      });
    }

    return suggestions;
  }

  /**
   * Forecast costs for future period
   *
   * @param period - Time period to forecast
   * @returns Cost forecast
   */
  forecast(period: TimePeriod): CostForecast {
    const now = Date.now();
    let periodMs: number;

    switch (period) {
      case 'hour':
        periodMs = 60 * 60 * 1000;
        break;
      case 'day':
        periodMs = 24 * 60 * 60 * 1000;
        break;
      case 'week':
        periodMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        periodMs = 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        periodMs = 24 * 60 * 60 * 1000;
    }

    // Get historical data for same period
    const historicalStart = now - periodMs;
    const historical = this.costs.filter(c => c.timestamp >= historicalStart);

    const totalCost = historical.reduce((sum, c) => sum + c.totalCost, 0);
    const totalCalls = historical.length;
    const totalTokens = historical.reduce((sum, c) => sum + c.totalTokens, 0);

    // Simple forecasting: assume same pattern continues
    // Could be improved with time series analysis
    const forecastedCost = totalCost;
    const confidence = historical.length > 100 ? 'high' : historical.length > 10 ? 'medium' : 'low';

    // Calculate trend (increasing/decreasing)
    const halfPeriod = periodMs / 2;
    const firstHalf = historical.filter(c => c.timestamp < now - halfPeriod);
    const secondHalf = historical.filter(c => c.timestamp >= now - halfPeriod);

    const firstHalfCost = firstHalf.reduce((sum, c) => sum + c.totalCost, 0);
    const secondHalfCost = secondHalf.reduce((sum, c) => sum + c.totalCost, 0);

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (secondHalfCost > firstHalfCost * 1.1) {
      trend = 'increasing';
    } else if (secondHalfCost < firstHalfCost * 0.9) {
      trend = 'decreasing';
    }

    return {
      period,
      forecastedCost,
      forecastedCalls: totalCalls,
      forecastedTokens: totalTokens,
      confidence,
      trend,
      basedOnDataPoints: historical.length,
    };
  }

  /**
   * Calculate cost from token usage
   *
   * @param model - Model name
   * @param inputTokens - Input token count
   * @param outputTokens - Output token count
   * @returns Calculated cost
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.pricing[model as keyof typeof DEFAULT_PRICING];

    if (!pricing) {
      logger.warn('Unknown model for cost calculation', { model });
      return 0;
    }

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get recent costs
   *
   * @param limit - Maximum number of records
   * @returns Recent cost records
   */
  getRecentCosts(limit: number = 100): LLMLCallCost[] {
    return this.costs.slice(-limit);
  }

  /**
   * Clear old cost records
   *
   * @param olderThan - Age in milliseconds
   */
  clearOldCosts(olderThan: number): void {
    const cutoff = Date.now() - olderThan;

    // Remove old costs
    while (this.costs.length > 0 && this.costs[0].timestamp < cutoff) {
      this.costs.shift();
    }

    logger.debug('Old costs cleared', { olderThan, remaining: this.costs.length });
  }

  /**
   * Filter costs by criteria
   *
   * @private
   */
  private filterCosts(filters?: CostFilters): LLMLCallCost[] {
    let filtered = [...this.costs];

    if (!filters) {
      return filtered;
    }

    // Filter by time period
    if (filters.period && filters.period !== 'all') {
      const now = Date.now();
      let periodMs: number;

      switch (filters.period) {
        case 'hour':
          periodMs = 60 * 60 * 1000;
          break;
        case 'day':
          periodMs = 24 * 60 * 60 * 1000;
          break;
        case 'week':
          periodMs = 7 * 24 * 60 * 60 * 1000;
          break;
        case 'month':
          periodMs = 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          periodMs = 24 * 60 * 60 * 1000;
      }

      const cutoff = now - periodMs;
      filtered = filtered.filter(c => c.timestamp >= cutoff);
    }

    // Filter by agent types
    if (filters.agentTypes && filters.agentTypes.length > 0) {
      filtered = filtered.filter(c => filters.agentTypes!.includes(c.agentType));
    }

    // Filter by models
    if (filters.models && filters.models.length > 0) {
      filtered = filtered.filter(c => filters.models!.includes(c.model));
    }

    // Filter by time range
    if (filters.startTime !== undefined) {
      filtered = filtered.filter(c => c.timestamp >= filters.startTime!);
    }
    if (filters.endTime !== undefined) {
      filtered = filtered.filter(c => c.timestamp <= filters.endTime!);
    }

    return filtered;
  }

  /**
   * Find repeated calls that could benefit from caching
   *
   * @private
   */
  private findRepeatedCalls(): Array<{ agentType: string; count: number; totalCost: number }> {
    const byAgent: Record<string, { count: number; totalCost: number }> = {};

    // Simple heuristic: same agent, similar token counts within short time
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const sorted = [...this.costs].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sorted.length; i++) {
      const cost = sorted[i];

      // Look for similar calls in the next time window
      for (let j = i + 1; j < sorted.length; j++) {
        const other = sorted[j];
        const timeDiff = other.timestamp - cost.timestamp;

        if (timeDiff > timeWindow) break;

        // Check if similar (same agent, similar token count ±10%)
        if (other.agentType === cost.agentType) {
          const tokenDiff = Math.abs(other.totalTokens - cost.totalTokens);
          const tokenRatio = tokenDiff / cost.totalTokens;

          if (tokenRatio < 0.1) {
            // Found similar calls
            if (!byAgent[cost.agentType]) {
              byAgent[cost.agentType] = { count: 0, totalCost: 0 };
            }
            byAgent[cost.agentType].count += 1;
            byAgent[cost.agentType].totalCost += cost.totalCost;
          }
        }
      }
    }

    return Object.entries(byAgent).map(([agentType, data]) => ({
      agentType,
      count: data.count,
      totalCost: data.totalCost,
    }));
  }
}

// Default export
export default CostAnalyzer;
