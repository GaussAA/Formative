/**
 * Token Budget Allocator
 *
 * Token 预算分配器，负责管理和分配 Token 预算
 * 支持：
 * - Token 使用估算
 * - 文本截断以适应预算
 * - 动态预算分配
 */

import type { TokenAllocation, AllocationParams } from '@/types';
import logger from '@/lib/logger';

// Approximate token ratios for different languages
const TOKEN_RATIOS: Record<string, number> = {
  english: 0.25,      // ~4 chars per token
  chinese: 0.5,       // ~2 chars per token
  japanese: 0.5,      // ~2 chars per token
  code: 0.3,          // ~3.3 chars per token
  default: 0.3,
};

/**
 * TokenBudgetAllocator
 *
 * Token 预算分配器
 */
export class TokenBudgetAllocator {
  private readonly maxTokens: number;
  private readonly reserveForResponse: number;

  constructor(options?: {
    maxTokens?: number;
    reserveForResponse?: number;
  }) {
    this.maxTokens = options?.maxTokens || 128000;
    this.reserveForResponse = options?.reserveForResponse || 4000;

    logger.debug('TokenBudgetAllocator initialized', {
      maxTokens: this.maxTokens,
      reserveForResponse: this.reserveForResponse,
    });
  }

  /**
   * Get available tokens for input
   *
   * @returns Available token count
   */
  getAvailableTokens(): number {
    return this.maxTokens - this.reserveForResponse;
  }

  /**
   * Estimate token count for text
   *
   * @param text - Text to estimate
   * @param language - Language hint for better estimation
   * @returns Estimated token count
   */
  estimateTokens(text: string, language?: string): number {
    if (!text) {
      return 0;
    }

    // Detect if text contains code
    const hasCode = /[{}()[\]<>,;:]/.test(text);
    const ratio = hasCode ? TOKEN_RATIOS.code : (TOKEN_RATIOS[language || 'default'] || TOKEN_RATIOS.default);

    // Add overhead for JSON structure, markup, etc.
    const overhead = this.calculateOverhead(text);

    return Math.ceil((text.length * ratio) + overhead);
  }

  /**
   * Allocate tokens for different context sections
   *
   * @param params - Allocation parameters
   * @returns Token allocation
   */
  allocate(params: AllocationParams): TokenAllocation {
    const {
      systemPrompt,
      examples = [],
      conversationHistory = [],
      schema = null,
    } = params;

    const available = this.getAvailableTokens();

    // Estimate tokens for each section
    const systemTokens = this.estimateTokens(systemPrompt);
    const schemaTokens = schema ? this.estimateTokens(JSON.stringify(schema)) : 0;
    const examplesTokens = examples.reduce(
      (sum, ex) => sum + this.estimateTokens(JSON.stringify(ex)),
      0
    );

    // Calculate remaining for conversation
    const fixedOverhead = systemTokens + schemaTokens + examplesTokens;
    const availableForConversation = Math.max(available - fixedOverhead, 0);

    // Estimate conversation tokens
    const conversationText = conversationHistory
      .map(m => m.content)
      .join('\n');
    const conversationTokens = this.estimateTokens(conversationText);

    // Calculate compression needed
    const compressionRatio = conversationTokens > availableForConversation
      ? availableForConversation / conversationTokens
      : 1.0;

    const allocation: TokenAllocation = {
      total: this.maxTokens,
      available,
      system: systemTokens,
      schema: schemaTokens,
      examples: examplesTokens,
      conversation: availableForConversation,
      used: fixedOverhead + Math.min(conversationTokens, availableForConversation),
      remaining: Math.max(available - fixedOverhead - conversationTokens, 0),
      compressionRatio,
    };

    logger.debug('Token allocation calculated', allocation);

    return allocation;
  }

  /**
   * Trim text to fit within token budget
   *
   * @param text - Text to trim
   * @param maxTokens - Maximum tokens allowed
   * @param language - Language hint
   * @returns Trimmed text
   */
  trimToFit(text: string, maxTokens: number, language?: string): string {
    if (this.estimateTokens(text, language) <= maxTokens) {
      return text;
    }

    // Binary search for optimal cutoff
    let left = 0;
    let right = text.length;
    let bestLength = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = text.substring(0, mid);
      const tokens = this.estimateTokens(truncated, language);

      if (tokens <= maxTokens) {
        bestLength = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    const trimmed = text.substring(0, bestLength);

    logger.debug('Text trimmed to fit budget', {
      originalLength: text.length,
      trimmedLength: bestLength,
      maxTokens,
    });

    return trimmed;
  }

  /**
   * Calculate overhead tokens for special characters and markup
   *
   * @private
   */
  private calculateOverhead(text: string): number {
    let overhead = 0;

    // JSON overhead
    if (text.includes('{') && text.includes('}')) {
      overhead += text.length * 0.05; // 5% for JSON structure
    }

    // Markdown overhead
    if (text.includes('#') || text.includes('```')) {
      overhead += text.length * 0.02; // 2% for markdown
    }

    // Special characters
    const specialCharCount = (text.match(/[^\w\s\u4e00-\u9fff]/g) || []).length;
    overhead += specialCharCount * 0.1;

    return Math.ceil(overhead);
  }
}

// Default export
export default TokenBudgetAllocator;
