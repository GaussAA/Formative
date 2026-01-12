/**
 * Structured Output Manager
 *
 * 提供结构化输出调用、验证和自动重试功能
 * 集成 Zod Schema 验证，确保 LLM 响应符合预期格式
 */

import { z } from 'zod';
import logger from '@/lib/logger';
import { createLLM } from './helper';
import type { LLMMessage, ConversationMessage } from './types';
import { SchemaRegistry, SchemaValidationResult } from '@/lib/schemas/schema-registry';
import { retryWithTimeout } from '@/lib/utils/retry';

/**
 * Structured output options
 */
export interface StructuredOutputOptions {
  /**
   * Retry on validation error
   * @default true
   */
  retryOnValidationError?: boolean;

  /**
   * Maximum number of retries
   * @default 3
   */
  maxRetries?: number;

  /**
   * Include validation instructions in prompt
   * @default true
   */
  includeValidationInPrompt?: boolean;

  /**
   * Initial retry delay in milliseconds
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Structured output result
 */
export interface StructuredOutputResult<T> {
  data: T;
  rawOutput: string;
  validation: SchemaValidationResult<T>;
  tokenUsage: TokenUsage;
  duration: number;
  attempt: number;
}

/**
 * StructuredOutputManager
 *
 * 结构化输出管理器，处理 LLM 响应的验证和重试
 */
export class StructuredOutputManager {
  private readonly schemaRegistry: SchemaRegistry;
  private readonly defaultOptions: Required<StructuredOutputOptions>;

  constructor(schemaRegistry?: SchemaRegistry) {
    this.schemaRegistry = schemaRegistry || new SchemaRegistry();
    this.defaultOptions = {
      retryOnValidationError: true,
      maxRetries: 3,
      includeValidationInPrompt: true,
      initialDelay: 1000,
      timeout: 30000,
    };
  }

