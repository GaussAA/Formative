/**
 * Prompt Template Loader
 *
 * 提供模板加载、缓存和元数据管理功能
 * 支持热重载和版本管理
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '@/lib/logger';
import { PromptTemplateEngine } from './template-engine';

/**
 * Prompt metadata
 */
export interface PromptMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags: string[];
  variables: string[];
  examples?: PromptExample[];
  lastModified: Date;
}

/**
 * Prompt example for few-shot learning
 */
export interface PromptExample {
  id: string;
  input: string;
  output: unknown;
  context?: Record<string, unknown>;
  tags: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * Loaded template with metadata
 */
export interface LoadedTemplate {
  content: string;
  metadata: PromptMetadata;
  version: string;
}

/**
 * Template cache entry
 */
interface CacheEntry {
  content: string;
  metadata: PromptMetadata;
  lastLoaded: Date;
  filePath: string;
}

/**
 * PromptTemplateLoader
 *
 * 模板加载器，支持缓存、热重载和元数据管理
 */
export class PromptTemplateLoader {
  private readonly cache: Map<string, CacheEntry>;
  private readonly engine: PromptTemplateEngine;
  private readonly templatesDir: string;
  private readonly enableHotReload: boolean;

  constructor(options?: {
    templatesDir?: string;
    enableHotReload?: boolean;
  }) {
    this.cache = new Map();
    this.engine = new PromptTemplateEngine(options?.templatesDir);
    this.templatesDir = options?.templatesDir || path.join(process.cwd(), 'src', 'lib', 'prompts', 'templates');
    this.enableHotReload = options?.enableHotReload ?? process.env.NODE_ENV === 'development';

    logger.debug('PromptTemplateLoader initialized', {
      templatesDir: this.templatesDir,
      enableHotReload: this.enableHotReload,
    });
  }

  /**
   * Load template by name
   *
   * @param templateName - Name of the template (without extension)
   * @returns Template content
   */
  async load(templateName: string): Promise<string> {
    const cacheKey = templateName;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !this.enableHotReload) {
      logger.debug('Template loaded from cache', { templateName });
      return cached.content;
    }

