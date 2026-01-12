/**
 * Context Compressor
 *
 * 上下文压缩器，提供多种压缩策略
 * 支持：
 * - 摘要压缩 (Summarization)
 * - 重要性评分 (Importance Scoring)
 * - 语义去重 (Semantic Deduplication)
 */

import type { ConversationMessage, CompressionParams, CompressedContext } from '@/types';
import { TokenBudgetAllocator } from './token-budget';
import logger from '@/lib/logger';

/**
 * ContextCompressor options
 */
interface CompressorOptions {
  threshold?: number;      // Compression threshold (0-1)
  strategy?: 'summary' | 'importance' | 'dedup' | 'hybrid';
}

/**
 * ContextCompressor
 *
 * 上下文压缩器实现
 */
export class ContextCompressor {
  private readonly options: Required<CompressorOptions>;
  private readonly tokenBudget: TokenBudgetAllocator;
  private compressionHistory: Array<{ original: number; compressed: number; timestamp: number }> = [];

  constructor(options?: CompressorOptions) {
    this.options = {
      threshold: options?.threshold || 0.7,
      strategy: options?.strategy || 'hybrid',
    };

    this.tokenBudget = new TokenBudgetAllocator();

    logger.debug('ContextCompressor initialized', this.options);
  }

  /**
   * Summarize messages into a concise representation
   *
   * @param messages - Messages to summarize
   * @returns Summary string
   */
  async summarize(messages: ConversationMessage[]): Promise<string> {
    if (messages.length === 0) {
      return '';
    }

    // Group messages by role
    const byRole = this.groupByRole(messages);

    // Build summary
    const parts: string[] = [];

    if (byRole.system?.length > 0) {
      parts.push(`System instructions: ${byRole.system.length} messages`);
    }

    if (byRole.user?.length > 0) {
      const userTopics = this.extractTopics(byRole.user);
      parts.push(`User discussed: ${userTopics.join(', ')}`);
    }

    if (byRole.assistant?.length > 0) {
      const assistantActions = this.extractActions(byRole.assistant);
      parts.push(`Assistant performed: ${assistantActions.join(', ')}`);
    }

    const summary = parts.join('. ');

    logger.debug('Messages summarized', {
      originalCount: messages.length,
      summaryLength: summary.length,
    });

    return summary;
  }

  /**
   * Score messages by importance
   *
   * @param messages - Messages to score
   * @param currentQuery - Current query for relevance comparison
   * @returns Array of importance scores (0-1)
   */
  async scoreImportance(
    messages: ConversationMessage[],
    currentQuery?: string
  ): Promise<number[]> {
    const scores: number[] = [];

    for (const message of messages) {
      let score = 0.5; // Base score

      // Recency boost
      const age = Date.now() - (message.timestamp || Date.now());
      const recencyScore = Math.exp(-age / (24 * 60 * 60 * 1000)); // Decay over 24h
      score += recencyScore * 0.2;

      // Length boost (longer messages might be more important)
      const lengthScore = Math.min(message.content.length / 1000, 0.2);
      score += lengthScore;

      // Role importance
      if (message.role === 'system') {
        score += 0.2;
      } else if (message.role === 'user') {
        score += 0.1;
      }

      // Keyword relevance
      if (currentQuery) {
        const relevance = this.calculateRelevance(message.content, currentQuery);
        score += relevance * 0.3;
      }

      // Question/answer importance
      if (message.content.includes('?')) {
        score += 0.1;
      }

      // Error/warning importance
      const lowerContent = message.content.toLowerCase();
      if (lowerContent.includes('error') || lowerContent.includes('warning')) {
        score += 0.15;
      }

      // Code/structure importance
      if (message.content.includes('```') || message.content.includes('{')) {
        score += 0.1;
      }

      scores.push(Math.min(score, 1.0));
    }

    logger.debug('Importance scores calculated', {
      messageCount: messages.length,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    });

    return scores;
  }

  /**
   * Deduplicate messages semantically
   *
   * @param messages - Messages to deduplicate
   * @returns Deduplicated messages
   */
  async deduplicate(messages: ConversationMessage[]): Promise<ConversationMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    const unique: ConversationMessage[] = [];
    const seen = new Set<string>();

    for (const message of messages) {
      // Create a normalized signature for comparison
      const signature = this.createSignature(message);

      // Check for near-duplicates
      let isDuplicate = false;
      for (const seenSig of seen) {
        if (this.similarity(signature, seenSig) > 0.85) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(message);
        seen.add(signature);
      }
    }

    logger.debug('Messages deduplicated', {
      originalCount: messages.length,
      uniqueCount: unique.length,
      removedCount: messages.length - unique.length,
    });

