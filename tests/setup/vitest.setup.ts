import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock IndexedDB with fake-indexeddb
import 'fake-indexeddb/auto';

// Mock logger to avoid console output during tests
// Note: This mock is used by most tests, but persistence tests need the real Logger class
// They should use vi.unmock('@/lib/logger') or import from a different path
vi.mock('@/lib/logger', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal() as any;
  return {
    ...actual,
    default: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      agent: vi.fn(),
    },
  };
});

// Mock environment variables for testing
process.env.LLM_PROVIDER = 'deepseek';
process.env.LLM_MODEL = 'deepseek-chat';
process.env.LLM_API_KEY = 'test-api-key-for-testing';
process.env.LLM_BASE_URL = 'https://api.test.com/v1';
