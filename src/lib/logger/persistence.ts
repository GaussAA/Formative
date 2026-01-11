/**
 * Logger Persistence Module
 *
 * Provides file-based log persistence with daily rotation and automatic cleanup.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LogEntry } from './index';

/**
 * Persistence configuration options
 */
export interface PersistenceOptions {
  /** Directory to store log files (default: logs/) */
  directory?: string;
  /** Maximum age of log files in days before cleanup (default: 7) */
  maxAgeDays?: number;
  /** Maximum total size of log files in MB (default: 100) */
  maxSizeMB?: number;
  /** Enable pretty printing for log files (default: false) */
  prettyPrint?: boolean;
}

/**
 * Log file metadata for rotation tracking
 */
interface LogFileInfo {
  filePath: string;
  date: string; // YYYY-MM-DD
  size: number;
  createdAt: Date;
}

/**
 * File-based log persistence with daily rotation
 */
export class LogPersistence {
  private directory: string;
  private maxAgeDays: number;
  private maxSizeMB: number;
  private prettyPrint: boolean;
  private currentFilePath: string | null = null;
  private currentFileSize: number = 0;

  constructor(options: PersistenceOptions = {}) {
    this.directory = options.directory || path.join(process.cwd(), 'logs');
    this.maxAgeDays = options.maxAgeDays ?? 7;
    this.maxSizeMB = options.maxSizeMB ?? 100;
    this.prettyPrint = options.prettyPrint ?? false;

    // Ensure directory exists
    this.ensureDirectory();
  }

  /**
   * Ensure the log directory exists
   */
  private ensureDirectory(): void {
    try {
      if (!fs.existsSync(this.directory)) {
        fs.mkdirSync(this.directory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Get today's date string (YYYY-MM-DD)
   */
  private getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * Get log file path for today
   */
  private getLogFilePath(): string {
    const dateStr = this.getTodayDateString();
    return path.join(this.directory, `app-${dateStr}.log`);
  }

  /**
   * Check if current log file needs rotation (date changed or size exceeded)
   */
  private needsRotation(): boolean {
    if (!this.currentFilePath) return true;

    // Check date change
    const todayPath = this.getLogFilePath();
    if (this.currentFilePath !== todayPath) return true;

    // Check size limit
    if (this.currentFileSize >= this.maxSizeMB * 1024 * 1024) return true;

    return false;
  }

  /**
   * Rotate to a new log file
   */
  private rotateLogFile(): void {
    const newFilePath = this.getLogFilePath();

    // If file already exists for today, check size
    if (fs.existsSync(newFilePath)) {
      const stats = fs.statSync(newFilePath);
      this.currentFileSize = stats.size;

      // If still within limits, use existing file
      if (this.currentFileSize < this.maxSizeMB * 1024 * 1024) {
        this.currentFilePath = newFilePath;
        return;
      }

      // Create numbered backup
      let counter = 1;
      let backupPath: string;
      do {
        backupPath = newFilePath.replace('.log', `-${counter}.log`);
        counter++;
      } while (fs.existsSync(backupPath));

      fs.renameSync(newFilePath, backupPath);
    }

    this.currentFilePath = newFilePath;
    this.currentFileSize = 0;
  }

  /**
   * Write a log entry to file
   */
  public write(entry: LogEntry): void {
    try {
      // Check if rotation is needed
      if (this.needsRotation()) {
        this.rotateLogFile();
      }

      if (!this.currentFilePath) return;

      // Format the log entry
      const logLine = this.prettyPrint
        ? JSON.stringify(entry, null, 2) + '\n\n'
        : JSON.stringify(entry) + '\n';

      // Append to file
      fs.appendFileSync(this.currentFilePath, logLine, { encoding: 'utf-8' });

      // Update file size tracking
      this.currentFileSize += Buffer.byteLength(logLine, 'utf-8');
    } catch (error) {
      // Silently fail - don't break the application if logging fails
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * Clean up old log files
   */
  public cleanup(): void {
    try {
      if (!fs.existsSync(this.directory)) return;

      const files = fs.readdirSync(this.directory);
      const now = Date.now();
      const maxAgeMs = this.maxAgeDays * 24 * 60 * 60 * 1000;

      let deletedCount = 0;

      for (const file of files) {
        if (!file.startsWith('app-') || !file.endsWith('.log')) continue;

        const filePath = path.join(this.directory, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        // eslint-disable-next-line no-console -- Logger cleanup notification
        console.log(`[Logger] Cleaned up ${deletedCount} old log files`);
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * Get current log file information
   */
  public getCurrentFileInfo(): LogFileInfo | null {
    if (!this.currentFilePath || !fs.existsSync(this.currentFilePath)) {
      return null;
    }

    const stats = fs.statSync(this.currentFilePath);
    return {
      filePath: this.currentFilePath,
      date: this.getTodayDateString(),
      size: stats.size,
      createdAt: stats.birthtime,
    };
  }

  /**
   * Get all log files with metadata
   */
  public getLogFiles(): LogFileInfo[] {
    try {
      if (!fs.existsSync(this.directory)) return [];

      const files = fs.readdirSync(this.directory)
        .filter(f => f.startsWith('app-') && f.endsWith('.log'));

      return files.map(file => {
        const filePath = path.join(this.directory, file);
        const stats = fs.statSync(filePath);
        const dateMatch = file.match(/app-(\d{4}-\d{2}-\d{2})/);
        const date = dateMatch?.[1] ?? 'unknown';

        return {
          filePath,
          date,
          size: stats.size,
          createdAt: stats.birthtime,
        };
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Failed to list log files:', error);
      return [];
    }
  }

  /**
   * Read log entries from a specific file
   */
  public readFromFile(filePath: string, limit?: number): LogEntry[] {
    try {
      if (!fs.existsSync(filePath)) return [];

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const entries: LogEntry[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line) as LogEntry;
          entries.push(entry);

          if (limit && entries.length >= limit) break;
        } catch {
          // Skip invalid JSON lines
          continue;
        }
      }

      return entries;
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }

  /**
   * Get total size of all log files in bytes
   */
  public getTotalSize(): number {
    try {
      const files = this.getLogFiles();
      return files.reduce((sum, file) => sum + file.size, 0);
    } catch {
      return 0;
    }
  }

  /**
   * Export logs to a single file
   */
  public exportLogs(outputPath: string, dateFrom?: Date, dateTo?: Date): boolean {
    try {
      const files = this.getLogFiles();
      const allEntries: LogEntry[] = [];

      for (const file of files) {
        const fileDate = new Date(file.date);

        // Filter by date range
        if (dateFrom && fileDate < dateFrom) continue;
        if (dateTo && fileDate > dateTo) continue;

        const entries = this.readFromFile(file.filePath);
        allEntries.push(...entries);
      }

      // Sort by timestamp
      allEntries.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Write to output file
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const content = allEntries
        .map(e => JSON.stringify(e))
        .join('\n');

      fs.writeFileSync(outputPath, content, 'utf-8');

      return true;
    } catch (error) {
      console.error('Failed to export logs:', error);
      return false;
    }
  }
}

/**
 * Global persistence instance
 */
let persistenceInstance: LogPersistence | null = null;

/**
 * Get or create global persistence instance
 */
export function getPersistence(options?: PersistenceOptions): LogPersistence {
  if (!persistenceInstance) {
    persistenceInstance = new LogPersistence(options);
  }
  return persistenceInstance;
}

/**
 * Enable file persistence for the logger
 */
export function enableFilePersistence(options: PersistenceOptions = {}): void {
  const persistence = getPersistence(options);

  // Cleanup old files on startup
  persistence.cleanup();
}
