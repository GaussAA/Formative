/**
 * LLM Helper for LangGraph Agents
 * 使用LangChain的ChatModel进行LLM调用
 */

import { ChatOpenAI } from '@langchain/openai';
import logger from '@/lib/logger';
import { getLLMConfig } from './config';
import { env, getLLMBaseURL } from '@/config/env';
import type { ChatOpenAIConfig, LLMCreateConfig, ConversationMessage } from './types';
import { buildMessages } from './messageBuilder';
import { llmCache, hashString } from '../cache/lru-cache';
import { retryWithTimeout } from '../utils/retry';

/**
 * 创建 LLM 实例（兼容 OpenAI API 的提供商）
 *
 * @param config - LLM 配置选项
 * @returns ChatOpenAI 实例
 */
export function createLLM(config?: LLMCreateConfig) {
  // 如果提供了 agentType，从配置文件获取预设参数
  const llmConfig = config?.agentType ? getLLMConfig(config.agentType) : null;

  const provider = config?.provider || env.LLM_PROVIDER || 'deepseek';
  const model = config?.model || env.LLM_MODEL || 'deepseek-chat';
  const apiKey = env.LLM_API_KEY;
  const temperature = config?.temperature ?? llmConfig?.temperature ?? 0.7;
  const maxTokens = config?.maxTokens ?? llmConfig?.maxTokens;

  // 根据provider设置baseURL
  const baseURL = config?.baseURL || getLLMBaseURL();

  logger.debug('Creating LLM instance', {
    provider,
    model,
    baseURL,
    temperature,
    maxTokens,
    agentType: config?.agentType,
  });

  // Ollama 不需要 API Key，使用占位符
  const effectiveApiKey = provider === 'ollama' ? apiKey || 'ollama' : apiKey;

  const llmParams: ChatOpenAIConfig = {
    model: model,
    temperature,
    apiKey: effectiveApiKey,
    configuration: {
      baseURL,
    },
  };

  // 如果设置了 maxTokens，添加到参数中
  if (maxTokens !== undefined) {
    llmParams.maxTokens = maxTokens;
  }

  return new ChatOpenAI(llmParams);
}

/**
 * 调用 LLM 并解析 JSON 响应
 *
 * @param systemPrompt - 系统提示词
 * @param userMessage - 用户消息
 * @param conversationHistory - 对话历史（可选）
 * @returns 解析后的 JSON 响应
 * @throws {Error} 当 LLM 调用失败或 JSON 解析失败时抛出
 */
