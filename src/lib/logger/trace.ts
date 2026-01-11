/**
 * TraceId Module
 *
 * Provides distributed tracing support for request tracking across the application.
 * Uses AsyncLocalStorage for Node.js environments to maintain trace context.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

// AsyncLocalStorage instance for trace context
const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Trace context interface
 */
interface TraceContext {
  traceId: string;
  sessionId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Generate a unique trace ID
 *
 * Format: trace-{timestamp}-{random}
 * Example: trace-1705000000000-abc123def
 *
 * @returns Unique trace ID
 */
export function generateTraceId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `trace-${timestamp}-${random}`;
}

/**
 * Get the current trace ID from async context
 *
 * @returns Current trace ID or undefined
 */
export function getTraceId(): string | undefined {
  const context = traceStorage.getStore();
  return context?.traceId;
}

/**
 * Get the full trace context
 *
 * @returns Current trace context or undefined
 */
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

/**
 * Run a function with a specific trace context
 *
 * @param traceId - The trace ID to use
 * @param context - Additional context data (sessionId, userId, etc.)
 * @param fn - The function to run with the trace context
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const result = await runWithTraceId('trace-123', { sessionId: 'abc' }, async () => {
 *   // All logger calls within this function will include the traceId
 *   logger.info('Processing request');
 *   return await doWork();
 * });
 * ```
 */
export function runWithTraceId<T>(
  traceId: string,
  context: Omit<TraceContext, 'traceId'>,
  fn: () => T
): T {
  return traceStorage.run({ traceId, ...context }, fn);
}

/**
 * Run an async function with a specific trace context
 *
 * @param traceId - The trace ID to use
 * @param context - Additional context data
 * @param fn - The async function to run
 * @returns Promise resolving to the result
 *
 * @example
 * ```typescript
 * await runWithTraceIdAsync('trace-123', { sessionId: 'abc' }, async () => {
 *   logger.info('Async operation started');
 *   await someAsyncWork();
 *   logger.info('Async operation completed');
 * });
 * ```
 */
export async function runWithTraceIdAsync<T>(
  traceId: string,
  context: Omit<TraceContext, 'traceId'>,
  fn: () => Promise<T>
): Promise<T> {
  return traceStorage.run({ traceId, ...context }, async () => {
    return await fn();
  });
}

/**
 * Wrap a function to automatically add trace ID to all logger calls
 *
 * @param fn - Function to wrap
 * @param traceId - Optional trace ID (auto-generated if not provided)
 * @param context - Additional context data
 * @returns Wrapped function
 *
 * @example
 * ```typescript
 * const tracedHandler = withTraceId(
 *   async (req, res) => {
 *     logger.info('Handling request'); // Will include traceId
 *     // ... handler logic
 *   },
 *   undefined,
 *   { sessionId: 'abc' }
 * );
 * ```
 */
export function withTraceId<T extends (...args: unknown[]) => unknown>(
  fn: T,
  traceId?: string,
  context?: Omit<TraceContext, 'traceId'>
): T {
  const finalTraceId = traceId || generateTraceId();
  const finalContext = context || {};

  return ((...args: unknown[]) => {
    return traceStorage.run({ traceId: finalTraceId, ...finalContext }, () => {
      return fn(...args);
    });
  }) as T;
}

/**
 * Get trace information for logging
 *
 * @returns Object with traceId and context for log metadata
 *
 * @example
 * ```typescript
 * logger.info('Operation started', {
 *   ...getTraceLogInfo(),
 *   customData: 'value'
 * });
 * ```
 */
export function getTraceLogInfo(): { traceId?: string; sessionId?: string } {
  const context = traceStorage.getStore();
  if (!context) return {};

  return {
    traceId: context.traceId,
    sessionId: context.sessionId,
  };
}

/**
 * Check if tracing is active in current context
 *
 * @returns true if trace context is available
 */
export function isTracingActive(): boolean {
  return traceStorage.getStore() !== undefined;
}
