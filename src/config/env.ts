/**
 * 环境变量验证和配置
 * 使用 Zod 进行运行时环境变量验证
 */

import { z } from 'zod';

/**
 * LLM 提供商类型
 */
const LLMProviderSchema = z.enum(['deepseek', 'qwen', 'ollama', 'mimo']);

/**
 * 环境变量 Schema
 */
const envSchema = z.object({
  // LLM 配置
  LLM_PROVIDER: LLMProviderSchema.default('deepseek'),
  LLM_MODEL: z.string().default('deepseek-chat'),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required'),
  LLM_BASE_URL: z.string().url().optional(),

  // Node 环境
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * 验证并解析环境变量
 */
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .filter(issue => issue.path.length > 0)
        .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');

      console.error('❌ 环境变量验证失败:\n' + missingVars);
      console.error('\n请在 .env.local 文件中配置以下变量：');
      console.error('  LLM_API_KEY=your_api_key_here');
      console.error('  LLM_PROVIDER=deepseek (可选: deepseek | qwen | ollama)');
      console.error('  LLM_BASE_URL=https://api.deepseek.com/v1 (可选)');

      throw new Error('环境变量配置错误');
    }
    throw error;
  }
}

/**
 * 导出验证后的环境变量
 */
export const env = validateEnv();

/**
 * 环境变量类型
 */
export type Env = z.infer<typeof envSchema>;

/**
 * 获取 LLM 基础 URL
 */
export function getLLMBaseURL(): string {
  if (env.LLM_BASE_URL) {
    return env.LLM_BASE_URL;
  }

  // 根据 provider 返回默认的 baseURL
  switch (env.LLM_PROVIDER) {
    case 'deepseek':
      return 'https://api.deepseek.com/v1';
    case 'qwen':
      return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    case 'ollama':
      return 'http://localhost:11434/v1';
    case 'mimo':
      return 'https://api.mimo.com/v1';
    default:
      return 'https://api.openai.com/v1';
  }
}

/**
 * 是否为开发环境
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * 是否为生产环境
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * 是否为测试环境
 */
export const isTest = env.NODE_ENV === 'test';
