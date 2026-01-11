/**
 * Prompt Manager Mock
 * Provides mock implementations for the prompt manager
 */

import { vi } from 'vitest';

/**
 * Prompt Type enum (copied to avoid circular dependency)
 */
export enum MockPromptType {
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
 * Default mock prompts for each agent type
 */
const defaultPrompts: Record<string, string> = {
  [MockPromptType.EXTRACTOR]: 'You are an information extractor. Extract structured data from user input.',
  [MockPromptType.PLANNER]: 'You are a requirement planner. Evaluate if requirements are complete.',
  [MockPromptType.ASKER]: 'You are a question generator. Generate clarifying questions.',
  [MockPromptType.FORM_VALIDATOR]: 'You are a form validator. Validate form data.',
  [MockPromptType.RISK]: 'You are a risk analyst. Identify project risks.',
  [MockPromptType.TECH]: 'You are a tech advisor. Recommend technology stacks.',
  [MockPromptType.MVP]: 'You are an MVP planner. Define minimum viable product scope.',
  [MockPromptType.DIAGRAM]: 'You are a diagram designer. Create architecture diagrams.',
  [MockPromptType.DIAGRAM_UPDATE]: 'You are a diagram updater. Update existing diagrams.',
  [MockPromptType.SPEC]: 'You are a specification writer. Generate PRD documents.',
};

/**
 * Creates a mock PromptManager class
 */
export class MockPromptManager {
  private prompts: Map<string, string>;

  constructor(customPrompts?: Partial<Record<string, string>>) {
    const entries = Object.entries({ ...defaultPrompts, ...customPrompts })
      .filter(([, value]) => value !== undefined) as [string, string][];
    this.prompts = new Map(entries);
  }

  async getPrompt(type: string): Promise<string> {
    const prompt = this.prompts.get(type);
    if (!prompt) {
      throw new Error(`Prompt not found: ${type}`);
    }
    return prompt;
  }

  async reloadPrompt(type: string): Promise<void> {
    // Mock reload does nothing
  }

  clearCache(): void {
    // Mock clear does nothing
  }

  getAvailablePrompts(): string[] {
    return Array.from(this.prompts.keys());
  }

  async validatePrompts(): Promise<{ valid: boolean; missing: string[] }> {
    return { valid: true, missing: [] };
  }

  /**
   * Test helper: set a custom prompt for a type
   */
  setPrompt(type: string, prompt: string): void {
    this.prompts.set(type, prompt);
  }

  /**
   * Test helper: clear all prompts
   */
  clearAllPrompts(): void {
    this.prompts.clear();
  }
}

/**
 * Create a mock prompt manager instance
 */
export function createMockPromptManager(customPrompts?: Partial<Record<string, string>>) {
  return new MockPromptManager(customPrompts);
}

/**
 * Get the default prompt for a type (useful for testing)
 */
export function getDefaultPrompt(type: string): string {
  return defaultPrompts[type] || '';
}
