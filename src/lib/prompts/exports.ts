/**
 * Prompts Module - Unified Export
 *
 * 导出所有提示词工程相关功能
 */

// Main prompt manager
export { default as promptManager, PromptManager, PromptType } from './index';

// Template engine
export { PromptTemplateEngine } from './template-engine';
export type { TemplateVariables, TemplateValidation } from './template-engine';

// Template loader
export { PromptTemplateLoader } from './template-loader';
export type { PromptMetadata, PromptExample, LoadedTemplate } from './template-loader';

// Version management
export { PromptVersionManager } from './prompt-version';
export type {
  PromptVersion,
  ABTestConfig,
  ABTestResults,
  VersionComparison,
  PromptUsage,
} from './prompt-version';
