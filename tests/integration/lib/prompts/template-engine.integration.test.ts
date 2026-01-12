/**
 * Integration Tests for Prompt Engineering System
 *
 * Tests the complete prompt engineering flow:
 * - Template loading and rendering
 * - Context management
 * - Schema validation
 * - Agent migration integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptTemplateEngine } from '@/lib/prompts/template-engine';
import { PromptTemplateLoader } from '@/lib/prompts/template-loader';
import { AgentMigrationHelper } from '@/lib/prompts/migration-helper';
import { getCacheManager, resetGlobalCacheManager } from '@/lib/cache/cache-manager';
import { z } from 'zod';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Prompt Engineering System Integration Tests', () => {
  let templateEngine: PromptTemplateEngine;
  let templateLoader: PromptTemplateLoader;
  let migrationHelper: AgentMigrationHelper;

  beforeEach(() => {
    resetGlobalCacheManager();
    templateEngine = new PromptTemplateEngine();
    templateLoader = new PromptTemplateLoader();
    migrationHelper = new AgentMigrationHelper();
  });

  afterEach(() => {
    resetGlobalCacheManager();
  });

  describe('Template Loading and Rendering', () => {
    it('should load and render asker template with variables', async () => {
      const template = await templateLoader.load('asker');

      expect(template).toBeDefined();
      expect(template).toContain('你是');
      expect(template).toContain('{{currentStageLabel}}');
      expect(template).toContain('{{profileJson}}');

      const rendered = templateEngine.render(template, {
        currentStageLabel: '需求采集',
        profileJson: '{"name": "测试项目"}',
        missingFields: [],
        askedQuestions: [],
      });

      expect(rendered).toContain('需求采集');
      expect(rendered).toContain('{"name": "测试项目"}');
    });

    it('should load and render planner template with variables', async () => {
      const template = await templateLoader.load('planner');

      const rendered = templateEngine.render(template, {
        currentProfileJson: '{"name": "测试项目"}',
        currentStageLabel: '需求采集',
        askedQuestionsCount: 0,
      });

      expect(rendered).toContain('测试项目');
      expect(rendered).toContain('需求采集');
    });

    it('should handle conditional blocks in templates', () => {
      const template = `
{{#if hasRequirements}}
Requirements exist:
{{#each requirements}}
- {{this}}
{{/each}}
{{/if}}
`;

      const withRequirements = templateEngine.render(template, {
        hasRequirements: true,
        requirements: ['A', 'B'],
      });

      expect(withRequirements).toContain('Requirements exist');
      expect(withRequirements).toContain('- A');
      expect(withRequirements).toContain('- B');

      const withoutRequirements = templateEngine.render(template, {
        hasRequirements: false,
        requirements: [],
      });

      // When condition is false, content is removed
      expect(withoutRequirements).not.toContain('Requirements exist');
    });

    it('should load all agent templates successfully', async () => {
      const templates = [
        'asker',
        'extractor',
        'planner',
        'risk',
        'tech',
        'mvp',
        'spec',
      ];

      for (const templateName of templates) {
        const template = await templateLoader.load(templateName);
        expect(template).toBeDefined();
        expect(template.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Agent Migration Integration', () => {
    it('should validate schema responses with Zod', async () => {
      const QuestionSchema = z.object({
        question: z.string(),
        options: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            value: z.string(),
          })
        ).optional(),
      });

      const validResponse = {
        question: '测试问题',
        options: [{ id: '1', label: '选项1', value: 'value1' }],
      };

      const result = QuestionSchema.parse(validResponse);
      expect(result).toEqual(validResponse);

      // Should throw for invalid response
      expect(() => {
        QuestionSchema.parse({ question: 123 }); // Invalid type
      }).toThrow();
    });

    it('should integrate with cache manager', async () => {
      const cacheManager = getCacheManager();

      const template = await templateLoader.load('planner');

      // Render template
      const result = templateEngine.render(template, {
        currentProfileJson: '{"name": "Test"}',
      });

      expect(result).toContain('Test');

      // The cache manager should track operations
      const stats = cacheManager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Context Integration', () => {
    it('should render templates with nested objects', () => {
      const template = 'Project: {{project.name}}, Description: {{project.description}}';

      const result = templateEngine.render(template, {
        project: {
          name: '测试项目',
          description: '这是一个测试',
        },
      });

      expect(result).toContain('测试项目');
      expect(result).toContain('这是一个测试');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}} from {{city}}';

      const result = templateEngine.render(template, {
        name: 'John',
        // city is missing
      });

      // Missing variables should be replaced with empty string or keep the placeholder
      expect(result).toContain('Hello');
      expect(result).toContain('John');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid template syntax gracefully', () => {
      const template = 'Hello {{name';

      // Should not throw, but handle gracefully
      expect(() => {
        templateEngine.render(template, { name: 'Test' });
      }).not.toThrow();
    });

    it('should throw when loading non-existent template', async () => {
      await expect(templateLoader.load('non-existent')).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should render templates efficiently', async () => {
      const template = await templateLoader.load('planner');
      const iterations = 100;

      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        templateEngine.render(template, {
          currentProfileJson: `{"name": "Project ${i}"}`,
        });
      }
      const duration = Date.now() - start;

      // Should render 100 templates in reasonable time
      expect(duration).toBeLessThan(500);
    });

    it('should produce consistent output for same inputs', async () => {
      const template = await templateLoader.load('asker');

      const variables = {
        currentStageLabel: '需求采集',
        profileJson: '{"name": "Test"}',
        missingFields: [],
        askedQuestions: [],
      };

      const result1 = templateEngine.render(template, variables);
      const result2 = templateEngine.render(template, variables);

      expect(result1).toBe(result2);
    });
  });

  describe('Integration with Existing Agents', () => {
    it('should be compatible with extractor agent', async () => {
      const template = await templateLoader.load('extractor');

      const rendered = templateEngine.render(template, {
        currentProfileJson: '{"name": "测试项目"}',
        userInput: '我想要开发一个在线购物网站',
        currentStageLabel: 'REQUIREMENT_COLLECTION',
      });

      expect(rendered).toContain('在线购物网站');
      expect(rendered).toContain('REQUIREMENT_COLLECTION');
    });

    it('should be compatible with risk analyst agent', async () => {
      const template = await templateLoader.load('risk');

      const rendered = templateEngine.render(template, {
        profileJson: '{"name": "测试项目", "requirements": ["需求1", "需求2"]}',
      });

      expect(rendered).toContain('测试项目');
    });

    it('should be compatible with tech advisor agent', async () => {
      const template = await templateLoader.load('tech');

      const rendered = templateEngine.render(template, {
        profileJson: '{"name": "测试项目"}',
      });

      expect(rendered).toContain('测试项目');
    });

    it('should be compatible with mvp boundary agent', async () => {
      const template = await templateLoader.load('mvp');

      const rendered = templateEngine.render(template, {
        profileJson: '{"name": "测试项目"}',
        riskAnalysisJson: '{}',
        techStackJson: '{}',
      });

      expect(rendered).toContain('测试项目');
    });

    it('should be compatible with spec generator agent', async () => {
      const template = await templateLoader.load('spec');

      const rendered = templateEngine.render(template, {
        profileJson: '{"name": "测试项目"}',
        riskAnalysisJson: '{}',
        techStackJson: '{}',
        mvpFeaturesJson: '{}',
      });

      expect(rendered).toContain('测试项目');
    });
  });

  describe('Template Validation', () => {
    it('should extract variables from template', () => {
      const template = 'Hello {{name}}, you have {{count}} messages.';

      const variables = templateEngine.extractVariables(template);

      expect(variables).toContain('name');
      expect(variables).toContain('count');
    });
  });

  describe('Advanced Features', () => {
    it('should support nested object access', () => {
      const template = 'User: {{user.name}}, Email: {{user.email}}';

      const result = templateEngine.render(template, {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      });

      expect(result).toContain('John');
      expect(result).toContain('john@example.com');
    });

    it('should support loop with index', () => {
      const template = '{{#each items}}Item {{@index}}: {{this}}{{/each}}';

      const result = templateEngine.render(template, {
        items: ['A', 'B', 'C'],
      });

      expect(result).toContain('Item 0: A');
      expect(result).toContain('Item 1: B');
      expect(result).toContain('Item 2: C');
    });

    it('should support simple loops with object properties', () => {
      const template = `
{{#each items}}
Name: {{name}}, Value: {{value}}
{{/each}}
`;

      const result = templateEngine.render(template, {
        items: [
          { name: 'Item1', value: 'Value1' },
          { name: 'Item2', value: 'Value2' },
        ],
      });

      expect(result).toContain('Item1');
      expect(result).toContain('Value1');
      expect(result).toContain('Item2');
      expect(result).toContain('Value2');
    });
  });
});
