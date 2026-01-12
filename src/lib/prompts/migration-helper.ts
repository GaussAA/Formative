/**
 * Agent Migration Helper
 *
 * 帮助渐进式迁移现有 Agent 到新系统
 * 提供向后兼容和特性开关
 */

import { PromptTemplateEngine } from './template-engine';
import { SchemaRegistry } from '@/lib/schemas/schema-registry';
import { ContextManager } from '@/lib/context/context-manager';
import { PromptTracker } from '@/lib/observability/prompt-tracker';
import { ExampleRegistry } from './examples/example-registry';
import { ExampleSelector } from './examples/example-selector';
import { ExampleTracker } from './examples/example-tracker';
import type { ConversationMessage } from '@/types';
import logger from '@/lib/logger';

/**
 * Migration options
 */
export interface MigrationOptions {
  useTemplateEngine?: boolean;
  useContextManager?: boolean;
  useSchemaRegistry?: boolean;
  useExampleSystem?: boolean;
  enableTracking?: boolean;
}

/**
 * Agent migration result
 */
export interface AgentMigrationResult {
  success: boolean;
  prompt?: string;
  response?: unknown;
  validation?: { valid: boolean; errors: string[] };
  tokenUsage?: { system: number; context: number; total: number };
  duration?: number;
  error?: string;
}

/**
 * AgentMigrationHelper
 *
 * 提供渐进式迁移的辅助功能
 */
export class AgentMigrationHelper {
  private readonly templateEngine: PromptTemplateEngine;
  private readonly schemaRegistry: SchemaRegistry;
  private readonly contextManager: ContextManager;
  private readonly promptTracker: PromptTracker;
  private readonly exampleRegistry: ExampleRegistry;
  private readonly exampleSelector: ExampleSelector;
  private readonly exampleTracker: ExampleTracker;

  constructor() {
    this.templateEngine = new PromptTemplateEngine();
    this.schemaRegistry = new SchemaRegistry();
    this.contextManager = new ContextManager();
    this.promptTracker = new PromptTracker();
    this.exampleRegistry = new ExampleRegistry();
    this.exampleSelector = new ExampleSelector();
    this.exampleTracker = new ExampleTracker();
  }

  /**
   * Migrate agent call to new system
   *
   * @param agentType - Agent type identifier
   * @param oldSystemPrompt - Old system prompt (backward compat)
   * @param contextData - Context data for template rendering
   * @param options - Migration options
   * @param callLLM - LLM call function
   * @returns Migration result
   */
  async migrateAgentCall(
    agentType: string,
    oldSystemPrompt: string,
    contextData: Record<string, unknown>,
    options: MigrationOptions = {},
    callLLM: (systemPrompt: string, userMessage: string) => Promise<string | unknown>
  ): Promise<AgentMigrationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Build prompt (with or without template engine)
      let systemPrompt: string;
      let tokenUsage: { system: number; context: number; total: number } = {
        system: 0,
        context: 0,
        total: 0,
      };

      if (options.useTemplateEngine) {
        // Use new template engine
        const templateName = `${agentType}.template.md`;
        systemPrompt = await this.templateEngine.renderWithInheritance(
          templateName,
          contextData
        );

        // Estimate system prompt tokens
        tokenUsage.system = this.estimateTokens(systemPrompt);
        logger.debug('Template rendered', { agentType, templateName });
      } else {
        // Use old system prompt
        systemPrompt = oldSystemPrompt;
        tokenUsage.system = this.estimateTokens(systemPrompt);
      }

      // Step 2: Build context (with or without context manager)
      let userMessage: string;

      if (options.useContextManager && contextData.conversationHistory) {
        const contextResult = await this.contextManager.buildContext({
          systemPrompt,
          conversationHistory: contextData.conversationHistory as ConversationMessage[],
          examples: contextData.examples || [],
          schema: contextData.schema,
        });

        userMessage = contextResult.messages
          .filter(m => m.role !== 'system')
          .map(m => m.content)
          .join('\n');

        tokenUsage.context = contextResult.tokenUsage.conversation;
      } else {
        // Build simple user message
        userMessage = this.buildSimpleUserMessage(contextData);
        tokenUsage.context = this.estimateTokens(userMessage);
      }

      // Step 3: Select examples (with or without example system)
      let examples: unknown[] = [];

      if (options.useExampleSystem && contextData.examples !== undefined) {
        const allExamples = contextData.examples as unknown[];
        examples = this.exampleSelector.select(allExamples, {
          count: 3,
          strategy: 'diverse',
          query: typeof contextData.query === 'string' ? contextData.query : undefined,
        });
      }

