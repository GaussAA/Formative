/**
 * Health Checker (P1 - Reliability Optimization)
 *
 * Provides comprehensive health monitoring for system components.
 * Features:
 * - Multiple health checks registration
 * - Component-level status tracking
 * - Health status aggregation
 * - Performance metrics collection
 */

import logger from '@/lib/logger';

/**
 * Health check status
 */
export type HealthCheckStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual health check result
 */
export interface HealthCheckResult {
  /** Component name */
  component: string;
  /** Health status */
  status: 'pass' | 'fail' | 'warn';
  /** Optional message */
  message?: string;
  /** Response time in milliseconds */
  latency?: number;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/**
 * Overall health status
 */
export interface HealthStatus {
  /** Overall system status */
  status: HealthCheckStatus;
  /** Individual component results */
  checks: HealthCheckResult[];
  /** Timestamp of health check */
  timestamp: number;
  /** Uptime in seconds */
  uptime?: number;
}

/**
 * Health check function type
 */
export type HealthCheckFunction = () => Promise<HealthCheckResult | boolean>;

/**
 * Registered health check
 */
interface RegisteredHealthCheck {
  name: string;
  check: HealthCheckFunction;
  enabled: boolean;
  timeout: number;
}

/**
 * Health Checker class
 */
export class HealthChecker {
  private checks: Map<string, RegisteredHealthCheck> = new Map();
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    logger.info('HealthChecker initialized');
  }

  /**
   * Register a health check
   * @param name - Unique check name
   * @param check - Health check function
   * @param options - Check options
   */
  register(
    name: string,
    check: HealthCheckFunction,
    options: { timeout?: number; enabled?: boolean } = {}
  ): void {
    const registered: RegisteredHealthCheck = {
      name,
      check,
      enabled: options.enabled !== false,
      timeout: options.timeout || 5000,
    };

    this.checks.set(name, registered);
    logger.debug('Health check registered', { name, enabled: registered.enabled });
  }

  /**
   * Unregister a health check
   * @param name - Check name to unregister
   */
  unregister(name: string): void {
    this.checks.delete(name);
    logger.debug('Health check unregistered', { name });
  }

  /**
   * Enable a health check
   * @param name - Check name
   */
  enable(name: string): void {
    const check = this.checks.get(name);
    if (check) {
      check.enabled = true;
      logger.debug('Health check enabled', { name });
    }
  }

  /**
   * Disable a health check
   * @param name - Check name
   */
  disable(name: string): void {
    const check = this.checks.get(name);
    if (check) {
      check.enabled = false;
      logger.debug('Health check disabled', { name });
    }
  }

  /**
   * Run all enabled health checks
   * @returns Overall health status
   */
  async checkAll(): Promise<HealthStatus> {
    const results: HealthCheckResult[] = [];
    const now = Date.now();

    for (const [name, registered] of this.checks.entries()) {
      if (!registered.enabled) continue;

      const result = await this.runCheck(name, registered);
      results.push(result);
    }

    // Determine overall status
    const status = this.calculateOverallStatus(results);

    logger.info('Health check completed', {
      status,
      checkCount: results.length,
      failed: results.filter(r => r.status === 'fail').length,
    });

    return {
      status,
      checks: results,
      timestamp: now,
      uptime: Math.floor((now - this.startTime) / 1000),
    };
  }

  /**
   * Run a specific health check
   * @param name - Check name
   * @returns Check result
   */
  async checkOne(name: string): Promise<HealthCheckResult | null> {
    const registered = this.checks.get(name);
    if (!registered) {
      logger.warn('Health check not found', { name });
      return null;
    }

    if (!registered.enabled) {
      logger.debug('Health check disabled', { name });
      return null;
    }

    return this.runCheck(name, registered);
  }

  /**
   * Run a single health check with timeout
   */
  private async runCheck(name: string, registered: RegisteredHealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), registered.timeout);
      });

      // Run check with timeout
      const result = await Promise.race([
        registered.check(),
        timeoutPromise,
      ]);

      // Normalize result
      if (typeof result === 'boolean') {
        return {
          component: name,
          status: result ? 'pass' : 'fail',
          latency: Date.now() - startTime,
          timestamp: Date.now(),
        };
      }

      return {
        ...result,
        latency: result.latency || Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Health check failed', { name, error });

      return {
        component: name,
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Calculate overall health status from individual results
   */
  private calculateOverallStatus(results: HealthCheckResult[]): HealthCheckStatus {
    if (results.length === 0) {
      return 'healthy';
    }

    const hasFailures = results.some(r => r.status === 'fail');
    const hasWarnings = results.some(r => r.status === 'warn');

    if (hasFailures) {
      return 'unhealthy';
    }

    if (hasWarnings) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Get list of registered health checks
   */
  getRegisteredChecks(): Array<{ name: string; enabled: boolean }> {
    return Array.from(this.checks.values()).map(check => ({
      name: check.name,
      enabled: check.enabled,
    }));
  }

  /**
   * Clear all health checks
   */
  clear(): void {
    this.checks.clear();
    logger.info('All health checks cleared');
  }
}

/**
 * Singleton instance
 */
let healthCheckerInstance: HealthChecker | null = null;

/**
 * Get HealthChecker singleton instance
 */
export function getHealthChecker(): HealthChecker {
  if (!healthCheckerInstance) {
    healthCheckerInstance = new HealthChecker();
  }
  return healthCheckerInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetHealthChecker(): void {
  healthCheckerInstance = null;
}

export default HealthChecker;
