/**
 * LLM Mock Factory
 * Provides mock implementations for LangChain ChatOpenAI
 */

import { vi } from 'vitest';
import type { ChatMessage } from '@langchain/core/messages';

/**
 * Mock ChatOpenAI response structure
 */
export interface MockLLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Creates a mock ChatOpenAI instance that returns the specified response
 *
 * @param responseContent - The content string to return
 * @returns A mock ChatOpenAI invoke function
 */
export function createMockLLM(responseContent: string) {
  return {
    invoke: vi.fn().mockResolvedValue({
      content: responseContent,
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    }),
  };
}

/**
 * Creates a mock ChatOpenAI instance that returns JSON response
 *
 * @param responseData - The JSON object to return (will be stringified)
 * @returns A mock ChatOpenAI invoke function
 */
export function createMockLLMJson<T>(responseData: T) {
  const jsonString = JSON.stringify(responseData, null, 2);
  return createMockLLM(jsonString);
}

/**
 * Creates a mock ChatOpenAI instance that returns JSON in markdown code block
 *
 * @param responseData - The JSON object to return
 * @returns A mock ChatOpenAI invoke function
 */
export function createMockLLMJsonMarkdown<T>(responseData: T) {
  const jsonString = JSON.stringify(responseData, null, 2);
  return createMockLLM(`\`\`\`json\n${jsonString}\n\`\`\``);
}

/**
 * Creates a mock ChatOpenAI instance that fails with an error
 *
 * @param errorMessage - The error message to throw
 * @returns A mock ChatOpenAI invoke function that throws
 */
export function createMockLLMError(errorMessage: string) {
  return {
    invoke: vi.fn().mockRejectedValue(new Error(errorMessage)),
  };
}

/**
 * Creates a mock ChatOpenAI instance that returns different responses on sequential calls
 *
 * @param responses - Array of responses to return in sequence
 * @returns A mock ChatOpenAI invoke function
 */
export function createMockLLMSequence(responses: string[]) {
  let callCount = 0;
  return {
    invoke: vi.fn().mockImplementation(() => {
      const response = responses[callCount % responses.length];
      callCount++;
      return Promise.resolve({
        content: response,
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      });
    }),
  };
}

/**
 * Mock ChatOpenAI class
 * Use this to mock the entire @langchain/openai module
 */
export class MockChatOpenAI {
  constructor(private config: unknown) {}

  invoke = vi.fn().mockResolvedValue({
    content: 'Mock LLM response',
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  });

  // Allow dynamic response setting
  setResponse(response: string) {
    this.invoke = vi.fn().mockResolvedValue({
      content: response,
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });
  }

  setError(error: Error) {
    this.invoke = vi.fn().mockRejectedValue(error);
  }
}

/**
 * Mock LangChain messages
 */
export const mockMessages = {
  system: (content: string): ChatMessage => ({
    type: 'system',
    content,
  } as unknown as ChatMessage),

  user: (content: string): ChatMessage => ({
    type: 'user',
    content,
  } as unknown as ChatMessage),

  assistant: (content: string): ChatMessage => ({
    type: 'assistant',
    content,
  } as unknown as ChatMessage),
};

/**
 * Vitest mock setup function for @langchain/openai
 * Call this in beforeEach to set up the module mock
 */
export function setupLLMMock() {
  vi.mock('@langchain/openai', () => ({
    ChatOpenAI: vi.fn().mockImplementation((config) => new MockChatOpenAI(config)),
  }));
}

/**
 * Reset all LLM mocks
 * Call this in afterEach to clean up
 */
export function resetLLMMocks() {
  vi.clearAllMocks();
}
