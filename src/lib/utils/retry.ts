/**
 * Retry utility with exponential backoff
 *
 * P1 Optimization: Added adaptive retry strategy with error classification
 *
 * Provides robust retry logic for network operations and LLM calls
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry (default: 1000ms) */
  initialDelay?: number;
  /** Maximum delay between retries in milliseconds (default: 10000ms) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Callback invoked before each retry attempt */
  onRetry?: (attempt: number, error: Error) => void;
  /** Whether to jitter the delay to avoid thundering herd (default: true) */
  jitter?: boolean;
}

/**
 * P1: Error classification for adaptive retry
 */
export enum ErrorClass {
  /** Errors that should be retried with exponential backoff */
  RETRYABLE = 'retryable',
  /** Errors that should NOT be retried */
  NON_RETRYABLE = 'non_retryable',
  /** Rate limit errors - should be retried with longer delays */
  THROTTLED = 'throttled',
}

/**
 * P1: Adaptive retry options
 */
export interface AdaptiveRetryOptions extends RetryOptions {
  /** Enable adaptive error classification (default: true) */
  adaptive?: boolean;
  /** Custom error classifier function */
  errorClassifier?: (error: Error) => ErrorClass;
  /** Custom delay calculator based on error class */
  delayCalculator?: (
    attempt: number,
    errorClass: ErrorClass,
    baseDelay: number
  ) => number;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  onRetry: () => {},
  jitter: true,
};

/**
 * P1: Default error classifier
 * Classifies errors based on message content and error type
 */
function defaultErrorClassifier(error: Error): ErrorClass {
  const message = error.message.toLowerCase();

  // Rate limit / throttling errors
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429') ||
    message.includes('quota exceeded')
  ) {
    return ErrorClass.THROTTLED;
  }

  // Network / timeout errors (retryable)
  if (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('fetch failed') ||
    message.includes('connection')
  ) {
    return ErrorClass.RETRYABLE;
  }

  // Authentication / authorization errors (non-retryable)
  if (
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('invalid key') ||
    message.includes('invalid token') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return ErrorClass.NON_RETRYABLE;
  }

  // Client errors (4xx) - generally non-retryable
  if (message.includes('400') || message.includes('404') || message.includes('422')) {
    return ErrorClass.NON_RETRYABLE;
  }

  // Server errors (5xx) - retryable
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return ErrorClass.RETRYABLE;
  }

  // Default to retryable for unknown errors
  return ErrorClass.RETRYABLE;
}

/**
 * P1: Default delay calculator based on error class
 */
function defaultDelayCalculator(
  attempt: number,
  errorClass: ErrorClass,
  baseDelay: number
): number {
  switch (errorClass) {
    case ErrorClass.THROTTLED:
      // Use exponential backoff with higher multiplier for throttled requests
      return baseDelay * Math.pow(3, attempt);

    case ErrorClass.RETRYABLE:
      // Standard exponential backoff
      return baseDelay * Math.pow(2, attempt);

    case ErrorClass.NON_RETRYABLE:
    default:
      // Don't delay for non-retryable errors (will be thrown anyway)
      return 0;
  }
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function call
 * @throws The last error if all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => await fetchLLMResponse(prompt),
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}:`, error.message);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<RetryOptions> = {
    maxRetries: options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries,
    initialDelay: options.initialDelay ?? DEFAULT_RETRY_OPTIONS.initialDelay,
    maxDelay: options.maxDelay ?? DEFAULT_RETRY_OPTIONS.maxDelay,
    backoffMultiplier: options.backoffMultiplier ?? DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    onRetry: options.onRetry ?? DEFAULT_RETRY_OPTIONS.onRetry,
    jitter: options.jitter ?? DEFAULT_RETRY_OPTIONS.jitter,
  };

  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this is the last attempt, throw the error
      if (attempt === opts.maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const baseDelay = opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt);
      const cappedDelay = Math.min(baseDelay, opts.maxDelay);

      // Add jitter to avoid thundering herd problem
      const jitterAmount = opts.jitter ? Math.random() * 0.3 * cappedDelay : 0;
      const delay = cappedDelay + jitterAmount;

      // Call onRetry callback
      opts.onRetry(attempt + 1, lastError);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * P1: Retry with adaptive strategy
 *
 * Intelligently classifies errors and adjusts retry behavior:
 * - Throttled errors: Exponential backoff with higher multiplier (3x)
 * - Network errors: Standard exponential backoff (2x)
 * - Authentication errors: Fail immediately (non-retryable)
 *
 * @param fn - The async function to retry
 * @param options - Adaptive retry configuration options
 * @returns The result of the function call
 * @throws The last error if all retry attempts fail or error is non-retryable
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoffAdaptive(
 *   () => fetchLLMResponse(prompt),
 *   {
 *     maxRetries: 3,
 *     adaptive: true,
 *   }
 * );
 * ```
 */
