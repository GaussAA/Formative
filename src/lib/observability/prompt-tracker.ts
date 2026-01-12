/**
 * Prompt Tracker
 *
 * 提示词版本追踪和使用分析
 * 支持：
 * - 版本控制
 * - A/B 测试
 * - 使用统计
 * - 性能对比
 */

import type {
  PromptVersion,
  PromptUsage,
  ABTestConfig,
  ABTestResults,
  VersionComparison,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/lib/logger';

/**
 * PromptTracker
 *
 * 提示词追踪器
 */
export class PromptTracker {
  private readonly versions: Map<string, PromptVersion[]> = new Map();
  private readonly usage: Map<string, PromptUsage[]> = new Map();
  private readonly abTests: Map<string, ABTestConfig> = new Map();
  private readonly currentVersions: Map<string, string> = new Map();

  /**
   * Track prompt usage
   *
   * @param usage - Usage data to track
   */
  track(usage: PromptUsage): void {
    const { agentType, version, timestamp = Date.now() } = usage;

    // Store usage record
    if (!this.usage.has(agentType)) {
      this.usage.set(agentType, []);
    }
    this.usage.get(agentType)!.push({ ...usage, timestamp });

    // Keep only last 1000 usage records per agent
    const records = this.usage.get(agentType)!;
    if (records.length > 1000) {
      records.shift();
    }

    logger.debug('Prompt usage tracked', {
      agentType,
      version,
      duration: usage.duration,
      tokenUsage: usage.tokenUsage,
    });
  }

  /**
   * Register new prompt version
   *
   * @param agentType - Agent type
   * @param version - Version data
   */
  registerVersion(agentType: string, version: PromptVersion): void {
    if (!this.versions.has(agentType)) {
      this.versions.set(agentType, []);
    }

    version.id = version.id || uuidv4();
    version.createdAt = version.createdAt || Date.now();
    version.status = version.status || 'active';

    this.versions.get(agentType)!.push(version);

    // Set as current if marked as current
    if (version.isCurrent) {
      this.setCurrentVersion(agentType, version.version);
    }

    logger.info('Prompt version registered', {
      agentType,
      version: version.version,
      id: version.id,
    });
  }

  /**
   * Set current version for agent type
   *
   * @param agentType - Agent type
   * @param version - Version string
   */
  setCurrentVersion(agentType: string, version: string): void {
    this.currentVersions.set(agentType, version);

    // Update isCurrent flags
    const versions = this.versions.get(agentType) || [];
    versions.forEach(v => {
      v.isCurrent = v.version === version;
    });

    logger.info('Current version set', { agentType, version });
  }

  /**
   * Get current version for agent type
   *
   * @param agentType - Agent type
   * @returns Current version string
   */
  getCurrentVersion(agentType: string): string | undefined {
    return this.currentVersions.get(agentType);
  }

  /**
   * Get version history for agent type
   *
   * @param agentType - Agent type
   * @returns Array of versions
   */
  getVersionHistory(agentType: string): PromptVersion[] {
    return this.versions.get(agentType) || [];
  }

  /**
   * Compare two versions
   *
   * @param agentType - Agent type
   * @param versionA - First version
   * @param versionB - Second version
   * @returns Comparison data
   */
  compareVersions(agentType: string, versionA: string, versionB: string): VersionComparison {
    const usageA = this.usage.get(agentType)?.filter(u => u.version === versionA) || [];
    const usageB = this.usage.get(agentType)?.filter(u => u.version === versionB) || [];

    const calculateMetrics = (records: PromptUsage[]) => {
      if (records.length === 0) {
        return { avgDuration: 0, avgTokens: 0, successRate: 0, avgLatency: 0 };
      }

      const successful = records.filter(r => r.success);

      return {
        avgDuration: records.reduce((sum, r) => sum + (r.duration || 0), 0) / records.length,
        avgTokens: records.reduce((sum, r) => sum + (r.tokenUsage?.total || 0), 0) / records.length,
        successRate: successful.length / records.length,
        avgLatency: records.reduce((sum, r) => sum + (r.latency || 0), 0) / records.length,
      };
    };

    const metricsA = calculateMetrics(usageA);
    const metricsB = calculateMetrics(usageB);

    return {
      versionA,
      versionB,
      metricsA,
      metricsB,
      sampleSizeA: usageA.length,
      sampleSizeB: usageB.length,
      recommendation: this.getComparisonRecommendation(metricsA, metricsB),
    };
  }

  /**
   * Rollback to previous version
   *
   * @param agentType - Agent type
   * @param version - Version to rollback to
   */
  rollback(agentType: string, version: string): void {
    const versions = this.versions.get(agentType) || [];
    const targetVersion = versions.find(v => v.version === version);

    if (!targetVersion) {
      throw new Error(`Version ${version} not found for agent type ${agentType}`);
    }

    this.setCurrentVersion(agentType, version);

    logger.info('Rollback performed', { agentType, version });
  }

  /**
   * Create A/B test
   *
   * @param config - A/B test configuration
   * @returns Test ID
   */
  createABTest(config: ABTestConfig): string {
    const testId = config.id || uuidv4();

    const test: ABTestConfig = {
      ...config,
      id: testId,
      status: 'running',
      createdAt: Date.now(),
    };

    this.abTests.set(testId, test);

    logger.info('A/B test created', {
      testId,
      agentType: config.agentType,
      versions: config.versions,
    });

    return testId;
  }

  /**
   * Get A/B test results
   *
   * @param testId - Test ID
   * @returns Test results
   */
  getABTestResults(testId: string): ABTestResults {
    const test = this.abTests.get(testId);

    if (!test) {
      throw new Error(`A/B test ${testId} not found`);
    }

    const usageByVersion: Record<string, PromptUsage[]> = {};

    test.versions.forEach(version => {
      usageByVersion[version] = this.usage
        .get(test.agentType)
        ?.filter(u => u.version === version && u.abTestId === testId) || [];
    });

    const results: ABTestResults = {
      testId,
      status: test.status,
      variants: test.versions.map(version => {
        const records = usageByVersion[version] || [];
        const successful = records.filter(r => r.success);

        return {
          version,
          sampleSize: records.length,
          successRate: records.length > 0 ? successful.length / records.length : 0,
          avgDuration: records.reduce((sum, r) => sum + (r.duration || 0), 0) / records.length,
          avgTokens: records.reduce((sum, r) => sum + (r.tokenUsage?.total || 0), 0) / records.length,
        };
      }),
      recommendation: '',
      startedAt: test.createdAt,
      completedAt: test.completedAt,
    };

    // Determine winner
    if (results.variants.length > 0) {
      const sorted = [...results.variants].sort((a, b) => b.successRate - a.successRate);
      const winner = sorted[0];
      results.recommendation = `Version ${winner.version} has highest success rate (${(winner.successRate * 100).toFixed(1)}%)`;
    }

    return results;
  }

  /**
   * Complete A/B test and declare winner
   *
   * @param testId - Test ID
   * @param winnerVersion - Winning version
   */
  completeABTest(testId: string, winnerVersion: string): void {
    const test = this.abTests.get(testId);

    if (!test) {
      throw new Error(`A/B test ${testId} not found`);
    }

    test.status = 'completed';
    test.completedAt = Date.now();
    test.winnerVersion = winnerVersion;

    // Set winner as current version
    this.setCurrentVersion(test.agentType, winnerVersion);

    logger.info('A/B test completed', {
      testId,
      winnerVersion,
      agentType: test.agentType,
    });
  }

  /**
   * Get all A/B tests
   *
   * @returns Array of A/B test configs
   */
  getABTests(): ABTestConfig[] {
    return Array.from(this.abTests.values());
  }

  /**
   * Get usage statistics for agent type
   *
   * @param agentType - Agent type
   * @param period - Time period in milliseconds
   * @returns Usage statistics
   */
  getUsageStats(agentType: string, period?: number): {
    totalCalls: number;
    successRate: number;
    avgDuration: number;
    avgTokens: number;
    byVersion: Record<string, number>;
  } {
    const now = Date.now();
    const cutoff = period ? now - period : 0;

    const records = this.usage.get(agentType)?.filter(r => r.timestamp >= cutoff) || [];

    const successful = records.filter(r => r.success);
    const byVersion: Record<string, number> = {};

    records.forEach(r => {
      byVersion[r.version] = (byVersion[r.version] || 0) + 1;
    });

    return {
      totalCalls: records.length,
      successRate: records.length > 0 ? successful.length / records.length : 0,
      avgDuration: records.reduce((sum, r) => sum + (r.duration || 0), 0) / records.length || 0,
      avgTokens: records.reduce((sum, r) => sum + (r.tokenUsage?.total || 0), 0) / records.length || 0,
      byVersion,
    };
  }

  /**
   * Get recommendation based on version comparison
   *
   * @private
   */
  private getComparisonRecommendation(
    metricsA: VersionComparison['metricsA'],
    metricsB: VersionComparison['metricsB']
  ): string {
    // Simple recommendation logic
    if (metricsB.successRate > metricsA.successRate) {
      return `Version B has ${(metricsB.successRate - metricsA.successRate) * 100}% higher success rate`;
    }

    if (metricsA.successRate > metricsB.successRate) {
      return `Version A has ${(metricsA.successRate - metricsB.successRate) * 100}% higher success rate`;
    }

    if (metricsB.avgTokens < metricsA.avgTokens) {
      return `Version B uses ${((1 - metricsB.avgTokens / metricsA.avgTokens) * 100).toFixed(1)}% fewer tokens`;
    }

    if (metricsA.avgTokens < metricsB.avgTokens) {
      return `Version A uses ${((1 - metricsA.avgTokens / metricsB.avgTokens) * 100).toFixed(1)}% fewer tokens`;
    }

    return 'No significant difference detected';
  }
}

// Default export
export default PromptTracker;
