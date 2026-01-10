/**
 * Token 计数工具
 * 用于估算文本的 Token 使用量
 */

/**
 * 估算文本的 Token 数量
 * 粗略估算：中文约 2 字符/token，英文约 4 字符/token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;

  // 中文: 1 token ≈ 2 字符
  // 英文: 1 token ≈ 4 字符
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/**
 * Token 使用日志记录
 */
export function logTokenUsage(
  component: string,
  prompt: string,
  response: string,
  logger?: Pick<Console, 'info'>
): void {
  const targetLogger = logger ?? console;
  const promptTokens = estimateTokens(prompt);
  const responseTokens = estimateTokens(response);

  targetLogger.info('Token usage', {
    component,
    promptTokens,
    responseTokens,
    total: promptTokens + responseTokens,
  });
}

/**
 * 格式化 Token 数量为可读形式
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens}`;
  }
  return `${(tokens / 1000).toFixed(1)}k`;
}