    return unique;
  }

  /**
   * Compress context using configured strategy
   *
   * @param params - Compression parameters
   * @returns Compressed context
   */
  async compress(params: CompressionParams): Promise<CompressedContext> {
    const { messages, targetRatio = this.options.threshold } = params;

    const originalTokens = this.tokenBudget.estimateTokens(
      messages.map(m => m.content).join('\n')
    );

    let compressedMessages = messages;
    let strategy = params.strategy || this.options.strategy;

    // Apply compression strategy
    switch (strategy) {
      case 'summary':
        const summary = await this.summarize(messages);
        compressedMessages = [{ role: 'system', content: `[Summary: ${summary}]` }];
        break;

      case 'importance':
        const scores = await this.scoreImportance(messages, params.currentQuery);
        const threshold = this.calculateThreshold(scores, targetRatio);
        compressedMessages = messages.filter((_, i) => scores[i] >= threshold);
        break;

      case 'dedup':
        compressedMessages = await this.deduplicate(messages);
        break;

      case 'hybrid':
      default:
        // First deduplicate
        let deduped = await this.deduplicate(messages);

        // Then score and filter by importance
        const hybridScores = await this.scoreImportance(deduped, params.currentQuery);
        const hybridThreshold = this.calculateThreshold(hybridScores, targetRatio);
        compressedMessages = deduped.filter((_, i) => hybridScores[i] >= hybridThreshold);

        // If still too large, summarize
        const compressedTokens = this.tokenBudget.estimateTokens(
          compressedMessages.map(m => m.content).join('\n')
        );

        if (compressedTokens > originalTokens * targetRatio) {
          const finalSummary = await this.summarize(compressedMessages);
          compressedMessages = [{ role: 'system', content: `[Compressed: ${finalSummary}]` }];
        }
        break;
    }

    const compressedTokens = this.tokenBudget.estimateTokens(
      compressedMessages.map(m => m.content).join('\n')
    );

    const result: CompressedContext = {
      messages: compressedMessages,
      original: messages,
      originalTokenCount: originalTokens,
      compressedTokenCount: compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
      strategy,
    };

    // Track compression history
    this.compressionHistory.push({
      original: originalTokens,
      compressed: compressedTokens,
      timestamp: Date.now(),
    });

    // Keep only last 100 entries
    if (this.compressionHistory.length > 100) {
      this.compressionHistory.shift();
    }

    logger.info('Context compressed', {
      originalTokens,
      compressedTokens,
      ratio: result.compressionRatio,
      strategy,
    });

    return result;
  }

  /**
   * Get compression statistics
   *
   * @returns Compression ratio and stats
   */
  getCompressionRatio(): number {
    if (this.compressionHistory.length === 0) {
      return 1.0;
    }

    const recent = this.compressionHistory.slice(-20); // Last 20 compressions
    const avgRatio = recent.reduce((sum, entry) =>
      sum + (entry.compressed / entry.original), 0
    ) / recent.length;

    return avgRatio;
  }

  /**
   * Get compression history
   *
   * @returns Array of compression records
   */
  getHistory(): Array<{ original: number; compressed: number; timestamp: number }> {
    return [...this.compressionHistory];
  }

  /**
   * Group messages by role
   *
   * @private
   */
  private groupByRole(messages: ConversationMessage[]): Record<string, ConversationMessage[]> {
    const groups: Record<string, ConversationMessage[]> = {};

    for (const message of messages) {
      if (!groups[message.role]) {
        groups[message.role] = [];
      }
      groups[message.role].push(message);
    }

    return groups;
  }

  /**
   * Extract topics from messages
   *
   * @private
   */
  private extractTopics(messages: ConversationMessage[]): string[] {
    const topics = new Set<string>();

    // Simple keyword extraction
    const keywords = [
      'requirements', 'design', 'implementation', 'testing',
      'deployment', 'database', 'api', 'authentication', 'authorization',
      'frontend', 'backend', 'error', 'bug', 'feature', 'refactor',
    ];

    for (const message of messages) {
      const content = message.content.toLowerCase();

      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      }

      // Extract mentions of specific terms
      const mentions = content.match(/(?:about|regarding|for)\s+(\w+)/gi);
      if (mentions) {
        mentions.forEach(m => topics.add(m.split(/\s+/)[1]));
      }
    }

    return Array.from(topics).slice(0, 5);
  }

  /**
   * Extract actions from assistant messages
   *
   * @private
   */
  private extractActions(messages: ConversationMessage[]): string[] {
    const actions = new Set<string>();

    const actionPatterns = [
      /created?\s+(\w+)/gi,
      /updated?\s+(\w+)/gi,
      /deleted?\s+(\w+)/gi,
      /implemented\s+(\w+)/gi,
      /fixed\s+(\w+)/gi,
      /generated\s+(\w+)/gi,
    ];

    for (const message of messages) {
      const content = message.content.toLowerCase();

      for (const pattern of actionPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            actions.add(match[1]);
          }
        }
      }
    }

    return Array.from(actions).slice(0, 5);
  }

  /**
   * Calculate relevance between two texts
   *
   * @private
   */
  private calculateRelevance(text: string, query: string): number {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    if (queryWords.length === 0) {
      return 0;
    }

    let matches = 0;
    for (const word of queryWords) {
      if (textLower.includes(word)) {
        matches++;
      }
    }

    return matches / queryWords.length;
  }

  /**
   * Create signature for message comparison
   *
   * @private
   */
  private createSignature(message: ConversationMessage): string {
    // Normalize: lowercase, remove extra whitespace, remove punctuation
    return message.content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Calculate similarity between two strings (Jaccard-like)
   *
   * @private
   */
  private similarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));

    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Calculate threshold for importance filtering
   *
   * @private
   */
  private calculateThreshold(scores: number[], targetRatio: number): number {
    const sorted = [...scores].sort((a, b) => b - a);
    const keepCount = Math.floor(sorted.length * targetRatio);

    if (keepCount === 0) {
      return Math.max(...scores);
    }

    return sorted[keepCount - 1];
  }
}

// Default export
export default ContextCompressor;
