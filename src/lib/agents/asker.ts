/**
 * Asker Node
 * 生成问题引导用户补全信息
 */

import { GraphStateType } from '../graph/state';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import logger from '../logger';

interface AskerResponse {
  message: string;
  options?: Array<{ id: string; label: string; value: string }>;
  type: 'single-choice' | 'multiple-choice' | 'text';
}

export async function askerNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('Asker', state.sessionId, 'Generating question for user', {
    currentStage: state.currentStage,
    missingFields: state.missingFields,
  });

  try {
    const systemPrompt = await promptManager.getPrompt(PromptType.ASKER);

    // 总是根据当前状态生成新问题，不使用缓存的nextQuestion
    const contextMessage = `
当前需求画像：
${JSON.stringify(state.profile, null, 2)}

缺失的字段：${state.missingFields?.join(', ') || '无'}

已经问过的问题：
${(state.askedQuestions || []).join('\n')}

当前阶段：${state.currentStage}（1=需求采集，2=风险分析，3=技术选型）

请生成一个NEW的问题来补全这些信息，不要重复之前的问题。
**重要**：
1. 如果当前阶段是需求采集(1)，只问需求相关的问题（目标用户、使用场景、核心功能等）
2. 不要提前问技术选型的问题
3. 生成的选项要与问题匹配
`;

    const result = await callLLMWithJSONByAgent<AskerResponse>(
      'asker', // 使用 asker 配置：temperature: 0.5, maxTokens: 500
      systemPrompt,
      contextMessage
    );

    logger.agent('Asker', state.sessionId, 'Question generated', {
      question: result.message,
      optionsCount: result.options?.length || 0,
    });

    // 记录已问问题
    const askedQuestions = state.askedQuestions || [];

    return {
      response: result.message,
      options: result.options?.map((opt) => ({
        id: opt.id,
        label: opt.label,
        value: opt.value,
      })),
      askedQuestions: [...askedQuestions, result.message],
    };
  } catch (error: any) {
    logger.error('Asker node failed', { sessionId: state.sessionId, error: error.message });

    // 降级：使用简单的默认问题
    const firstMissing = state.missingFields?.[0];
    let defaultQuestion = '请描述一下您的产品目标是什么？';
    let defaultOptions = undefined;

    if (firstMissing?.includes('targetUsers')) {
      defaultQuestion = '这个产品主要是给谁用的？';
    } else if (firstMissing?.includes('coreFunctions')) {
      defaultQuestion = '您希望这个产品有哪些核心功能？';
    } else if (firstMissing?.includes('needsDataStorage')) {
      defaultQuestion = '用户发布的内容需要保存下来吗？';
      defaultOptions = [
        { id: 'yes', label: '需要保存', value: 'true' },
        { id: 'no', label: '不需要保存', value: 'false' },
      ];
    }

    const askedQuestions = state.askedQuestions || [];

    return {
      response: defaultQuestion,
      options: defaultOptions,
      askedQuestions: [...askedQuestions, defaultQuestion],
    };
  }
}
