/**
 * Context Manager
 *
 * 智能上下文管理，负责构建和优化 LLM 调用的上下文
 * 支持：
 * - 智能上下文构建
 * - Token 预算分配
 * - 滚动窗口策略
 * - 上下文压缩
 */

import type { ConversationMessage, BuildContextParams, BuildContextResult, ContextStats } from '@/types';
import { TokenBudgetAllocator } from './token-budget';
import { RollingWindowStrategy } from './rolling-window';
import { ContextCompressor } from './context-compressor';
import logger from '@/lib/logger';

/**
 * ContextManager
 *
 * 上下文管理器，负责智能构建和优化 LLM 调用上下文
 */
export class ContextManager {
  private readonly tokenBudget: TokenBudgetAllocator;
  private readonly rollingWindow: RollingWindowStrategy;
  private readonly compressor: ContextCompressor;

  constructor(options?: {
    maxTokens?: number;
    reserveForResponse?: number;
    compressionThreshold?: number;
  }) {
    this.tokenBudget = new TokenBudgetAllocator({
      maxTokens: options?.maxTokens || 128000,
      reserveForResponse: options?.reserveForResponse || 4000,
    });

    this.rollingWindow = new RollingWindowStrategy({
      maxTokens: this.tokenBudget.getAvailableTokens(),
    });

    this.compressor = new ContextCompressor({
      threshold: options?.compressionThreshold || 0.7,
    });

    logger.info('ContextManager initialized', {
      maxTokens: options?.maxTokens || 128000,
      reserveForResponse: options?.reserveForResponse || 4000,
    });
  }

  /**
   * Build context for LLM call
   *
   * @param params - Build context parameters
   * @returns Built context result
   */
  async buildContext(params: BuildContextParams): Promise<BuildContextResult> {
    const {
      systemPrompt,
      conversationHistory = [],
      schema = null,
      examples = [],
      maxTokens,
    } = params;

    try {
      logger.debug('Building context', {
        historyLength: conversationHistory.length,
        exampleCount: examples.length,
        hasSchema: !!schema,
      });

      // Calculate token budget
      const availableTokens = maxTokens
        ? Math.min(this.tokenBudget.getAvailableTokens(), maxTokens)
        : this.tokenBudget.getAvailableTokens();

      // Build system context
      const systemContext = this.buildSystemContext(systemPrompt, schema);

      // Build examples context
      const examplesContext = this.buildExamplesContext(examples);

      // Calculate remaining tokens for conversation
      const systemTokens = this.tokenBudget.estimateTokens(systemContext);
      const examplesTokens = this.tokenBudget.estimateTokens(examplesContext);
      const remainingForConversation = availableTokens - systemTokens - examplesTokens;

      // Select conversation messages using rolling window
      const selectedMessages = this.rollingWindow.selectMessages(
        conversationHistory,
        remainingForConversation
      );

      // Build final messages array
      const messages: ConversationMessage[] = [
        { role: 'system', content: systemContext },
      ];

      if (examplesContext) {
        messages.push({ role: 'system', content: examplesContext });
      }

      messages.push(...selectedMessages);

      // Calculate final token usage
      const totalTokens = this.tokenBudget.estimateTokens(
        messages.map(m => m.content).join('\n')
      );

      const result: BuildContextResult = {
        messages,
        systemPrompt: systemContext,
        conversationHistory: selectedMessages,
        tokenUsage: {
          system: systemTokens,
          examples: examplesTokens,
          conversation: remainingForConversation - this.tokenBudget.estimateTokens(
            selectedMessages.map(m => m.content).join('\n')
          ),
          total: totalTokens,
          remaining: availableTokens - totalTokens,
        },
        stats: this.getStats(),
      };

      logger.debug('Context built successfully', {
        messageCount: messages.length,
        totalTokens,
        remaining: result.tokenUsage.remaining,
      });

      return result;
    } catch (error) {
      logger.error('Failed to build context', { error });
      throw new Error(`Failed to build context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add message to conversation history
   *
   * @param message - Message to add
   */
  async addMessage(message: ConversationMessage): Promise<void> {
    this.rollingWindow.addMessage(message);
    logger.debug('Message added to context', { role: message.role });
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.rollingWindow.clear();
    logger.debug('Conversation history cleared');
  }

  /**
   * Compress current context
   *
   * @returns Compressed context summary
   */
  async compressContext(): Promise<string> {
    const messages = this.rollingWindow.getAllMessages();

    if (messages.length === 0) {
      return '';
    }

    logger.debug('Compressing context', { messageCount: messages.length });

    const compressed = await this.compressor.summarize(messages);

    logger.info('Context compressed', {
      originalLength: messages.length,
      compressedLength: compressed.length,
    });

    return compressed;
  }

  /**
   * Get context statistics
   *
   * @returns Context statistics
   */
  getStats(): ContextStats {
    const messages = this.rollingWindow.getAllMessages();
    const totalContent = messages.map(m => m.content).join('\n');
    const totalTokens = this.tokenBudget.estimateTokens(totalContent);

    return {
      messageCount: messages.length,
      totalTokens,
      availableTokens: this.tokenBudget.getAvailableTokens(),
      compressionRatio: this.compressor.getCompressionRatio(),
      lastUpdated: new Date(),
    };
  }

  /**
   * Build system context from prompt and schema
   *
   * @private
   */
  private buildSystemContext(systemPrompt: string, schema: unknown): string {
    let context = systemPrompt;

    if (schema) {
      const schemaSection = '\n\n## Response Format\n\nYou must respond with valid JSON matching this schema:\n```\n' +
        JSON.stringify(schema, null, 2) + '\n```\n';
      context += schemaSection;
    }

    return context;
  }

  /**
   * Build examples context from few-shot examples
   *
   * @private
   */
  private buildExamplesContext(examples: unknown[]): string {
    if (examples.length === 0) {
      return '';
    }

    let context = '\n\n## Examples\n\n';

    examples.forEach((example, index) => {
      context += `### Example ${index + 1}\n\n`;
      context += '```\n' + JSON.stringify(example, null, 2) + '\n```\n\n';
    });

    return context;
  }
}

// Default export
export default ContextManager;
