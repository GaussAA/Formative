/**
 * Logger Module
 * 提供结构化日志记录功能，支持不同级别的日志输出
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  message: string;
  context?: Record<string, unknown>;
  agent?: string;
  sessionId?: string;
}

class Logger {
  private minLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      message,
      context,
    };

    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 控制台输出
    const levelName = LogLevel[level];
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';

    switch (level) {
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        console.debug(`[${levelName}] ${message}${contextStr}`);
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.info(`[${levelName}] ${message}${contextStr}`);
        break;
      case LogLevel.WARN:
        console.warn(`[${levelName}] ${message}${contextStr}`);
        break;
      case LogLevel.ERROR:
        console.error(`[${levelName}] ${message}${contextStr}`);
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, context);
  }

  // Agent专用日志
  agent(agentName: string, sessionId: string, message: string, context?: Record<string, unknown>) {
    this.info(message, {
      ...context,
      agent: agentName,
      sessionId,
    });
  }

  // 获取所有日志
  getLogs(filter?: { level?: LogLevel; sessionId?: string; agent?: string }): LogEntry[] {
    let filtered = this.logs;

    if (filter?.level !== undefined) {
      const filterLevel = filter.level;
      filtered = filtered.filter(log => log.level >= filterLevel);
    }

    if (filter?.sessionId) {
      filtered = filtered.filter(log => log.context?.sessionId === filter.sessionId);
    }

    if (filter?.agent) {
      filtered = filtered.filter(log => log.context?.agent === filter.agent);
    }

    return filtered;
  }

  // 清空日志
  clear() {
    this.logs = [];
  }

  // 设置最小日志级别
  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }
}

// 单例模式
const logger = new Logger(
  process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
);

export default logger;
