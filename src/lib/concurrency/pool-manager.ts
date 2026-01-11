/**
 * Pool Manager (P2 - Performance Optimization)
 *
 * Provides concurrency control and task queue management.
 * Features:
 * - Semaphore-based concurrency limiting
 * - Task queue with priority support
 * - LLM call pooling (default: 5 concurrent)
 * - Promise-based task execution
 */

import logger from '@/lib/logger';

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

/**
 * Task wrapper for queue management
 */
interface QueuedTask<T> {
  id: string;
  task: () => Promise<T>;
  priority: TaskPriority;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  /** Pool size (max concurrent tasks) */
  poolSize: number;
  /** Currently running tasks */
  runningTasks: number;
  /** Tasks waiting in queue */
  queuedTasks: number;
  /** Total completed tasks */
  completedTasks: number;
  /** Total failed tasks */
  failedTasks: number;
  /** Average execution time (ms) */
  avgExecutionTime: number;
}

/**
 * Pool configuration
 */
export interface PoolConfig {
  /** Maximum concurrent tasks (default: 5) */
  maxConcurrent?: number;
  /** Maximum queue size (0 = unlimited, default: 100) */
  maxQueueSize?: number;
  /** Task timeout in milliseconds (0 = no timeout, default: 30000) */
  taskTimeout?: number;
  /** Enable priority queue (default: false) */
  enablePriority?: boolean;
}

/**
 * Semaphore for controlling concurrent access
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    if (permits <= 0) {
      throw new Error('Semaphore permits must be greater than 0');
    }
    this.permits = permits;
  }

  /**
   * Acquire a permit (blocks if none available)
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // Wait for a permit to become available
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Release a permit
   */
  release(): void {
    if (this.waitQueue.length > 0) {
      // Wake up next waiting task
      const nextResolve = this.waitQueue.shift();
      nextResolve?.();
    } else {
      this.permits++;
    }
  }

  /**
   * Get available permits
   */
  availablePermits(): number {
    return this.permits;
  }
}

/**
 * Pool Manager class
 */
export class PoolManager {
  private semaphore: Semaphore;
  private taskQueue: QueuedTask<unknown>[] = [];
  private runningTasks: Set<string> = new Set();
  private config: Required<PoolConfig>;
  private stats = {
    completedTasks: 0,
    failedTasks: 0,
    totalExecutionTime: 0,
  };
  private taskIdCounter = 0;

  constructor(config: PoolConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 5,
      maxQueueSize: config.maxQueueSize ?? 100,
      taskTimeout: config.taskTimeout ?? 30000,
      enablePriority: config.enablePriority ?? false,
    };

    this.semaphore = new Semaphore(this.config.maxConcurrent);

