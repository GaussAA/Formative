import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogLevel, type LogEntry } from '@/lib/logger';
import { LogPersistence, enableFilePersistence, getPersistence } from '@/lib/logger/persistence';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Test directory
const TEST_LOG_DIR = path.join(process.cwd(), 'logs', 'test');

describe('LogPersistence', () => {
  let persistence: LogPersistence;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_LOG_DIR, { recursive: true });

    // Create fresh instance for each test
    persistence = new LogPersistence({ directory: TEST_LOG_DIR });
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }
  });

  describe('Constructor', () => {
    it('should create log directory if it does not exist', () => {
      const newDir = path.join(TEST_LOG_DIR, 'new-dir');
      const p = new LogPersistence({ directory: newDir });
      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should use default options', () => {
      const p = new LogPersistence();
      expect(p).toBeDefined();
    });
  });

  describe('write()', () => {
    it('should write log entry to file', () => {
      const entry: LogEntry = {
        timestamp: '2025-01-11T12:34:56.789Z',
        level: 'INFO',
        message: 'Test message',
        context: { key: 'value' },
      };

      persistence.write(entry);

      const files = fs.readdirSync(TEST_LOG_DIR);
      expect(files.length).toBeGreaterThan(0);

      const content = fs.readFileSync(path.join(TEST_LOG_DIR, files[0]), 'utf-8');
      const parsed = JSON.parse(content.trim());
      expect(parsed.message).toBe('Test message');
    });

    it('should create daily log files', () => {
      const today = new Date();
      const expectedFileName = `app-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.log`;

      persistence.write({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Test',
      });

      const files = fs.readdirSync(TEST_LOG_DIR);
      expect(files).toContain(expectedFileName);
    });

    it('should append to existing file', () => {
      const entry1: LogEntry = {
        timestamp: '2025-01-11T12:34:56.789Z',
        level: 'INFO',
        message: 'First message',
      };

      const entry2: LogEntry = {
        timestamp: '2025-01-11T12:34:57.000Z',
        level: 'WARN',
        message: 'Second message',
      };

      persistence.write(entry1);
      persistence.write(entry2);

      const files = fs.readdirSync(TEST_LOG_DIR);
      const content = fs.readFileSync(path.join(TEST_LOG_DIR, files[0]), 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0]).message).toBe('First message');
      expect(JSON.parse(lines[1]).message).toBe('Second message');
    });

    it('should rotate when size limit exceeded', () => {
      const p = new LogPersistence({
        directory: TEST_LOG_DIR,
        maxSizeMB: 0.001, // 1KB for testing
      });

      // Write large entries to exceed limit
      const largeEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'A'.repeat(2000), // Large message
        context: { data: 'B'.repeat(2000) },
      };

      // Write multiple times to trigger rotation
      for (let i = 0; i < 5; i++) {
        p.write(largeEntry);
      }

      const files = fs.readdirSync(TEST_LOG_DIR);
      expect(files.length).toBeGreaterThan(1);
    });

    it('should handle pretty print option', () => {
      const p = new LogPersistence({
        directory: TEST_LOG_DIR,
        prettyPrint: true,
      });

      const entry: LogEntry = {
        timestamp: '2025-01-11T12:34:56.789Z',
        level: 'INFO',
        message: 'Test',
        context: { key: 'value' },
      };

      p.write(entry);

      const files = fs.readdirSync(TEST_LOG_DIR);
      const content = fs.readFileSync(path.join(TEST_LOG_DIR, files[0]), 'utf-8');

      // Pretty printed should have newlines and indentation
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });
  });

  describe('cleanup()', () => {
    it('should remove old log files', () => {
      const p = new LogPersistence({
        directory: TEST_LOG_DIR,
        maxAgeDays: 1,
      });

      // Create old file
      const oldFile = path.join(TEST_LOG_DIR, 'app-2025-01-01.log');
      fs.writeFileSync(oldFile, '{"timestamp":"2025-01-01T00:00:00.000Z","level":"INFO","message":"old"}');
      fs.utimesSync(oldFile, new Date(), new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)); // 2 days old

      // Create recent file
      const recentFile = path.join(TEST_LOG_DIR, 'app-2025-01-11.log');
      fs.writeFileSync(recentFile, '{"timestamp":"2025-01-11T00:00:00.000Z","level":"INFO","message":"recent"}');

      p.cleanup();

      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(recentFile)).toBe(true);
    });

    it('should not remove files newer than max age', () => {
      const p = new LogPersistence({
        directory: TEST_LOG_DIR,
        maxAgeDays: 7,
      });

      // Create recent file
      const recentFile = path.join(TEST_LOG_DIR, 'app-2025-01-11.log');
      fs.writeFileSync(recentFile, '{"timestamp":"2025-01-11T00:00:00.000Z","level":"INFO","message":"recent"}');

      p.cleanup();

      expect(fs.existsSync(recentFile)).toBe(true);
    });
  });

  describe('getLogFiles()', () => {
    it('should return all log files with metadata', () => {
      // Create test files with slight delay to ensure different creation times
      const file1 = path.join(TEST_LOG_DIR, 'app-2025-01-10.log');
      fs.writeFileSync(file1, '{"timestamp":"2025-01-10T00:00:00.000Z","level":"INFO","message":"test1"}');

      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 10) {} // Wait 10ms

      const file2 = path.join(TEST_LOG_DIR, 'app-2025-01-11.log');
      fs.writeFileSync(file2, '{"timestamp":"2025-01-11T00:00:00.000Z","level":"INFO","message":"test2"}');

      const files = persistence.getLogFiles();

      expect(files.length).toBe(2);
      expect(files[0].date).toBe('2025-01-11'); // Sorted by date descending
      expect(files[1].date).toBe('2025-01-10');
      expect(files[0].size).toBeGreaterThan(0);
    });
  });

  describe('readFromFile()', () => {
    it('should read log entries from file', () => {
      const filePath = path.join(TEST_LOG_DIR, 'app-2025-01-11.log');
      const entries = [
        { timestamp: '2025-01-11T12:00:00.000Z', level: 'INFO', message: 'Msg1' },
        { timestamp: '2025-01-11T12:01:00.000Z', level: 'WARN', message: 'Msg2' },
      ];
      fs.writeFileSync(filePath, entries.map(e => JSON.stringify(e)).join('\n'));

      const result = persistence.readFromFile(filePath);

      expect(result.length).toBe(2);
      expect(result[0].message).toBe('Msg1');
      expect(result[1].message).toBe('Msg2');
    });

    it('should respect limit parameter', () => {
      const filePath = path.join(TEST_LOG_DIR, 'app-2025-01-11.log');
      const entries = [
        { timestamp: '2025-01-11T12:00:00.000Z', level: 'INFO', message: 'Msg1' },
        { timestamp: '2025-01-11T12:01:00.000Z', level: 'WARN', message: 'Msg2' },
        { timestamp: '2025-01-11T12:02:00.000Z', level: 'ERROR', message: 'Msg3' },
      ];
      fs.writeFileSync(filePath, entries.map(e => JSON.stringify(e)).join('\n'));

      const result = persistence.readFromFile(filePath, 2);

      expect(result.length).toBe(2);
    });
  });

  describe('getTotalSize()', () => {
    it('should return total size of all log files', () => {
      const file1 = path.join(TEST_LOG_DIR, 'app-2025-01-10.log');
      const file2 = path.join(TEST_LOG_DIR, 'app-2025-01-11.log');
      fs.writeFileSync(file1, '{"timestamp":"2025-01-10T00:00:00.000Z","level":"INFO","message":"test1"}');
      fs.writeFileSync(file2, '{"timestamp":"2025-01-11T00:00:00.000Z","level":"INFO","message":"test2"}');

      const size = persistence.getTotalSize();
      const expectedSize = fs.statSync(file1).size + fs.statSync(file2).size;

      expect(size).toBe(expectedSize);
    });
  });

  describe('exportLogs()', () => {
    it('should export logs to a single file', () => {
      // Create test files
      const file1 = path.join(TEST_LOG_DIR, 'app-2025-01-10.log');
      const file2 = path.join(TEST_LOG_DIR, 'app-2025-01-11.log');
      fs.writeFileSync(file1, '{"timestamp":"2025-01-10T12:00:00.000Z","level":"INFO","message":"old"}');
      fs.writeFileSync(file2, '{"timestamp":"2025-01-11T12:00:00.000Z","level":"INFO","message":"new"}');

      const exportPath = path.join(TEST_LOG_DIR, 'export.log');
      const success = persistence.exportLogs(exportPath);

      expect(success).toBe(true);
      expect(fs.existsSync(exportPath)).toBe(true);

      const content = fs.readFileSync(exportPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(2);
    });

    it('should filter by date range', () => {
      const file1 = path.join(TEST_LOG_DIR, 'app-2025-01-05.log');
      const file2 = path.join(TEST_LOG_DIR, 'app-2025-01-10.log');
      const file3 = path.join(TEST_LOG_DIR, 'app-2025-01-15.log');
      fs.writeFileSync(file1, '{"timestamp":"2025-01-05T12:00:00.000Z","level":"INFO","message":"old"}');
      fs.writeFileSync(file2, '{"timestamp":"2025-01-10T12:00:00.000Z","level":"INFO","message":"middle"}');
      fs.writeFileSync(file3, '{"timestamp":"2025-01-15T12:00:00.000Z","level":"INFO","message":"new"}');

      const exportPath = path.join(TEST_LOG_DIR, 'export-filtered.log');
      const dateFrom = new Date('2025-01-08');
      const dateTo = new Date('2025-01-12');
      persistence.exportLogs(exportPath, dateFrom, dateTo);

      const content = fs.readFileSync(exportPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0]).message).toBe('middle');
    });
  });

  describe('getCurrentFileInfo()', () => {
    it('should return current log file info', () => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Test',
      };
      persistence.write(entry);

      const info = persistence.getCurrentFileInfo();

      expect(info).not.toBeNull();
      expect(info?.date).toBe(new Date().toISOString().split('T')[0]);
      expect(info?.size).toBeGreaterThan(0);
    });
  });
});

