/**
 * Prompt Version Management
 *
 * 提供提示词版本控制、A/B 测试和回滚功能
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '@/lib/logger';
import { PromptMetadata } from './template-loader';

/**
 * Version entry
 */
export interface PromptVersion {
  version: string;
  content: string;
  metadata: PromptMetadata;
  createdAt: Date;
  isActive: boolean;
}

/**
 * A/B Test configuration
 */
export interface ABTestConfig {
  id: string;
  name: string;
  agentType: string;
  versionA: string;
  versionB: string;
  trafficSplit: number; // 0-1, percentage for version A
  startDate: Date;
  endDate?: Date;
  description?: string;
}

/**
 * A/B Test results
 */
export interface ABTestResults {
  testId: string;
  status: 'running' | 'completed' | 'paused';
  versionA: {
    version: string;
    usageCount: number;
    avgTokens: number;
    avgDuration: number;
    errorRate: number;
  };
  versionB: {
    version: string;
    usageCount: number;
    avgTokens: number;
    avgDuration: number;
    errorRate: number;
  };
  winner?: 'A' | 'B' | 'inconclusive';
  confidence: number;
  recommendation?: string;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  versionA: string;
  versionB: string;
  improvement: {
    tokenUsage: number; // percentage
    duration: number; // percentage
    successRate: number; // percentage
  };
  recommendation: string;
}

/**
 * Prompt usage tracking
 */
export interface PromptUsage {
  agentType: string;
  version: string;
  timestamp: Date;
  duration: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  outcome: 'success' | 'error';
  error?: string;
  traceId?: string;
  spanId?: string;
}

/**
 * PromptVersionManager
 *
 * 提示词版本管理器，支持版本控制、A/B 测试和回滚
 */
export class PromptVersionManager {
  private readonly versionsDir: string;
  private readonly activeVersions: Map<string, string>; // agentType -> version
  private readonly abTests: Map<string, ABTestConfig>;
  private readonly usageHistory: PromptUsage[];

  constructor(versionsDir?: string) {
    this.versionsDir = versionsDir || path.join(process.cwd(), 'src', 'lib', 'prompts', '.versions');
    this.activeVersions = new Map();
    this.abTests = new Map();
    this.usageHistory = [];

    this.initialize();
  }

