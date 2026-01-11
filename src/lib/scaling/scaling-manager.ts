/**
 * Scaling Manager (P3 - Scalability Optimization)
 *
 * Provides horizontal scaling support for multi-instance deployments.
 * Features:
 * - Worker pool management
 * - Distributed task queue
 * - Multi-instance coordination
 * - Load balancing and failover
 */

import logger from '@/lib/logger';
import { PoolManager, TaskPriority } from '@/lib/concurrency/pool-manager';

/**
 * Worker configuration
 */
export interface WorkerConfig {
  /** Worker identifier */
  id: string;
  /** Worker type/category */
  type: string;
  /** Maximum concurrent tasks */
  maxConcurrency?: number;
  /** Worker metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Worker status
 */
export interface WorkerStatus {
  /** Worker ID */
  id: string;
  /** Worker type */
  type: string;
  /** Current state */
  state: 'idle' | 'busy' | 'draining' | 'offline';
  /** Number of active tasks */
  activeTasks: number;
  /** Total completed tasks */
  completedTasks: number;
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
}

/**
 * Task for distributed processing
 */
export interface DistributedTask<T = unknown, R = unknown> {
  /** Unique task ID */
  id: string;
  /** Task type for routing */
  type: string;
  /** Task data */
  data: T;
  /** Task priority */
  priority: TaskPriority;
  /** Creation timestamp */
  createdAt: number;
  /** Maximum retries */
  maxRetries?: number;
  /** Current retry count */
  retryCount?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Task result
 */
export interface TaskResult<R = unknown> {
  /** Task ID */
  taskId: string;
  /** Worker ID that processed the task */
  workerId: string;
  /** Result data */
  result?: R;
  /** Error if failed */
  error?: Error;
  /** Completion timestamp */
  completedAt: number;
  /** Processing duration in milliseconds */
  duration: number;
}

/**
 * Scaling configuration
 */
export interface ScalingConfig {
  /** Maximum workers per type */
  maxWorkers?: number;
  /** Task timeout in milliseconds (default: 30000) */
  taskTimeout?: number;
  /** Heartbeat interval in milliseconds (default: 5000) */
  heartbeatInterval?: number;
  /** Worker timeout before marking offline (default: 15000) */
  workerTimeout?: number;
  /** Enable automatic worker scaling */
  autoScaling?: boolean;
}

/**
 * Scaling Manager class
 */
export class ScalingManager {
  private config: Required<ScalingConfig>;
  private workers: Map<string, WorkerStatus> = new Map();
  private taskQueue: Map<string, DistributedTask[]> = new Map();
  private taskResults: Map<string, TaskResult> = new Map();
  private poolManager: PoolManager;
  private heartbeatTimer?: NodeJS.Timeout;
  private taskCounter = 0;

  constructor(config: ScalingConfig = {}) {
    this.config = {
      maxWorkers: config.maxWorkers ?? 10,
      taskTimeout: config.taskTimeout ?? 30000,
      heartbeatInterval: config.heartbeatInterval ?? 5000,
      workerTimeout: config.workerTimeout ?? 15000,
      autoScaling: config.autoScaling ?? true,
    };

    this.poolManager = new PoolManager({
      maxConcurrent: this.config.maxWorkers,
      maxQueueSize: 1000,
      taskTimeout: this.config.taskTimeout,
    });

    logger.info('ScalingManager initialized', { config: this.config });

    // Start heartbeat monitoring
    this.startHeartbeat();
  }

  /**
   * Register a worker
   * @param config - Worker configuration
   */
  registerWorker(config: WorkerConfig): void {
    const status: WorkerStatus = {
      id: config.id,
      type: config.type,
      state: 'idle',
      activeTasks: 0,
      completedTasks: 0,
      lastHeartbeat: Date.now(),
    };

    this.workers.set(config.id, status);

    // Initialize task queue for worker type
    if (!this.taskQueue.has(config.type)) {
      this.taskQueue.set(config.type, []);
    }

    logger.info('Worker registered', { id: config.id, type: config.type });
  }

  /**
   * Unregister a worker
   * @param workerId - Worker ID
   */
  unregisterWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      this.workers.delete(workerId);
      logger.info('Worker unregistered', { workerId });
    }
  }

