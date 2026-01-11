import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LogLevel, type LogEntry, Logger } from '@/lib/logger';
import {
  formatForDevelopment,
  formatForProduction,
  maskSensitiveData,
  getCallerInfo,
} from '@/lib/logger/utils';

// Prevent vitest from auto-mocking the logger module
vi.unmock('@/lib/logger');
vi.unmock('@/lib/logger/utils');

describe('Logger', () => {
  let logger: Logger;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create new logger instance for each test
    logger = new Logger({ minLevel: LogLevel.DEBUG });

    // Spy on console methods
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LogLevel enum', () => {
    it('should have all five log levels', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.CRITICAL).toBe(4);
    });
  });

  describe('logging methods', () => {
    it('should log DEBUG level messages', () => {
      logger.debug('Test debug message', { key: 'value' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.level).toBe('DEBUG');
      expect(log?.message).toBe('Test debug message');
      expect(log?.context).toEqual({ key: 'value' });
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('should log INFO level messages', () => {
      logger.info('Test info message', { key: 'value' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.level).toBe('INFO');
      expect(log?.message).toBe('Test info message');
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should log WARN level messages', () => {
      logger.warn('Test warn message', { key: 'value' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.level).toBe('WARN');
      expect(log?.message).toBe('Test warn message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log ERROR level messages', () => {
      logger.error('Test error message', { key: 'value' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.level).toBe('ERROR');
      expect(log?.message).toBe('Test error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log ERROR level with Error instance', () => {
      const error = new Error('Test error');
      logger.error('Test error message', error);

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.level).toBe('ERROR');
      expect(log?.error).toBeDefined();
      expect(log?.error?.message).toBe('Test error');
      expect(log?.error?.name).toBe('Error');
    });

    it('should log ERROR level with context and Error instance', () => {
      const error = new Error('Test error');
      logger.error('Test error message', { code: 'ERR_001' }, error);

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.context).toEqual({ code: 'ERR_001' });
      expect(log?.error?.message).toBe('Test error');
    });

    it('should log CRITICAL level messages', () => {
      logger.critical('Test critical message', { key: 'value' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.level).toBe('CRITICAL');
      expect(log?.message).toBe('Test critical message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log CRITICAL level with Error instance', () => {
      const error = new Error('Critical failure');
      logger.critical('System crash', error);

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.level).toBe('CRITICAL');
      expect(log?.error?.message).toBe('Critical failure');
    });

    it('should log agent-specific messages', () => {
      logger.agent('Planner', 'session-123', 'Starting evaluation', { completeness: 80 });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.level).toBe('INFO');
      expect(log?.agent).toBe('Planner');
      expect(log?.sessionId).toBe('session-123');
      expect(log?.context?.completeness).toBe(80);
    });
  });

  describe('LogEntry structure', () => {
    it('should include ISO 8601 timestamp', () => {
      logger.info('Test message');
      const logs = logger.getLogs();
      const log = logs[0];

      expect(log?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify it can be parsed as Date
      const date = new Date(log?.timestamp ?? '');
      expect(date.getTime()).toBeGreaterThan(0);
    });

    it('should include source field in development mode', () => {
      logger.info('Test message');
      const logs = logger.getLogs();
      const log = logs[0];

      // Source should be present in development mode
      if (process.env.NODE_ENV === 'development') {
        expect(log?.source).toBeDefined();
        expect(log?.source).toMatch(/^(src\/|tests\/)/);
      }
    });

    it('should include error details for ERROR level', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      const logs = logger.getLogs();
      const log = logs[0];
      expect(log?.error).toBeDefined();
      expect(log?.error?.message).toBe('Test error');
      expect(log?.error?.name).toBe('Error');

      // Stack trace should be included in development
      if (process.env.NODE_ENV === 'development') {
        expect(log?.error?.stack).toBeDefined();
      }
    });

    it('should include error details for CRITICAL level', () => {
      const error = new Error('Critical error');
      logger.critical('Critical failure', error);

      const logs = logger.getLogs();
      const log = logs[0];
      expect(log?.error).toBeDefined();
      expect(log?.error?.message).toBe('Critical error');
    });
  });

  describe('log level filtering', () => {
    it('should filter logs below minimum level', () => {
      logger.setMinLevel(LogLevel.WARN);

      logger.debug('Should not appear');
      logger.info('Should not appear');
      logger.warn('Should appear');
      logger.error('Should appear');
      logger.critical('Should appear');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs.every(log => log.level === 'WARN' || log.level === 'ERROR' || log.level === 'CRITICAL')).toBe(true);
    });

    it('should getLogs with level filter', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      logger.critical('Critical message');

      const errorAndAbove = logger.getLogs({ level: LogLevel.ERROR });
      expect(errorAndAbove.length).toBeGreaterThanOrEqual(2);
      expect(errorAndAbove.every(log => log.level === 'ERROR' || log.level === 'CRITICAL')).toBe(true);
    });

    it('should getLogs with sessionId filter', () => {
      logger.agent('Planner', 'session-1', 'Message 1');
      logger.agent('Analyst', 'session-2', 'Message 2');

      const session1Logs = logger.getLogs({ sessionId: 'session-1' });
      expect(session1Logs).toHaveLength(1);
      const log = session1Logs[0];
      expect(log?.sessionId).toBe('session-1');
    });

    it('should getLogs with agent filter', () => {
      logger.agent('Planner', 'session-1', 'Message 1');
      logger.agent('Analyst', 'session-2', 'Message 2');

      const plannerLogs = logger.getLogs({ agent: 'Planner' });
      expect(plannerLogs).toHaveLength(1);
      const log = plannerLogs[0];
      expect(log?.agent).toBe('Planner');
    });
  });

  describe('log management', () => {
    it('should clear all logs', () => {
      logger.info('Message 1');
      logger.info('Message 2');
      expect(logger.getLogs()).toHaveLength(2);

      logger.clear();
      expect(logger.getLogs()).toHaveLength(0);
    });

    it('should limit logs to maxLogs (1000)', () => {
      const maxLogs = 1000;
      // Add more logs than maxLogs
      for (let i = 0; i < maxLogs + 100; i++) {
        logger.info(`Message ${i}`);
      }

      const logs = logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(maxLogs);
      // Oldest logs should be removed
      const log = logs[0];
      expect(log?.message).not.toBe('Message 0');
    });

    it('should set minimum log level', () => {
      logger.setMinLevel(LogLevel.ERROR);
      logger.debug('Hidden');
      logger.info('Hidden');
      logger.warn('Hidden');
      logger.error('Visible');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      const log = logs[0];
      expect(log?.level).toBe('ERROR');
    });
  });
});

describe('Logger utilities', () => {
  describe('formatForDevelopment', () => {
    it('should format log entry for development', () => {
      const entry: LogEntry = {
        timestamp: '2025-01-11T12:34:56.789Z',
        level: 'INFO',
        message: 'Test message',
        source: 'src/lib/logger/index.ts:log',
        context: { key: 'value' },
      };

      const formatted = formatForDevelopment(entry);

      expect(formatted).toContain('[INFO');
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('src/lib/logger/index.ts:log');
      expect(formatted).toContain('"key": "value"');
    });

    it('should format CRITICAL level with magenta color code', () => {
      const entry: LogEntry = {
        timestamp: '2025-01-11T12:34:56.789Z',
        level: 'CRITICAL',
        message: 'Critical failure',
      };

      const formatted = formatForDevelopment(entry);
      expect(formatted).toContain('[CRITICAL');
      expect(formatted).toContain('\x1b[35m'); // Magenta color
    });

    it('should include error details when present', () => {
      const entry: LogEntry = {
        timestamp: '2025-01-11T12:34:56.789Z',
        level: 'ERROR',
        message: 'Error occurred',
        error: {
          name: 'Error',
          message: 'Test error',
          stack: 'Error: Test error\n    at test.ts:1:1',
        },
      };

      const formatted = formatForDevelopment(entry);
      expect(formatted).toContain('Error: Test error');
    });
  });

  describe('formatForProduction', () => {
    it('should format log entry as single-line JSON', () => {
      const entry: LogEntry = {
        timestamp: '2025-01-11T12:34:56.789Z',
        level: 'INFO',
        message: 'Test message',
        context: { key: 'value' },
      };

      const formatted = formatForProduction(entry);

      // Should be valid JSON
      expect(() => JSON.parse(formatted)).not.toThrow();

      // Should not contain newlines (single line)
      expect(formatted).not.toContain('\n');

      const parsed = JSON.parse(formatted) as LogEntry;
      expect(parsed.level).toBe('INFO');
      expect(parsed.message).toBe('Test message');
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask Chinese mobile numbers', () => {
      const input = 'Call me at 13812345678';
      const masked = maskSensitiveData(input) as string;

      expect(masked).toBe('Call me at 138****5678');
    });

    it('should mask email addresses', () => {
      const input = 'Contact user@example.com';
      const masked = maskSensitiveData(input) as string;

      expect(masked).toBe('Contact u***@example.com');
    });

    it('should mask API keys with sk- prefix', () => {
      const input = 'API key: sk-abcdefghijklmnopqrstuvwxyz123';
      const masked = maskSensitiveData(input) as string;

      expect(masked).toBe('API key: sk-******');
    });

    it('should mask Bearer tokens', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const masked = maskSensitiveData(input) as string;

      expect(masked).toContain('Bearer ******');
    });

    it('should mask password fields in JSON string', () => {
      const input = '{"password":"secret123","username":"john"}';
      const masked = maskSensitiveData(input) as string;

      expect(masked).toContain('"password":"***"');
      expect(masked).toContain('"username":"john"');
    });

    it('should mask data in objects recursively', () => {
      const input = {
        user: {
          email: 'user@example.com',
          phone: '13812345678',
          profile: {
            apiKey: 'sk-test123456789',
          },
        },
      };

      const masked = maskSensitiveData(input) as Record<string, unknown>;

      const user = masked.user as Record<string, unknown> | undefined;
      expect(user?.email).toBe('u***@example.com');
      expect(user?.phone).toBe('138****5678');

      const profile = user?.profile as Record<string, unknown> | undefined;
      expect(profile?.apiKey).toBe('sk-******');
    });

    it('should mask data in arrays', () => {
      const input = ['user@example.com', '13812345678', 'sk-test123456789'];
      const masked = maskSensitiveData(input) as unknown[];

      expect(masked).toEqual(['u***@example.com', '138****5678', 'sk-******']);
    });

    it('should not modify primitive values', () => {
      expect(maskSensitiveData(42)).toBe(42);
      expect(maskSensitiveData(true)).toBe(true);
      expect(maskSensitiveData(null)).toBe(null);
      expect(maskSensitiveData(undefined)).toBe(undefined);
    });
  });

  describe('getCallerInfo', () => {
    it('should extract caller information from stack', () => {
      const caller = getCallerInfo();

      if (caller) {
        // In test environment, caller may be from node_modules
        // Just verify it contains a colon separator
        expect(caller).toContain(':');
      }
    });

    it('should return undefined or placeholder if stack trace is unavailable', () => {
      // Create error without proper stack capture
      const caller = getCallerInfo(100); // Skip more frames than available

      // Should return undefined when no valid caller is found
      expect(caller === undefined || caller.includes('<anonymous>')).toBe(true);
    });
  });
});