  /**
   * Initialize version manager
   * Load active versions from disk
   *
   * @private
   */
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.versionsDir, { recursive: true });

      // Load active versions
      const activeVersionsPath = path.join(this.versionsDir, 'active-versions.json');
      try {
        const content = await fs.readFile(activeVersionsPath, 'utf-8');
        const parsed = JSON.parse(content);
        Object.entries(parsed).forEach(([agentType, version]) => {
          this.activeVersions.set(agentType, version as string);
        });
        logger.info('Active versions loaded', { count: this.activeVersions.size });
      } catch {
        // File doesn't exist yet, create default
        await this.saveActiveVersions();
      }

      // Load A/B tests
      const abTestsPath = path.join(this.versionsDir, 'ab-tests.json');
      try {
        const content = await fs.readFile(abTestsPath, 'utf-8');
        const parsed = JSON.parse(content) as ABTestConfig[];
        parsed.forEach(test => {
          this.abTests.set(test.id, test);
        });
        logger.info('A/B tests loaded', { count: this.abTests.size });
      } catch {
        // File doesn't exist yet
        await this.saveABTests();
      }
    } catch (error) {
      logger.error('Failed to initialize version manager', { error });
    }
  }

  /**
   * Get active version for agent type
   *
   * @param agentType - Agent type
   * @returns Active version string
   */
  getActiveVersion(agentType: string): string {
    return this.activeVersions.get(agentType) || '1.0.0';
  }

  /**
   * Set active version for agent type
   *
   * @param agentType - Agent type
   * @param version - Version to set as active
   */
  async setActiveVersion(agentType: string, version: string): Promise<void> {
    this.activeVersions.set(agentType, version);
    await this.saveActiveVersions();

    logger.info('Active version updated', { agentType, version });
  }

  /**
   * Save new version of prompt
   *
   * @param agentType - Agent type
   * @param version - Version string
   * @param content - Prompt content
   * @param metadata - Prompt metadata
   */
  async saveVersion(
    agentType: string,
    version: string,
    content: string,
    metadata: PromptMetadata
  ): Promise<void> {
    const versionDir = path.join(this.versionsDir, agentType);
    await fs.mkdir(versionDir, { recursive: true });

    const versionPath = path.join(versionDir, `${version}.json`);
    const versionEntry: PromptVersion = {
      version,
      content,
      metadata,
      createdAt: new Date(),
      isActive: this.activeVersions.get(agentType) === version,
    };

    await fs.writeFile(versionPath, JSON.stringify(versionEntry, null, 2));

    logger.info('Prompt version saved', { agentType, version });
  }

  /**
   * Get version history for agent type
   *
   * @param agentType - Agent type
   * @returns Array of version entries
   */
  async getVersionHistory(agentType: string): Promise<PromptVersion[]> {
    const versionDir = path.join(this.versionsDir, agentType);

    try {
      const files = await fs.readdir(versionDir);
      const versions: PromptVersion[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(versionDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const versionEntry = JSON.parse(content) as PromptVersion;
          versions.push(versionEntry);
        }
      }

      // Sort by version (descending)
      return versions.sort((a, b) => this.compareVersions(b.version, a.version));
    } catch {
      return [];
    }
  }

  /**
   * Rollback to previous version
   *
   * @param agentType - Agent type
   * @param version - Version to rollback to
   */
  async rollback(agentType: string, version: string): Promise<void> {
    const history = await this.getVersionHistory(agentType);
    const targetVersion = history.find(v => v.version === version);

    if (!targetVersion) {
      throw new Error(`Version ${version} not found for agent ${agentType}`);
    }

    await this.setActiveVersion(agentType, version);

    logger.info('Rollback completed', { agentType, version });
  }

  /**
   * Create A/B test
   *
   * @param config - A/B test configuration
   * @returns Test ID
   */
  async createABTest(config: Omit<ABTestConfig, 'id'>): Promise<string> {
    const testId = `ab-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const test: ABTestConfig = {
      ...config,
      id: testId,
    };

    this.abTests.set(testId, test);
    await this.saveABTests();

    logger.info('A/B test created', { testId, agentType: config.agentType });
    return testId;
  }

  /**
   * Get A/B test results
   *
   * @param testId - Test ID
   * @returns Test results
   */
  getABTestResults(testId: string): ABTestResults | undefined {
    const test = this.abTests.get(testId);
    if (!test) {
      return undefined;
    }

    // Filter usage history for this test
    const versionAUsage = this.usageHistory.filter(
      u => u.agentType === test.agentType && u.version === test.versionA
    );
    const versionBUsage = this.usageHistory.filter(
      u => u.agentType === test.agentType && u.version === test.versionB
    );

    // Calculate statistics
    const calcStats = (usage: PromptUsage[]) => {
      if (usage.length === 0) {
        return { usageCount: 0, avgTokens: 0, avgDuration: 0, errorRate: 0 };
      }
      return {
        usageCount: usage.length,
        avgTokens: usage.reduce((sum, u) => sum + u.tokenUsage.totalTokens, 0) / usage.length,
        avgDuration: usage.reduce((sum, u) => sum + u.duration, 0) / usage.length,
        errorRate: usage.filter(u => u.outcome === 'error').length / usage.length,
      };
    };

    const results: ABTestResults = {
      testId,
      status: test.endDate ? 'completed' : 'running',
      versionA: {
        version: test.versionA,
        ...calcStats(versionAUsage),
      },
      versionB: {
        version: test.versionB,
        ...calcStats(versionBUsage),
      },
      confidence: 0.95, // Simplified confidence calculation
    };

    // Determine winner (simplified)
    if (results.versionB.avgTokens < results.versionA.avgTokens * 0.9) {
      results.winner = 'B';
      results.recommendation = `Version B uses ${Math.round((1 - results.versionB.avgTokens / results.versionA.avgTokens) * 100)}% fewer tokens`;
    } else if (results.versionA.avgTokens < results.versionB.avgTokens * 0.9) {
      results.winner = 'A';
      results.recommendation = `Version A uses ${Math.round((1 - results.versionA.avgTokens / results.versionB.avgTokens) * 100)}% fewer tokens`;
    } else {
      results.winner = 'inconclusive';
      results.recommendation = 'No significant difference between versions';
    }

    return results;
  }

  /**
   * Compare two versions
   *
   * @param agentType - Agent type
   * @param versionA - First version
   * @param versionB - Second version
   * @returns Comparison result
   */
  async compareVersions(
    agentType: string,
    versionA: string,
    versionB: string
  ): Promise<VersionComparison> {
    const versionAUsage = this.usageHistory.filter(
      u => u.agentType === agentType && u.version === versionA
    );
    const versionBUsage = this.usageHistory.filter(
      u => u.agentType === agentType && u.version === versionB
    );

    const calcStats = (usage: PromptUsage[]) => {
      if (usage.length === 0) {
        return { avgTokens: 0, avgDuration: 0, successRate: 0 };
      }
      return {
        avgTokens: usage.reduce((sum, u) => sum + u.tokenUsage.totalTokens, 0) / usage.length,
        avgDuration: usage.reduce((sum, u) => sum + u.duration, 0) / usage.length,
        successRate: usage.filter(u => u.outcome === 'success').length / usage.length,
      };
    };

    const statsA = calcStats(versionAUsage);
    const statsB = calcStats(versionBUsage);

    return {
      versionA,
      versionB,
      improvement: {
        tokenUsage: statsA.avgTokens > 0 ? ((statsA.avgTokens - statsB.avgTokens) / statsA.avgTokens) * 100 : 0,
        duration: statsA.avgDuration > 0 ? ((statsA.avgDuration - statsB.avgDuration) / statsA.avgDuration) * 100 : 0,
        successRate: statsA.successRate > 0 ? ((statsB.successRate - statsA.successRate) / statsA.successRate) * 100 : 0,
      },
      recommendation: this.generateComparisonRecommendation(statsA, statsB),
    };
  }

  /**
   * Record prompt usage
   *
   * @param usage - Usage data
   */
  async trackUsage(usage: PromptUsage): Promise<void> {
    this.usageHistory.push(usage);

    // Keep only last 10,000 entries in memory
    if (this.usageHistory.length > 10000) {
      this.usageHistory.splice(0, this.usageHistory.length - 10000);
    }

    // Persist usage data periodically
    if (this.usageHistory.length % 100 === 0) {
      await this.saveUsageHistory();
    }
  }

  /**
   * Get usage statistics for agent type
   *
   * @param agentType - Agent type
   * @param period - Time period in days
   * @returns Usage statistics
   */
  getUsageStats(agentType: string, period: number = 7): {
    totalCalls: number;
    avgTokens: number;
    avgDuration: number;
    successRate: number;
    byVersion: Record<string, number>;
  } {
    const since = Date.now() - period * 24 * 60 * 60 * 1000;
    const recentUsage = this.usageHistory.filter(
      u => u.agentType === agentType && u.timestamp.getTime() > since
    );

    const byVersion: Record<string, number> = {};
    recentUsage.forEach(u => {
      byVersion[u.version] = (byVersion[u.version] || 0) + 1;
    });

    return {
      totalCalls: recentUsage.length,
      avgTokens: recentUsage.reduce((sum, u) => sum + u.tokenUsage.totalTokens, 0) / Math.max(1, recentUsage.length),
      avgDuration: recentUsage.reduce((sum, u) => sum + u.duration, 0) / Math.max(1, recentUsage.length),
      successRate: recentUsage.filter(u => u.outcome === 'success').length / Math.max(1, recentUsage.length),
      byVersion,
    };
  }

  /**
   * Generate comparison recommendation
   *
   * @private
   */
  private generateComparisonRecommendation(
    statsA: { avgTokens: number; avgDuration: number; successRate: number },
    statsB: { avgTokens: number; avgDuration: number; successRate: number }
  ): string {
    const tokenImprovement = statsA.avgTokens > 0 ? (statsA.avgTokens - statsB.avgTokens) / statsA.avgTokens : 0;
    const durationImprovement = statsA.avgDuration > 0 ? (statsA.avgDuration - statsB.avgDuration) / statsA.avgDuration : 0;
    const successImprovement = statsB.successRate - statsA.successRate;

    if (tokenImprovement > 0.1 || durationImprovement > 0.1) {
      return `Version B is better: ${Math.round(tokenImprovement * 100)}% fewer tokens, ${Math.round(durationImprovement * 100)}% faster`;
    } else if (tokenImprovement < -0.1 || durationImprovement < -0.1) {
      return `Version A is better: ${Math.round(-tokenImprovement * 100)}% fewer tokens, ${Math.round(-durationImprovement * 100)}% faster`;
    } else if (successImprovement > 0.05) {
      return `Version B has higher success rate: ${Math.round(successImprovement * 100)}% improvement`;
    } else if (successImprovement < -0.05) {
      return `Version A has higher success rate: ${Math.round(-successImprovement * 100)}% improvement`;
    } else {
      return 'Both versions perform similarly';
    }
  }

  /**
   * Compare semantic versions
   *
   * @private
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  }

  /**
   * Save active versions to disk
   *
   * @private
   */
  private async saveActiveVersions(): Promise<void> {
    const filePath = path.join(this.versionsDir, 'active-versions.json');
    const content = JSON.stringify(Object.fromEntries(this.activeVersions), null, 2);
    await fs.writeFile(filePath, content);
  }

  /**
   * Save A/B tests to disk
   *
   * @private
   */
  private async saveABTests(): Promise<void> {
    const filePath = path.join(this.versionsDir, 'ab-tests.json');
    const content = JSON.stringify(Array.from(this.abTests.values()), null, 2);
    await fs.writeFile(filePath, content);
  }

  /**
   * Save usage history to disk
   *
   * @private
   */
  private async saveUsageHistory(): Promise<void> {
    const filePath = path.join(this.versionsDir, 'usage-history.jsonl');
    const lines = this.usageHistory.map(u => JSON.stringify(u)).join('\n');
    await fs.writeFile(filePath, lines);
  }
}

// Default export
export default PromptVersionManager;
