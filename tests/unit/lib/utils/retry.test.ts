import { describe, it, expect, vi } from 'vitest';
import {
  retryWithBackoff,
  createTimeout,
  withTimeout,
  retryWithTimeout,
  type RetryOptions,
} from '@/lib/utils/retry';

describe('retry', () => {
  describe('retryWithBackoff', () => {
    it('should return result on first success', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      const result = await retryWithBackoff(mockFn, {
        maxRetries: 3,
        initialDelay: 10,
        onRetry,
      });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exhausted', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('persistent error'));

      await expect(
        retryWithBackoff(mockFn, { maxRetries: 2, initialDelay: 10 })
      ).rejects.toThrow('persistent error');

      expect(mockFn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should call onRetry callback with attempt number and error', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      await retryWithBackoff(mockFn, {
        maxRetries: 3,
        initialDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
      expect(onRetry.mock.calls[0][1]).toBeInstanceOf(Error);
      expect(onRetry.mock.calls[0][1].message).toBe('fail 1');
      expect(onRetry.mock.calls[1][1].message).toBe('fail 2');
    });

    it('should handle zero maxRetries', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('error'));

      await expect(
        retryWithBackoff(mockFn, { maxRetries: 0 })
      ).rejects.toThrow('error');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should use default options when not provided', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
    });

    it('should handle non-Error exceptions', async () => {
      const mockFn = vi.fn().mockRejectedValue('string error');

      await expect(
        retryWithBackoff(mockFn, { maxRetries: 1, initialDelay: 10 })
      ).rejects.toThrow('string error');
    });

    it('should handle null rejection', async () => {
      const mockFn = vi.fn().mockRejectedValue(null);

      await expect(
        retryWithBackoff(mockFn, { maxRetries: 1, initialDelay: 10 })
      ).rejects.toThrow();
    });
  });

  describe('createTimeout', () => {
    it('should reject after specified time', async () => {
      vi.useFakeTimers();

      const timeoutPromise = createTimeout(1000, 'Custom timeout');

      vi.advanceTimersByTimeAsync(1000);

      await expect(timeoutPromise).rejects.toThrow('Custom timeout');

      vi.restoreAllMocks();
    });

    it('should use default message when not provided', async () => {
      vi.useFakeTimers();

      const timeoutPromise = createTimeout(500);

      vi.advanceTimersByTimeAsync(500);

      await expect(timeoutPromise).rejects.toThrow('Operation timeout after 500ms');

      vi.restoreAllMocks();
    });

    it('should reject with Error object', async () => {
      vi.useFakeTimers();

      const timeoutPromise = createTimeout(100);

      vi.advanceTimersByTimeAsync(100);

      try {
        await timeoutPromise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      vi.restoreAllMocks();
    });
  });

  describe('withTimeout', () => {
    it('should return result before timeout', async () => {
      const quickFn = async () => 'quick result';

      const result = await withTimeout(quickFn, 1000);

      expect(result).toBe('quick result');
    });

    it('should timeout if function takes too long', async () => {
      vi.useFakeTimers();

      const slowFn = async () => {
        return new Promise<string>((resolve) => {
          setTimeout(() => resolve('slow result'), 2000);
        });
      };

      const resultPromise = withTimeout(slowFn, 100);

      vi.advanceTimersByTimeAsync(100);

      await expect(resultPromise).rejects.toThrow('Operation timeout after 100ms');

      vi.restoreAllMocks();
    });

    it('should use custom timeout message when provided', async () => {
      vi.useFakeTimers();

      const slowFn = async () => {
        return new Promise<string>(() => {});
      };

      const resultPromise = withTimeout(slowFn, 100, 'Custom timeout message');

      vi.advanceTimersByTimeAsync(100);

      await expect(resultPromise).rejects.toThrow('Custom timeout message');

      vi.restoreAllMocks();
    });

    it('should handle synchronous functions', async () => {
      const syncFn = () => 'sync result';

      const result = await withTimeout(syncFn, 100);

      expect(result).toBe('sync result');
    });

    it('should propagate function errors', async () => {
      const errorFn = async () => {
        throw new Error('Function error');
      };

      await expect(withTimeout(errorFn, 1000)).rejects.toThrow('Function error');
    });
  });

  describe('retryWithTimeout', () => {
    it('should succeed on first try', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await retryWithTimeout(mockFn, {}, 1000);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure with timeout', async () => {
      vi.useFakeTimers();

      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockResolvedValue('success');

      const resultPromise = retryWithTimeout(mockFn, { maxRetries: 2, initialDelay: 10 }, 1000);

      vi.advanceTimersByTimeAsync(20);

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);

      vi.restoreAllMocks();
    });

    it('should propagate retry errors', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('persistent error'));

      await expect(
        retryWithTimeout(mockFn, { maxRetries: 0, initialDelay: 10 }, 1000)
      ).rejects.toThrow('persistent error');
    });
  });
});
