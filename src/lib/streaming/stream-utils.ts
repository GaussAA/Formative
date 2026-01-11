/**
 * Streaming Response Utilities
 *
 * Helper functions for implementing Server-Sent Events (SSE)
 * for streaming LLM responses to the client
 *
 * P2 Optimization: Added adaptive chunk sizing and dynamic delay adjustment
 */

/**
 * Convert text to SSE (Server-Sent Events) format chunks
 *
 * @param text - The full text to stream
 * @param chunkSize - Size of each chunk (default: 50 characters)
 * @returns AsyncGenerator that yields SSE formatted chunks
 */
export async function* streamTextAsSSE(
  text: string,
  chunkSize: number = 50
): AsyncGenerator<string, void, unknown> {
  const encoder = new TextEncoder();

  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    const sseMessage = `data: ${JSON.stringify({ chunk })}\n\n`;
    yield sseMessage;

    // Small delay to simulate typing effect
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  // Send completion signal
  yield 'data: [DONE]\n\n';
}

/**
 * SSE metadata that can be sent with the stream
 * Uses unknown for options to match the OptionChip interface (id, label, value)
 */
export interface SSEMetadata {
  options?: unknown; // Array<{ id: string; label: string; value: string }> from OptionChip
  profile?: unknown;
  currentStage?: number;
  completeness?: number;
  [key: string]: unknown;
}

/**
 * Create a ReadableStream for SSE streaming
 *
 * @param text - The text to stream
 * @param metadata - Optional metadata to send at the end of stream
 * @param chunkSize - Size of each chunk
 * @returns ReadableStream that yields SSE formatted data
 */