      // Step 4: Call LLM
      const rawOutput = await callLLM(systemPrompt, userMessage);

      // Step 5: Validate response (with or without schema registry)
      let validation: { valid: boolean; errors: string[] } | undefined;
      let response: unknown;

      // Handle both string and pre-parsed responses
      if (typeof rawOutput === 'string') {
        // String response - needs validation/parsing
        if (options.useSchemaRegistry && contextData.schemaType) {
          validation = this.schemaRegistry.validate(contextData.schemaType, rawOutput);

          if (!validation.valid) {
            logger.warn('Schema validation failed', {
              agentType,
              errors: validation.errors,
            });
          }
        }

        if (options.useSchemaRegistry && contextData.schemaType && validation?.valid) {
          response = this.schemaRegistry.safeParse(contextData.schemaType, rawOutput);
        } else {
          // Fallback to JSON parse
          try {
            response = this.extractJSON(rawOutput);
          } catch {
            response = { raw: rawOutput };
          }
        }
      } else {
        // Pre-parsed response (object) - use directly
        response = rawOutput;
        // Still validate if schema registry is enabled
        if (options.useSchemaRegistry && contextData.schemaType) {
          const responseStr = JSON.stringify(rawOutput);
          validation = this.schemaRegistry.validate(contextData.schemaType, responseStr);
        }
      }

      tokenUsage.total = tokenUsage.system + tokenUsage.context;

      // Step 7: Track usage (if enabled)
      if (options.enableTracking) {
        this.promptTracker.track({
          agentType,
          version: options.useTemplateEngine ? 'v2' : 'v1',
          prompt: systemPrompt,
          response: rawOutput,
          success: validation?.valid ?? true,
          latency: Date.now() - startTime,
          timestamp: Date.now(),
        });
      }

      return {
        success: true,
        prompt: systemPrompt,
        response,
        validation,
        tokenUsage,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Agent migration failed', {
        agentType,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Build simple user message from context data
   *
   * @private
   */
  private buildSimpleUserMessage(contextData: Record<string, unknown>): string {
    const parts: string[] = [];

    if (contextData.profileJson) {
      parts.push(`当前需求画像：\n${contextData.profileJson}`);
    }

    if (contextData.missingFields) {
      const missing = Array.isArray(contextData.missingFields)
        ? contextData.missingFields.join(', ')
        : String(contextData.missingFields);
      parts.push(`缺失的字段：${missing}`);
    }

    if (contextData.askedQuestions) {
      const asked = Array.isArray(contextData.askedQuestions)
        ? contextData.askedQuestions.join('\n')
        : String(contextData.askedQuestions);
      parts.push(`已经问过的问题：\n${asked}`);
    }

    if (contextData.additionalContext) {
      parts.push(String(contextData.additionalContext));
    }

    return parts.join('\n\n');
  }

  /**
   * Extract JSON from LLM response
   *
   * @private
   */
  private extractJSON(response: string): unknown {
    // Try to find JSON in markdown code blocks
    const jsonBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);

    if (jsonBlockMatch) {
      return JSON.parse(jsonBlockMatch[1].trim());
    }

    // Try to parse whole response as JSON
    try {
      return JSON.parse(response);
    } catch {
      // Return raw text if not JSON
      return { raw: response };
    }
  }

  /**
   * Estimate token count for text
   *
   * @private
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;

    // Simple estimation: ~4 chars per token for English, ~2 for Chinese
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;

    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }

  /**
   * Get migration statistics
   *
   * @returns Statistics about migration usage
   */
  getMigrationStats(): {
    templateUsage: number;
    schemaUsage: number;
    contextUsage: number;
    exampleUsage: number;
    trackingUsage: number;
  } {
    return {
      templateUsage: this.templateEngine ? 1 : 0,
      schemaUsage: Object.keys(this.schemaRegistry.getStats().versions || {}).length,
      contextUsage: this.contextManager.getStats().messageCount,
      exampleUsage: this.exampleRegistry.getStats().totalExamples,
      trackingUsage: this.promptTracker.getStats().totalCalls,
    };
  }

  /**
   * Get all system components
   *
   * @returns All system components
   */
  getComponents() {
    return {
      templateEngine: this.templateEngine,
      schemaRegistry: this.schemaRegistry,
      contextManager: this.contextManager,
      promptTracker: this.promptTracker,
      exampleRegistry: this.exampleRegistry,
      exampleSelector: this.exampleSelector,
      exampleTracker: this.exampleTracker,
    };
  }
}

// Default export
export default AgentMigrationHelper;
