/**
 * LLM Helper for LangGraph Agents
 * 使用LangChain的ChatModel进行LLM调用
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import logger from '@/lib/logger';

// 创建LLM实例（兼容OpenAI API的提供商）
export function createLLM(config?: {
  provider?: string;
  model?: string;
  temperature?: number;
}) {
  const provider = config?.provider || process.env.LLM_PROVIDER || 'deepseek';
  const model = config?.model || process.env.LLM_MODEL || 'deepseek-chat';
  const apiKey = process.env.LLM_API_KEY;
  const temperature = config?.temperature ?? 0.7;

  // 根据provider设置baseURL
  let baseURL = process.env.LLM_BASE_URL;
  if (!baseURL) {
    switch (provider) {
      case 'deepseek':
        baseURL = 'https://api.deepseek.com/v1';
        break;
      case 'qwen':
        baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        break;
      default:
        baseURL = 'https://api.openai.com/v1';
    }
  }

  logger.debug('Creating LLM instance', { provider, model, baseURL });

  if (!apiKey) {
    throw new Error(`LLM_API_KEY is required. Please set it in .env file.`);
  }

  return new ChatOpenAI({
    modelName: model,
    temperature,
    apiKey: apiKey, // 使用apiKey而不是openAIApiKey
    configuration: {
      baseURL,
    },
  });
}

/**
 * 调用LLM并解析JSON响应
 */
export async function callLLMWithJSON<T = any>(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<T> {
  const llm = createLLM();

  const messages = [
    new SystemMessage(systemPrompt),
  ];

  // 添加对话历史
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content));
      }
    }
  }

  // 添加当前用户消息
  messages.push(new HumanMessage(userMessage));

  try {
    const response = await llm.invoke(messages);
    const content = response.content.toString();

    logger.debug('LLM response received', { length: content.length });

    // 尝试解析JSON
    // 去除可能的markdown代码块标记
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    try {
      return JSON.parse(jsonStr.trim()) as T;
    } catch (parseError) {
      logger.warn('Failed to parse JSON from LLM response, returning raw content', {
        content: content.substring(0, 200),
      });
      // 如果JSON解析失败，尝试返回原始内容
      throw new Error(`Failed to parse JSON: ${parseError}`);
    }
  } catch (error: any) {
    logger.error('LLM call failed', { error: error.message });
    throw error;
  }
}

/**
 * 调用LLM并返回文本响应
 */
export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<string> {
  const llm = createLLM();

  const messages = [
    new SystemMessage(systemPrompt),
  ];

  // 添加对话历史
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content));
      }
    }
  }

  // 添加当前用户消息
  messages.push(new HumanMessage(userMessage));

  try {
    const response = await llm.invoke(messages);
    return response.content.toString();
  } catch (error: any) {
    logger.error('LLM call failed', { error: error.message });
    throw error;
  }
}
