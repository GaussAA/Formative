/**
 * Prompt Manager Module
 * 管理和加载各个Agent的系统提示词
 *
 * Enhanced with template engine support while maintaining backward compatibility
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '@/lib/logger';
import { PromptTemplateEngine } from './template-engine';
import { PromptTemplateLoader } from './template-loader';
import { PromptVersionManager } from './prompt-version';
import { AgentMigrationHelper } from './migration-helper';
import globalSchemaRegistry from '@/lib/schemas/schema-registry';
import { agentSchemas } from '@/lib/schemas/agent-schemas';
import type { TemplateVariables, PromptUsage } from '@/types';

const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

export enum PromptType {
  EXTRACTOR = 'extractor',
  PLANNER = 'planner',
  ASKER = 'asker',
  FORM_VALIDATOR = 'form-validator',
  RISK = 'risk',
  TECH = 'tech',
  MVP = 'mvp',
  DIAGRAM = 'diagram',
  DIAGRAM_UPDATE = 'diagram-update',
  SPEC = 'spec',
}

/**
 * Prompt Manager Options
 */
interface PromptManagerOptions {
  /**
   * Enable new template engine system
   * @default false for backward compatibility
   */
  useTemplateEngine?: boolean;

  /**
   * Enable hot reload for development
   * @default true in development
   */
  enableHotReload?: boolean;

  /**
   * Custom templates directory
   */
  templatesDir?: string;
}

/**
 * Prompt Manager
 *
 * Enhanced prompt manager with template engine support
 * Maintains full backward compatibility with existing code
 */
class PromptManager {
  private cache: Map<PromptType, string> = new Map();
  private templateEngine: PromptTemplateEngine;
  private templateLoader: PromptTemplateLoader;
  private versionManager: PromptVersionManager;
  private options: Required<PromptManagerOptions>;

  constructor(options?: PromptManagerOptions) {
    this.options = {
      useTemplateEngine: options?.useTemplateEngine ?? false,
      enableHotReload: options?.enableHotReload ?? process.env.NODE_ENV === 'development',
      templatesDir: options?.templatesDir || path.join(process.cwd(), 'src', 'lib', 'prompts', 'templates'),
    };

    this.templateEngine = new PromptTemplateEngine(this.options.templatesDir);
    this.templateLoader = new PromptTemplateLoader({
      templatesDir: this.options.templatesDir,
      enableHotReload: this.options.templateEngine,
    });
    this.versionManager = new PromptVersionManager();

    this.initializeSchemas();
    logger.info('PromptManager initialized', { options: this.options });
  }

  /**
   * Initialize schemas for all agents
   * @private
   */
  private initializeSchemas(): void {
    const agentTypeMapping: Record<PromptType, string> = {
      [PromptType.EXTRACTOR]: 'extractor',
      [PromptType.PLANNER]: 'planner',
      [PromptType.ASKER]: 'asker',
      [PromptType.FORM_VALIDATOR]: 'formValidator',
      [PromptType.RISK]: 'risk',
      [PromptType.TECH]: 'tech',
      [PromptType.MVP]: 'mvp',
      [PromptType.DIAGRAM]: 'diagram',
      [PromptType.DIAGRAM_UPDATE]: 'diagram-update',
      [PromptType.SPEC]: 'spec',
    };

    for (const [promptType, schemaKey] of Object.entries(agentTypeMapping)) {
      const schema = (agentSchemas as Record<string, unknown>)[schemaKey];
      if (schema) {
        globalSchemaRegistry.register(promptType, {
          agentType: promptType,
          zodSchema: schema,
          jsonSchema: {},
          example: null,
          version: '1.0.0',
        });
      }
    }
  }

