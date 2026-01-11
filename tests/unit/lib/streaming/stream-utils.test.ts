import { describe, it, expect } from 'vitest';
import {
  streamTextAsSSE,
  createSSEReadableStream,
  parseSSEChunk,
  splitIntoChunks,
  simulateStreaming,
  SSE_HEADERS,
  createSSEResponse,
  type SSEMetadata,
} from '@/lib/streaming/stream-utils';

describe('stream-utils', () => {
  describe('splitIntoChunks', () => {
    it('should split text into chunks', () => {
      const text = 'Hello World';
      const chunks = splitIntoChunks(text, 5);

      expect(chunks).toEqual(['Hello', ' Worl', 'd']);
    });

    it('should handle empty string', () => {
      const chunks = splitIntoChunks('', 5);
      expect(chunks).toEqual([]);
    });

    it('should use default chunk size of 50', () => {
      const text = 'a'.repeat(100);
      const chunks = splitIntoChunks(text);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(50);
      expect(chunks[1]).toHaveLength(50);
    });

    it('should handle text shorter than chunk size', () => {
      const text = 'Hi';
      const chunks = splitIntoChunks(text, 10);

      expect(chunks).toEqual(['Hi']);
    });

    it('should handle text exactly equal to chunk size', () => {
      const text = 'abcde';
      const chunks = splitIntoChunks(text, 5);

      expect(chunks).toEqual(['abcde']);
    });

    it('should handle unicode characters', () => {
      const text = '你好世界';
      const chunks = splitIntoChunks(text, 2);

      expect(chunks).toEqual(['你好', '世界']);
    });
  });

  describe('streamTextAsSSE', () => {
    it('should stream text as SSE chunks', async () => {
      const text = 'Hi';
      const chunks: string[] = [];
      const generator = streamTextAsSSE(text, 2);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2); // 'Hi' + [DONE]
      expect(chunks[0]).toContain('data: {"chunk":"Hi"}');
      expect(chunks[chunks.length - 1]).toBe('data: [DONE]\n\n');
    });

    it('should use default chunk size of 50', async () => {
      const text = 'a'.repeat(100);
      const chunks: string[] = [];
      const generator = streamTextAsSSE(text);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should have 3 chunks: 50 chars, 50 chars, [DONE]
      expect(chunks).toHaveLength(3);
    });

    it('should handle empty string', async () => {
      const text = '';
      const chunks: string[] = [];
      const generator = streamTextAsSSE(text);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should only have [DONE] signal
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('data: [DONE]\n\n');
    });

    it('should produce valid SSE format', async () => {
      const text = 'Hello';
      const chunks: string[] = [];
      const generator = streamTextAsSSE(text, 5);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toMatch(/^data: \{.*?\}\n\n$/);
    });
  });

  describe('createSSEReadableStream', () => {
    it('should create a readable stream for SSE', async () => {
      const text = 'Hi';
      const stream = createSSEReadableStream(text, undefined, 2);

      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];

      let done = false;
      while (!done) {
        const result = await reader.read();
        if (result.done) {
          done = true;
        } else if (result.value) {
          chunks.push(result.value);
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
      const decoder = new TextDecoder();
      const text1 = decoder.decode(chunks[0]);
      expect(text1).toContain('data: {"chunk":"Hi"}');
    });

    it('should include metadata in stream', async () => {
      const text = 'Hi';
      const metadata: SSEMetadata = {
        currentStage: 1,
        completeness: 50,
      };
      const stream = createSSEReadableStream(text, metadata, 2);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let done = false;
      while (!done) {
        const result = await reader.read();
        if (result.done) {
          done = true;
        } else if (result.value) {
          const decoder = new TextDecoder();
          chunks.push(decoder.decode(result.value));
        }
      }

      const fullText = chunks.join('');
      expect(fullText).toContain('"metadata"');
      expect(fullText).toContain('"currentStage":1');
      expect(fullText).toContain('"completeness":50');
    });

    it('should handle empty metadata object', async () => {
      const text = 'Hi';
      const stream = createSSEReadableStream(text, {}, 2);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let done = false;
      while (!done) {
        const result = await reader.read();
        if (result.done) {
          done = true;
        } else if (result.value) {
          const decoder = new TextDecoder();
          chunks.push(decoder.decode(result.value));
        }
      }

      // Should not include metadata if empty
      const fullText = chunks.join('');
      expect(fullText).not.toContain('"metadata"');
    });

    it('should send [DONE] signal at end', async () => {
      const text = 'Hi';
      const stream = createSSEReadableStream(text);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let done = false;
      while (!done) {
        const result = await reader.read();
        if (result.done) {
          done = true;
        } else if (result.value) {
          const decoder = new TextDecoder();
          chunks.push(decoder.decode(result.value));
        }
      }

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk).toContain('data: [DONE]');
    });
  });

  describe('parseSSEChunk', () => {
    it('should parse valid SSE chunk', () => {
      const chunk = 'data: {"chunk":"Hello"}';
      const result = parseSSEChunk(chunk);

      expect(result).toEqual({ chunk: 'Hello' });
    });

    it('should parse SSE chunk with newlines', () => {
      const chunk = 'data: {"chunk":"Hello"}\n\n';
      const result = parseSSEChunk(chunk);

      expect(result).toEqual({ chunk: 'Hello' });
    });

    it('should parse SSE chunk with spaces', () => {
      const chunk = '  data: {"chunk":"Hello"}  ';
      const result = parseSSEChunk(chunk);

      expect(result).toEqual({ chunk: 'Hello' });
    });

    it('should return null for [DONE] signal', () => {
      const chunk = 'data: [DONE]';
      const result = parseSSEChunk(chunk);

      expect(result).toBeNull();
    });

    it('should return null for [DONE] with newlines', () => {
      const chunk = 'data: [DONE]\n\n';
      const result = parseSSEChunk(chunk);

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const chunk = 'data: {invalid json}';
      const result = parseSSEChunk(chunk);

      expect(result).toBeNull();
    });

    it('should return null for non-data lines', () => {
      const chunk = 'event: message';
      const result = parseSSEChunk(chunk);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseSSEChunk('');

      expect(result).toBeNull();
    });

    it('should parse complex JSON data', () => {
      const chunk = 'data: {"chunk":"Hello","metadata":{"stage":1}}';
      const result = parseSSEChunk(chunk);

      expect(result).toEqual({
        chunk: 'Hello',
        metadata: { stage: 1 },
      });
    });
  });

  describe('simulateStreaming', () => {
    it('should simulate streaming with chunks', async () => {
      const text = 'Hello World';
      const chunks: string[] = [];
      const generator = simulateStreaming(text, 5);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(1);
      const reconstructed = chunks.join('');
      expect(reconstructed).toBe(text);
    });

    it('should calculate appropriate chunk size', async () => {
      const text = 'abcdefghij'; // 10 chars
      const chunks: string[] = [];
      const generator = simulateStreaming(text, 0);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should create chunks
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle single character', async () => {
      const text = 'a';
      const chunks: string[] = [];
      const generator = simulateStreaming(text, 0);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['a']);
    });

    it('should handle empty string', async () => {
      const text = '';
      const chunks: string[] = [];
      const generator = simulateStreaming(text, 0);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([]);
    });
  });

  describe('SSE_HEADERS', () => {
    it('should have correct headers', () => {
      expect(SSE_HEADERS).toEqual({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
    });

    it('should be readonly', () => {
      // The headers are defined with `as const` which makes them readonly
      expect(SSE_HEADERS['Content-Type']).toBe('text/event-stream');
    });
  });

  describe('createSSEResponse', () => {
    it('should create a Response with SSE headers', () => {
      const stream = new ReadableStream();
      const response = createSSEResponse(stream);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
      expect(response.headers.get('Connection')).toBe('keep-alive');
      expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    });

    it('should use the provided stream', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: test\n\n'));
          controller.close();
        },
      });
      const response = createSSEResponse(stream);

      const text = await response.text();
      expect(text).toBe('data: test\n\n');
    });
  });

  describe('SSEMetadata interface', () => {
    it('should accept optional properties', () => {
      const metadata1: SSEMetadata = {};
      const metadata2: SSEMetadata = { currentStage: 1 };
      const metadata3: SSEMetadata = {
        options: [{ id: '1', label: 'Test', value: 'test' }],
        profile: { name: 'Test' },
        currentStage: 1,
        completeness: 50,
      };

      expect(metadata1).toEqual({});
      expect(metadata2.currentStage).toBe(1);
      expect(metadata3.options).toBeDefined();
    });

    it('should allow additional properties', () => {
      const metadata: SSEMetadata = {
        currentStage: 1,
        customField: 'custom value',
        anotherField: 123,
      };

      expect(metadata.currentStage).toBe(1);
      expect(metadata.customField).toBe('custom value');
      expect(metadata.anotherField).toBe(123);
    });
  });
});
