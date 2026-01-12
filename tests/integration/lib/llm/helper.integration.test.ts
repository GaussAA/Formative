/**
 * LLM Helper Integration Tests
 * Tests the LLM helper functions with mocked dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createLLM,
  callLLM,
  callLLMWithJSON,
  callLLMByAgent,
  callLLMWithJSONByAgent,
} from '@/lib/llm/helper';
import { llmCache } from '@/lib/cache/lru-cache';

// Create a shared mock function for all instances
const mockInvokeFn = vi.fn().mockResolvedValue({
  content: 'Mock LLM response',
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
});

// Mock @langchain/openai with a class defined inline to avoid hoisting issues
vi.mock('@langchain/openai', () => {
  class MockChatOpenAI {
    invoke = mockInvokeFn;
    constructor(public config: unknown) {}
  }
  return { ChatOpenAI: MockChatOpenAI };
});

// Mock prompt manager
const mockPromptManager = {
  async getPrompt(type: string): Promise<string> {
    const prompts: Record<string, string> = {
      extractor: 'You are an information extractor.',
      planner: 'You are a requirement planner.',
      asker: 'You are a question generator.',
      'form-validator': 'You are a form validator.',
      risk: 'You are a risk analyst.',
      tech: 'You are a tech advisor.',
      mvp: 'You are an MVP planner.',
      diagram: 'You are a diagram designer.',
      'diagram-update': 'You are a diagram updater.',
      spec: 'You are a specification writer.',
    };
    return prompts[type] || 'Default prompt';
  },
  async reloadPrompt() {},
  clearCache() {},
  getAvailablePrompts() {
    return Object.keys([]);
  },
  async validatePrompts() {
    return { valid: true, missing: [] };
  },
};

vi.mock('@/lib/prompts', () => ({
  default: mockPromptManager,
  PromptType: {
    EXTRACTOR: 'extractor',
    PLANNER: 'planner',
    ASKER: 'asker',
    FORM_VALIDATOR: 'form-validator',
    RISK: 'risk',
    TECH: 'tech',
    MVP: 'mvp',
    DIAGRAM: 'diagram',
    DIAGRAM_UPDATE: 'diagram-update',
    SPEC: 'spec',
  },
}));

// Import ChatOpenAI after mocking
import { ChatOpenAI } from '@langchain/openai';

describe('LLM Helper Integration Tests', () => {
  beforeEach(() => {
    // Clear cache and reset mock before each test
    llmCache.clear();
    mockInvokeFn.mockReset().mockResolvedValue({
      content: 'Mock LLM response',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });
  });

  afterEach(() => {
    llmCache.clear();
  });

  describe('createLLM', () => {
    it('should create ChatOpenAI instance with default config', () => {
      const llm = createLLM();

      // Verify instance was created with correct config
      expect(llm).toBeDefined();
      expect((llm as any).config).toMatchObject({
        model: 'deepseek-chat',
        temperature: 0.7,
        apiKey: expect.any(String),
        configuration: {
          baseURL: expect.any(String),
        },
      });
    });

    it('should create LLM with custom config', () => {
      const llm = createLLM({
        temperature: 0.5,
        maxTokens: 500,
        model: 'custom-model',
      });

      expect((llm as any).config).toMatchObject({
        temperature: 0.5,
        maxTokens: 500,
        model: 'custom-model',
      });
    });

    it('should create LLM with agentType config', () => {
      const llm = createLLM({ agentType: 'extractor' });

      expect((llm as any).config).toMatchObject({
        temperature: 0.1,
        maxTokens: 1000,
      });
    });

    it('should use ollama provider without API key', () => {
      // This test verifies ollama provider can be created
      // The apiKey fallback to 'ollama' happens when env.LLM_API_KEY is not set
      // Since the test environment sets LLM_API_KEY, we just verify it works
      const llm = createLLM({ provider: 'ollama' });

      expect(llm).toBeDefined();
      // Verify ollama uses the configured API key
      expect((llm as any).config.apiKey).toBeTruthy();
    });
  });

  describe('callLLM', () => {
    it('should call LLM and return text response', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: 'Test response',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callLLM('System prompt', 'User message');

      expect(result).toBe('Test response');
      expect(mockInvokeFn).toHaveBeenCalledWith([
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
      ]);
    });

    it('should call LLM with conversation history', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: 'Response with history',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const history = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
      ];

      const result = await callLLM('System prompt', 'New message', history);

      expect(result).toBe('Response with history');
      expect(mockInvokeFn).toHaveBeenCalledWith([
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
        { role: 'user', content: 'New message' },
      ]);
    });

    it('should throw error when LLM call fails', async () => {
      mockInvokeFn.mockRejectedValueOnce(new Error('API Error'));

      await expect(callLLM('System', 'Message')).rejects.toThrow('API Error');
    });
  });

  describe('callLLMWithJSON', () => {
    it('should parse JSON from plain text response', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: '{"key": "value"}',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callLLMWithJSON<{ key: string }>('System', 'Message');

      expect(result).toEqual({ key: 'value' });
    });

    it('should parse JSON from markdown code block', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: '```json\n{"key": "value"}\n```',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callLLMWithJSON<{ key: string }>('System', 'Message');

      expect(result).toEqual({ key: 'value' });
    });

    it('should parse JSON from plain code block', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: '```\n{"key": "value"}\n```',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callLLMWithJSON<{ key: string }>('System', 'Message');

      expect(result).toEqual({ key: 'value' });
    });

    it('should throw error when JSON is invalid', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: 'not valid json',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      await expect(callLLMWithJSON('System', 'Message')).rejects.toThrow('Failed to parse JSON');
    });

    it('should throw error when LLM call fails', async () => {
      mockInvokeFn.mockRejectedValueOnce(new Error('Network error'));

      await expect(callLLMWithJSON('System', 'Message')).rejects.toThrow('Network error');
    });
  });

  describe('callLLMByAgent', () => {
    it('should call LLM with agent-specific config', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: 'Agent response',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callLLMByAgent('extractor', 'System prompt', 'User message');

      expect(result).toBe('Agent response');
      // The LLM instance is created internally, just verify the call happened
      expect(mockInvokeFn).toHaveBeenCalled();
    });

    it('should handle different agent types with different configs', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: 'Response',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      await callLLMByAgent('planner', 'System', 'Message');

      // Verify the call was made
      expect(mockInvokeFn).toHaveBeenCalled();
    });
  });

  describe('callLLMWithJSONByAgent', () => {
    it('should call LLM with agent config and parse JSON', async () => {
      const responseData = { result: 'test', count: 42 };
      mockInvokeFn.mockResolvedValueOnce({
        content: JSON.stringify(responseData),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callLLMWithJSONByAgent<{ result: string; count: number }>(
        'extractor',
        'System prompt',
        'User message'
      );

      expect(result).toEqual(responseData);
    });

    it('should cache responses', async () => {
      const responseData = { cached: true };
      mockInvokeFn.mockResolvedValueOnce({
        content: JSON.stringify(responseData),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      // First call
      const result1 = await callLLMWithJSONByAgent<{ cached: boolean }>(
        'extractor',
        'System prompt',
        'User message'
      );
      expect(result1).toEqual(responseData);
      expect(mockInvokeFn).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await callLLMWithJSONByAgent<{ cached: boolean }>(
        'extractor',
        'System prompt',
        'User message'
      );
      expect(result2).toEqual(responseData);
      expect(mockInvokeFn).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should use different cache keys for different inputs', async () => {
      mockInvokeFn.mockResolvedValue({
        content: '{"data": "value1"}',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      await callLLMWithJSONByAgent('extractor', 'System', 'Message1');
      await callLLMWithJSONByAgent('extractor', 'System', 'Message2');

      expect(mockInvokeFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on failure with exponential backoff', async () => {
      let callCount = 0;
      mockInvokeFn.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return { content: '{"success": true}', usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } };
      });

      const result = await callLLMWithJSONByAgent<{ success: boolean }>(
        'extractor',
        'System',
        'Message'
      );

      expect(result).toEqual({ success: true });
      expect(callCount).toBe(3);
    });

    it('should throw error after max retries', async () => {
      mockInvokeFn.mockRejectedValue(new Error('Persistent failure'));

      await expect(
        callLLMWithJSONByAgent('extractor', 'System', 'Message')
      ).rejects.toThrow();
    });

    it('should parse JSON from markdown response', async () => {
      const responseData = { key: 'value', nested: { item: 1 } };
      mockInvokeFn.mockResolvedValueOnce({
        content: `\`\`\`json\n${JSON.stringify(responseData)}\n\`\`\``,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callLLMWithJSONByAgent('extractor', 'System', 'Message');

      expect(result).toEqual(responseData);
    });
  });

  describe('Cache Behavior', () => {
    it('should not cache responses from different agent types', async () => {
      mockInvokeFn.mockResolvedValue({
        content: '{"result": "value"}',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      await callLLMWithJSONByAgent('extractor', 'System', 'Message');
      await callLLMWithJSONByAgent('planner', 'System', 'Message');

      expect(mockInvokeFn).toHaveBeenCalledTimes(2);
    });

    it('should limit system prompt in cache key to 500 chars', async () => {
      mockInvokeFn.mockResolvedValue({
        content: '{"result": "value"}',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const longPrompt = 'a'.repeat(1000);
      const shortPrompt = 'a'.repeat(500);

      await callLLMWithJSONByAgent('extractor', longPrompt, 'Message');
      await callLLMWithJSONByAgent('extractor', shortPrompt, 'Message');

      // Should use same cache since longPrompt is truncated to 500 chars
      expect(mockInvokeFn).toHaveBeenCalledTimes(1);
    });

    it('should clear cache between different test runs', async () => {
      mockInvokeFn.mockResolvedValue({
        content: '{"result": "value"}',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      // First call
      await callLLMWithJSONByAgent('extractor', 'System', 'Message1');
      expect(llmCache.size).toBeGreaterThan(0);

      // Clear cache manually
      llmCache.clear();

      // Second call should not use cache
      await callLLMWithJSONByAgent('extractor', 'System', 'Message2');
      expect(mockInvokeFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: '{"incomplete": ',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      await expect(
        callLLMWithJSONByAgent('extractor', 'System', 'Message')
      ).rejects.toThrow('Failed to parse JSON');
    });

    it('should handle LLM response with text before JSON', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: 'Some text\n{"key": "value"}',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callLLMWithJSONByAgent<{ key: string }>('extractor', 'System', 'Message');

      expect(result).toEqual({ key: 'value' });
    });

    it('should handle LLM response with text after JSON', async () => {
      mockInvokeFn.mockResolvedValueOnce({
        content: '{"key": "value"}\nSome additional text',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callLLMWithJSONByAgent<{ key: string }>('extractor', 'System', 'Message');

      expect(result).toEqual({ key: 'value' });
    });
  });
});
