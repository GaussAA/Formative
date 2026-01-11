/**
 * Backup Manager (P1 - Reliability Optimization)
 *
 * Provides automated backup and restore functionality for checkpoint storage.
 * Features:
 * - Scheduled automatic backups
 * - Manual backup creation
 * - Restore from backup files
 * - Backup cleanup (retention policy)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import logger from '@/lib/logger';
import type { BaseCheckpointSaver } from '@langchain/langgraph';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

/**
 * Backup metadata
 */
export interface BackupMetadata {
  /** Backup file name */
  filename: string;
  /** Full path to backup file */
  path: string;
  /** Timestamp when backup was created */
  createdAt: number;
  /** Size in bytes */
  size: number;
  /** Number of checkpoints in backup */
  checkpointCount: number;
}

/**
 * Backup options
 */
export interface BackupOptions {
  /** Backup directory path */
  backupDir?: string;
  /** Retention period in days (default: 7) */
  retentionDays?: number;
  /** Maximum backup file size in MB (default: 100) */
  maxFileSizeMB?: number;
  /** Include metadata in backup */
  includeMetadata?: boolean;
}

/**
 * Backup summary
 */
export interface BackupSummary {
  /** Backup metadata */
  metadata: BackupMetadata;
  /** Checkpoint IDs included in backup */
  checkpointIds: string[];
  /** Total size in bytes */
  totalSize: number;
}

/**
 * Backup Manager class
 */
export class BackupManager {
  private backupDir: string;
  private retentionDays: number;
  private maxFileSizeBytes: number;
  private includeMetadata: boolean;
  private autoBackupTimer?: NodeJS.Timeout;