export function createSSEReadableStream(
  text: string,
  metadata?: SSEMetadata,
  chunkSize: number = 50
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for (let i = 0; i < text.length; i += chunkSize) {
          const chunk = text.slice(i, i + chunkSize);
          const sseMessage = `data: ${JSON.stringify({ chunk })}\n\n`;
          controller.enqueue(encoder.encode(sseMessage));

          // Small delay to simulate typing effect
          await new Promise(resolve => setTimeout(resolve, 20));
        }

        // Send metadata before completion signal
        if (metadata && Object.keys(metadata).length > 0) {
          const metadataMessage = `data: ${JSON.stringify({ metadata })}\n\n`;
          controller.enqueue(encoder.encode(metadataMessage));
        }

        // Send completion signal
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Parse SSE chunk from the client side
 *
 * @param chunk - Raw SSE data chunk
 * @returns Parsed chunk object or null if done signal
 */
export function parseSSEChunk(chunk: string): { chunk: string } | null {
  const trimmed = chunk.trim();

  if (trimmed === 'data: [DONE]') {
    return null;
  }

  if (trimmed.startsWith('data: ')) {
    try {
      const data = JSON.parse(trimmed.slice(6));
      return data;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Split text into chunks for streaming
 *
 * @param text - The text to split
 * @param chunkSize - Target chunk size
 * @returns Array of text chunks
 */
export function splitIntoChunks(text: string, chunkSize: number = 50): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Stream response headers for SSE
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no', // Disable Nginx buffering
} as const;

/**
 * Create an SSE response object
 *
 * @param stream - The ReadableStream to send
 * @returns Response object with SSE headers
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      ...SSE_HEADERS,
    },
  });
}

/**
 * Simulated streaming for development/testing
 * When the actual LLM doesn't support streaming
 *
 * @param text - The text to "stream"
 * @param delay - Delay between chunks in ms
 * @returns AsyncGenerator yielding text chunks
 */
export async function* simulateStreaming(
  text: string,
  delay: number = 30
): AsyncGenerator<string, void, unknown> {
  const chunkSize = Math.max(1, Math.floor(text.length / 20)); // ~20 chunks

  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    yield chunk;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// ============================================================
// P2 PERFORMANCE OPTIMIZATION: Adaptive Streaming
// ============================================================

/**
 * Streaming configuration for adaptive chunking
 */
export interface AdaptiveStreamConfig {
  /** Minimum chunk size in characters (default: 20) */
  minChunkSize?: number;
  /** Maximum chunk size in characters (default: 200) */
  maxChunkSize?: number;
  /** Target delay between chunks in milliseconds (default: 50) */
  targetDelay?: number;
  /** Enable adaptive chunk sizing (default: true) */
  adaptive?: boolean;
  /** Initial chunk size (default: 50) */
  initialChunkSize?: number;
}

/**
 * Streaming statistics
 */
export interface StreamStats {
  /** Total characters sent */
  totalChars: number;
  /** Number of chunks sent */
  chunkCount: number;
  /** Average chunk size */
  avgChunkSize: number;
  /** Average delay between chunks (ms) */
  avgDelay: number;
  /** Total streaming time (ms) */
  totalTime: number;
}

/**
 * Adaptive streaming state
 */
interface AdaptiveStreamState {
  currentChunkSize: number;
  lastChunkTime: number;
  totalChars: number;
  chunkCount: number;
  totalDelay: number;
  startTime: number;
}

/**
 * Default adaptive streaming configuration
 */
const DEFAULT_ADAPTIVE_CONFIG: Required<AdaptiveStreamConfig> = {
  minChunkSize: 20,
  maxChunkSize: 200,
  targetDelay: 50,
  adaptive: true,
  initialChunkSize: 50,
};

/**
 * Stream text with adaptive chunk sizing (P2 Optimization)
 *
 * Adjusts chunk size and delay based on network conditions to achieve
 * smooth streaming with optimal user experience.
 *
 * @param text - Text to stream
 * @param config - Adaptive streaming configuration
 * @returns Object with stream generator and stats getter
 */
export function createAdaptiveStream(
  text: string,
  config: AdaptiveStreamConfig = {}
): {
  stream: AsyncGenerator<string, void, unknown>;
  getStats: () => StreamStats;
} {
  const mergedConfig = {
    minChunkSize: config.minChunkSize ?? DEFAULT_ADAPTIVE_CONFIG.minChunkSize,
    maxChunkSize: config.maxChunkSize ?? DEFAULT_ADAPTIVE_CONFIG.maxChunkSize,
    targetDelay: config.targetDelay ?? DEFAULT_ADAPTIVE_CONFIG.targetDelay,
    adaptive: config.adaptive !== false,
    initialChunkSize: config.initialChunkSize ?? DEFAULT_ADAPTIVE_CONFIG.initialChunkSize,
  };

  const state: AdaptiveStreamState = {
    currentChunkSize: mergedConfig.initialChunkSize,
    lastChunkTime: Date.now(),
    totalChars: 0,
    chunkCount: 0,
    totalDelay: 0,
    startTime: Date.now(),
  };

  async function* stream(): AsyncGenerator<string, void, unknown> {
    let position = 0;
    const textLength = text.length;

    while (position < textLength) {
      // Calculate chunk size
      const chunkSize = calculateChunkSize(
        textLength - position,
        state.currentChunkSize,
        mergedConfig.minChunkSize,
        mergedConfig.maxChunkSize
      );

      // Extract chunk
      const chunk = text.substring(position, position + chunkSize);
      position += chunkSize;

      // Update state
      state.totalChars += chunk.length;
      state.chunkCount++;

      // Calculate delay
      const now = Date.now();
      const elapsed = now - state.lastChunkTime;
      const delay = Math.max(0, mergedConfig.targetDelay - elapsed);

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      state.totalDelay += delay + (Date.now() - now);
      state.lastChunkTime = Date.now();

      // Adapt chunk size based on performance
      if (mergedConfig.adaptive) {
        adaptChunkSize(state, elapsed, delay, mergedConfig);
      }

      yield chunk;
    }
  }

  return {
    stream: stream(),
    getStats: () => ({
      totalChars: state.totalChars,
      chunkCount: state.chunkCount,
      avgChunkSize: state.chunkCount > 0 ? state.totalChars / state.chunkCount : 0,
      avgDelay: state.chunkCount > 0 ? state.totalDelay / state.chunkCount : 0,
      totalTime: Date.now() - state.startTime,
    }),
  };
}

/**
 * Calculate optimal chunk size
 */
function calculateChunkSize(
  remaining: number,
  currentSize: number,
  minSize: number,
  maxSize: number
): number {
  let size = Math.min(currentSize, remaining);
  size = Math.max(size, minSize);
  size = Math.min(size, maxSize);
  return size;
}

/**
 * Adapt chunk size based on network performance
 */
function adaptChunkSize(
  state: AdaptiveStreamState,
  elapsed: number,
  delay: number,
  config: Required<AdaptiveStreamConfig>
): void {
  const totalTime = elapsed + delay;
  const targetTime = config.targetDelay;

  if (totalTime > targetTime * 1.5) {
    // Too slow - decrease chunk size
    state.currentChunkSize = Math.max(
      config.minChunkSize,
      state.currentChunkSize * 0.9
    );
  } else if (totalTime < targetTime * 0.7) {
    // Too fast - increase chunk size
    state.currentChunkSize = Math.min(
      config.maxChunkSize,
      state.currentChunkSize * 1.1
    );
  }
}

/**
 * Pre-configured streaming presets (P2 Optimization)
 */
export const StreamPresets = {
  /** Fast streaming for real-time chat */
  FAST: { minChunkSize: 10, maxChunkSize: 50, targetDelay: 30 },
  /** Balanced streaming */
  BALANCED: { minChunkSize: 20, maxChunkSize: 100, targetDelay: 50 },
  /** Smooth streaming for better readability */
  SMOOTH: { minChunkSize: 30, maxChunkSize: 200, targetDelay: 80 },
  /** Bulk streaming for large responses */
  BULK: { minChunkSize: 100, maxChunkSize: 500, targetDelay: 100 },
} as const;
