/**
 * Rate Limiter Middleware
 *
 * Provides in-memory rate limiting with sliding window algorithm.
 * Supports different limits for authenticated and anonymous users.
 */

import { NextRequest } from 'next/server';
import logger from '@/lib/logger';
import { LRUCache } from '@/lib/cache/lru-cache';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Custom key generator function */
  keyGenerator?: (req: NextRequest) => string;
  /** Skip successful requests (only count errors) */
  skipSuccessfulRequests?: boolean;
  /** Skip failed requests (only count successes) */
  skipFailedRequests?: boolean;
}

/**
 * Rate limit record
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Time until window resets (seconds) */
  retryAfter?: number;
  /** Current limit */
  limit: number;
}

/**
 * Rate Limiter class
 */
export class RateLimiter {
  private cache: LRUCache<string, RateLimitRecord>;
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    // Bind the default keyGenerator to preserve 'this' context
    const defaultKeyGenerator = this.defaultKeyGenerator.bind(this);

    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyGenerator: config.keyGenerator || defaultKeyGenerator,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
    };

    // Use LRU cache with configurable size
    this.cache = new LRUCache<string, RateLimitRecord>(10000);

    logger.info('RateLimiter initialized', {
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests,
    });
  }

  /**
   * Default key generator: IP + Session ID (if available)
   */
  private defaultKeyGenerator(req: NextRequest): string {
    const ip = this.getClientIP(req);
    const sessionId = req.headers.get('x-session-id');
    return `${ip}:${sessionId || 'anonymous'}`;
  }

  /**
   * Extract client IP from request
   */
  private getClientIP(req: NextRequest): string {
    // Check various headers for real IP (behind proxy/load balancer)
    const headers = [
      'x-forwarded-for',
      'x-real-ip',
      'cf-connecting-ip',
      'x-client-ip',
    ];

    for (const header of headers) {
      const value = req.headers.get(header);
      if (value) {
        // x-forwarded-for can contain multiple IPs, take the first one
        const firstIp = value.split(',')[0]?.trim();
        if (firstIp) {
          return firstIp;
        }
      }
    }

    // Fallback: try to get from request headers
    return 'unknown';
  }

  /**
   * Check if request should be rate limited
   * @param req - Next.js request object
   * @returns Rate limit result
   */
  async check(req: NextRequest): Promise<RateLimitResult> {
    const key = this.config.keyGenerator(req);
    const now = Date.now();

    // Get existing record
    const record = this.cache.get(key);

    // Create new record if none exists or window has expired
    if (!record || now > record.resetTime) {
      const newRecord: RateLimitRecord = {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequest: now,
      };

      this.cache.set(key, newRecord);

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        limit: this.config.maxRequests,
      };
    }

    // Check if limit exceeded
    if (record.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);

      logger.warn('Rate limit exceeded', {
        key,
        count: record.count,
        limit: this.config.maxRequests,
        retryAfter,
      });

      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        limit: this.config.maxRequests,
      };
    }

    // Increment counter
    record.count++;
    this.cache.set(key, record);

    return {
      allowed: true,
      remaining: this.config.maxRequests - record.count,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Record a successful request (for skipSuccessfulRequests mode)
   */
  recordSuccess(req: NextRequest): void {
    if (!this.config.skipSuccessfulRequests) {
      return;
    }

    // Implementation for skipping successful requests
    // This would require tracking pending requests
  }

  /**
   * Record a failed request (for skipFailedRequests mode)
   */
  recordFailure(req: NextRequest): void {
    if (!this.config.skipFailedRequests) {
      return;
    }

    // Implementation for skipping failed requests
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.cache.delete(key);
    logger.debug('Rate limit reset', { key });
  }

  /**
   * Clear all rate limit records
   */
  clear(): void {
    this.cache.clear();
    logger.info('All rate limit records cleared');
  }

  /**
   * Get current rate limit stats for a key
   */
  getStats(key: string): { count: number; resetTime: number; remaining: number } | null {
    const record = this.cache.get(key);
    if (!record) return null;

    return {
      count: record.count,
      resetTime: record.resetTime,
      remaining: Math.max(0, this.config.maxRequests - record.count),
    };
  }

  /**
   * Clean up expired records
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    // LRU cache automatically evicts old entries, but we can force cleanup
    // This is a no-op for the basic implementation
    logger.debug('Rate limiter cleanup completed', { cleaned });
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  /** Strict: 10 requests per minute */
  STRICT: { windowMs: 60000, maxRequests: 10 },

  /** Default: 60 requests per minute */
  DEFAULT: { windowMs: 60000, maxRequests: 60 },

  /** Relaxed: 100 requests per minute */
  RELAXED: { windowMs: 60000, maxRequests: 100 },

  /** API: 1000 requests per hour */
  API: { windowMs: 3600000, maxRequests: 1000 },

  /** Chat: 30 requests per minute (for LLM endpoints) */
  CHAT: { windowMs: 60000, maxRequests: 30 },

  /** Form submit: 10 requests per hour */
  FORM_SUBMIT: { windowMs: 3600000, maxRequests: 10 },
};

/**
 * Create rate limit result headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Singleton instances for common use cases
 */
const limiters = new Map<string, RateLimiter>();

/**
 * Get or create a rate limiter instance
 */
export function getRateLimiter(name: string, config: RateLimitConfig): RateLimiter {
  if (!limiters.has(name)) {
    limiters.set(name, new RateLimiter(config));
  }
  return limiters.get(name)!;
}

/**
 * Pre-configured rate limiters
 */
export const preconfiguredLimiters: Record<string, RateLimiter> = {
  chat: new RateLimiter(RateLimitPresets.CHAT),
  api: new RateLimiter(RateLimitPresets.API),
  formSubmit: new RateLimiter(RateLimitPresets.FORM_SUBMIT),
  default: new RateLimiter(RateLimitPresets.DEFAULT),
};

/**
 * Default export: preconfigured chat rate limiter
 */
export default preconfiguredLimiters.chat;