  /**
   * Update worker heartbeat
   * @param workerId - Worker ID
   */
  updateHeartbeat(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.lastHeartbeat = Date.now();
    }
  }

  /**
   * Submit a task for distributed processing
   * @param task - Task to process
   * @returns Promise that resolves with task result
   */
  async submitTask<T, R>(task: DistributedTask<T>): Promise<TaskResult<R>> {
    // Ensure task has ID
    if (!task.id) {
      task.id = `task-${++this.taskCounter}`;
    }

    // Set default values
    task.createdAt = Date.now();
    task.priority = task.priority ?? TaskPriority.NORMAL;
    task.maxRetries = task.maxRetries ?? 3;
    task.retryCount = task.retryCount ?? 0;

    logger.debug('Task submitted', { taskId: task.id, type: task.type });

    return new Promise<TaskResult<R>>((resolve, reject) => {
      // Add to task queue
      const queue = this.taskQueue.get(task.type);
      if (queue) {
        queue.push(task as DistributedTask);
      }

      // Process task
      this.poolManager
        .execute(
          async () => {
            return this.processTask<T, R>(task as DistributedTask<T>);
          },
          task.priority
        )
        .then(resolve)
        .catch((error) => {
          // Retry if possible
          if ((task.retryCount ?? 0) < (task.maxRetries ?? 3)) {
            task.retryCount = (task.retryCount ?? 0) + 1;
            logger.info('Retrying task', {
              taskId: task.id,
              attempt: task.retryCount,
            });
            return this.submitTask<T, R>(task as DistributedTask<T>);
          }
          reject(error);
          // Return undefined to satisfy type checker (promise will be rejected)
          return undefined as never;
        });
    });
  }

  /**
   * Process a single task
   */
  private async processTask<T, R>(task: DistributedTask<T>): Promise<TaskResult<R>> {
    const startTime = Date.now();

    // Select available worker
    const worker = this.selectWorker(task.type);
    if (!worker) {
      throw new Error(`No available worker for task type: ${task.type}`);
    }

    worker.state = 'busy';
    worker.activeTasks++;

    try {
      // Update heartbeat
      this.updateHeartbeat(worker.id);

      // Process task (placeholder - would call actual worker)
      const result = await this.executeTask<T, R>(task, worker.id);

      worker.completedTasks++;
      worker.state = 'idle';
      worker.activeTasks--;

      return result;
    } catch (error) {
      worker.state = 'idle';
      worker.activeTasks--;
      throw error;
    }
  }

  /**
   * Select an available worker for task type
   */
  private selectWorker(taskType: string): WorkerStatus | null {
    // Find idle worker of matching type
    for (const worker of this.workers.values()) {
      if (worker.type === taskType && worker.state === 'idle') {
        return worker;
      }
    }

    // If auto-scaling enabled, could spawn new worker here
    if (this.config.autoScaling) {
      logger.debug('Auto-scaling: could spawn new worker', { taskType });
    }

    return null;
  }

  /**
   * Execute task on worker (placeholder implementation)
   */
  private async executeTask<T, R>(
    task: DistributedTask<T>,
    workerId: string
  ): Promise<TaskResult<R>> {
    const startTime = Date.now();

    // This is a placeholder implementation
    // Real implementation would:
    // 1. Send task to worker via RPC/IPC
    // 2. Wait for result
    // 3. Handle timeout

    logger.debug('Executing task', { taskId: task.id, workerId });

    // Simulate task execution
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result: TaskResult<R> = {
      taskId: task.id,
      workerId,
      completedAt: Date.now(),
      duration: Date.now() - startTime,
    } as TaskResult<R>;

    // Store result
    this.taskResults.set(task.id, result);

    return result;
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.checkWorkerHealth();
    }, this.config.heartbeatInterval);
  }

  /**
   * Check worker health and remove timed-out workers
   */
  private checkWorkerHealth(): void {
    const now = Date.now();
    const timeoutWorkers: string[] = [];

    for (const [workerId, worker] of this.workers.entries()) {
      if (now - worker.lastHeartbeat > this.config.workerTimeout) {
        timeoutWorkers.push(workerId);
      }
    }

    for (const workerId of timeoutWorkers) {
      logger.warn('Worker timed out, removing', { workerId });
      this.unregisterWorker(workerId);
    }
  }

  /**
   * Get worker status
   * @param workerId - Worker ID
   * @returns Worker status or undefined if not found
   */
  getWorkerStatus(workerId: string): WorkerStatus | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all workers by type
   * @param type - Worker type
   * @returns Array of worker statuses
   */
  getWorkersByType(type: string): WorkerStatus[] {
    return Array.from(this.workers.values()).filter((w) => w.type === type);
  }

  /**
   * Get scaling statistics
   */
  getStats(): {
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
    offlineWorkers: number;
    queueSize: number;
    poolStats: ReturnType<PoolManager['getStats']>;
  } {
    let activeWorkers = 0;
    let idleWorkers = 0;
    let offlineWorkers = 0;
    let queueSize = 0;

    for (const worker of this.workers.values()) {
      if (worker.state === 'busy') activeWorkers++;
      else if (worker.state === 'idle') idleWorkers++;
      else offlineWorkers++;
    }

    for (const queue of this.taskQueue.values()) {
      queueSize += queue.length;
    }

    return {
      totalWorkers: this.workers.size,
      activeWorkers,
      idleWorkers,
      offlineWorkers,
      queueSize,
      poolStats: this.poolManager.getStats(),
    };
  }

  /**
   * Drain all workers (stop accepting new tasks)
   */
  async drain(): Promise<void> {
    logger.info('Draining all workers');

    for (const worker of this.workers.values()) {
      if (worker.state === 'idle') {
        worker.state = 'draining';
      }
    }

    // Wait for active tasks to complete
    await this.poolManager.drain();

    logger.info('All workers drained');
  }

  /**
   * Get task result
   * @param taskId - Task ID
   * @returns Task result or undefined if not found
   */
  getTaskResult<R>(taskId: string): TaskResult<R> | undefined {
    return this.taskResults.get(taskId) as TaskResult<R> | undefined;
  }

  /**
   * Clear completed task results
   */
  clearTaskResults(): void {
    this.taskResults.clear();
  }

  /**
   * Destroy the scaling manager
   */
  async destroy(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    await this.drain();
    this.workers.clear();
    this.taskQueue.clear();
    this.taskResults.clear();

    logger.info('ScalingManager destroyed');
  }
}

/**
 * Singleton instances
 */
const managers: Map<string, ScalingManager> = new Map();

/**
 * Get or create a scaling manager
 * @param name - Manager name
 * @param config - Configuration (only used on first creation)
 * @returns ScalingManager instance
 */
export function getScalingManager(
  name: string = 'default',
  config?: ScalingConfig
): ScalingManager {
  if (!managers.has(name)) {
    managers.set(name, new ScalingManager(config));
  }
  return managers.get(name)!;
}

/**
 * Reset all managers (for testing)
 */
export function resetScalingManagers(): void {
  for (const manager of managers.values()) {
    manager.destroy();
  }
  managers.clear();
}

export default ScalingManager;
