/**
 * Circuit Breaker (P1 - Reliability Optimization)
 *
 * Implements the Circuit Breaker pattern for fault tolerance.
 * Prevents cascading failures by failing fast when a service is down.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail immediately
 * - HALF_OPEN: Testing if service has recovered
 */

import logger from '@/lib/logger';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before tripping */
  threshold?: number;
  /** Time in OPEN state before attempting recovery (ms) */
  timeout?: number;
  /** Number of successful calls in HALF_OPEN before closing */
  halfOpenAttempts?: number;
  /** Callback on state change */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Callback on failure */
  onFailure?: (error: Error) => void;
}

/**
 * Circuit breaker execution result
 */
export interface CircuitBreakerResult<T> {
  /** Whether execution succeeded */
  success: boolean;
  /** Result value (if successful) */
  value?: T;
  /** Error (if failed) */
  error?: Error;
  /** Circuit state after execution */
  state: CircuitState;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /** Current state */
  state: CircuitState;
  /** Total request count */
  totalRequests: number;
  /** Successful request count */
  successCount: number;
  /** Failed request count */
  failureCount: number;
  /** Current consecutive failures */
  consecutiveFailures: number;
  /** Last failure time */
  lastFailureTime?: number;
  /** Last state change time */
  lastStateChange: number;
}

/**
 * Circuit Breaker class
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private consecutiveFailures = 0;
  private halfOpenSuccessCount = 0;
  private lastFailureTime = 0;
  private lastStateChange: number;
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly halfOpenAttempts: number;
  private readonly onStateChangeCallback?: (from: CircuitState, to: CircuitState) => void;
  private readonly onFailureCallback?: (error: Error) => void;

  constructor(config: CircuitBreakerConfig = {}) {
    this.threshold = config.threshold ?? 5;
    this.timeout = config.timeout ?? 60000; // 1 minute default
    this.halfOpenAttempts = config.halfOpenAttempts ?? 3;
    this.lastStateChange = Date.now();
    this.onStateChangeCallback = config.onStateChange;
    this.onFailureCallback = config.onFailure;

    logger.info('CircuitBreaker initialized', {
      threshold: this.threshold,
      timeout: this.timeout,
      halfOpenAttempts: this.halfOpenAttempts,
    });
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn - Function to execute
   * @returns Execution result
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        // Transition to HALF_OPEN to test recovery
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        // Circuit is still OPEN, fail fast
        const error = new Error('Circuit breaker is OPEN');
        logger.warn('Circuit breaker rejected request', {
          state: this.state,
          timeUntilReset: this.timeout - (Date.now() - this.lastFailureTime),
        });
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++;
    this.consecutiveFailures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccessCount++;

      // After enough successes in HALF_OPEN, close the circuit
      if (this.halfOpenSuccessCount >= this.halfOpenAttempts) {
        this.transitionTo(CircuitState.CLOSED);
        this.halfOpenSuccessCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on successful request in CLOSED state
      this.failureCount = Math.max(0, this.failureCount - 1);
    }

    logger.debug('Circuit breaker success', {
      state: this.state,
      successCount: this.successCount,
      consecutiveFailures: this.consecutiveFailures,
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.failureCount++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    logger.warn('Circuit breaker failure', {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      threshold: this.threshold,
      error: error.message,
    });

    // Trip the circuit if threshold exceeded
    if (this.consecutiveFailures >= this.threshold) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Fail in HALF_OPEN means service is not ready, open circuit
      this.transitionTo(CircuitState.OPEN);
      this.halfOpenSuccessCount = 0;
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    logger.info('Circuit breaker state changed', {
      from: oldState,
      to: newState,
    });

    // Call state change callback if provided
    if (this.onStateChangeCallback) {
      try {
        this.onStateChangeCallback(oldState, newState);
      } catch (error) {
        logger.error('State change callback error', { error });
      }
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      failureCount: this.failureCount,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime || undefined,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.consecutiveFailures = 0;
    this.halfOpenSuccessCount = 0;

    logger.info('Circuit breaker reset');
  }

  /**
   * Check if circuit is open (failing fast)
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Get time until circuit attempts recovery (ms)
   */
  getTimeUntilReset(): number {
    if (this.state !== CircuitState.OPEN) {
      return 0;
    }
    const timeUntilReset = this.timeout - (Date.now() - this.lastFailureTime);
    return Math.max(0, timeUntilReset);
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple named circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   * @param name - Circuit breaker name
   * @param config - Circuit breaker configuration
   */
  get(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Remove a circuit breaker
   * @param name - Circuit breaker name
   */
  remove(name: string): void {
    this.breakers.delete(name);
  }

  /**
   * Get all circuit breaker names
   */
  names(): string[] {
    return Array.from(this.breakers.keys());
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Map<string, CircuitBreakerStats> {
    const stats = new Map<string, CircuitBreakerStats>();
    for (const [name, breaker] of this.breakers.entries()) {
      stats.set(name, breaker.getStats());
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
  }
}

/**
 * Global circuit breaker registry
 */
const globalRegistry = new CircuitBreakerRegistry();

/**
 * Get global circuit breaker registry
 */
export function getCircuitBreakerRegistry(): CircuitBreakerRegistry {
  return globalRegistry;
}

/**
 * Get or create a circuit breaker from global registry
 */
export function getCircuitBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
  return globalRegistry.get(name, config);
}

export default CircuitBreaker;
