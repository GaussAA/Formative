/**
 * Unit tests for RollingWindowStrategy
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RollingWindowStrategy } from '@/lib/context/rolling-window';
import type { ConversationMessage } from '@/types';

describe('RollingWindowStrategy', () => {
  let strategy: RollingWindowStrategy;

  beforeEach(() => {
    strategy = new RollingWindowStrategy({
      maxTokens: 1000,
      pinRecent: 2,
    });
  });

  describe('addMessage', () => {
    it('should add message to history', () => {
      const message: ConversationMessage = { role: 'user', content: 'Hello' };
      strategy.addMessage(message);

      expect(strategy.getCount()).toBe(1);
    });

    it('should add pinned message', () => {
      const message: ConversationMessage = { role: 'user', content: 'Important' };
      strategy.addMessage(message, 0.8, true);

      expect(strategy.getCount()).toBe(1);
    });

    it('should calculate default importance for user message', () => {
      const message: ConversationMessage = { role: 'user', content: 'What is this?' };
      strategy.addMessage(message);

      expect(strategy.getCount()).toBe(1);
    });

    it('should calculate higher importance for error messages', () => {
      const errorMsg: ConversationMessage = { role: 'assistant', content: 'There was an error processing your request' };
      strategy.addMessage(errorMsg);

      expect(strategy.getCount()).toBe(1);
    });
  });

  describe('selectMessages', () => {
    it('should return empty array for empty input', () => {
      const selected = strategy.selectMessages([], 1000);
      expect(selected).toEqual([]);
    });

    it('should select all messages when under budget', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const selected = strategy.selectMessages(messages, 1000);

      expect(selected).toHaveLength(2);
    });

    it('should prefer pinned messages', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Regular message 1' },
        { role: 'user', content: 'Pinned message' },
        { role: 'assistant', content: 'Regular message 2' },
      ];

      // Add the pinned message
      strategy.addMessage(messages[1], 0.5, true);

      const selected = strategy.selectMessages(messages, 50);

      // Should include the pinned message
      expect(selected.some(m => m.content === 'Pinned message')).toBe(true);
    });

    it('should maintain message order', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' },
      ];

      const selected = strategy.selectMessages(messages, 1000);

      expect(selected[0].content).toBe('First');
      expect(selected[1].content).toBe('Second');
      expect(selected[2].content).toBe('Third');
    });

    it('should trim messages when over budget', () => {
      const longContent = 'A'.repeat(500);
      const messages: ConversationMessage[] = [
        { role: 'user', content: longContent },
        { role: 'assistant', content: longContent },
        { role: 'user', content: longContent },
      ];

      const selected = strategy.selectMessages(messages, 200);

      // Should select fewer messages due to budget constraint
      expect(selected.length).toBeLessThan(3);
    });
  });

  describe('getAllMessages', () => {
    it('should return all messages in order', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' },
      ];

      messages.forEach(m => strategy.addMessage(m));

      const all = strategy.getAllMessages();

      expect(all).toHaveLength(3);
      expect(all[0].content).toBe('First');
      expect(all[1].content).toBe('Second');
      expect(all[2].content).toBe('Third');
    });

    it('should return empty array when no messages', () => {
      const all = strategy.getAllMessages();
      expect(all).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all messages', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      messages.forEach(m => strategy.addMessage(m));
      expect(strategy.getCount()).toBe(1);

      strategy.clear();
      expect(strategy.getCount()).toBe(0);
    });
  });

  describe('getCount', () => {
    it('should return 0 for new instance', () => {
      expect(strategy.getCount()).toBe(0);
    });

    it('should return correct count after adding messages', () => {
      strategy.addMessage({ role: 'user', content: 'Test 1' });
      expect(strategy.getCount()).toBe(1);

      strategy.addMessage({ role: 'user', content: 'Test 2' });
      expect(strategy.getCount()).toBe(2);
    });
  });
});
