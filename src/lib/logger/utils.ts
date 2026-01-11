/**
 * Logger Utilities
 *
 * Provides utility functions for log formatting, sensitive data masking,
 * and source code location tracking.
 */

import type { LogEntry } from './index';

/**
 * ANSI color codes for console output
 */
const COLORS = {
  DEBUG: '\x1b[36m', // Cyan
  INFO: '\x1b[32m', // Green
  WARN: '\x1b[33m', // Yellow
  ERROR: '\x1b[31m', // Red
  CRITICAL: '\x1b[35m', // Magenta
  RESET: '\x1b[0m',
  DIM: '\x1b[90m', // Gray
} as const;

/**
 * Masking rules for sensitive data
 */
const MASKING_RULES: Array<{
  pattern: RegExp;
  mask: string;
}> = [
  // Chinese mobile numbers: 13812345678 -> 138****5678
  {
    pattern: /\b(1[3-9]\d)\d{4}(\d{4})\b/g,
    mask: '$1****$2',
  },
  // Email addresses: user@example.com -> u***@example.com
  {
    pattern: /\b([a-zA-Z0-9])[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    mask: '$1***@$2',
  },
  // API Keys (sk- prefix) - handle various lengths
  {
    pattern: /\b(sk-[a-zA-Z0-9]{8,})\b/gi,
    mask: 'sk-******',
  },
  // Bearer tokens: Bearer xxxxx -> Bearer ******
  {
    pattern: /\b(Bearer\s+[a-zA-Z0-9._-]{5,})\b/gi,
    mask: 'Bearer ******',
  },
  // Password fields in JSON: "password": "secret" -> "password": "***"
  {
    pattern: /"password"\s*:\s*"[^"]*"/gi,
    mask: '"password":"***"',
  },
  // Generic secret/api-key fields
  {
    pattern: /"(?:api_?key|secret|token)"\s*:\s*"[^"]{4,}"/gi,
    mask: '"$1":"***"',
  },
];

/**
 * Format log entry for development environment (readable with colors)
 *
 * @param entry - The log entry to format
 * @returns Formatted string for console output
 */
export function formatForDevelopment(entry: LogEntry): string {
  const color = COLORS[entry.level as keyof typeof COLORS] || COLORS.RESET;

  // Format timestamp as HH:MM:SS.mmm manually for compatibility
  const date = new Date(entry.timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  const time = `${hours}:${minutes}:${seconds}.${ms}`;

  // Build parts array
  const parts: string[] = [
    `${color}[${entry.level.padEnd(8)}]${COLORS.RESET}`,
    time,
    entry.message,
  ];

  // Add source if available (grayed out)
  if (entry.source) {
    parts.push(`${COLORS.DIM}${entry.source}${COLORS.RESET}`);
  }

  // Add context as formatted JSON
  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context, null, 2));
  }

  // Add error details if present
  if (entry.error) {
    parts.push(`\n${COLORS.DIM}  Error: ${entry.error.message}${COLORS.RESET}`);
    if (entry.error.stack) {
      parts.push(
        `\n${COLORS.DIM}  Stack: ${entry.error.stack.split('\n').join('\n    ')}${COLORS.RESET}`
      );
    }
  }

  return parts.join(' ');
}

/**
 * Format log entry for production environment (single-line JSON)
 *
 * @param entry - The log entry to format
 * @returns JSON string for log aggregation systems
 */
export function formatForProduction(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Mask sensitive data in the input value
 *
 * @param input - The value to mask (string, object, or array)
 * @returns The value with sensitive data masked
 */
export function maskSensitiveData(input: unknown): unknown {
  // String masking
  if (typeof input === 'string') {
    let masked = input;
    for (const rule of MASKING_RULES) {
      masked = masked.replace(rule.pattern, rule.mask);
    }
    return masked;
  }

  // Array masking (recursive)
  if (Array.isArray(input)) {
    return input.map(maskSensitiveData);
  }

  // Object masking (recursive)
  if (typeof input === 'object' && input !== null) {
    const maskedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      // Skip already masked fields
      if (key.endsWith('_masked')) {
        maskedObj[key] = value;
        continue;
      }
      // Recursively mask nested values
      maskedObj[key] = maskSensitiveData(value);
    }
    return maskedObj;
  }

  // Primitive types (number, boolean, null, undefined) - return as-is
  return input;
}

/**
 * Extract caller information from the call stack
 *
 * @param skipFrames - Number of stack frames to skip (default: 3 for internal calls)
 * @returns Source location string in format "src/path/file.ts:functionName" or undefined
 */
export function getCallerInfo(skipFrames: number = 3): string | undefined {
  const error = new Error();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stack = (error as any).stack;
  if (!stack) return undefined;

  const lines = stack.split('\n');
  // Find the caller line (skip Error constructor, getCallerInfo, log method, and public method)
  const callerLine = lines[skipFrames];
  if (!callerLine) return undefined;

  // Match various stack trace formats:
  // - Node.js: "at functionName (/path/to/file.ts:123:45)"
  // - Node.js anonymous: "at /path/to/file.ts:123:45"
  const match = callerLine.match(
    /at\s+(?:async\s+)?(?:(.+?)\s+)?\((.+?):(\d+):\d+\)|at\s+(.+?):(\d+):\d+/
  );

  if (!match) return undefined;

  const functionName = match[1] || match[4] || '<anonymous>';
  const filename = match[2] || match[5] || '';

  // Convert absolute path to project-relative path
  const relativePath = filename
    .replace(/.*[\/\\]src[\/\\]/, 'src/')
    .replace(/.*[\/\\]node_modules[\/\\]/, 'node_modules/');

  return `${relativePath}:${functionName}`;
}

/**
 * Check if the current environment is development
 *
 * @returns true if running in development environment
 */
export function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get the appropriate minimum log level based on environment
 *
 * @returns LogLevel.INFO in production, LogLevel.DEBUG in development
 */
export function getDefaultMinLevel(): number {
  return isDevelopmentEnvironment() ? 0 : 1; // DEBUG or INFO
}
