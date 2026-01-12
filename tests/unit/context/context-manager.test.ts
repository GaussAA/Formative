/**
 * Unit tests for ContextManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '@/lib/context/context-manager';
import type { BuildContextParams, ConversationMessage } from '@/types';

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager({
      maxTokens: 10000,
      reserveForResponse: 2000,
      compressionThreshold: 0.7,
    });
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const defaultManager = new ContextManager();
      const stats = defaultManager.getStats();

      expect(stats.messageCount).toBe(0);
      expect(stats.totalTokens).toBe(0);
    });

    it('should initialize with custom values', () => {
      const customManager = new ContextManager({
        maxTokens: 5000,
        reserveForResponse: 1000,
      });

      const stats = customManager.getStats();
      expect(stats.availableTokens).toBe(4000); // 5000 - 1000
    });
  });

  describe('buildContext', () => {
    it('should build context with system prompt', async () => {
      const params: BuildContextParams = {
        systemPrompt: 'You are a helpful assistant.',
      };

      const result = await manager.buildContext(params);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[0].content).toContain('You are a helpful assistant.');
    });

    it('should build context with conversation history', async () => {
      const history: ConversationMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const params: BuildContextParams = {
        systemPrompt: 'System prompt',
        conversationHistory: history,
      };

      const result = await manager.buildContext(params);

      expect(result.messages.length).toBeGreaterThan(1);
      expect(result.messages.some(m => m.role === 'user')).toBe(true);
    });

    it('should include schema in system prompt', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const params: BuildContextParams = {
        systemPrompt: 'System prompt',
        schema,
      };

      const result = await manager.buildContext(params);

      expect(result.messages[0].content).toContain('Response Format');
      expect(result.messages[0].content).toContain('JSON');
    });

    it('should include examples in context', async () => {
      const examples = [
        { input: 'test', output: 'result' },
        { input: 'another', output: 'another result' },
      ];

      const params: BuildContextParams = {
        systemPrompt: 'System prompt',
        examples,
      };

      const result = await manager.buildContext(params);

      const systemMessages = result.messages.filter(m => m.role === 'system');
      expect(systemMessages.some(m => m.content.includes('Examples'))).toBe(true);
    });

    it('should respect max tokens limit', async () => {
      const longHistory: ConversationMessage[] = Array(100).fill(null).map((_, i) => ({
        role: 'user' as const,
        content: `Long message number ${i} with lots of repeated content to fill space. `,
      }));

      const params: BuildContextParams = {
        systemPrompt: 'System prompt',
        conversationHistory: longHistory,
        maxTokens: 1000,
      };

      const result = await manager.buildContext(params);

      // Should select fewer messages due to token limit
      expect(result.conversationHistory.length).toBeLessThan(longHistory.length);
    });

    it('should calculate token usage correctly', async () => {
      const params: BuildContextParams = {
        systemPrompt: 'System prompt',
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      };

      const result = await manager.buildContext(params);

      expect(result.tokenUsage).toHaveProperty('system');
      expect(result.tokenUsage).toHaveProperty('examples');
      expect(result.tokenUsage).toHaveProperty('conversation');
      expect(result.tokenUsage).toHaveProperty('total');
      expect(result.tokenUsage).toHaveProperty('remaining');
      expect(result.tokenUsage.total).toBeGreaterThan(0);
    });

    it('should include stats in result', async () => {
      const params: BuildContextParams = {
        systemPrompt: 'System prompt',
      };

      const result = await manager.buildContext(params);

      expect(result.stats).toHaveProperty('messageCount');
      expect(result.stats).toHaveProperty('totalTokens');
      expect(result.stats).toHaveProperty('availableTokens');
    });
  });

  describe('addMessage', () => {
    it('should add message to history', async () => {
      const message: ConversationMessage = { role: 'user', content: 'Test message' };

      await manager.addMessage(message);

      const stats = manager.getStats();
      expect(stats.messageCount).toBe(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear all messages', async () => {
      await manager.addMessage({ role: 'user', content: 'Test 1' });
      await manager.addMessage({ role: 'user', content: 'Test 2' });

      let stats = manager.getStats();
      expect(stats.messageCount).toBe(2);

      manager.clearHistory();

      stats = manager.getStats();
      expect(stats.messageCount).toBe(0);
    });
  });

  describe('compressContext', () => {
    it('should return empty string for no messages', async () => {
      const compressed = await manager.compressContext();
      expect(compressed).toBe('');
    });

    it('should compress conversation history', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I need help with requirements' },
        { role: 'assistant', content: 'I will help you with that' },
        { role: 'user', content: 'The requirements are for authentication' },
        { role: 'assistant', content: 'Authentication requires user login' },
      ];

      for (const message of messages) {
        await manager.addMessage(message);
      }

      const compressed = await manager.compressContext();

      expect(compressed).toBeTruthy();
      expect(compressed.length).toBeGreaterThan(0);
      // Compressed should be shorter than original
      const originalLength = messages.map(m => m.content).join('').length;
      expect(compressed.length).toBeLessThan(originalLength);
    });
  });

  describe('getStats', () => {
    it('should return zero stats for new manager', () => {
      const stats = manager.getStats();

      expect(stats.messageCount).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.availableTokens).toBe(8000); // 10000 - 2000
      expect(stats.compressionRatio).toBeGreaterThanOrEqual(0);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });

    it('should return updated stats after adding messages', async () => {
      await manager.addMessage({ role: 'user', content: 'Test message with content' });

      const stats = manager.getStats();

      expect(stats.messageCount).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
    });
  });
});
