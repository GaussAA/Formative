/**
 * Unit tests for Schema validation
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SchemaRegistry } from '@/lib/schemas/schema-registry';
import {
  extractorResponseSchema,
  plannerResponseSchema,
  riskResponseSchema,
} from '@/lib/schemas/agent-schemas';

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry();
  });

  describe('register and get', () => {
    it('should register and retrieve schema', () => {
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      registry.register('test-agent', {
        agentType: 'test-agent',
        zodSchema: testSchema,
        jsonSchema: { type: 'object' },
        example: { name: 'Test', age: 25 },
        version: '1.0.0',
      });

      const retrieved = registry.get('test-agent');
      expect(retrieved).toBeDefined();
      expect(retrieved?.agentType).toBe('test-agent');
    });

    it('should return undefined for non-existent schema', () => {
      const retrieved = registry.get('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should check if schema exists', () => {
      const testSchema = z.object({ value: z.string() });

      expect(registry.has('test')).toBe(false);

      registry.register('test', {
        agentType: 'test',
        zodSchema: testSchema,
        jsonSchema: {},
        example: null,
        version: '1.0.0',
      });

      expect(registry.has('test')).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate valid data', () => {
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      registry.register('test-agent', {
        agentType: 'test-agent',
        zodSchema: testSchema,
        jsonSchema: {},
        example: null,
        version: '1.0.0',
      });

      const result = registry.validate('test-agent', {
        name: 'Alice',
        age: 30,
      });

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ name: 'Alice', age: 30 });
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid data', () => {
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      registry.register('test-agent', {
        agentType: 'test-agent',
        zodSchema: testSchema,
        jsonSchema: {},
        example: null,
        version: '1.0.0',
      });

      // Wrong type for 'age' field (string instead of number)
      const result = registry.validate('test-agent', {
        name: 'Bob',
        age: 'not a number', // Type mismatch
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing schema', () => {
      const result = registry.validate('non-existent', { data: 'test' });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('No schema registered');
    });
  });

  describe('safeParse', () => {
    it('should return data for valid input', () => {
      const testSchema = z.object({
        value: z.string(),
      });

      registry.register('test', {
        agentType: 'test',
        zodSchema: testSchema,
        jsonSchema: {},
        example: null,
        version: '1.0.0',
      });

      const result = registry.safeParse('test', { value: 'test' });
      expect(result).toEqual({ value: 'test' });
    });

    it('should return null for invalid input', () => {
      const testSchema = z.object({
        value: z.string(),
      });

      registry.register('test', {
        agentType: 'test',
        zodSchema: testSchema,
        jsonSchema: {},
        example: null,
        version: '1.0.0',
      });

      const result = registry.safeParse('test', { value: 123 });
      expect(result).toBeNull();
    });
  });

  describe('generateJSONSchema', () => {
    it('should generate JSON schema from Zod schema', () => {
      const testSchema = z.object({
        name: z.string(),
        age: z.number().optional(),
        active: z.boolean(),
      });

      registry.register('test', {
        agentType: 'test',
        zodSchema: testSchema,
        jsonSchema: {},
        example: null,
        version: '1.0.0',
      });

      const jsonSchema = registry.generateJSONSchema('test');

      expect(jsonSchema).toHaveProperty('type', 'object');
      expect(jsonSchema).toHaveProperty('properties');
    });

    it('should throw for non-existent schema', () => {
      expect(() => registry.generateJSONSchema('non-existent')).toThrow();
    });
  });

  describe('generateExample', () => {
    it('should return cached example if available', () => {
      const testSchema = z.object({
        name: z.string(),
      });

      const example = { name: 'Cached Example' };

      registry.register('test', {
        agentType: 'test',
        zodSchema: testSchema,
        jsonSchema: {},
        example,
        version: '1.0.0',
      });

      const result = registry.generateExample('test');
      expect(result).toEqual(example);
    });

    it('should generate example from schema', () => {
      const testSchema = z.object({
        name: z.string(),
        count: z.number(),
        active: z.boolean(),
      });

      registry.register('test', {
        agentType: 'test',
        zodSchema: testSchema,
        jsonSchema: {},
        example: { name: 'example', count: 0, active: true },
        version: '1.0.0',
      });

      const result = registry.generateExample('test') as Record<string, unknown>;

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('count', 0);
      expect(result).toHaveProperty('active');
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      registry.register('agent1', {
        agentType: 'agent1',
        zodSchema: z.object({}),
        jsonSchema: {},
        example: null,
        version: '1.0.0',
      });

      registry.register('agent2', {
        agentType: 'agent2',
        zodSchema: z.object({}),
        jsonSchema: {},
        example: null,
        version: '2.0.0',
      });

      const stats = registry.getStats();

      expect(stats.totalSchemas).toBe(2);
      expect(stats.agentTypes).toContain('agent1');
      expect(stats.agentTypes).toContain('agent2');
      expect(stats.versions).toEqual({
        agent1: '1.0.0',
        agent2: '2.0.0',
      });
    });
  });
});

describe('Agent Schemas', () => {
  describe('extractorResponseSchema', () => {
    it('should validate valid extractor response', () => {
      const validData = {
        extracted: {
          projectName: 'Test Project',
          productGoal: 'Test goal',
          coreFunctions: ['Function 1', 'Function 2'],
        },
        missingFields: ['targetUsers'],
        nextQuestion: 'Who is your target user?',
        options: [
          { id: 'opt1', label: 'Option 1', value: 'value1' },
          { id: 'opt2', label: 'Option 2', value: 'value2' },
        ],
      };

      const result = extractorResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept partial extracted data', () => {
      const partialData = {
        extracted: {},
        missingFields: ['projectName', 'productGoal'],
      };

      const result = extractorResponseSchema.safeParse(partialData);
      expect(result.success).toBe(true);
    });

    it('should require extracted and missingFields', () => {
      const invalidData = {
        extracted: {},
        // missing missingFields
      };

      const result = extractorResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('plannerResponseSchema', () => {
    it('should validate valid planner response', () => {
      const validData = {
        completeness: 75,
        checklist: {
          productGoal: true,
          targetUsers: true,
          useCases: false,
          coreFunctions: true,
          needsDataStorage: false,
          needsMultiUser: false,
        },
        missingCritical: ['useCases'],
        canProceed: true,
        recommendation: 'Continue to collect use cases',
      };

      const result = plannerResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should enforce completeness range', () => {
      const invalidData = {
        completeness: 150, // Out of range
        checklist: {
          productGoal: true,
          targetUsers: true,
          useCases: true,
          coreFunctions: true,
          needsDataStorage: true,
          needsMultiUser: true,
        },
        missingCritical: [],
        canProceed: true,
        recommendation: 'All complete',
      };

      const result = plannerResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('riskResponseSchema', () => {
    it('should validate valid risk response', () => {
      const validData = {
        risks: [
          {
            category: 'technical',
            description: 'Complex integration',
            severity: 'high',
            mitigation: 'Use API wrappers',
          },
        ],
        solutions: [
          {
            id: 'sol1',
            name: 'Conservative',
            description: 'Start small',
            approach: 'conservative',
            pros: ['Lower risk', 'Faster to market'],
            cons: ['Limited features'],
            estimatedEffort: '2-3 weeks',
          },
        ],
        recommendedSolution: 'sol1',
        reasoning: 'Best for MVP',
      };

      const result = riskResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate severity enum', () => {
      const invalidData = {
        risks: [
          {
            category: 'technical',
            description: 'Risk',
            severity: 'critical', // Invalid severity
          },
        ],
        solutions: [],
        recommendedSolution: '',
        reasoning: '',
      };

      const result = riskResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
