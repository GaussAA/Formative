/**
 * Prompt Manager Module
 * 管理和加载各个Agent的系统提示词
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '@/lib/logger';

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

class PromptManager {
  private cache: Map<PromptType, string> = new Map();

  /**
   * 获取指定类型的提示词
   */
  async getPrompt(type: PromptType): Promise<string> {
    // 优先从缓存读取
    const cached = this.cache.get(type);
    if (cached) {
      return cached;
    }

    try {
      const filename = `${type}.system.md`;
      const filepath = path.join(PROMPTS_DIR, filename);
      const content = await fs.readFile(filepath, 'utf-8');

      // 缓存提示词
      this.cache.set(type, content);
      logger.debug('Prompt loaded', { type, filepath });

      return content;
    } catch (error) {
      logger.error('Failed to load prompt', { type, error });
      throw new Error(`Failed to load prompt: ${type}`);
    }
  }

  /**
   * 重新加载指定提示词（用于开发时热更新）
   */
  async reloadPrompt(type: PromptType): Promise<void> {
    this.cache.delete(type);
    await this.getPrompt(type);
    logger.info('Prompt reloaded', { type });
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.cache.clear();
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
}

// 单例导出
const promptManager = new PromptManager();
export default promptManager;
