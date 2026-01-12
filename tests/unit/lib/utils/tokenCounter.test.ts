import { describe, it, expect, vi, beforeEach } from 'vitest';
import { estimateTokens, logTokenUsage, formatTokenCount } from '@/lib/utils/tokenCounter';

describe('tokenCounter', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for undefined input', () => {
      // @ts-expect-error - testing undefined input
      expect(estimateTokens()).toBe(0);
    });

    it('should estimate Chinese text correctly (~2 chars/token)', () => {
      // 4 Chinese characters = 2 tokens
      expect(estimateTokens('你好世界')).toBe(2);
      // 5 Chinese characters = 3 tokens (Math.ceil)
      expect(estimateTokens('你好世界好')).toBe(3);
    });

    it('should estimate English text correctly (~4 chars/token)', () => {
      // "Hello" (5 chars) = 2 tokens
      expect(estimateTokens('Hello')).toBe(2);
      // "Hello World" (11 chars) = 3 tokens
      expect(estimateTokens('Hello World')).toBe(3);
    });

    it('should estimate mixed text correctly', () => {
      // "Hello你好" = 5 English + 2 Chinese = 1.25 + 1 = 2.25 -> 3 tokens
      expect(estimateTokens('Hello你好')).toBe(3);
      // "Hi世界" = 2 English + 2 Chinese = 0.5 + 1 = 1.5 -> 2 tokens
      expect(estimateTokens('Hi世界')).toBe(2);
    });

    it('should handle special characters and spaces', () => {
      // Special characters are treated as non-Chinese
      expect(estimateTokens('!@#$%')).toBe(2);
      // Spaces are included in otherChars
      expect(estimateTokens('   ')).toBe(1);
    });

    it('should handle numbers correctly', () => {
      // Numbers are non-Chinese
      expect(estimateTokens('12345678')).toBe(2);
    });

    it('should handle very long strings', () => {
      const longText = '你好'.repeat(100); // 200 Chinese chars = 100 tokens
      expect(estimateTokens(longText)).toBe(100);
    });
  });

  describe('formatTokenCount', () => {
    it('should return string as-is for small numbers', () => {
      expect(formatTokenCount(0)).toBe('0');
      expect(formatTokenCount(1)).toBe('1');
      expect(formatTokenCount(999)).toBe('999');
    });

    it('should format 1000+ numbers with k suffix', () => {
      expect(formatTokenCount(1000)).toBe('1.0k');
      expect(formatTokenCount(1500)).toBe('1.5k');
      expect(formatTokenCount(1999)).toBe('2.0k');
      expect(formatTokenCount(12345)).toBe('12.3k');
    });

    it('should round to one decimal place', () => {
      expect(formatTokenCount(1234)).toBe('1.2k');
      expect(formatTokenCount(1555)).toBe('1.6k');
      expect(formatTokenCount(9999)).toBe('10.0k');
    });

    it('should handle very large numbers', () => {
      expect(formatTokenCount(100000)).toBe('100.0k');
      expect(formatTokenCount(1234567)).toBe('1234.6k');
    });
  });

  describe('logTokenUsage', () => {
    let mockLogger: Pick<Console, 'info'>;

    beforeEach(() => {
      mockLogger = { info: vi.fn() as unknown as Console['info'] };
    });

    it('should log token usage with provided logger', () => {
      const prompt = 'Hello 你好';
      const response = 'World 世界';

      logTokenUsage('test-component', prompt, response, mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith('Token usage', {
        component: 'test-component',
        promptTokens: 3, // Hello(2) + 你好(1) = 3
        responseTokens: 3, // World(2) + 世界(1) = 3
        total: 6,
      });
    });

    it('should use console.log when no logger provided', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logTokenUsage('test', 'Hello', 'World');

      expect(consoleSpy).toHaveBeenCalledWith('Token usage', {
        component: 'test',
        promptTokens: 2,
        responseTokens: 2,
        total: 4,
      });

      consoleSpy.mockRestore();
    });

    it('should handle empty strings', () => {
      logTokenUsage('test', '', '', mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith('Token usage', {
        component: 'test',
        promptTokens: 0,
        responseTokens: 0,
        total: 0,
      });
    });

    it('should calculate tokens for long prompts', () => {
      const longPrompt = '你好世界'.repeat(100); // 400 Chinese chars = 200 tokens

      logTokenUsage('test', longPrompt, '', mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith('Token usage', {
        component: 'test',
        promptTokens: 200,
        responseTokens: 0,
        total: 200,
      });
    });
  });
});
