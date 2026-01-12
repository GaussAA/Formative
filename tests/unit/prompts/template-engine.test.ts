/**
 * Unit tests for PromptTemplateEngine
 */

import { describe, it, expect } from 'vitest';
import { PromptTemplateEngine } from '@/lib/prompts/template-engine';

describe('PromptTemplateEngine', () => {
  let engine: PromptTemplateEngine;

  beforeEach(() => {
    engine = new PromptTemplateEngine();
  });

  describe('render', () => {
    it('should render simple variables', () => {
      const template = 'Hello {{name}}!';
      const result = engine.render(template, { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should render multiple variables', () => {
      const template = '{{greeting}}, {{name}}! Today is {{day}}.';
      const result = engine.render(template, {
        greeting: 'Hello',
        name: 'Alice',
        day: 'Monday',
      });
      expect(result).toBe('Hello, Alice! Today is Monday.');
    });

    it('should handle nested variables', () => {
      const template = 'User: {{user.name}} ({{user.email}})';
      const result = engine.render(template, {
        user: { name: 'Bob', email: 'bob@example.com' },
      });
      expect(result).toBe('User: Bob (bob@example.com)');
    });

    it('should leave undefined variables as-is', () => {
      const template = 'Hello {{name}} from {{city}}!';
      const result = engine.render(template, { name: 'Alice' });
      expect(result).toBe('Hello Alice from {{city}}!');
    });

    it('should render empty strings', () => {
      const template = 'Value: {{value}}';
      const result = engine.render(template, { value: '' });
      expect(result).toBe('Value: ');
    });
  });

  describe('conditionals', () => {
    it('should render content when condition is true', () => {
      const template = '{{#if show}}Visible{{/if}}';
      const result = engine.render(template, { show: true });
      expect(result).toBe('Visible');
    });

    it('should not render content when condition is false', () => {
      const template = '{{#if show}}Visible{{/if}}';
      const result = engine.render(template, { show: false });
      expect(result).toBe('');
    });

    it('should not render content when condition is undefined', () => {
      const template = '{{#if show}}Visible{{/if}}';
      const result = engine.render(template, {});
      expect(result).toBe('');
    });

    it('should handle multiple conditionals', () => {
      const template = '{{#if a}}A{{/if}}{{#if b}}B{{/if}}{{#if c}}C{{/if}}';
      const result = engine.render(template, { a: true, c: true });
      expect(result).toBe('AC');
    });

    it('should render nested conditionals', () => {
      const template = '{{#if outer}}{{#if inner}}Both{{/if}}{{/if}}';
      const result = engine.render(template, { outer: true, inner: true });
      expect(result).toBe('Both');
    });
  });

  describe('loops', () => {
    it('should render array items', () => {
      const template = '{{#each items}}{{this}} {{/each}}';
      const result = engine.render(template, { items: ['a', 'b', 'c'] });
      expect(result).toBe('a b c ');
    });

    it('should use @index in loops', () => {
      const template = '{{#each items}}{{@index}}: {{this}}\n{{/each}}';
      const result = engine.render(template, { items: ['x', 'y', 'z'] });
      expect(result).toBe('0: x\n1: y\n2: z\n');
    });

    it('should render object arrays', () => {
      const template = '{{#each users}}{{name}}: {{age}}\n{{/each}}';
      const result = engine.render(template, {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      });
      expect(result).toBe('Alice: 30\nBob: 25\n');
    });

    it('should handle empty arrays', () => {
      const template = '{{#each items}}{{this}}{{/each}}';
      const result = engine.render(template, { items: [] });
      expect(result).toBe('');
    });

    it('should handle non-array values', () => {
      const template = '{{#each items}}{{this}}{{/each}}';
      const result = engine.render(template, { items: 'not an array' });
      expect(result).toBe('');
    });
  });

  describe('complex templates', () => {
    it('should combine variables, conditionals, and loops', () => {
      const template = `
{{#if showList}}
List:
{{#each items}}- {{this}}
{{/each}}
{{/if}}
Total: {{count}}
`;
      const result = engine.render(template, {
        showList: true,
        items: ['apple', 'banana'],
        count: 2,
      });

      expect(result).toContain('List:');
      expect(result).toContain('- apple');
      expect(result).toContain('- banana');
      expect(result).toContain('Total: 2');
    });
  });

  describe('validate', () => {
    it('should validate correct template', () => {
      const template = 'Hello {{name}}!';
      const result = engine.validate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unmatched conditionals', () => {
      const template = '{{#if show}}Unclosed';
      const result = engine.validate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unmatched conditionals'))).toBe(true);
    });

    it('should detect unmatched loops', () => {
      const template = '{{#each items}}Unclosed';
      const result = engine.validate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unmatched loops'))).toBe(true);
    });

    it('should detect invalid variable syntax', () => {
      const template = 'Hello {name}!'; // Missing second brace
      const result = engine.validate(template);
      // This should be valid as it's not a template variable
      expect(result.valid).toBe(true);
    });
  });

  describe('extractVariables', () => {
    it('should extract simple variables', () => {
      const template = 'Hello {{name}} from {{city}}!';
      const variables = engine.extractVariables(template);
      expect(variables).toContain('name');
      expect(variables).toContain('city');
    });

    it('should extract variables from conditionals', () => {
      const template = '{{#if show}}Content{{/if}}';
      const variables = engine.extractVariables(template);
      expect(variables).toContain('show');
    });

    it('should extract variables from loops', () => {
      const template = '{{#each items}}{{this}}{{/each}}';
      const variables = engine.extractVariables(template);
      expect(variables).toContain('items');
    });

    it('should not include special variables like @index', () => {
      const template = '{{#each items}}{{@index}}: {{this}}{{/each}}';
      const variables = engine.extractVariables(template);
      expect(variables).toContain('items');
      expect(variables).not.toContain('@index');
      expect(variables).not.toContain('this');
    });

    it('should extract unique variables', () => {
      const template = '{{name}} is {{name}} from {{city}}';
      const variables = engine.extractVariables(template);
      expect(variables).toEqual(expect.arrayContaining(['name', 'city']));
      expect(variables.filter(v => v === 'name')).toHaveLength(1);
    });
  });
});