    // Load from file
    try {
      const templatePath = await this.resolveTemplatePath(templateName);
      const content = await fs.readFile(templatePath, 'utf-8');

      // Cache the content
      if (!this.enableHotReload) {
        this.cache.set(cacheKey, {
          content,
          metadata: await this.extractMetadata(content, templateName),
          lastLoaded: new Date(),
          filePath: templatePath,
        });
      }

      logger.debug('Template loaded from file', { templateName, path: templatePath });
      return content;
    } catch (error) {
      logger.error('Failed to load template', { templateName, error });
      throw new Error(`Failed to load template '${templateName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load template with metadata
   *
   * @param templateName - Name of the template
   * @returns Template content with metadata
   */
  async loadWithMetadata(templateName: string): Promise<LoadedTemplate> {
    const cacheKey = `${templateName}:withMetadata`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !this.enableHotReload) {
      logger.debug('Template with metadata loaded from cache', { templateName });
      return {
        content: cached.content,
        metadata: cached.metadata,
        version: cached.metadata.version,
      };
    }

    // Load from file
    try {
      const content = await this.load(templateName);
      const metadata = await this.extractMetadata(content, templateName);
      const stats = await this.getFileStats(templateName);

      const result: LoadedTemplate = {
        content,
        metadata,
        version: metadata.version,
      };

      // Cache the result
      if (!this.enableHotReload) {
        this.cache.set(cacheKey, {
          content,
          metadata,
          lastLoaded: new Date(),
          filePath: stats.path,
        });
      }

      logger.debug('Template with metadata loaded', { templateName, version: metadata.version });
      return result;
    } catch (error) {
      logger.error('Failed to load template with metadata', { templateName, error });
      throw error;
    }
  }

  /**
   * Invalidate cache for specific template or all templates
   *
   * @param templateName - Name of the template to invalidate, or undefined to clear all
   */
  invalidate(templateName?: string): void {
    if (templateName) {
      this.cache.delete(templateName);
      this.cache.delete(`${templateName}:withMetadata`);
      logger.info('Template cache invalidated', { templateName });
    } else {
      this.cache.clear();
      logger.info('All template cache cleared');
    }
  }

  /**
   * Get all available template names
   *
   * @returns Array of template names
   */
  async getAvailableTemplates(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.templatesDir);
      const templates: string[] = [];

      for (const file of files) {
        const ext = path.extname(file);
        if (ext === '.md' || ext === '.template.md') {
          templates.push(path.basename(file, ext).replace('.template', ''));
        }
      }

      return templates.sort();
    } catch (error) {
      logger.error('Failed to list templates', { error });
      return [];
    }
  }

  /**
   * Validate all templates
   *
   * @returns Validation results for all templates
   */
  async validateAllTemplates(): Promise<Map<string, { valid: boolean; errors: string[] }>> {
    const results = new Map<string, { valid: boolean; errors: string[] }>();
    const templates = await this.getAvailableTemplates();

    for (const templateName of templates) {
      try {
        const content = await this.load(templateName);
        const validation = this.engine.validate(content);
        results.set(templateName, validation);

        if (!validation.valid) {
          logger.warn('Template validation failed', { templateName, errors: validation.errors });
        }
      } catch (error) {
        results.set(templateName, {
          valid: false,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    }

    return results;
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    totalSize: number;
  } {
    const keys = Array.from(this.cache.keys());
    const totalSize = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.content.length,
      0
    );

    return {
      size: this.cache.size,
      keys,
      totalSize,
    };
  }

  /**
   * Resolve template file path
   * Handles both .template.md and .md extensions
   *
   * @private
   */
  private async resolveTemplatePath(templateName: string): Promise<string> {
    const extensions = ['.template.md', '.md'];

    for (const ext of extensions) {
      const filePath = path.join(this.templatesDir, `${templateName}${ext}`);
      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        // Continue to next extension
      }
    }

    throw new Error(`Template file not found: ${templateName}`);
  }

  /**
   * Extract metadata from template content
   * Parses frontmatter if present
   *
   * @private
   */
  private async extractMetadata(content: string, templateName: string): Promise<PromptMetadata> {
    // Check for YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      try {
        const yaml = frontmatterMatch[1];
        // Simple YAML parser (for common fields)
        const metadata: PromptMetadata = {
          name: this.extractYamlField(yaml, 'name') || templateName,
          version: this.extractYamlField(yaml, 'version') || '1.0.0',
          description: this.extractYamlField(yaml, 'description') || '',
          author: this.extractYamlField(yaml, 'author'),
          tags: this.extractYamlArray(yaml, 'tags') || [],
          variables: this.extractYamlArray(yaml, 'variables') || this.engine.extractVariables(content),
          examples: [],
          lastModified: new Date(),
        };

        return metadata;
      } catch (error) {
        logger.warn('Failed to parse frontmatter', { templateName, error });
      }
    }

    // Default metadata
    return {
      name: templateName,
      version: '1.0.0',
      description: '',
      tags: [],
      variables: this.engine.extractVariables(content),
      examples: [],
      lastModified: new Date(),
    };
  }

  /**
   * Extract field from YAML string
   *
   * @private
   */
  private extractYamlField(yaml: string, field: string): string | undefined {
    const regex = new RegExp(`^${field}:\\s*(.+)$`, 'm');
    const match = yaml.match(regex);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : undefined;
  }

  /**
   * Extract array from YAML string
   *
   * @private
   */
  private extractYamlArray(yaml: string, field: string): string[] | undefined {
    const regex = new RegExp(`^${field}:\\s*\\[(.*?)\\]`, 'm');
    const match = yaml.match(regex);
    if (match) {
      return match[1]
        .split(',')
        .map(item => item.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
    return undefined;
  }

  /**
   * Get file statistics
   *
   * @private
   */
  private async getFileStats(templateName: string): Promise<{
    path: string;
    size: number;
    modified: Date;
  }> {
    const filePath = await this.resolveTemplatePath(templateName);
    const stats = await fs.stat(filePath);

    return {
      path: filePath,
      size: stats.size,
      modified: stats.mtime,
    };
  }
}

// Default export
export default PromptTemplateLoader;