export async function callLLMWithJSON<T = unknown>(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: ConversationMessage[]
): Promise<T> {
  const llm = createLLM();

  // 使用消息构建工具
  const messages = buildMessages(systemPrompt, userMessage, conversationHistory);

  try {
    const response = await llm.invoke(messages);
    const content = response.content.toString();

    logger.debug('LLM response received', { length: content.length });

    // 尝试解析JSON
    // 1. 先尝试从 markdown 代码块中提取
    let jsonStr = content;
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1];
    } else {
      // 2. 如果没有代码块，尝试提取 JSON 对象 (处理 LLM 在 JSON 前后添加文本的情况)
      // 查找第一个 { 和最后一个 }
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');

      // 同样处理数组情况
      const firstBracket = content.indexOf('[');
      const lastBracket = content.lastIndexOf(']');

      // 确定是对象还是数组
      if (firstBrace !== -1 && lastBrace !== -1) {
        // 对象类型
        jsonStr = content.substring(firstBrace, lastBrace + 1);
      } else if (firstBracket !== -1 && lastBracket !== -1) {
        // 数组类型
        jsonStr = content.substring(firstBracket, lastBracket + 1);
      }
    }

    try {
      return JSON.parse(jsonStr.trim()) as T;
    } catch (parseError) {
      logger.warn('Failed to parse JSON from LLM response, returning raw content', {
        content: content.substring(0, 200),
      });
      // 如果JSON解析失败，尝试返回原始内容
      throw new Error(`Failed to parse JSON: ${parseError}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('LLM call failed', { error: errorMessage });
    throw error;
  }
}

/**
 * 调用 LLM 并返回文本响应
 *
 * @param systemPrompt - 系统提示词
 * @param userMessage - 用户消息
 * @param conversationHistory - 对话历史（可选）
 * @returns LLM 响应文本
 * @throws {Error} 当 LLM 调用失败时抛出
 */
export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: ConversationMessage[]
): Promise<string> {
  const llm = createLLM();

  // 使用消息构建工具
  const messages = buildMessages(systemPrompt, userMessage, conversationHistory);

  try {
    const response = await llm.invoke(messages);
    return response.content.toString();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('LLM call failed', { error: errorMessage });
    throw error;
  }
}

/**
 * 调用 LLM 并解析 JSON 响应（使用 Agent 配置）
 *
 * 根据指定的 agentType 从配置文件获取优化的参数
 *
 * @param agentType - Agent 类型，用于获取预设配置
 * @param systemPrompt - 系统提示词
 * @param userMessage - 用户消息
 * @param conversationHistory - 对话历史（可选）
 * @returns 解析后的 JSON 响应
 * @throws {Error} 当 LLM 调用失败或 JSON 解析失败时抛出
 */
export async function callLLMWithJSONByAgent<T = unknown>(
  agentType: string,
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: ConversationMessage[]
): Promise<T> {
  // 生成缓存键（基于 agentType、systemPrompt 和 userMessage）
  const cacheKey = hashString(
    JSON.stringify({
      agentType,
      systemPrompt: systemPrompt.slice(0, 500), // 限制长度避免键过长
      userMessage,
    })
  );

  // 检查缓存
  const cached = llmCache.getAs<T>(cacheKey);
  if (cached !== undefined) {
    logger.info('LLM cache hit', { agentType, cacheStats: llmCache.getStats() });
    return cached;
  }

  // 使用重试和超时机制调用 LLM
  try {
    const result = await retryWithTimeout(
      async () => {
        const llm = createLLM({ agentType });
        const messages = buildMessages(systemPrompt, userMessage, conversationHistory);
        const response = await llm.invoke(messages);
        const content = response.content.toString();

        logger.debug('LLM response received', { agentType, length: content.length });

        // 尝试解析JSON
        // 1. 先尝试从 markdown 代码块中提取
        let jsonStr = content;
        const jsonMatch =
          content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch?.[1]) {
          jsonStr = jsonMatch[1];
        } else {
          // 2. 如果没有代码块，尝试提取 JSON 对象 (处理 LLM 在 JSON 前后添加文本的情况)
          // 查找第一个 { 和最后一个 }
          const firstBrace = content.indexOf('{');
          const lastBrace = content.lastIndexOf('}');

          // 同样处理数组情况
          const firstBracket = content.indexOf('[');
          const lastBracket = content.lastIndexOf(']');

          // 确定是对象还是数组
          if (firstBrace !== -1 && lastBrace !== -1) {
            // 对象类型
            jsonStr = content.substring(firstBrace, lastBrace + 1);
          } else if (firstBracket !== -1 && lastBracket !== -1) {
            // 数组类型
            jsonStr = content.substring(firstBracket, lastBracket + 1);
          }
        }

        try {
          return JSON.parse(jsonStr.trim()) as T;
        } catch (parseError) {
          logger.warn('Failed to parse JSON from LLM response', {
            agentType,
            content: content.substring(0, 200),
          });
          throw new Error(`Failed to parse JSON: ${parseError}`);
        }
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        onRetry: (attempt, error) => {
          logger.warn(`LLM call retry attempt ${attempt}`, { agentType, error: error.message });
        },
      },
      30000 // 30 秒超时
    );

    // 存入缓存
    llmCache.set(cacheKey, result);
    logger.debug('LLM response cached', { agentType, cacheStats: llmCache.getStats() });

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('LLM call failed after retries', { agentType, error: errorMessage });
    throw error;
  }
}

/**
 * 调用 LLM 并返回文本响应（使用 Agent 配置）
 *
 * @param agentType - Agent 类型，用于获取预设配置
 * @param systemPrompt - 系统提示词
 * @param userMessage - 用户消息
 * @param conversationHistory - 对话历史（可选）
 * @returns LLM 响应文本
 * @throws {Error} 当 LLM 调用失败时抛出
 */
export async function callLLMByAgent(
  agentType: string,
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: ConversationMessage[]
): Promise<string> {
  const llm = createLLM({ agentType });

  // 使用消息构建工具
  const messages = buildMessages(systemPrompt, userMessage, conversationHistory);

  try {
    const response = await llm.invoke(messages);
    return response.content.toString();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('LLM call failed', { agentType, error: errorMessage });
    throw error;
  }
}