  /**
   * Call LLM with structured output validation
   *
   * @param agentType - Agent type for LLM configuration
   * @param prompt - Prompt to send to LLM
   * @param schema - Zod schema for validation
   * @param options - Structured output options
   * @returns Structured output result
   */
  async callWithStructuredOutput<T>(
    agentType: string,
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: StructuredOutputOptions
  ): Promise<StructuredOutputResult<T>> {
    const opts = { ...this.defaultOptions, ...options };
    let currentPrompt = prompt;

    // Add validation instructions to prompt if enabled
    if (opts.includeValidationInPrompt) {
      currentPrompt = this.addValidationInstructions(currentPrompt, schema);
    }

    const startTime = Date.now();

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        logger.debug('Structured output attempt', { agentType, attempt, maxRetries: opts.maxRetries });

        const result = await retryWithTimeout(
          async () => {
            const llm = createLLM({ agentType });
            const messages: LLMMessage[] = [{ role: 'user', content: currentPrompt }];
            const response = await llm.invoke(messages);
            const rawOutput = response.content.toString();

            const tokenUsage: TokenUsage = {
              promptTokens: response.usage_metadata?.input_tokens ?? 0,
              completionTokens: response.usage_metadata?.output_tokens ?? 0,
              totalTokens:
                (response.usage_metadata?.input_tokens ?? 0) +
                (response.usage_metadata?.output_tokens ?? 0),
            };

            // Validate and parse response
            const validation = this.validateAndParse(rawOutput, schema);

            if (!validation.valid && opts.retryOnValidationError && attempt < opts.maxRetries) {
              // Build retry prompt with error feedback
              currentPrompt = this.buildRetryPrompt(currentPrompt, validation.errors);
              throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            return {
              rawOutput,
              validation,
              tokenUsage,
            };
          },
          {
            maxRetries: 0, // We handle retries ourselves
            initialDelay: opts.initialDelay,
            onRetry: (retryAttempt, error) => {
              logger.warn('Structured output retry attempt', {
                agentType,
                attempt: retryAttempt,
                error: error.message,
              });
            },
          },
          opts.timeout
        );

        const duration = Date.now() - startTime;

        if (result.validation.valid && result.validation.data) {
          logger.info('Structured output successful', {
            agentType,
            duration,
            tokenUsage: result.tokenUsage,
            attempt,
          });

          return {
            data: result.validation.data,
            rawOutput: result.rawOutput,
            validation: result.validation as SchemaValidationResult<T>,
            tokenUsage: result.tokenUsage,
            duration,
            attempt,
          };
        }

        // Validation failed but no more retries
        const durationFailed = Date.now() - startTime;
        logger.error('Structured output validation failed after all retries', {
          agentType,
          errors: result.validation.errors,
          attempts: attempt,
        });

        return {
          data: null as T,
          rawOutput: result.rawOutput,
          validation: result.validation as SchemaValidationResult<T>,
          tokenUsage: result.tokenUsage,
          duration: durationFailed,
          attempt,
        };
      } catch (error) {
        const isLastAttempt = attempt >= opts.maxRetries;

        if (isLastAttempt) {
          const durationFailed = Date.now() - startTime;
          logger.error('Structured output failed after all retries', {
            agentType,
            error: error instanceof Error ? error.message : String(error),
            attempts: attempt,
          });

          return {
            data: null as T,
            rawOutput: '',
            validation: {
              valid: false,
              errors: [error instanceof Error ? error.message : String(error)],
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
            duration: durationFailed,
            attempt,
          };
        }

        // Continue to next retry
        logger.warn('Structured output attempt failed, retrying', {
          agentType,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('Max retries exceeded');
  }

  /**
   * Validate and parse JSON response
   *
   * @param response - LLM response string
   * @param schema - Zod schema for validation
   * @returns Validation result
   */
  validateAndParse<T>(response: string, schema: z.ZodSchema<T>): SchemaValidationResult<T> {
    try {
      // Try to extract JSON from response
      let jsonStr = response;

      // Extract from markdown code blocks
      const jsonMatch =
        response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/```\s*([\s\S]*?)\s*```/);

      if (jsonMatch?.[1]) {
        jsonStr = jsonMatch[1];
      } else {
        // Extract JSON object/array (handle LLM adding extra text)
        const firstBrace = response.indexOf('{');
        const lastBrace = response.lastIndexOf('}');
        const firstBracket = response.indexOf('[');
        const lastBracket = response.lastIndexOf(']');

        // Determine if object or array comes first
        const hasObject = firstBrace !== -1 && lastBrace !== -1;
        const hasArray = firstBracket !== -1 && lastBracket !== -1;

        if (hasObject && (!hasArray || firstBrace < firstBracket)) {
          jsonStr = response.substring(firstBrace, lastBrace + 1);
        } else if (hasArray) {
          jsonStr = response.substring(firstBracket, lastBracket + 1);
        }
      }

      // Parse JSON
      const parsed = JSON.parse(jsonStr.trim());

      // Validate against schema
      const validated = schema.parse(parsed);

      return {
        valid: true,
        data: validated,
        errors: [],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          data: null,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }

      return {
        valid: false,
        data: null,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Retry with corrected prompt
   *
   * @param error - Validation error
   * @param originalPrompt - Original prompt
   * @param schema - Zod schema
   * @returns Corrected data
   */
  async retryWithCorrection<T>(
    error: Error,
    originalPrompt: string,
    schema: z.ZodSchema<T>
  ): Promise<T> {
    const errors = [error.message];

    const correctedPrompt = this.buildRetryPrompt(originalPrompt, errors);
    const result = await this.callWithStructuredOutput('default', correctedPrompt, schema, {
      maxRetries: 1,
    });

    if (!result.data) {
      throw new Error(`Failed to correct validation errors: ${errors.join(', ')}`);
    }

    return result.data;
  }

  /**
   * Add validation instructions to prompt
   *
   * @private
   */
  private addValidationInstructions(prompt: string, schema: z.ZodSchema): string {
    const jsonSchema = this.zodToSimpleSchema(schema);

    return `${prompt}

IMPORTANT - Output Format Requirements:
1. Your response MUST be valid JSON only
2. Do not include any text before or after the JSON
3. The JSON must match this exact structure:

${JSON.stringify(jsonSchema, null, 2)}

4. All string fields must have non-empty values
5. All required fields must be present
6. Arrays must contain valid elements
7. Boolean values must be true or false
8. Numbers must be valid numeric values

Example output format:
\`\`\`json
{
  ${Object.keys(jsonSchema).slice(0, 3).join(',\n  ')}${Object.keys(jsonSchema).length > 3 ? ',\n  ...' : ''}
}
\`\`\`
`;
  }

  /**
   * Build retry prompt with error feedback
   *
   * @private
   */
  private buildRetryPrompt(originalPrompt: string, errors: string[]): string {
    return `${originalPrompt}

---
VALIDATION FEEDBACK:
Your previous response had validation errors:
${errors.map(e => `- ${e}`).join('\n')}

Please fix these errors and output valid JSON only.
Make sure to:
1. Match the exact structure specified
2. Include all required fields
3. Use correct data types
4. Provide non-empty values for string fields
5. Output ONLY the JSON, no additional text
`;
  }

  /**
   * Convert Zod schema to simple JSON schema representation
   *
   * @private
   */
  private zodToSimpleSchema(zodSchema: z.ZodSchema): object {
    const getType = (schema: z.ZodTypeAny): string | object => {
      if (schema instanceof z.ZodString) return 'string';
      if (schema instanceof z.ZodNumber) return 'number';
      if (schema instanceof z.ZodBoolean) return 'boolean';
      if (schema instanceof z.ZodArray) return [getType(schema.element)];
      if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(shape)) {
          const zodField = value as z.ZodTypeAny;
          const isOptional = zodField instanceof z.ZodOptional || zodField instanceof z.ZodNullable;
          const fieldType = getType(zodField instanceof z.ZodOptional ? zodField.unwrap() : zodField);
          result[key] = isOptional ? `${fieldType} (optional)` : fieldType;
        }
        return result;
      }
      if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
        return `${getType(schema.unwrap())} (optional)`;
      }
      if (schema instanceof z.ZodEnum) return schema.options.join(' | ');
      if (schema instanceof z.ZodEffects) return getType(schema._def.schema);
      return 'unknown';
    };

    return getType(zodSchema) as object;
  }
}

// Default export
export default StructuredOutputManager;
