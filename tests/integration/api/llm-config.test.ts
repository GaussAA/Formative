/**
 * LLM Configuration Diagnostic Test
 *
 * Run this test to verify your LLM configuration is correct.
 *
 * Usage:
 *   pnpm test tests/integration/api/llm-config.test.ts
 *
 * Before running, make sure you have a .env.local file with:
 *   LLM_API_KEY=your_api_key_here
 *   LLM_PROVIDER=deepseek (or qwen, ollama, mimo)
 *   LLM_MODEL=deepseek-chat (or corresponding model)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createLLM, callLLM } from '@/lib/llm/helper';
import { env } from '@/config/env';

describe('LLM Configuration', () => {
  describe('Environment Variables', () => {
    it('should have LLM_API_KEY set', () => {
      expect(env.LLM_API_KEY).toBeDefined();
      expect(env.LLM_API_KEY.length).toBeGreaterThan(0);
    });

    it('should have a valid LLM_PROVIDER', () => {
      expect(env.LLM_PROVIDER).toMatch(/^(deepseek|qwen|ollama|mimo)$/);
    });

    it('should have LLM_MODEL set', () => {
      expect(env.LLM_MODEL).toBeDefined();
      expect(env.LLM_MODEL.length).toBeGreaterThan(0);
    });
  });

  describe('LLM Instance Creation', () => {
    it('should create an LLM instance without errors', () => {
      expect(() => {
        createLLM();
      }).not.toThrow();
    });
  });

  describe('LLM API Call', () => {
    it('should successfully call the LLM API', { timeout: 30000 }, async () => {
      const result = await callLLM(
        'You are a helpful assistant.',
        'Say "Hello, World!" in exactly those words.'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toContain('hello');
    });

    it('should handle JSON responses correctly', { timeout: 30000 }, async () => {
      const { callLLMWithJSON } = await import('@/lib/llm/helper');

      interface TestResponse {
        message: string;
        count: number;
      }

      const result = await callLLMWithJSON<TestResponse>(
        'You are a helpful assistant that responds with valid JSON.',
        'Respond with a JSON object: {"message": "test", "count": 42}'
      );

      expect(result).toBeDefined();
      expect(result.message).toBe('test');
      expect(result.count).toBe(42);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key gracefully', async () => {
      // Store original key
      const originalKey = env.LLM_API_KEY;

      // Temporarily set invalid key
      (env as any).LLM_API_KEY = '';

      try {
        const { callLLM: testCallLLM } = await import('@/lib/llm/helper');
        await expect(testCallLLM(
          'You are a helpful assistant.',
          'Say hello'
        )).rejects.toThrow();
      } finally {
        // Restore original key
        (env as any).LLM_API_KEY = originalKey;
      }
    });
  });
});
