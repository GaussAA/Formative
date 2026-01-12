/**
 * Schema Registry
 *
 * 集中管理所有 Agent 的 Zod Schema 定义
 * 提供 JSON Schema 生成、示例生成和验证功能
 */

import { z } from 'zod';
import logger from '@/lib/logger';

/**
 * Registered schema metadata
 */
export interface RegisteredSchema {
  agentType: string;
  zodSchema: z.ZodSchema;
  jsonSchema: object;
  example: unknown;
  version: string;
  lastModified: Date;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors: string[];
  path?: string;
}

/**
 * SchemaRegistry
 *
 * Schema 注册表，管理所有 Agent 的响应 Schema
 */
export class SchemaRegistry {
  private readonly schemas: Map<string, RegisteredSchema>;

  constructor() {
    this.schemas = new Map();
    logger.debug('SchemaRegistry initialized');
  }

  /**
   * Register schema for agent type
   *
   * @param agentType - Agent type identifier
   * @param schema - Schema registration data
   */
  register(agentType: string, schema: Omit<RegisteredSchema, 'lastModified'>): void {
    const registeredSchema: RegisteredSchema = {
      ...schema,
      lastModified: new Date(),
    };

    this.schemas.set(agentType, registeredSchema);
    logger.info('Schema registered', { agentType, version: schema.version });
  }

  /**
   * Get schema by agent type
   *
   * @param agentType - Agent type identifier
   * @returns Registered schema or undefined
   */
  get(agentType: string): RegisteredSchema | undefined {
    return this.schemas.get(agentType);
  }

  /**
   * Check if schema exists for agent type
   *
   * @param agentType - Agent type identifier
   * @returns True if schema exists
   */
  has(agentType: string): boolean {
    return this.schemas.has(agentType);
  }

  /**
   * Unregister schema for agent type
   *
   * @param agentType - Agent type identifier
   */
  unregister(agentType: string): void {
    this.schemas.delete(agentType);
    logger.info('Schema unregistered', { agentType });
  }

