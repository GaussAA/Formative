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
  const effectiveApiKey = provider === 'ollama'
    ? (apiKey || 'ollama')
    : apiKey;

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
    // 去除可能的markdown代码块标记
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch?.[1] || content;

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
  const llm = createLLM({ agentType });

  // 使用消息构建工具
  const messages = buildMessages(systemPrompt, userMessage, conversationHistory);

  try {
    const response = await llm.invoke(messages);
    const content = response.content.toString();

    logger.debug('LLM response received', { agentType, length: content.length });

    // 尝试解析JSON
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch?.[1] || content;

    try {
      return JSON.parse(jsonStr.trim()) as T;
    } catch (parseError) {
      logger.warn('Failed to parse JSON from LLM response', {
        agentType,
        content: content.substring(0, 200),
      });
      throw new Error(`Failed to parse JSON: ${parseError}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('LLM call failed', { agentType, error: errorMessage });
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
