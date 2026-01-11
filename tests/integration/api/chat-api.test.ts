/**
 * Chat API Integration Test
 *
 * Tests the /api/chat endpoint with various configurations
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load environment variables before importing anything
const envPath = resolve(process.cwd(), '../../.env.local');
config({ path: envPath });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Chat API Integration Tests', () => {
  describe('Basic API call without streaming', () => {
    it('should return a response with valid message', { timeout: 30000 }, async () => {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '你好' }),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('sessionId');
      expect(data.response).toBeTruthy();
    });

    it('should handle streaming=true parameter', { timeout: 30000 }, async () => {
      const response = await fetch(`${API_URL}/api/chat?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '你好' }),
      });

      expect(response.ok).toBe(true);

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('text/event-stream');

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;
      let hasDone = false;
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            hasDone = true;
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                hasDone = true;
                break;
              } else if (data) {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.chunk) {
                    fullContent += parsed.chunk;
                    chunks++;
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
          if (hasDone) break;
        }
      }

      expect(chunks).toBeGreaterThan(0);
      expect(fullContent).toBeTruthy();
    });

    it('should maintain session with sessionId', { timeout: 30000 }, async () => {
      // First message to create session
      const response1 = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '我的项目是一个在线购物网站' }),
      });

      expect(response1.ok).toBe(true);
      const data1 = await response1.json();
      const sessionId = data1.sessionId;
      expect(sessionId).toBeTruthy();

      // Second message with same sessionId
      const response2 = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '主要功能是什么',
          sessionId,
        }),
      });

      expect(response2.ok).toBe(true);
      const data2 = await response2.json();
      expect(data2.sessionId).toBe(sessionId);
    });

    it('should return error for invalid input', { timeout: 10000 }, async () => {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should include all expected fields in response', { timeout: 30000 }, async () => {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '简单的需求描述' }),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();

      // Check expected fields
      expect(data).toHaveProperty('sessionId');
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('currentStage');
      expect(data).toHaveProperty('completeness');
      expect(data).toHaveProperty('options');
      expect(data).toHaveProperty('profile');
      expect(data).toHaveProperty('askedQuestions');

      // Verify types
      expect(typeof data.sessionId).toBe('string');
      expect(typeof data.response).toBe('string');
      expect(typeof data.currentStage).toBe('number');
      expect(typeof data.completeness).toBe('number');
      expect(Array.isArray(data.options)).toBe(true);
      expect(typeof data.profile).toBe('object');
    });
  });

  describe('Error handling', () => {
    it('should handle missing message field', { timeout: 10000 }, async () => {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should handle rate limiting (if enabled)', { timeout: 10000 }, async () => {
      // This test might fail if rate limiting is disabled or has different settings
      const promises = Array.from({ length: 35 }, () =>
        fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test' }),
        })
      );

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);

      // Rate limiting might or might not trigger depending on configuration
      if (rateLimited) {
        const rateLimitResponse = responses.find(r => r.status === 429);
        expect(rateLimitResponse?.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      }
    }, 60000);
  });

  describe('Session management', () => {
    it('should create new session with UUID format', { timeout: 30000 }, async () => {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test message' }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      // Check UUID format (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(data.sessionId).toMatch(uuidRegex);
    });

    it('should include X-Session-Id header in streaming response', { timeout: 30000 }, async () => {
      const response = await fetch(`${API_URL}/api/chat?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test' }),
      });

      expect(response.ok).toBe(true);
      const sessionId = response.headers.get('X-Session-Id');
      expect(sessionId).toBeTruthy();

      // Verify UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(sessionId).toMatch(uuidRegex);
    });
  });
});
