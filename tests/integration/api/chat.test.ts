/**
 * Chat API Route Integration Tests
 * Tests the /api/chat endpoint
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { runWorkflow, continueWorkflow } from '@/lib/graph';
import { Stage } from '@/types';
import { createMockState } from '../../mocks/factories';

// Mock the workflow functions
vi.mock('@/lib/graph', () => ({
  runWorkflow: vi.fn(),
  continueWorkflow: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mocked-uuid-1234'),
}));

import { runWorkflow as mockRunWorkflow } from '@/lib/graph';
import { continueWorkflow as mockContinueWorkflow } from '@/lib/graph';

describe('Chat API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('request validation', () => {
    it('should return 400 when message is missing', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Message is required and must be a string');
    });

    it('should return 400 when message is not a string', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 123 }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Message is required and must be a string');
    });

    it('should return 400 when message is empty string', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Message is required and must be a string');
    });
  });

  describe('new session creation', () => {
    it('should create new session when sessionId is not provided', async () => {
      const mockResult = createMockState({
        response: 'Hello! How can I help you today?',
        options: [],
        currentStage: Stage.REQUIREMENT_COLLECTION,
        completeness: 0,
        stop: false,
        profile: {},
      });

      vi.mocked(mockRunWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'I want to build a todo app' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(mockRunWorkflow).toHaveBeenCalledWith(
        'mocked-uuid-1234',
        'I want to build a todo app'
      );
      expect(data.sessionId).toBe('mocked-uuid-1234');
      expect(data.response).toBe('Hello! How can I help you today?');
    });

    it('should use provided sessionId when exists', async () => {
      const mockResult = createMockState({
        response: 'Continuing our conversation...',
        options: [],
        currentStage: Stage.REQUIREMENT_COLLECTION,
        completeness: 20,
        stop: false,
        profile: { projectName: 'Todo App' },
      });

      vi.mocked(mockContinueWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Add more features',
          sessionId: 'existing-session-123',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(mockContinueWorkflow).toHaveBeenCalledWith(
        'existing-session-123',
        'Add more features'
      );
      expect(data.sessionId).toBe('existing-session-123');
      expect(data.response).toBe('Continuing our conversation...');
    });
  });

  describe('non-streaming response', () => {
    it('should return JSON response with all fields', async () => {
      const mockResult = createMockState({
        response: 'Here are your options',
        options: [
          { id: 'option-1', label: 'Option 1', value: 'value-1' },
          { id: 'option-2', label: 'Option 2', value: 'value-2' },
        ],
        currentStage: Stage.TECH_STACK,
        completeness: 75,
        stop: false,
        profile: { projectName: 'Test Project', targetUsers: 'Developers' },
        askedQuestions: ['Question 1', 'Question 2'],
      });

      vi.mocked(mockRunWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Show options' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data).toEqual({
        sessionId: 'mocked-uuid-1234',
        response: 'Here are your options',
        options: [
          { id: 'option-1', label: 'Option 1', value: 'value-1' },
          { id: 'option-2', label: 'Option 2', value: 'value-2' },
        ],
        currentStage: Stage.TECH_STACK,
        completeness: 75,
        stop: false,
        profile: { projectName: 'Test Project', targetUsers: 'Developers' },
        askedQuestions: ['Question 1', 'Question 2'],
      });
    });

    it('should return default values when result fields are missing', async () => {
      const mockResult = createMockState({
        response: undefined as unknown as string,
        currentStage: Stage.INIT,
      });

      vi.mocked(mockRunWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.response).toBe('收到您的消息，正在处理...');
      expect(data.options).toEqual([]);
      expect(data.currentStage).toBe(Stage.INIT);
      expect(data.completeness).toBe(0);
      expect(data.stop).toBe(false);
      expect(data.profile).toEqual({});
      expect(data.askedQuestions).toEqual([]);
    });

    it('should include finalSpec when present', async () => {
      const mockResult = createMockState({
        response: 'Document generated',
        finalSpec: '# Complete Specification Document\n\n## Project Overview\n...',
        currentStage: Stage.COMPLETED,
        stop: true,
      });

      vi.mocked(mockContinueWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Generate document',
          sessionId: 'session-123',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.finalSpec).toBe('# Complete Specification Document\n\n## Project Overview\n...');
      expect(data.stop).toBe(true);
    });
  });

  describe('streaming response', () => {
    it('should return SSE stream when stream=true', async () => {
      const mockResult = createMockState({
        response: 'This is a streamed response',
        options: [{ id: 'opt1', label: 'Option 1', value: 'val1' }],
        currentStage: Stage.REQUIREMENT_COLLECTION,
        completeness: 50,
        profile: { projectName: 'Test' },
      });

      vi.mocked(mockRunWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat?stream=true', {
        method: 'POST',
        body: JSON.stringify({ message: 'Stream this' }),
      });

      // Use fake timers to speed up the streaming delays
      const response = await POST(request as any);

      // Check SSE headers
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
      expect(response.headers.get('Connection')).toBe('keep-alive');
      expect(response.headers.get('X-Session-Id')).toBe('mocked-uuid-1234');

      // Check that response body is a ReadableStream
      expect(response.body).toBeInstanceOf(ReadableStream);

      // Fast-forward through all timers
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let chunks = '';

      // Run all pending timers to complete the stream
      await vi.runAllTimersAsync();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        chunks += decoder.decode(value, { stream: true });
      }

      // Verify SSE format
      expect(chunks).toContain('data: {"chunk":');
      expect(chunks).toContain('data: {"metadata":');
      expect(chunks).toContain('data: [DONE]');
    });

    it('should handle empty response in streaming mode', async () => {
      const mockResult = createMockState({
        response: '',
        options: [],
        currentStage: Stage.INIT,
        completeness: 0,
      });

      vi.mocked(mockRunWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat?stream=true', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test empty' }),
      });

      const response = await POST(request as any);

      // When response is empty (falsy), it returns JSON instead of SSE
      // because the code checks `if (stream && result.response)`
      // So this should return JSON, not SSE
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe('error handling', () => {
    it('should return 500 for general errors', async () => {
      vi.mocked(mockRunWorkflow).mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test error' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe(true);
      expect(data.message).toBe('系统错误，请稍后重试');
    });

    it('should return 503 for LLM_API_KEY errors', async () => {
      vi.mocked(mockRunWorkflow).mockRejectedValueOnce(
        new Error('LLM_API_KEY is not configured')
      );

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.message).toContain('LLM配置错误');
      expect(data.message).toContain('API密钥配置');
    });

    it('should return 503 for 信息提取失败 errors', async () => {
      vi.mocked(mockRunWorkflow).mockRejectedValueOnce(
        new Error('信息提取失败: Invalid input format')
      );

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.message).toContain('信息提取失败');
    });

    it('should return 503 for JSON parsing errors', async () => {
      vi.mocked(mockRunWorkflow).mockRejectedValueOnce(
        new Error('Failed to parse JSON response from LLM')
      );

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.message).toContain('LLM返回格式错误');
    });

    it('should include error details in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      // @ts-ignore - NODE_ENV is read-only in TypeScript but writable at runtime
      process.env.NODE_ENV = 'development';

      vi.mocked(mockRunWorkflow).mockRejectedValueOnce(
        new Error('Specific error message')
      );

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.details).toBe('Specific error message');

      // @ts-ignore
      process.env.NODE_ENV = originalEnv;
    });

    it('should not include error details in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      // @ts-ignore - NODE_ENV is read-only in TypeScript but writable at runtime
      process.env.NODE_ENV = 'production';

      vi.mocked(mockRunWorkflow).mockRejectedValueOnce(
        new Error('Specific error message')
      );

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(data.details).toBeUndefined();

      // @ts-ignore
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle non-Error objects', async () => {
      vi.mocked(mockRunWorkflow).mockRejectedValueOnce('String error');

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe(true);
      expect(data.message).toBe('系统错误，请稍后重试');
    });
  });

  describe('edge cases', () => {
    it('should handle null sessionId as new session', async () => {
      const mockResult = createMockState({
        response: 'New session created',
        options: [],
        currentStage: Stage.INIT,
        completeness: 0,
        stop: false,
        profile: {},
      });

      vi.mocked(mockRunWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test', sessionId: null }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(mockRunWorkflow).toHaveBeenCalled();
      expect(data.sessionId).toBe('mocked-uuid-1234');
    });

    it('should handle undefined sessionId as new session', async () => {
      const mockResult = createMockState({
        response: 'New session created',
        options: [],
        currentStage: Stage.INIT,
        completeness: 0,
        stop: false,
        profile: {},
      });

      vi.mocked(mockRunWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Test', sessionId: undefined }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(mockRunWorkflow).toHaveBeenCalled();
      expect(data.sessionId).toBe('mocked-uuid-1234');
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(10000);

      const mockResult = createMockState({
        response: 'Message received',
        options: [],
        currentStage: Stage.REQUIREMENT_COLLECTION,
        completeness: 0,
        stop: false,
        profile: {},
      });

      vi.mocked(mockRunWorkflow).mockResolvedValueOnce(mockResult as any);

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: longMessage }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(mockRunWorkflow).toHaveBeenCalledWith('mocked-uuid-1234', longMessage);
      expect(data.response).toBe('Message received');
    });
  });
});