export async function retryWithBackoffAdaptive<T>(
  fn: () => Promise<T>,
  options: AdaptiveRetryOptions = {}
): Promise<T> {
  const adaptive = options.adaptive !== false;
  const errorClassifier = options.errorClassifier || defaultErrorClassifier;
  const delayCalculator = options.delayCalculator || defaultDelayCalculator;

  const opts: Required<RetryOptions> = {
    maxRetries: options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries,
    initialDelay: options.initialDelay ?? DEFAULT_RETRY_OPTIONS.initialDelay,
    maxDelay: options.maxDelay ?? DEFAULT_RETRY_OPTIONS.maxDelay,
    backoffMultiplier: options.backoffMultiplier ?? DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    onRetry: options.onRetry ?? DEFAULT_RETRY_OPTIONS.onRetry,
    jitter: options.jitter ?? DEFAULT_RETRY_OPTIONS.jitter,
  };

  let lastError: Error;
  let currentDelay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Classify error if adaptive mode is enabled
      const errorClass = adaptive ? errorClassifier(lastError) : ErrorClass.RETRYABLE;

      // Fail immediately for non-retryable errors
      if (errorClass === ErrorClass.NON_RETRYABLE) {
        throw lastError;
      }

      // If this is the last attempt, throw the error
      if (attempt === opts.maxRetries) {
        throw lastError;
      }

      // Calculate delay based on error class
      if (adaptive) {
        const baseDelay = opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt);
        currentDelay = delayCalculator(attempt, errorClass, baseDelay);
        currentDelay = Math.min(currentDelay, opts.maxDelay);
      } else {
        currentDelay = opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt);
        currentDelay = Math.min(currentDelay, opts.maxDelay);
      }

      // Add jitter to avoid thundering herd problem
      const jitterAmount = opts.jitter ? Math.random() * 0.3 * currentDelay : 0;
      const delay = currentDelay + jitterAmount;

      // Call onRetry callback
      opts.onRetry(attempt + 1, lastError);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Create a timeout promise that rejects after specified milliseconds
 *
 * @param ms - Timeout in milliseconds
 * @param message - Optional error message
 * @returns A promise that rejects after the timeout
 *
 * @example
 * ```typescript
 * const result = await Promise.race([
 *   fetchLLMResponse(prompt),
 *   createTimeout(30000, 'LLM request timeout')
 * ]);
 * ```
 */
export function createTimeout(ms: number, message: string = `Operation timeout after ${ms}ms`): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Execute a function with a timeout
 *
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Optional custom timeout message
 * @returns The result of the function call
 * @throws Timeout error if the function doesn't complete in time
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => fetchLLMResponse(prompt),
 *   30000,
 *   'LLM request took too long'
 * );
 * ```
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return Promise.race([
    fn(),
    createTimeout(timeoutMs, timeoutMessage),
  ]) as Promise<T>;
}

/**
 * Retry a function with timeout and exponential backoff
 *
 * Combines retry logic with timeout for robust error handling
 *
 * @param fn - The async function to execute
 * @param retryOptions - Retry configuration options
 * @param timeoutMs - Timeout in milliseconds (default: 30000ms)
 * @returns The result of the function call
 * @throws Timeout error or the last retry error
 *
 * @example
 * ```typescript
 * const result = await retryWithTimeout(
 *   () => fetchLLMResponse(prompt),
 *   { maxRetries: 3 },
 *   30000
 * );
 * ```
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  retryOptions: RetryOptions = {},
  timeoutMs: number = 30000
): Promise<T> {
  return retryWithBackoff(
    () => withTimeout(fn, timeoutMs, `Operation timeout after ${timeoutMs}ms`),
    retryOptions
  );
}
