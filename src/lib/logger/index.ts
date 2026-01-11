/**
 * Logger Module
 *
 * Provides structured logging with JSON output, multiple log levels,
 * sensitive data masking, source code tracking, and trace ID support.
 */

import {
  formatForDevelopment,
  formatForProduction,
  getDefaultMinLevel,
  getCallerInfo,
  isDevelopmentEnvironment,
  maskSensitiveData,
} from './utils';
import { getTraceId } from './trace';
import { LogPersistence, getPersistence } from './persistence';

/**
 * Log level enumeration with priority values
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

/**
 * Standardized log entry structure with ISO 8601 timestamp
 */
export interface LogEntry {
  /** ISO 8601 timestamp (e.g., "2025-01-11T12:34:56.789Z") */
  timestamp: string;
  /** Log level as string ("DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL") */
  level: string;
  /** Log message */
  message: string;
  /** Source location in format "src/path/file.ts:functionName" */
  source?: string;
  /** Structured context data (automatically masked) */
  context?: Record<string, unknown>;
  /** Distributed trace ID for request tracking */
  traceId?: string;
  /** Agent name for workflow logs (backward compatibility) */
  agent?: string;
  /** Session ID for request tracking (backward compatibility) */
  sessionId?: string;
  /** Error details for ERROR and CRITICAL levels */
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger options for customizing behavior
 */
interface LoggerOptions {
  /** Minimum log level to output (default: auto-detected from environment) */
  minLevel?: LogLevel;
  /** Enable sensitive data masking (default: true) */
  enableMasking?: boolean;
  /** Enable source code tracking (default: true in development, false in production) */
  enableSourceTracking?: boolean;
  /** Enable file persistence (default: false) */
  enableFilePersistence?: boolean;
  /** File persistence configuration */
  persistenceOptions?: {
    directory?: string;
    maxAgeDays?: number;
    maxSizeMB?: number;
    prettyPrint?: boolean;
  };
}

/**
 * Logger class providing structured logging functionality
 */
export class Logger {
  private minLevel: LogLevel;
  private enableMasking: boolean;
  private enableSourceTracking: boolean;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private isDev: boolean;
  private persistence: LogPersistence | null = null;

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? getDefaultMinLevel();
    this.enableMasking = options.enableMasking ?? true;
    this.enableSourceTracking = options.enableSourceTracking ?? isDevelopmentEnvironment();
    this.isDev = isDevelopmentEnvironment();

    // Initialize file persistence if enabled
    if (options.enableFilePersistence) {
      this.persistence = getPersistence(options.persistenceOptions);
      // Cleanup old files on startup
      this.persistence.cleanup();
    }
  }

