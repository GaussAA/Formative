/**
 * Rolling Window Strategy
 *
 * 滚动窗口策略，用于管理对话历史
 * 支持：
 * - 基于重要性的消息选择
 * - 滑动窗口保留最近消息
 * - 关键消息强制保留
 */

import type { ConversationMessage } from '@/types';
import { TokenBudgetAllocator } from './token-budget';
import logger from '@/lib/logger';

/**
 * Message with metadata
 */
interface MessageWithMetadata {
  message: ConversationMessage;
  timestamp: number;
  importance: number;
  isPinned: boolean;
}

/**
 * RollingWindowStrategy options
 */
interface RollingWindowOptions {
  maxTokens?: number;
  pinRecent?: number;
  importanceDecay?: number;
}

/**
 * RollingWindowStrategy
 *
 * 滚动窗口策略实现
 */
export class RollingWindowStrategy {
  private readonly messages: MessageWithMetadata[] = [];
  private readonly tokenBudget: TokenBudgetAllocator;
  private readonly options: Required<RollingWindowOptions>;

  constructor(options?: RollingWindowOptions) {
    this.options = {
      maxTokens: options?.maxTokens || 100000,
      pinRecent: options?.pinRecent || 5,
      importanceDecay: options?.importanceDecay || 0.9,
    };

    this.tokenBudget = new TokenBudgetAllocator({
      maxTokens: this.options.maxTokens,
    });

    logger.debug('RollingWindowStrategy initialized', this.options);
  }

  /**
   * Add message to history
   *
   * @param message - Message to add
   * @param importance - Optional importance score (0-1)
   * @param isPinned - Whether to pin this message
   */
  addMessage(
    message: ConversationMessage,
    importance?: number,
    isPinned?: boolean
  ): void {
    const metadata: MessageWithMetadata = {
      message,
      timestamp: Date.now(),
      importance: importance ?? this.calculateDefaultImportance(message),
      isPinned: isPinned ?? false,
    };

    this.messages.push(metadata);

    logger.debug('Message added to rolling window', {
      role: message.role,
      importance: metadata.importance,
      isPinned: metadata.isPinned,
    });
  }

  /**
   * Select messages to fit within token budget
   *
   * @param messages - Messages to select from
   * @param maxTokens - Maximum tokens allowed
   * @returns Selected messages
   */
  selectMessages(messages: ConversationMessage[], maxTokens: number): ConversationMessage[] {
    if (messages.length === 0) {
      return [];
    }

    // Create temporary metadata for all input messages
    // Use index as timestamp to preserve original order
    const candidatesWithMeta: MessageWithMetadata[] = messages.map((msg, idx) => {
      // Check if message exists in internal state
      const existing = this.messages.find(m => m.message.content === msg.content);
      if (existing) {
        return existing;
      }

      // Create temporary metadata for selection
      return {
        message: msg,
        timestamp: idx, // Use index to preserve order
        importance: this.calculateDefaultImportance(msg),
        isPinned: false,
      };
    });

    // For a simple selection within budget, use FIFO from most recent
    const selected: ConversationMessage[] = [];
    let currentTokens = 0;

    // Process from most recent to oldest
    for (let i = candidatesWithMeta.length - 1; i >= 0; i--) {
      const msg = candidatesWithMeta[i].message;
      const msgTokens = this.tokenBudget.estimateTokens(msg.content);

      if (currentTokens + msgTokens <= maxTokens) {
        selected.unshift(msg);
        currentTokens += msgTokens;
      }

      if (currentTokens >= maxTokens * 0.9) {
        break;
      }
    }

    logger.debug('Messages selected from rolling window', {
      inputCount: messages.length,
      selectedCount: selected.length,
      totalTokens: currentTokens,
    });

    return selected;
  }

  /**
   * Get all messages in history
   *
   * @returns All messages
   */
  getAllMessages(): ConversationMessage[] {
    return this.messages
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(m => m.message);
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages.length = 0;
    logger.debug('Rolling window cleared');
  }

  /**
   * Get message count
   *
   * @returns Number of messages
   */
  getCount(): number {
    return this.messages.length;
  }

  /**
   * Select messages by importance score
   *
   * @private
   */
  private selectByImportance(
    messages: MessageWithMetadata[],
    maxTokens: number
  ): MessageWithMetadata[] {
    // Sort by importance (descending), then by recency
    const sorted = [...messages].sort((a, b) => {
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      return b.timestamp - a.timestamp;
    });

    const selected: MessageWithMetadata[] = [];
    let currentTokens = 0;

    for (const msg of sorted) {
      const msgTokens = this.tokenBudget.estimateTokens(msg.message.content);

      if (currentTokens + msgTokens <= maxTokens) {
        selected.push(msg);
        currentTokens += msgTokens;
      }
    }

    // Re-sort by timestamp to maintain conversation order
    return selected.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Trim messages to fit within token budget
   *
   * @private
   */
  private trimMessagesToFit(messages: ConversationMessage[], maxTokens: number): ConversationMessage[] {
    const result: ConversationMessage[] = [];
    let currentTokens = 0;

    // Process from most recent to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.tokenBudget.estimateTokens(msg.content);

      if (currentTokens + msgTokens <= maxTokens) {
        result.unshift(msg);
        currentTokens += msgTokens;
      }

      if (currentTokens >= maxTokens * 0.9) {
        break;
      }
    }

    return result;
  }

  /**
   * Calculate default importance for a message
   *
   * @private
   */
  private calculateDefaultImportance(message: ConversationMessage): number {
    let importance = 0.5; // Base importance

    // User/assistant messages are more important
    if (message.role === 'user' || message.role === 'assistant') {
      importance += 0.2;
    }

    // System messages are important
    if (message.role === 'system') {
      importance += 0.3;
    }

    // Longer messages might be more important
    const lengthScore = Math.min(message.content.length / 1000, 0.2);
    importance += lengthScore;

    // Questions are important
    if (message.content.includes('?')) {
      importance += 0.1;
    }

    // Error messages are important
    if (message.content.toLowerCase().includes('error')) {
      importance += 0.2;
    }

    return Math.min(importance, 1.0);
  }
}

// Default export
export default RollingWindowStrategy;
