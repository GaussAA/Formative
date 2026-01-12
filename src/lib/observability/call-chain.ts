/**
 * Call Chain Tracker
 *
 * 分布式调用链追踪
 * 支持：
 * - 跨服务调用追踪
 * - Span 管理
 * - OTLP 导出
 * - 性能分析
 */

import type {
  TraceMetadata,
  Span,
  Trace,
  CallChainOptions,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/lib/logger';

/**
 * CallChainTracker
 *
 * 调用链追踪器
 */
export class CallChainTracker {
  private readonly traces: Map<string, Trace> = new Map();
  private readonly activeSpans: Map<string, Set<string>> = new Map(); // traceId -> spanIds
  private readonly options: Required<CallChainOptions>;

  constructor(options?: CallChainOptions) {
    this.options = {
      enabled: options?.enabled ?? true,
      sampleRate: options?.sampleRate ?? 1.0,
      maxSpansPerTrace: options?.maxSpansPerTrace ?? 1000,
    };

    logger.debug('CallChainTracker initialized', this.options);
  }

  /**
   * Start a new trace
   *
   * @param metadata - Trace metadata
   * @returns Trace ID
   */
  startTrace(metadata: TraceMetadata): string {
    if (!this.options.enabled || Math.random() > this.options.sampleRate) {
      // Return a dummy trace ID for non-sampled traces
      return uuidv4();
    }

    const traceId = metadata.traceId || uuidv4();

    const trace: Trace = {
      id: traceId,
      traceId,
      parentTraceId: metadata.parentTraceId,
      rootSpanId: uuidv4(),
      metadata: {
        ...metadata,
        traceId,
        startedAt: Date.now(),
      },
      spans: [],
      status: 'in_progress',
      startedAt: Date.now(),
    };

    this.traces.set(traceId, trace);
    this.activeSpans.set(traceId, new Set());

    // Create root span
    const rootSpan: Span = {
      id: trace.rootSpanId,
      traceId,
      parentSpanId: null,
      name: metadata.operation || 'root',
      kind: 'internal',
      status: 'started',
      startTime: Date.now(),
      attributes: {
        ...metadata.attributes,
        'trace.root': true,
      },
    };

    this.addSpan(traceId, rootSpan);

    logger.debug('Trace started', {
      traceId,
      operation: metadata.operation,
    });

    return traceId;
  }

  /**
   * Add a span to a trace
   *
   * @param traceId - Trace ID
   * @param span - Span data
   */
  addSpan(traceId: string, span: Span): void {
    if (!this.options.enabled) {
      return;
    }

    const trace = this.traces.get(traceId);

    if (!trace) {
      logger.warn('Cannot add span - trace not found', { traceId });
      return;
    }

    // Check max spans limit
    if (trace.spans.length >= this.options.maxSpansPerTrace) {
      logger.warn('Max spans limit reached', { traceId, limit: this.options.maxSpansPerTrace });
      return;
    }

    span.traceId = traceId;
    span.startTime = span.startTime || Date.now();

    trace.spans.push(span);
    this.activeSpans.get(traceId)?.add(span.id);

    logger.debug('Span added', {
      traceId,
      spanId: span.id,
      name: span.name,
    });
  }

  /**
   * End a span
   *
   * @param traceId - Trace ID
   * @param spanId - Span ID
   * @param status - Final status
   */
  endSpan(traceId: string, spanId: string, status?: Span['status']): void {
    if (!this.options.enabled) {
      return;
    }

    const trace = this.traces.get(traceId);

    if (!trace) {
      return;
    }

    const span = trace.spans.find(s => s.id === spanId);

    if (!span) {
      logger.warn('Cannot end span - span not found', { traceId, spanId });
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status || 'ok';

    this.activeSpans.get(traceId)?.delete(spanId);

    logger.debug('Span ended', {
      traceId,
      spanId,
      duration: span.duration,
      status: span.status,
    });
  }

  /**
   * Get a trace by ID
   *
   * @param traceId - Trace ID
   * @returns Trace data or undefined
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * End a trace
   *
   * @param traceId - Trace ID
   * @param status - Final status
   */
  endTrace(traceId: string, status?: Trace['status']): void {
    if (!this.options.enabled) {
      return;
    }

    const trace = this.traces.get(traceId);

    if (!trace) {
      return;
    }

    // End all active spans
    const activeSpanIds = this.activeSpans.get(traceId) || new Set();
    for (const spanId of activeSpanIds) {
      this.endSpan(traceId, spanId, 'cancelled');
    }

    trace.status = status || 'completed';
    trace.endedAt = Date.now();
    trace.duration = trace.endedAt - trace.startedAt;

    this.activeSpans.delete(traceId);

    logger.info('Trace ended', {
      traceId,
      duration: trace.duration,
      status: trace.status,
      spanCount: trace.spans.length,
    });
  }

  /**
   * Export trace to OTLP format
   *
   * @param traceId - Trace ID
   * @returns OTLP-compatible object
   */
  exportToOTLP(traceId: string): object {
    const trace = this.traces.get(traceId);

    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    return {
      resourceSpans: [
        {
          resource: {
            attributes: {
              'service.name': trace.metadata.serviceName || 'formative',
              'service.version': trace.metadata.serviceVersion || '1.0.0',
              'deployment.environment': trace.metadata.environment || 'development',
            },
          },
          scopeSpans: [
            {
              scope: {
                name: 'formative',
                version: '1.0.0',
              },
              spans: trace.spans.map(span => ({
                traceId: traceId,
                spanId: span.id,
                parentSpanId: span.parentSpanId,
                name: span.name,
                kind: span.kind,
                startTimeUnixNano: span.startTime * 1_000_000,
                endTimeUnixNano: (span.endTime || span.startTime) * 1_000_000,
                status: {
                  code: this.getStatusCode(status),
                },
                attributes: span.attributes || {},
                duration: span.duration,
              })),
            },
          ],
        },
      ],
    };
  }

  /**
   * Get all traces
   *
   * @param filter - Optional filter criteria
   * @returns Array of traces
   */
  getTraces(filter?: {
    service?: string;
    operation?: string;
    status?: Trace['status'];
    limit?: number;
  }): Trace[] {
    let traces = Array.from(this.traces.values());

    if (filter) {
      if (filter.service) {
        traces = traces.filter(t => t.metadata.serviceName === filter.service);
      }
      if (filter.operation) {
        traces = traces.filter(t => t.metadata.operation === filter.operation);
      }
      if (filter.status) {
        traces = traces.filter(t => t.status === filter.status);
      }
      if (filter.limit) {
        traces = traces.slice(-filter.limit);
      }
    }

    return traces;
  }

  /**
   * Get statistics about traces
   *
   * @returns Statistics
   */
  getStats(): {
    totalTraces: number;
    activeTraces: number;
    completedTraces: number;
    failedTraces: number;
    avgDuration: number;
  } {
    const traces = Array.from(this.traces.values());
    const completed = traces.filter(t => t.status === 'completed');
    const failed = traces.filter(t => t.status === 'error');
    const active = traces.filter(t => t.status === 'in_progress');

    const avgDuration = completed.length > 0
      ? completed.reduce((sum, t) => sum + (t.duration || 0), 0) / completed.length
      : 0;

    return {
      totalTraces: traces.length,
      activeTraces: active.length,
      completedTraces: completed.length,
      failedTraces: failed.length,
      avgDuration,
    };
  }

  /**
   * Clear old traces
   *
   * @param olderThan - Age in milliseconds
   */
  clearOldTraces(olderThan: number): void {
    const cutoff = Date.now() - olderThan;

    for (const [traceId, trace] of this.traces.entries()) {
      if (trace.startedAt < cutoff && trace.status !== 'in_progress') {
        this.traces.delete(traceId);
        this.activeSpans.delete(traceId);
      }
    }

    logger.debug('Old traces cleared', { olderThan });
  }

  /**
   * Convert status to OpenTelemetry status code
   *
   * @private
   */
  private getStatusCode(status?: Span['status']): number {
    switch (status) {
      case 'ok':
        return 1; // STATUS_OK
      case 'error':
        return 2; // STATUS_ERROR
      default:
        return 0; // STATUS_UNSET
    }
  }
}

// Default export
export default CallChainTracker;
