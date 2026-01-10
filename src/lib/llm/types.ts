/**
 * LLM 相关类型定义
 */

/**
 * LLM 消息格式（兼容 LangChain 0.3.x 和 1.x）
 * 使用纯对象格式 { role, content }，确保与 LangChain 的 MessageFieldWithRole 兼容
 */
export type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
} & Record<string, unknown>;

/**
 * ChatOpenAI 配置接口 (LangChain 1.x 兼容)
 */
export interface ChatOpenAIConfig {
  model: string;
  temperature: number;
  apiKey: string;
  configuration: {
    baseURL: string;
  };
  maxTokens?: number;
}

/**
 * LLM 创建配置
 */
export interface LLMCreateConfig {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  agentType?: string;
  baseURL?: string;
}

/**
 * 对话历史消息
 */
export interface ConversationMessage {
  role: string;
  content: string;
}
