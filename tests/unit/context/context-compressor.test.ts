/**
 * Unit tests for ContextCompressor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextCompressor } from '@/lib/context/context-compressor';
import type { ConversationMessage } from '@/types';

describe('ContextCompressor', () => {
  let compressor: ContextCompressor;

  beforeEach(() => {
    compressor = new ContextCompressor({
      threshold: 0.7,
      strategy: 'hybrid',
    });
  });

  describe('summarize', () => {
    it('should return empty string for empty messages', async () => {
      const summary = await compressor.summarize([]);
      expect(summary).toBe('');
    });

    it('should summarize user messages', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I need help with requirements for my project' },
        { role: 'user', content: 'The requirements are about authentication and authorization' },
      ];

      const summary = await compressor.summarize(messages);

      expect(summary).toBeTruthy();
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should summarize assistant messages', async () => {
      const messages: ConversationMessage[] = [
        { role: 'assistant', content: 'I will implement the authentication system' },
        { role: 'assistant', content: 'I have created the user model and database schema' },
      ];

      const summary = await compressor.summarize(messages);

      expect(summary).toBeTruthy();
      expect(summary.toLowerCase()).toContain('assistant');
    });

    it('should include system instructions', async () => {
      const messages: ConversationMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'system', content: 'Always respond with valid JSON' },
      ];

      const summary = await compressor.summarize(messages);

      expect(summary).toContain('System instructions');
    });
  });

  describe('scoreImportance', () => {
    it('should return scores for all messages', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const scores = await compressor.scoreImportance(messages);

      expect(scores).toHaveLength(2);
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should score system messages higher', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'system', content: 'Important system instruction' },
      ];

      const scores = await compressor.scoreImportance(messages);

      expect(scores[1]).toBeGreaterThan(scores[0]);
    });

    it('should boost score for messages matching query', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I like apples and bananas' },
        { role: 'user', content: 'The weather is nice' },
      ];

      const scores = await compressor.scoreImportance(messages, 'tell me about fruits');

      expect(scores[0]).toBeGreaterThan(scores[1]);
    });

    it('should boost score for questions', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'This is a statement' },
        { role: 'user', content: 'What is the answer?' },
      ];

      const scores = await compressor.scoreImportance(messages);

      expect(scores[1]).toBeGreaterThan(scores[0]);
    });

    it('should boost score for error messages', async () => {
      const messages: ConversationMessage[] = [
        { role: 'assistant', content: 'Everything is fine' },
        { role: 'assistant', content: 'There was an error in the database' },
      ];

      const scores = await compressor.scoreImportance(messages);

      expect(scores[1]).toBeGreaterThan(scores[0]);
    });
  });

  describe('deduplicate', () => {
    it('should return empty array for empty input', async () => {
      const result = await compressor.deduplicate([]);
      expect(result).toEqual([]);
    });

    it('should remove exact duplicates', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello world' },
        { role: 'user', content: 'Hello world' },
        { role: 'assistant', content: 'Hi there' },
      ];

      const result = await compressor.deduplicate(messages);

      expect(result).toHaveLength(2);
    });

    it('should remove near-duplicates', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello world!' },
        { role: 'user', content: 'Hello world' },
        { role: 'user', content: 'HELLO WORLD' },
      ];

      const result = await compressor.deduplicate(messages);

      // Should remove near-duplicates (same meaning, different formatting)
      expect(result.length).toBeLessThan(3);
    });

    it('should keep distinct messages', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'First message' },
        { role: 'user', content: 'Second different message' },
        { role: 'assistant', content: 'Completely different response' },
      ];

      const result = await compressor.deduplicate(messages);

      expect(result).toHaveLength(3);
    });
  });

  describe('compress', () => {
    it('should compress with summary strategy', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I need help with requirements for my project '.repeat(10) },
        { role: 'assistant', content: 'I will help you implement the requirements '.repeat(10) },
      ];

      const result = await compressor.compress({
        messages,
        strategy: 'summary',
      });

      expect(result.messages).toHaveLength(1);
      expect(result.strategy).toBe('summary');
      // For longer messages, compression should reduce size
      expect(result.compressedTokenCount).toBeLessThan(result.originalTokenCount);
    });

    it('should compress with importance strategy', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Important question?' },
        { role: 'user', content: 'less important statement' },
        { role: 'assistant', content: 'Response' },
      ];

      const result = await compressor.compress({
        messages,
        strategy: 'importance',
        targetRatio: 0.5,
      });

      expect(result.messages.length).toBeLessThan(messages.length);
      expect(result.strategy).toBe('importance');
    });

    it('should compress with dedup strategy', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello world' },
        { role: 'user', content: 'Hello world' },
        { role: 'user', content: 'Different message' },
      ];

      const result = await compressor.compress({
        messages,
        strategy: 'dedup',
      });

      expect(result.messages.length).toBeLessThan(messages.length);
      expect(result.strategy).toBe('dedup');
    });

    it('should use hybrid strategy by default', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response' },
      ];

      const result = await compressor.compress({
        messages,
      });

      expect(result.strategy).toBe('hybrid');
    });

    it('should calculate compression ratio correctly', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Long message with lots of content '.repeat(10) },
        { role: 'user', content: 'Another long message '.repeat(10) },
      ];

      const result = await compressor.compress({
        messages,
        targetRatio: 0.5,
      });

      expect(result.compressionRatio).toBeLessThanOrEqual(1.0);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('getCompressionRatio', () => {
    it('should return 1.0 for new compressor', () => {
      const ratio = compressor.getCompressionRatio();
      expect(ratio).toBe(1.0);
    });

    it('should return average ratio after compressions', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'This is a longer message about testing requirements that should compress well '.repeat(5) },
      ];

      await compressor.compress({ messages, targetRatio: 0.5 });
      await compressor.compress({ messages, targetRatio: 0.7 });

      const ratio = compressor.getCompressionRatio();
      expect(ratio).toBeGreaterThan(0);
    });
  });

  describe('getHistory', () => {
    it('should return empty array initially', () => {
      const history = compressor.getHistory();
      expect(history).toEqual([]);
    });

    it('should track compression history', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      await compressor.compress({ messages });

      const history = compressor.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('original');
      expect(history[0]).toHaveProperty('compressed');
      expect(history[0]).toHaveProperty('timestamp');
    });
  });
});