  /**
   * 获取指定类型的提示词 (Legacy API - 向后兼容)
   *
   * @param type - 提示词类型
   * @returns 提示词内容
   */
  async getPrompt(type: PromptType): Promise<string> {
    // If template engine is enabled, use it
    if (this.options.useTemplateEngine) {
      return this.renderPrompt(type, {});
    }

    // Legacy behavior: read from prompts/ directory
    const cached = this.cache.get(type);
    if (cached) {
      return cached;
    }

    try {
      const filename = `${type}.system.md`;
      const filepath = path.join(PROMPTS_DIR, filename);
      const content = await fs.readFile(filepath, 'utf-8');

      this.cache.set(type, content);
      logger.debug('Prompt loaded (legacy)', { type, filepath });

      return content;
    } catch (error) {
      logger.error('Failed to load prompt', { type, error });
      throw new Error(`Failed to load prompt: ${type}`);
    }
  }

  /**
   * 渲染带变量的提示词 (New API)
   *
   * @param type - 提示词类型
   * @param variables - 模板变量
   * @returns 渲染后的提示词
   */
  async renderPrompt(type: PromptType, variables: TemplateVariables): Promise<string> {
    try {
      const templateName = this.getTemplateName(type);

      if (this.options.useTemplateEngine) {
        // Use new template engine
        return await this.templateEngine.renderWithInheritance(templateName, variables);
      }

      // Fallback: load template and render
      const template = await this.templateLoader.load(templateName);
      return this.templateEngine.render(template, variables);
    } catch (error) {
      logger.error('Failed to render prompt', { type, error });
      throw new Error(`Failed to render prompt '${type}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取带元数据的提示词 (New API)
   *
   * @param type - 提示词类型
   * @returns 提示词内容和元数据
   */
  async getPromptWithMetadata(type: PromptType): Promise<{
    content: string;
    metadata: {
      version: string;
      variables: string[];
      description?: string;
    };
  }> {
    const templateName = this.getTemplateName(type);
    const loaded = await this.templateLoader.loadWithMetadata(templateName);

    return {
      content: loaded.content,
      metadata: {
        version: loaded.version,
        variables: loaded.metadata.variables,
        description: loaded.metadata.description,
      },
    };
  }

  /**
   * 重新加载指定提示词（用于开发时热更新）
   *
   * @param type - 提示词类型
   */
  async reloadPrompt(type: PromptType): Promise<void> {
    this.cache.delete(type);
    this.templateLoader.invalidate(this.getTemplateName(type));
    await this.getPrompt(type);
    logger.info('Prompt reloaded', { type });
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.templateLoader.invalidate();
    logger.info('Prompt cache cleared');
  }

  /**
   * 获取所有可用的提示词类型
   */
  getAvailablePrompts(): PromptType[] {
    return Object.values(PromptType);
  }

  /**
   * 检查提示词文件是否存在
   */
  async validatePrompts(): Promise<{ valid: boolean; missing: PromptType[] }> {
    const missing: PromptType[] = [];

    for (const type of Object.values(PromptType)) {
      try {
        await this.getPrompt(type);
      } catch {
        missing.push(type);
      }
    }

    const valid = missing.length === 0;
    if (!valid) {
      logger.warn('Some prompts are missing', { missing });
    }

    return { valid, missing };
  }

  /**
   * 追踪提示词使用情况 (New API - for observability)
   *
   * @param usage - 使用数据
   */
  async trackUsage(usage: PromptUsage): Promise<void> {
    await this.versionManager.trackUsage(usage);
    logger.debug('Prompt usage tracked', { agentType: usage.agentType, version: usage.version });
  }

  /**
   * 获取 Schema Registry (New API)
   */
  getSchemaRegistry() {
    return globalSchemaRegistry;
  }

  /**
   * 获取 Template Engine (New API)
   */
  getTemplateEngine() {
    return this.templateEngine;
  }

  /**
   * 获取 Version Manager (New API)
   */
  getVersionManager() {
    return this.versionManager;
  }

  /**
   * Map PromptType enum to template name
   * @private
   */
  private getTemplateName(type: PromptType): string {
    // Convert enum values like 'form-validator' to 'formValidator' for schema lookup
    return type;
  }
}

// Create singleton instance
const promptManager = new PromptManager();

// Export class for testing/custom instances
export { PromptManager };

// Default export: singleton instance
export default promptManager;