  /**
   * Core logging method
   *
   * @param level - Log level
   * @param message - Log message
   * @param context - Optional context data
   * @param meta - Optional metadata (source, traceId, error, etc.)
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    meta?: {
      source?: string;
      agent?: string;
      sessionId?: string;
      error?: Error;
      traceId?: string;
    }
  ): void {
    // Filter by minimum level
    if (level < this.minLevel) return;

    // Get trace ID from async context if not provided
    const traceId = meta?.traceId || getTraceId();

    // Create log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      source: meta?.source || (this.enableSourceTracking ? getCallerInfo() : undefined),
      context: this.enableMasking ? (maskSensitiveData(context) as Record<string, unknown>) : context,
      traceId,
      agent: meta?.agent,
      sessionId: meta?.sessionId,
    };

    // Add error details if present
    if (meta?.error) {
      entry.error = {
        name: meta.error.name,
        message: meta.error.message,
        stack: this.isDev ? meta.error.stack : undefined,
      };
    }

    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output to console
    this.output(entry, level);

    // Write to file if persistence is enabled
    if (this.persistence) {
      this.persistence.write(entry);
    }
  }

  /**
   * Output log entry to console
   *
   * @param entry - Log entry to output
   * @param level - Log level for console method selection
   */
  private output(entry: LogEntry, level: LogLevel): void {
    const formatted = this.isDev ? formatForDevelopment(entry) : formatForProduction(entry);

    // Logger module requires full console access
    switch (level) {
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console -- Logger module needs full console access
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console -- Logger module needs full console access
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formatted);
        break;
    }
  }

  /**
   * Log DEBUG level message
   *
   * @param message - Log message
   * @param context - Optional context data
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log INFO level message
   *
   * @param message - Log message
   * @param context - Optional context data
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log WARN level message
   *
   * @param message - Log message
   * @param context - Optional context data
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log ERROR level message
   *
   * @param message - Log message
   * @param contextOrError - Context data or Error instance
   * @param errorInstance - Optional Error instance (if context is provided)
   */
  error(message: string, contextOrError?: Record<string, unknown> | Error, errorInstance?: Error): void {
    const ctx = contextOrError instanceof Error ? undefined : contextOrError;
    const err = contextOrError instanceof Error ? contextOrError : errorInstance;
    this.log(LogLevel.ERROR, message, ctx, { error: err });
  }

  /**
   * Log CRITICAL level message (system-level failures)
   *
   * Use for: database connection failures, LLM API unavailability,
   * memory overflow, service startup failures, data corruption
   *
   * @param message - Log message
   * @param contextOrError - Context data or Error instance
   * @param errorInstance - Optional Error instance (if context is provided)
   */
  critical(message: string, contextOrError?: Record<string, unknown> | Error, errorInstance?: Error): void {
    const ctx = contextOrError instanceof Error ? undefined : contextOrError;
    const err = contextOrError instanceof Error ? contextOrError : errorInstance;
    this.log(LogLevel.CRITICAL, message, ctx, { error: err });
  }

  /**
   * Agent-specific logging for workflow nodes
   *
   * @param agentName - Agent node name
   * @param sessionId - Session ID
   * @param message - Log message
   * @param context - Optional context data
   */
  agent(agentName: string, sessionId: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context, {
      agent: agentName,
      sessionId,
    });
  }

  /**
   * Retrieve stored logs with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Filtered log entries
   */
  getLogs(filter?: {
    level?: LogLevel;
    sessionId?: string;
    agent?: string;
  }): LogEntry[] {
    let filtered = this.logs;

    if (filter?.level !== undefined) {
      const minLevel = filter.level;
      filtered = filtered.filter(
        log => LogLevel[log.level as keyof typeof LogLevel] >= minLevel
      );
    }

    if (filter?.sessionId) {
      filtered = filtered.filter(log => log.sessionId === filter.sessionId);
    }

    if (filter?.agent) {
      filtered = filtered.filter(log => log.agent === filter.agent);
    }

    return filtered;
  }

  /**
   * Clear all stored logs from memory
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Set minimum log level
   *
   * @param level - New minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Get current log file information
   */
  getCurrentLogFileInfo() {
    return this.persistence?.getCurrentFileInfo() || null;
  }

  /**
   * Get all log files with metadata
   */
  getLogFiles() {
    return this.persistence?.getLogFiles() || [];
  }

  /**
   * Read log entries from a specific file
   */
  readLogsFromFile(filePath: string, limit?: number): LogEntry[] {
    return this.persistence?.readFromFile(filePath, limit) || [];
  }

  /**
   * Get total size of all log files in bytes
   */
  getTotalLogSize(): number {
    return this.persistence?.getTotalSize() || 0;
  }

  /**
   * Export logs to a single file
   */
  exportLogs(outputPath: string, dateFrom?: Date, dateTo?: Date): boolean {
    return this.persistence?.exportLogs(outputPath, dateFrom, dateTo) || false;
  }

  /**
   * Manually trigger cleanup of old log files
   */
  cleanupOldLogs(): void {
    this.persistence?.cleanup();
  }
}

// Singleton instance
const loggerInstance = new Logger();

// Export with proper type
const logger: {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, contextOrError?: Record<string, unknown> | Error, errorInstance?: Error): void;
  critical(message: string, contextOrError?: Record<string, unknown> | Error, errorInstance?: Error): void;
  agent(agentName: string, sessionId: string, message: string, context?: Record<string, unknown>): void;
  getLogs(filter?: { level?: LogLevel; sessionId?: string; agent?: string }): LogEntry[];
  clear(): void;
  setMinLevel(level: LogLevel): void;
} = loggerInstance;

export default logger;
export { formatForDevelopment, formatForProduction, maskSensitiveData };
export type { LoggerOptions };
export * from './trace';
export { LogPersistence, enableFilePersistence, getPersistence } from './persistence';
export type { PersistenceOptions } from './persistence';
