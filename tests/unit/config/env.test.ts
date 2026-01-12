import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * 环境变量验证单元测试
 * 测试 validateEnv 函数的所有路径和边界条件
 */

describe('validateEnv', () => {
  // 保存原始环境变量
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 重置环境变量
    process.env = { ...originalEnv };
  });

  describe('normal validation', () => {
    it('should validate successfully with all required environment variables', async () => {
      process.env.LLM_API_KEY = 'test-api-key';

      const { env } = await import('@/config/env');

      expect(env.LLM_API_KEY).toBe('test-api-key');
      expect(env.LLM_PROVIDER).toBe('deepseek'); // default
      expect(env.LLM_MODEL).toBe('deepseek-chat'); // default
    });

    it('should use default values for optional environment variables', async () => {
      process.env.LLM_API_KEY = 'test-api-key';

      const { env } = await import('@/config/env');

      expect(env.NODE_ENV).toBe('development');
      expect(env.LLM_PROVIDER).toBe('deepseek');
      expect(env.LLM_MODEL).toBe('deepseek-chat');
      expect(env.SECRET_SOURCE).toBe('env');
      expect(env.VAULT_SECRET_PATH).toBe('secret');
      expect(env.RATE_LIMIT_ENABLED).toBe(true);
      expect(env.RATE_LIMIT_WINDOW_MS).toBe(60000);
      expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(30);
    });

    it('should accept valid LLM provider values', async () => {
      const validProviders = ['deepseek', 'qwen', 'ollama', 'mimo'];

      for (const provider of validProviders) {
        // Reset module cache for each test
        vi.resetModules();
        process.env.LLM_API_KEY = 'test-api-key';
        process.env.LLM_PROVIDER = provider;

        const { env } = await import('@/config/env');

        expect(env.LLM_PROVIDER).toBe(provider);
      }
    });

    it('should accept valid NODE_ENV values', async () => {
      const validEnvs = ['development', 'production', 'test'];

      for (const nodeEnv of validEnvs) {
        vi.resetModules();
        process.env.LLM_API_KEY = 'test-api-key';
        (process.env as any).NODE_ENV = nodeEnv;

        const { env } = await import('@/config/env');

        expect(env.NODE_ENV).toBe(nodeEnv);
      }
    });

    it('should accept valid SECRET_SOURCE values', async () => {
      const validSources = ['env', 'vault', 'aws_secrets_manager', 'azure_key_vault', 'gcp_secret_manager'];

      for (const source of validSources) {
        vi.resetModules();
        process.env.LLM_API_KEY = 'test-api-key';
        process.env.SECRET_SOURCE = source;

        const { env } = await import('@/config/env');

        expect(env.SECRET_SOURCE).toBe(source);
      }
    });

    it('should accept optional URL fields when valid', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.LLM_BASE_URL = 'https://api.custom.com/v1';
      process.env.VAULT_ADDR = 'https://vault.example.com';
      process.env.AZURE_KEY_VAULT_URI = 'https://vault.azure.net';

      const { env } = await import('@/config/env');

      expect(env.LLM_BASE_URL).toBe('https://api.custom.com/v1');
      expect(env.VAULT_ADDR).toBe('https://vault.example.com');
      expect(env.AZURE_KEY_VAULT_URI).toBe('https://vault.azure.net');
    });

    it('should accept optional string fields', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      process.env.AZURE_CLIENT_ID = 'azure-client-id';
      process.env.AZURE_CLIENT_SECRET = 'azure-client-secret';
      process.env.AZURE_TENANT_ID = 'azure-tenant-id';
      process.env.GCP_PROJECT_ID = 'gcp-project-id';
      process.env.GCP_CREDENTIALS = 'gcp-credentials';
      process.env.VAULT_TOKEN = 'vault-token';

      const { env } = await import('@/config/env');

      expect(env.AWS_REGION).toBe('us-east-1');
      expect(env.AWS_ACCESS_KEY_ID).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(env.AWS_SECRET_ACCESS_KEY).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      expect(env.AZURE_CLIENT_ID).toBe('azure-client-id');
      expect(env.AZURE_CLIENT_SECRET).toBe('azure-client-secret');
      expect(env.AZURE_TENANT_ID).toBe('azure-tenant-id');
      expect(env.GCP_PROJECT_ID).toBe('gcp-project-id');
      expect(env.GCP_CREDENTIALS).toBe('gcp-credentials');
      expect(env.VAULT_TOKEN).toBe('vault-token');
    });

    it('should parse RATE_LIMIT_* values correctly', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.RATE_LIMIT_ENABLED = 'false';
      process.env.RATE_LIMIT_WINDOW_MS = '120000';
      process.env.RATE_LIMIT_MAX_REQUESTS = '60';

      const { env } = await import('@/config/env');

      expect(env.RATE_LIMIT_ENABLED).toBe(false);
      expect(env.RATE_LIMIT_WINDOW_MS).toBe(120000);
      expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(60);
    });
  });

  describe('validation errors - missing required fields', () => {
    it('should throw error when LLM_API_KEY is missing', async () => {
      process.env.LLM_API_KEY = '';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when LLM_API_KEY is undefined', async () => {
      delete process.env.LLM_API_KEY;

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when LLM_API_KEY is empty string', async () => {
      process.env.LLM_API_KEY = '   ';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });
  });

  describe('validation errors - invalid format', () => {
    it('should throw error when LLM_BASE_URL is invalid URL', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.LLM_BASE_URL = 'not-a-valid-url';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when LLM_BASE_URL is missing protocol', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.LLM_BASE_URL = 'api.example.com/v1';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when VAULT_ADDR is invalid URL', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.VAULT_ADDR = 'invalid-vault-url';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when AZURE_KEY_VAULT_URI is invalid URL', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.AZURE_KEY_VAULT_URI = 'not-a-url';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });
  });

  describe('validation errors - invalid enum values', () => {
    it('should throw error when LLM_PROVIDER is invalid', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.LLM_PROVIDER = 'invalid-provider';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when LLM_PROVIDER is empty string', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.LLM_PROVIDER = '';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when NODE_ENV is invalid', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      (process.env as any).NODE_ENV = 'staging';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when SECRET_SOURCE is invalid', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.SECRET_SOURCE = 'invalid-source';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });
  });

  describe('validation errors - multiple errors', () => {
    it('should throw error when multiple required fields are missing', async () => {
      delete process.env.LLM_API_KEY;
      (process.env as any).NODE_ENV = 'invalid';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when multiple fields have invalid format', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.LLM_BASE_URL = 'invalid-url';
      process.env.VAULT_ADDR = 'another-invalid-url';
      process.env.LLM_PROVIDER = 'invalid';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });

    it('should throw error when required and optional fields are invalid', async () => {
      process.env.LLM_API_KEY = '';
      process.env.LLM_BASE_URL = 'not-a-url';
      (process.env as any).NODE_ENV = 'invalid-env';

      vi.resetModules();

      await expect(import('@/config/env')).rejects.toThrow('环境变量配置错误');
    });
  });

  describe('error message formatting', () => {
    it('should format error message for missing LLM_API_KEY', async () => {
      process.env.LLM_API_KEY = '';

      vi.resetModules();

      try {
        await import('@/config/env');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.message).toBe('环境变量配置错误');
        }
      }
    });

    it('should format error message for invalid LLM_PROVIDER', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.LLM_PROVIDER = 'invalid-provider';

      vi.resetModules();

      try {
        await import('@/config/env');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.message).toBe('环境变量配置错误');
        }
      }
    });

    it('should format error message for invalid LLM_BASE_URL', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.LLM_BASE_URL = 'invalid-url';

      vi.resetModules();

      try {
        await import('@/config/env');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.message).toBe('环境变量配置错误');
        }
      }
    });
  });

  describe('boundary values', () => {
    it('should accept single character LLM_API_KEY', async () => {
      process.env.LLM_API_KEY = 'a';

      const { env } = await import('@/config/env');

      expect(env.LLM_API_KEY).toBe('a');
    });

    it('should accept very long LLM_API_KEY', async () => {
      const longKey = 'x'.repeat(1000);
      process.env.LLM_API_KEY = longKey;

      const { env } = await import('@/config/env');

      expect(env.LLM_API_KEY).toBe(longKey);
    });

    it('should accept RATE_LIMIT_WINDOW_MS as 0', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.RATE_LIMIT_WINDOW_MS = '0';

      const { env } = await import('@/config/env');

      expect(env.RATE_LIMIT_WINDOW_MS).toBe(0);
    });

    it('should accept RATE_LIMIT_MAX_REQUESTS as 0', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.RATE_LIMIT_MAX_REQUESTS = '0';

      const { env } = await import('@/config/env');

      expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(0);
    });

    it('should accept very large RATE_LIMIT_WINDOW_MS', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.RATE_LIMIT_WINDOW_MS = '999999999';

      const { env } = await import('@/config/env');

      expect(env.RATE_LIMIT_WINDOW_MS).toBe(999999999);
    });

    it('should accept very large RATE_LIMIT_MAX_REQUESTS', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.RATE_LIMIT_MAX_REQUESTS = '999999999';

      const { env } = await import('@/config/env');

      expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(999999999);
    });

    it('should accept RATE_LIMIT_ENABLED as "true"', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.RATE_LIMIT_ENABLED = 'true';

      const { env } = await import('@/config/env');

      expect(env.RATE_LIMIT_ENABLED).toBe(true);
    });

    it('should accept RATE_LIMIT_ENABLED as "false"', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.RATE_LIMIT_ENABLED = 'false';

      const { env } = await import('@/config/env');

      expect(env.RATE_LIMIT_ENABLED).toBe(false);
    });

    it('should accept RATE_LIMIT_ENABLED as "1"', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.RATE_LIMIT_ENABLED = '1';

      const { env } = await import('@/config/env');

      expect(env.RATE_LIMIT_ENABLED).toBe(true);
    });

    it('should accept RATE_LIMIT_ENABLED as "0"', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.RATE_LIMIT_ENABLED = '0';

      const { env } = await import('@/config/env');

      expect(env.RATE_LIMIT_ENABLED).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle unicode characters in LLM_API_KEY', async () => {
      process.env.LLM_API_KEY = 'test-🔑-key';

      const { env } = await import('@/config/env');

      expect(env.LLM_API_KEY).toBe('test-🔑-key');
    });

    it('should handle special characters in URL fields', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.LLM_BASE_URL = 'https://api.example.com:8443/v1/path?query=value#fragment';

      const { env } = await import('@/config/env');

      expect(env.LLM_BASE_URL).toBe('https://api.example.com:8443/v1/path?query=value#fragment');
    });

    it('should handle empty optional fields', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.AWS_REGION = '';
      process.env.VAULT_TOKEN = '';
      process.env.GCP_PROJECT_ID = '';

      const { env } = await import('@/config/env');

      expect(env.AWS_REGION).toBe('');
      expect(env.VAULT_TOKEN).toBe('');
      expect(env.GCP_PROJECT_ID).toBe('');
    });

    it('should handle whitespace-only optional fields', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      process.env.AWS_REGION = '   ';
      process.env.VAULT_TOKEN = '  ';

      const { env } = await import('@/config/env');

      expect(env.AWS_REGION).toBe('   ');
      expect(env.VAULT_TOKEN).toBe('  ');
    });
  });
});