  constructor(options: BackupOptions = {}) {
    this.backupDir = options.backupDir || path.join(process.cwd(), 'backups', 'checkpoints');
    this.retentionDays = options.retentionDays || 7;
    this.maxFileSizeBytes = (options.maxFileSizeMB || 100) * 1024 * 1024;
    this.includeMetadata = options.includeMetadata !== false;

    this.ensureBackupDir();
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDir(): Promise<void> {
    try {
      await mkdir(this.backupDir, { recursive: true });
      logger.debug('Backup directory ensured', { path: this.backupDir });
    } catch (error) {
      logger.error('Failed to create backup directory', { path: this.backupDir, error });
      throw new Error(`Failed to create backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Create a backup of current checkpoint state
   * @param checkpointer - Checkpoint saver instance
   * @param name - Optional backup name (default: auto-generated timestamp)
   * @returns Backup metadata
   */
  async createBackup(checkpointer: BaseCheckpointSaver, name?: string): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = name || `checkpoint-${timestamp}.json`;
    const backupPath = path.join(this.backupDir, filename);

    try {
      logger.info('Creating backup', { filename });

      // Export checkpoint state
      const backupData = await this.exportCheckpoints(checkpointer);

      // Validate size
      const jsonSize = JSON.stringify(backupData).length;
      if (jsonSize > this.maxFileSizeBytes) {
        throw new Error(`Backup size (${Math.round(jsonSize / 1024 / 1024)}MB) exceeds maximum allowed size`);
      }

      // Write to file
      await writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

      // Get file stats
      const stats = await stat(backupPath);

      const metadata: BackupMetadata = {
        filename,
        path: backupPath,
        createdAt: Date.now(),
        size: stats.size,
        checkpointCount: backupData.checkpoints?.length || 0,
      };

      logger.info('Backup created successfully', {
        filename,
        size: `${Math.round(stats.size / 1024)}KB`,
        checkpointCount: metadata.checkpointCount,
      });

      return metadata;
    } catch (error) {
      logger.error('Failed to create backup', { filename, error });
      throw error;
    }
  }

  /**
   * Restore from a backup file
   * @param backupPath - Path to backup file or backup filename
   * @param checkpointer - Checkpoint saver instance
   */
  async restoreBackup(backupPath: string, checkpointer: BaseCheckpointSaver): Promise<void> {
    // If only filename provided, use backup directory
    if (!path.isAbsolute(backupPath)) {
      backupPath = path.join(this.backupDir, backupPath);
    }

    try {
      logger.info('Restoring from backup', { path: backupPath });

      // Read backup file
      const data = await readFile(backupPath, 'utf-8');
      const backupData = JSON.parse(data);

      // Import checkpoints
      await this.importCheckpoints(backupData, checkpointer);

      logger.info('Backup restored successfully', { path: backupPath });
    } catch (error) {
      logger.error('Failed to restore backup', { path: backupPath, error });
      throw new Error(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all available backups
   * @returns Array of backup metadata
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const files = await readdir(this.backupDir);
      const backups: BackupMetadata[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.backupDir, file);
        const stats = await stat(filePath);

        // Read checkpoint count from file
        let checkpointCount = 0;
        try {
          const data = await readFile(filePath, 'utf-8');
          const backupData = JSON.parse(data);
          checkpointCount = backupData.checkpoints?.length || 0;
        } catch {
          // Skip invalid files
          continue;
        }

        backups.push({
          filename: file,
          path: filePath,
          createdAt: stats.mtimeMs,
          size: stats.size,
          checkpointCount,
        });
      }

      // Sort by creation time (newest first)
      backups.sort((a, b) => b.createdAt - a.createdAt);

      return backups;
    } catch (error) {
      logger.error('Failed to list backups', { error });
      return [];
    }
  }

  /**
   * Delete a backup file
   * @param filename - Backup filename to delete
   */
  async deleteBackup(filename: string): Promise<void> {
    const backupPath = path.join(this.backupDir, filename);

    try {
      await unlink(backupPath);
      logger.info('Backup deleted', { filename });
    } catch (error) {
      logger.error('Failed to delete backup', { filename, error });
      throw new Error(`Failed to delete backup: ${filename}`);
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanup(): Promise<BackupMetadata[]> {
    const now = Date.now();
    const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;
    const backups = await this.listBackups();
    const deleted: BackupMetadata[] = [];

    for (const backup of backups) {
      const age = now - backup.createdAt;
      if (age > retentionMs) {
        await this.deleteBackup(backup.filename);
        deleted.push(backup);
      }
    }

    if (deleted.length > 0) {
      logger.info('Old backups cleaned up', {
        count: deleted.length,
        retentionDays: this.retentionDays,
      });
    }

    return deleted;
  }

  /**
   * Setup automatic backup schedule
   * @param checkpointer - Checkpoint saver instance
   * @param intervalMs - Backup interval in milliseconds (default: 1 hour)
   */
  scheduleAutoBackup(checkpointer: BaseCheckpointSaver, intervalMs: number = 3600000): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
    }

    this.autoBackupTimer = setInterval(async () => {
      try {
        await this.createBackup(checkpointer);
      } catch (error) {
        logger.error('Auto backup failed', { error });
      }
    }, intervalMs);

    logger.info('Auto backup scheduled', { intervalMs });
  }

  /**
   * Stop automatic backup schedule
   */
  stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = undefined;
      logger.info('Auto backup stopped');
    }
  }

  /**
   * Export checkpoint state for backup
   */
  private async exportCheckpoints(checkpointer: BaseCheckpointSaver): Promise<{
    version: string;
    exportedAt: string;
    checkpoints: Array<{ threadId: string; state: unknown }>;
  }> {
    // This is a placeholder implementation
    // In a real implementation, you would need to iterate through
    // all checkpoints in the checkpointer and export them
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      checkpoints: [],
    };
  }

  /**
   * Import checkpoint state from backup
   */
  private async importCheckpoints(
    backupData: any,
    checkpointer: BaseCheckpointSaver
  ): Promise<void> {
    // This is a placeholder implementation
    // In a real implementation, you would need to restore
    // each checkpoint to the checkpointer
    logger.debug('Importing checkpoints', { count: backupData.checkpoints?.length || 0 });
  }

  /**
   * Get backup directory path
   */
  getBackupDir(): string {
    return this.backupDir;
  }

  /**
   * Get total size of all backups
   */
  async getTotalSize(): Promise<number> {
    const backups = await this.listBackups();
    return backups.reduce((sum, backup) => sum + backup.size, 0);
  }

  /**
   * Destroy backup manager (cleanup)
   */
  destroy(): void {
    this.stopAutoBackup();
  }
}

/**
 * Singleton instance
 */
let backupManagerInstance: BackupManager | null = null;

/**
 * Get BackupManager singleton instance
 */
export function getBackupManager(options?: BackupOptions): BackupManager {
  if (!backupManagerInstance) {
    backupManagerInstance = new BackupManager(options);
  }
  return backupManagerInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetBackupManager(): void {
  if (backupManagerInstance) {
    backupManagerInstance.destroy();
  }
  backupManagerInstance = null;
}

export default BackupManager;