describe('Logger with File Persistence', () => {
  const testDir = path.join(process.cwd(), 'logs', 'integration-test');

  beforeEach(() => {
    // Unmock the logger for these integration tests
    vi.unmock('@/lib/logger');

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Re-mock the logger after these tests
    vi.doMock('@/lib/logger', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        default: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          agent: vi.fn(),
        },
      };
    });

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should write logs to file when persistence is enabled', () => {
    const logger = new Logger({
      enableFilePersistence: true,
      persistenceOptions: { directory: testDir },
    });

    logger.info('Test message', { key: 'value' });

    const files = fs.readdirSync(testDir);
    expect(files.length).toBeGreaterThan(0);

    const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
    const parsed = JSON.parse(content.trim());
    expect(parsed.message).toBe('Test message');
    expect(parsed.context).toEqual({ key: 'value' });
  });

  it('should not write to file when persistence is disabled', () => {
    const logger = new Logger({
      enableFilePersistence: false,
    });

    logger.info('Test message');

    // Should not create any files in testDir
    expect(fs.existsSync(testDir)).toBe(true);
    expect(fs.readdirSync(testDir).length).toBe(0);
  });

  it('should include traceId in file logs', async () => {
    // Import the trace module functions
    const { runWithTraceId } = await import('@/lib/logger/trace');

    const logger = new Logger({
      enableFilePersistence: true,
      persistenceOptions: { directory: testDir },
    });

    // Use runWithTraceId to set up trace context
    // This should work because runWithTraceId uses AsyncLocalStorage
    // which properly propagates the traceId through the async context
    runWithTraceId('test-trace-123', {}, () => {
      logger.info('Test with trace');
    });

    const files = fs.readdirSync(testDir);
    const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
    const parsed = JSON.parse(content.trim());

    expect(parsed.traceId).toBe('test-trace-123');
  });

  it('should provide file management methods', () => {
    const logger = new Logger({
      enableFilePersistence: true,
      persistenceOptions: { directory: testDir },
    });

    logger.info('Test 1');
    logger.info('Test 2');

    // Test getCurrentLogFileInfo
    const info = logger.getCurrentLogFileInfo();
    expect(info).not.toBeNull();
    expect(info?.size).toBeGreaterThan(0);

    // Test getLogFiles
    const files = logger.getLogFiles();
    expect(files.length).toBeGreaterThan(0);

    // Test getTotalLogSize
    const totalSize = logger.getTotalLogSize();
    expect(totalSize).toBeGreaterThan(0);

    // Test readLogsFromFile
    const entries = logger.readLogsFromFile(files[0].filePath);
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('should export logs via logger instance', () => {
    const logger = new Logger({
      enableFilePersistence: true,
      persistenceOptions: { directory: testDir },
    });

    logger.info('Export test 1');
    logger.info('Export test 2');

    const exportPath = path.join(testDir, 'exported.log');
    const success = logger.exportLogs(exportPath);

    expect(success).toBe(true);
    expect(fs.existsSync(exportPath)).toBe(true);
  });
});

describe('enableFilePersistence()', () => {
  it('should enable persistence globally', () => {
    const testDir = path.join(process.cwd(), 'logs', 'global-test');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // This would normally affect the global singleton
    // For testing purposes, we just verify the function exists and doesn't throw
    expect(() => {
      enableFilePersistence({ directory: testDir });
    }).not.toThrow();

    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});

describe('getPersistence()', () => {
  it('should return singleton instance', () => {
    const instance1 = getPersistence();
    const instance2 = getPersistence();

    expect(instance1).toBe(instance2);
  });

  it('should accept options', () => {
    const testDir = path.join(process.cwd(), 'logs', 'singleton-test');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    const instance = getPersistence({ directory: testDir });
    expect(instance).toBeDefined();

    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});
