/**
 * LLM 消息构建工具 (LangChain 1.x 兼容)
 * 使用纯对象格式 { role, content }，兼容 LangChain 0.3.x 和 1.x
 */

import type { LLMMessage, ConversationMessage } from './types';

/**
 * 构建 LLM 消息数组
 *
 * @param systemPrompt - 系统提示词
 * @param userMessage - 用户消息
 * @param conversationHistory - 对话历史（可选）
 * @returns 构建好的消息数组
 */
export function buildMessages(
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: ConversationMessage[]
): LLMMessage[] {
  const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];

  // 添加对话历史
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role as LLMMessage['role'], content: msg.content });
    }
  }

  // 添加当前用户消息
  messages.push({ role: 'user', content: userMessage });

  return messages;
}