    logger.info('PoolManager initialized', {
      maxConcurrent: this.config.maxConcurrent,
      maxQueueSize: this.config.maxQueueSize,
      taskTimeout: this.config.taskTimeout,
      enablePriority: this.config.enablePriority,
    });
  }

  /**
   * Execute a task in the pool
   * @param task - Async function to execute
   * @param priority - Task priority (if enabled)
   * @returns Promise that resolves with the task result
   */
  async execute<T>(
    task: () => Promise<T>,
    priority: TaskPriority = TaskPriority.NORMAL
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Check queue size limit
      if (
        this.config.maxQueueSize > 0 &&
        this.taskQueue.length >= this.config.maxQueueSize
      ) {
        reject(new Error('Task queue is full'));
        return;
      }

      const taskId = `task-${++this.taskIdCounter}`;
      const queuedTask: QueuedTask<T> = {
        id: taskId,
        task,
        priority,
        resolve: resolve as (value: T) => void,
        reject,
        enqueuedAt: Date.now(),
      };

      this.taskQueue.push(queuedTask as QueuedTask<unknown>);
      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    // Sort by priority if enabled
    if (this.config.enablePriority && this.taskQueue.length > 1) {
      this.taskQueue.sort((a, b) => b.priority - a.priority);
    }

    // Process tasks while we have capacity
    while (
      this.taskQueue.length > 0 &&
      this.runningTasks.size < this.config.maxConcurrent
    ) {
      const queuedTask = this.taskQueue.shift();
      if (!queuedTask) break;

      this.runTask(queuedTask);
    }
  }

  /**
   * Run a single task
   */
  private async runTask<T>(queuedTask: QueuedTask<T>): Promise<void> {
    const { id, task, resolve, reject, enqueuedAt } = queuedTask;

    this.runningTasks.add(id);

    const startTime = Date.now();

    try {
      // Acquire semaphore permit
      await this.semaphore.acquire();

      // Create timeout promise if configured
      const timeoutPromise =
        this.config.taskTimeout > 0
          ? this.createTimeout(this.config.taskTimeout)
          : null;

      // Execute task (with timeout if configured)
      const result = timeoutPromise
        ? await Promise.race([task(), timeoutPromise])
        : await task();

      const executionTime = Date.now() - startTime;
      this.stats.completedTasks++;
      this.stats.totalExecutionTime += executionTime;

      resolve(result as T);
    } catch (error) {
      this.stats.failedTasks++;
      reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Release semaphore permit
      this.semaphore.release();

      // Remove from running tasks
      this.runningTasks.delete(id);

      // Process next task in queue
      this.processQueue();
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Task timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Get current pool statistics
   */
  getStats(): PoolStats {
    const avgExecutionTime =
      this.stats.completedTasks > 0
        ? this.stats.totalExecutionTime / this.stats.completedTasks
        : 0;

    return {
      poolSize: this.config.maxConcurrent,
      runningTasks: this.runningTasks.size,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.stats.completedTasks,
      failedTasks: this.stats.failedTasks,
      avgExecutionTime,
    };
  }

  /**
   * Check if pool is idle (no running or queued tasks)
   */
  isIdle(): boolean {
    return this.runningTasks.size === 0 && this.taskQueue.length === 0;
  }

  /**
   * Wait for all tasks to complete
   */
  async drain(): Promise<void> {
    while (!this.isIdle()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Clear the task queue (does not cancel running tasks)
   */
  clearQueue(): number {
    const cleared = this.taskQueue.length;

    // Reject all queued tasks
    for (const task of this.taskQueue) {
      task.reject(new Error('Task cancelled: queue cleared'));
    }

    this.taskQueue = [];

    logger.info('Task queue cleared', { cleared });

    return cleared;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      completedTasks: 0,
      failedTasks: 0,
      totalExecutionTime: 0,
    };
    logger.debug('Pool statistics reset');
  }
}

/**
 * Pre-configured pools
 */
export const PoolPresets = {
  /** LLM call pool (5 concurrent, 30s timeout) */
  LLM: { maxConcurrent: 5, maxQueueSize: 50, taskTimeout: 30000 },
  /** API call pool (10 concurrent, 10s timeout) */
  API: { maxConcurrent: 10, maxQueueSize: 100, taskTimeout: 10000 },
  /** Database pool (20 concurrent, 5s timeout) */
  DATABASE: {
    maxConcurrent: 20,
    maxQueueSize: 200,
    taskTimeout: 5000,
  },
  /** Background task pool (3 concurrent, no timeout) */
  BACKGROUND: { maxConcurrent: 3, maxQueueSize: 20, taskTimeout: 0 },
} as const;

/**
 * Singleton instances
 */
const pools: Map<string, PoolManager> = new Map();

/**
 * Get or create a named pool
 * @param name - Pool name
 * @param config - Pool configuration (only used on first creation)
 * @returns PoolManager instance
 */
export function getPool(name: string, config?: PoolConfig): PoolManager {
  if (!pools.has(name)) {
    pools.set(name, new PoolManager(config));
  }
  return pools.get(name)!;
}

/**
 * Get pre-configured LLM pool
 */
export function getLLMPool(): PoolManager {
  return getPool('llm', PoolPresets.LLM);
}

/**
 * Reset all pools (for testing)
 */
export function resetPools(): void {
  pools.clear();
}

export default PoolManager;