  /**
   * Get all registered agent types
   *
   * @returns Array of agent type identifiers
   */
  getAgentTypes(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Validate data against schema
   *
   * @param agentType - Agent type identifier
   * @param data - Data to validate
   * @returns Validation result
   */
  validate<T = unknown>(agentType: string, data: unknown): SchemaValidationResult<T> {
    const schema = this.schemas.get(agentType);

    if (!schema) {
      return {
        valid: false,
        errors: [`No schema registered for agent type: ${agentType}`],
      };
    }

    try {
      const validated = schema.zodSchema.parse(data);
      return {
        valid: true,
        data: validated as T,
        errors: [],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues?.map(e => `${e.path.join('.')}: ${e.message}`) || [],
        };
      }

      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Safely parse data against schema (returns data even if invalid)
   *
   * @param agentType - Agent type identifier
   * @param data - Data to parse
   * @returns Parsed data or null if parsing fails
   */
  safeParse<T = unknown>(agentType: string, data: unknown): T | null {
    const result = this.validate<T>(agentType, data);
    return result.valid ? (result.data as T) : null;
  }

  /**
   * Generate JSON Schema from Zod schema
   * Useful for including in prompts
   *
   * @param agentType - Agent type identifier
   * @returns JSON Schema object
   */
  generateJSONSchema(agentType: string): object {
    const schema = this.schemas.get(agentType);

    if (!schema) {
      throw new Error(`No schema registered for agent type: ${agentType}`);
    }

    return this.zodToJsonSchema(schema.zodSchema);
  }

  /**
   * Generate example from schema
   * Useful for including in prompts as few-shot examples
   *
   * @param agentType - Agent type identifier
   * @returns Example object matching the schema
   */
  generateExample(agentType: string): unknown {
    const schema = this.schemas.get(agentType);

    if (!schema) {
      throw new Error(`No schema registered for agent type: ${agentType}`);
    }

    // Return cached example if available
    if (schema.example !== undefined) {
      return schema.example;
    }

    // Generate example from schema
    return this.generateExampleFromSchema(schema.zodSchema);
  }

  /**
   * Convert Zod schema to JSON Schema format
   *
   * @private
   */
  private zodToJsonSchema(zodSchema: z.ZodSchema): object {
    // This is a simplified implementation
    // For production, consider using zod-to-json-schema library

    const getZodType = (schema: z.ZodTypeAny): string => {
      if (schema instanceof z.ZodString) return 'string';
      if (schema instanceof z.ZodNumber) return 'number';
      if (schema instanceof z.ZodBoolean) return 'boolean';
      if (schema instanceof z.ZodArray) return 'array';
      if (schema instanceof z.ZodObject) return 'object';
      if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return getZodType(schema.unwrap());
      if (schema instanceof z.ZodDefault) return getZodType(schema.removeDefault());
      if (schema instanceof z.ZodEnum) return 'string';
      if (schema instanceof z.ZodLiteral) return typeof schema.value;
      // Zod v4: Try to handle transformation schemas safely
      try {
        // @ts-ignore - ZodTransformation replaces ZodEffects in v4
        if (schema instanceof z.ZodTransformation) {
          // @ts-ignore
          return getZodType(schema._def.schema || schema.innerType());
        }
        // Fallback for v3
        // @ts-ignore
        if (schema instanceof z.ZodEffects) {
          // @ts-ignore
          return getZodType(schema._def.schema);
        }
      } catch {
        // If instanceof fails, try to check _def typeName
        // @ts-ignore
        if (schema._def?.typeName === 'ZodEffects' || schema._def?.typeName === 'ZodTransformation') {
          // @ts-ignore
          return getZodType(schema._def.schema || schema._def.baseSchema);
        }
      }
      return 'unknown';
    };

    const toJsonSchema = (schema: z.ZodTypeAny): object => {
      const typeName = getZodType(schema);

      if (schema instanceof z.ZodObject) {
        const properties: Record<string, object> = {};
        const required: string[] = [];

        const shape = schema.shape;
        for (const [key, value] of Object.entries(shape)) {
          const zodField = value as z.ZodTypeAny;
          properties[key] = toJsonSchema(zodField);

          if (!(zodField instanceof z.ZodOptional) && !(zodField instanceof z.ZodNullable) && !(zodField instanceof z.ZodDefault)) {
            required.push(key);
          }
        }

        return {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }

      if (schema instanceof z.ZodArray) {
        return {
          type: 'array',
          items: toJsonSchema(schema.element),
        };
      }

      if (schema instanceof z.ZodEnum) {
        return {
          type: 'string',
          enum: schema.options,
        };
      }

      if (schema instanceof z.ZodLiteral) {
        return {
          type: typeof schema.value,
          const: schema.value,
        };
      }

      if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
        const innerSchema = toJsonSchema(schema.unwrap());
        return {
          ...innerSchema,
          // Remove required if this is optional
          required: undefined,
        };
      }

      // Handle ZodEffects/Transformation safely
      try {
        // @ts-ignore - ZodTransformation replaces ZodEffects in v4
        if (schema instanceof z.ZodTransformation) {
          // @ts-ignore
          return toJsonSchema(schema._def.schema || schema.innerType());
        }
        // @ts-ignore - Fallback for v3
        if (schema instanceof z.ZodEffects) {
          // @ts-ignore
          return toJsonSchema(schema._def.schema);
        }
      } catch {
        // Check by typeName if instanceof fails
        // @ts-ignore
        if (schema._def?.typeName === 'ZodEffects' || schema._def?.typeName === 'ZodTransformation') {
          // @ts-ignore
          return toJsonSchema(schema._def.schema || schema._def.baseSchema);
        }
      }

      // Basic types
      return { type: typeName };
    };

    return toJsonSchema(zodSchema);
  }

  /**
   * Generate example value from Zod schema
   *
   * @private
   */
  private generateExampleFromSchema(zodSchema: z.ZodSchema): unknown {
    const generateValue = (schema: z.ZodTypeAny): unknown => {
      // Handle ZodEffects/Transformation (refined schemas)
      try {
        // @ts-ignore - ZodTransformation replaces ZodEffects in v4
        if (schema instanceof z.ZodTransformation) {
          // @ts-ignore
          return generateValue(schema._def.schema || schema.innerType());
        }
        // @ts-ignore - Fallback for v3
        if (schema instanceof z.ZodEffects) {
          // @ts-ignore
          return generateValue(schema._def.schema);
        }
      } catch {
        // Check by typeName if instanceof fails
        // @ts-ignore
        if (schema._def?.typeName === 'ZodEffects' || schema._def?.typeName === 'ZodTransformation') {
          // @ts-ignore
          return generateValue(schema._def.schema || schema._def.baseSchema);
        }
      }

      // Handle ZodDefault
      if (schema instanceof z.ZodDefault) {
        const defaultValue = schema._def.defaultValue();
        if (defaultValue !== undefined) {
          return defaultValue;
        }
        return generateValue(schema.removeDefault());
      }

      // Handle ZodOptional
      if (schema instanceof z.ZodOptional) {
        return undefined;
      }

      // Handle ZodNullable
      if (schema instanceof z.ZodNullable) {
        return null;
      }

      // Handle ZodObject
      if (schema instanceof z.ZodObject || schema._def?.typeName === 'ZodObject') {
        const obj: Record<string, unknown> = {};
        const shape = schema.shape;

        for (const [key, value] of Object.entries(shape)) {
          const exampleValue = generateValue(value as z.ZodTypeAny);
          // Include the value even if it's undefined, as the schema may allow it
          obj[key] = exampleValue;
        }

        return obj;
      }

      // Handle ZodArray
      if (schema instanceof z.ZodArray || schema._def?.typeName === 'ZodArray') {
        const itemExample = generateValue(schema.element);
        return itemExample !== undefined ? [itemExample] : [];
      }

      // Handle ZodString
      if (schema instanceof z.ZodString || schema._def?.typeName === 'ZodString') {
        const description = schema._def.description || '';
        if (description.includes('email')) return 'user@example.com';
        if (description.includes('url')) return 'https://example.com';
        if (description.includes('date')) return '2024-01-15';
        if (description.includes('phone')) return '+1234567890';
        return 'example_value';
      }

      // Handle ZodNumber
      if (schema instanceof z.ZodNumber || schema._def?.typeName === 'ZodNumber') {
        return 0;
      }

      // Handle ZodBoolean
      if (schema instanceof z.ZodBoolean || schema._def?.typeName === 'ZodBoolean') {
        return true;
      }

      // Handle ZodEnum
      if (schema instanceof z.ZodEnum) {
        return schema.options[0];
      }

      // Handle ZodLiteral
      if (schema instanceof z.ZodLiteral) {
        return schema.value;
      }

      // Handle ZodUnion
      if (schema instanceof z.ZodUnion) {
        return generateValue(schema.options[0]);
      }

      // Handle ZodDiscriminatedUnion
      if (schema instanceof z.ZodDiscriminatedUnion) {
        return generateValue(schema.options[0]);
      }

      // Handle ZodIntersection
      if (schema instanceof z.ZodIntersection) {
        const left = generateValue(schema._def.left);
        const right = generateValue(schema._def.right);
        return { ...(left as object), ...(right as object) };
      }

      // Handle ZodRecord
      if (schema instanceof z.ZodRecord) {
        return {};
      }

      // Handle ZodMap
      if (schema instanceof z.ZodMap) {
        return new Map();
      }

      // Handle ZodSet
      if (schema instanceof z.ZodSet) {
        return new Set();
      }

      // Handle ZodDate
      if (schema instanceof z.ZodDate) {
        return new Date('2024-01-15T00:00:00.000Z');
      }

      // Handle ZodBigInt
      if (schema instanceof z.ZodBigInt) {
        return BigInt(0);
      }

      // Handle ZodNativeEnum
      if (schema instanceof z.ZodNativeEnum) {
        const enumValues = Object.values(schema.enum);
        return enumValues[0];
      }

      // Default fallback
      logger.warn('Unhandled Zod type for example generation', {
        typeName: schema.constructor.name,
      });
      return undefined;
    };

    return generateValue(zodSchema);
  }

  /**
   * Get registry statistics
   *
   * @returns Registry statistics
   */
  getStats(): {
    totalSchemas: number;
    agentTypes: string[];
    versions: Record<string, string>;
  } {
    const versions: Record<string, string> = {};

    for (const [agentType, schema] of this.schemas) {
      versions[agentType] = schema.version;
    }

    return {
      totalSchemas: this.schemas.size,
      agentTypes: this.getAgentTypes(),
      versions,
    };
  }
}

// Global singleton instance
const globalSchemaRegistry = new SchemaRegistry();

// Default export
export default globalSchemaRegistry;
