/**
 * Prompt Template Engine
 *
 * 提供提示词模板渲染功能，支持：
 * - 变量插值: {{variable}}
 * - 条件渲染: {{#if condition}}...{{/if}}
 * - 循环渲染: {{#each items}}...{{/each}}
 * - 模板继承: child extends base
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '@/lib/logger';

/**
 * 模板渲染变量
 */
export type TemplateVariables = Record<string, unknown>;

/**
 * 模板验证结果
 */
export interface TemplateValidation {
  valid: boolean;
  errors: string[];
}

/**
 * PromptTemplateEngine
 *
 * 提示词模板引擎，支持变量插值、条件渲染和循环渲染
 */
export class PromptTemplateEngine {
  private readonly templatesDir: string;
  private readonly baseTemplatesDir: string;

  // Regex patterns for template syntax
  private readonly VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;
  private readonly CONDITIONAL_REGEX = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  private readonly LOOP_REGEX = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  private readonly INHERIT_REGEX = /\{\{#extends\s+([\w-/]+)\}\}/;
  private readonly BLOCK_REGEX = /\{\{#block\s+(\w+)\}\}([\s\S]*?)\{\{\/block\}\}/g;
  private readonly BLOCK_INSERT_REGEX = /\{\{#insert\s+(\w+)\}\}/g;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(process.cwd(), 'src', 'lib', 'prompts', 'templates');
    this.baseTemplatesDir = path.join(this.templatesDir, 'base');
  }

  /**
   * Render template with variables
   *
   * @param template - Template string with variables
   * @param variables - Variables to interpolate
   * @returns Rendered template
   */
  render(template: string, variables: TemplateVariables): string {
    let result = template;

    try {
      // 1. Process conditionals (before variables, as they may contain variables)
      result = this.processConditionals(result, variables);

      // 2. Process loops (before variables, as they may contain variables)
      result = this.processLoops(result, variables);

      // 3. Process simple variables
      result = this.processVariables(result, variables);

      logger.debug('Template rendered successfully', {
        templateLength: template.length,
        resultLength: result.length,
        variableCount: Object.keys(variables).length,
      });

      return result;
    } catch (error) {
      logger.error('Template rendering failed', { error });
      throw new Error(`Failed to render template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Render template from file with inheritance support
   *
   * @param templateName - Name of the template file (without extension)
   * @param variables - Variables to interpolate
   * @param options - Render options
   * @returns Rendered template
   */
  async renderWithInheritance(
    templateName: string,
    variables: TemplateVariables,
    options?: { version?: string; locale?: string }
  ): Promise<string> {
    try {
      let templatePath = path.join(this.templatesDir, `${templateName}.template.md`);

      // Check if template exists, fallback to .md
      try {
        await fs.access(templatePath);
      } catch {
        templatePath = path.join(this.templatesDir, `${templateName}.md`);
      }

      // Read template content
      let templateContent = await fs.readFile(templatePath, 'utf-8');

      // Process inheritance
      const extendsMatch = templateContent.match(this.INHERIT_REGEX);
      if (extendsMatch) {
        const baseTemplateName = extendsMatch[1];
        const baseTemplate = await this.loadBaseTemplate(baseTemplateName);
        templateContent = this.processInheritance(baseTemplate, templateContent);
      }

      // Render with variables
      return this.render(templateContent, variables);
    } catch (error) {
      logger.error('Failed to render template with inheritance', { templateName, error });
      throw new Error(`Failed to render template '${templateName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate template syntax
   *
   * @param template - Template string to validate
   * @returns Validation result with errors if any
   */
  validate(template: string): TemplateValidation {
    const errors: string[] = [];

    try {
      // Check for unmatched conditionals
      const ifMatches = template.match(/\{\{#if/g) || [];
      const endIfMatches = template.match(/\{\{\/if\}\}/g) || [];
      if (ifMatches.length !== endIfMatches.length) {
        errors.push(`Unmatched conditionals: ${ifMatches.length} {{#if}} vs ${endIfMatches.length} {{/if}}`);
      }

      // Check for unmatched loops
      const eachMatches = template.match(/\{\{#each/g) || [];
      const endEachMatches = template.match(/\{\{\/each\}\}/g) || [];
      if (eachMatches.length !== endEachMatches.length) {
        errors.push(`Unmatched loops: ${eachMatches.length} {{#each}} vs ${endEachMatches.length} {{/each}}`);
      }

      // Check for invalid variable names
      const invalidVars = template.match(/\{\{[^}]*[^a-zA-Z0-9_.\s][^}]*\}\}/g);
      if (invalidVars) {
        errors.push(`Invalid variable syntax: ${invalidVars.join(', ')}`);
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  /**
   * Extract required variables from template
   *
   * @param template - Template string
   * @returns Array of variable names used in template
   */
  extractVariables(template: string): string[] {
    const variables = new Set<string>();
    const specialVars = new Set(['@index', '@key', 'this']);

    // Extract from {{variable}}
    let match: RegExpExecArray | null;
    const variableRegex = /\{\{([^#/\s}][^}]*)\}\}/g;
    while ((match = variableRegex.exec(template)) !== null) {
      const varPath = match[1].trim();
      // Get the top-level variable name
      const topLevel = varPath.split('.')[0];
      // Skip special variables
      if (!specialVars.has(topLevel)) {
        variables.add(topLevel);
      }
    }

    // Extract from {{#if condition}}
    const conditionalRegex = /\{\{#if\s+([\w.]+)\}\}/g;
    while ((match = conditionalRegex.exec(template)) !== null) {
      variables.add(match[1]);
    }

    // Extract from {{#each items}}
    const loopRegex = /\{\{#each\s+(\w+)\}\}/g;
    while ((match = loopRegex.exec(template)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Process conditional blocks
   *
   * @private
   */
  private processConditionals(template: string, variables: TemplateVariables): string {
    let result = template;
    let match: RegExpExecArray | null;

    // Reset regex state
    this.CONDITIONAL_REGEX.lastIndex = 0;

    while ((match = this.CONDITIONAL_REGEX.exec(template)) !== null) {
      const [fullMatch, condition, body] = match;
      const value = this.getNestedValue(variables, condition);

      // Check if condition is truthy
      const shouldRender = value !== undefined && value !== null && value !== false && value !== '';

      result = result.replace(fullMatch, shouldRender ? body : '');

      // Update template for next iteration
      template = result;
      this.CONDITIONAL_REGEX.lastIndex = 0;
    }

    return result;
  }

  /**
   * Process loop blocks
   *
   * @private
   */
  private processLoops(template: string, variables: TemplateVariables): string {
    let result = template;
    let match: RegExpExecArray | null;

    // Reset regex state
    this.LOOP_REGEX.lastIndex = 0;

    while ((match = this.LOOP_REGEX.exec(template)) !== null) {
      const [fullMatch, arrayName, body] = match;
      const array = variables[arrayName];

      let rendered = '';

      if (Array.isArray(array)) {
        rendered = array
          .map((item, index) => {
            let itemBody = body;

            // Replace {{@index}} with current index
            itemBody = itemBody.replace(/\{\{@index\}\}/g, String(index));

            // Replace {{this}} with current item
            itemBody = itemBody.replace(/\{\{@key\}\}/g, String(index));
            itemBody = itemBody.replace(/\{\{this\}\}/g, this.escapeRegex(String(item)));

            // If item is an object, replace its properties
            if (typeof item === 'object' && item !== null) {
              Object.entries(item).forEach(([key, value]) => {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                itemBody = itemBody.replace(regex, this.escapeRegex(String(value)));
              });
            }

            return itemBody;
          })
          .join('');
      }

      result = result.replace(fullMatch, rendered);

      // Update template for next iteration
      template = result;
      this.LOOP_REGEX.lastIndex = 0;
    }

    return result;
  }

  /**
   * Process simple variables
   *
   * @private
   */
  private processVariables(template: string, variables: TemplateVariables): string {
    return template.replace(this.VARIABLE_REGEX, (match, path) => {
      const trimmedPath = path.trim();
      const value = this.getNestedValue(variables, trimmedPath);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object using dot notation
   *
   * @private
   */
  private getNestedValue(obj: TemplateVariables, path: string): unknown {
    const keys = path.split('.');
    let value: unknown = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Escape special regex characters
   *
   * @private
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Load base template for inheritance
   *
   * @private
   */
  private async loadBaseTemplate(baseName: string): Promise<string> {
    const basePath = path.join(this.baseTemplatesDir, `${baseName}.template.md`);

    try {
      return await fs.readFile(basePath, 'utf-8');
    } catch {
      // Fallback to .md extension
      const mdPath = path.join(this.baseTemplatesDir, `${baseName}.md`);
      return await fs.readFile(mdPath, 'utf-8');
    }
  }

  /**
   * Process template inheritance
   * Extracts blocks from child template and inserts them into base template
   *
   * @private
   */
  private processInheritance(baseTemplate: string, childTemplate: string): string {
    let result = baseTemplate;

    // Extract blocks from child template
    const childBlocks = new Map<string, string>();
    let match: RegExpExecArray | null;

    // Reset regex state
    this.BLOCK_REGEX.lastIndex = 0;

    while ((match = this.BLOCK_REGEX.exec(childTemplate)) !== null) {
      const [, blockName, blockContent] = match;
      childBlocks.set(blockName, blockContent);
    }

    // Insert blocks into base template
    result = result.replace(this.BLOCK_INSERT_REGEX, (match, blockName) => {
      return childBlocks.get(blockName) || match;
    });

    return result;
  }
}

// Default export
export default PromptTemplateEngine;
