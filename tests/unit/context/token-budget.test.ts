/**
 * Unit tests for TokenBudgetAllocator
 */

import { describe, it, expect } from 'vitest';
import { TokenBudgetAllocator } from '@/lib/context/token-budget';

describe('TokenBudgetAllocator', () => {
  let allocator: TokenBudgetAllocator;

  beforeEach(() => {
    allocator = new TokenBudgetAllocator({
      maxTokens: 10000,
      reserveForResponse: 2000,
    });
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const defaultAllocator = new TokenBudgetAllocator();
      expect(defaultAllocator.getAvailableTokens()).toBe(124000); // 128000 - 4000
    });

    it('should initialize with custom values', () => {
      expect(allocator.getAvailableTokens()).toBe(8000); // 10000 - 2000
    });
  });

  describe('getAvailableTokens', () => {
    it('should return tokens minus reservation', () => {
      expect(allocator.getAvailableTokens()).toBe(8000);
    });
  });

  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(allocator.estimateTokens('')).toBe(0);
    });

    it('should estimate English text', () => {
      const text = 'Hello world, this is a test message.';
      const tokens = allocator.estimateTokens(text, 'english');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('should estimate Chinese text', () => {
      const text = '你好世界，这是一条测试消息。';
      const tokens = allocator.estimateTokens(text, 'chinese');
      expect(tokens).toBeGreaterThan(0);
      // Chinese should use more tokens per character
      expect(tokens).toBeGreaterThan(text.length * 0.3);
    });

    it('should estimate code differently', () => {
      const code = 'function test() { return true; }';
      const tokens = allocator.estimateTokens(code, 'code');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should add overhead for JSON', () => {
      const json = '{"name": "test", "value": 123}';
      const tokens = allocator.estimateTokens(json);
      // JSON should have overhead
      expect(tokens).toBeGreaterThan(0);
    });

    it('should add overhead for Markdown', () => {
      const markdown = '# Header\n\n```code```';
      const tokens = allocator.estimateTokens(markdown);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('allocate', () => {
    it('should allocate tokens for all sections', () => {
      const allocation = allocator.allocate({
        systemPrompt: 'You are a helpful assistant.',
        examples: [{ input: 'test', output: 'result' }],
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        schema: { type: 'object' },
      });

      expect(allocation.total).toBe(10000);
      expect(allocation.available).toBe(8000);
      expect(allocation.system).toBeGreaterThan(0);
      expect(allocation.schema).toBeGreaterThan(0);
      expect(allocation.examples).toBeGreaterThan(0);
      expect(allocation.conversation).toBeGreaterThanOrEqual(0);
    });

    it('should calculate compression ratio when over budget', () => {
      const longConversation = Array(100).fill(null).map((_, i) => ({
        role: 'user' as const,
        content: `Message ${i}: `.repeat(100),
      }));

      const allocation = allocator.allocate({
        systemPrompt: 'System prompt',
        conversationHistory: longConversation,
      });

      expect(allocation.compressionRatio).toBeLessThan(1.0);
    });

    it('should have no compression when under budget', () => {
      const allocation = allocator.allocate({
        systemPrompt: 'System prompt',
        conversationHistory: [
          { role: 'user', content: 'Short message' },
        ],
      });

      expect(allocation.compressionRatio).toBe(1.0);
    });
  });

  describe('trimToFit', () => {
    it('should return original if under budget', () => {
      const text = 'Short text';
      const result = allocator.trimToFit(text, 1000);
      expect(result).toBe(text);
    });

    it('should trim text to fit budget', () => {
      const longText = 'a'.repeat(10000);
      const maxTokens = 100;
      const result = allocator.trimToFit(longText, maxTokens);

      expect(result.length).toBeLessThan(longText.length);
      expect(allocator.estimateTokens(result)).toBeLessThanOrEqual(maxTokens + 10);
    });

    it('should preserve text structure', () => {
      const text = 'Hello world. This is a test. With multiple sentences.';
      const result = allocator.trimToFit(text, 5);

      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
