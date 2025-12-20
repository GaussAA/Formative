/**
 * Spec Generator Node
 * 生成最终的开发文档
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLM } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import logger from '../logger';

export async function specGeneratorNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('SpecGenerator', state.sessionId, 'Generating final specification document');

  try {
    const systemPrompt = await promptManager.getPrompt(PromptType.SPEC);

    const contextMessage = `
请根据以下信息生成开发方案文档：

需求画像：
${JSON.stringify(state.profile, null, 2)}

阶段总结：
${JSON.stringify(state.summary, null, 2)}

请按照9章节结构生成完整的Markdown文档。
`;

    const finalSpec = await callLLM(systemPrompt, contextMessage);

    logger.agent('SpecGenerator', state.sessionId, 'Specification document generated', {
      length: finalSpec.length,
    });

    // 更新summary
    const updatedSummary = {
      ...state.summary,
      [Stage.SPEC_GENERATION]: {
        finalSpec,
      },
    };

    return {
      summary: updatedSummary,
      finalSpec,
      response: '开发方案文档已生成！您可以复制下面的文档，直接交给AI进行开发。',
      currentStage: Stage.COMPLETED,
      stop: true,
      needMoreInfo: false,
    };
  } catch (error: any) {
    logger.error('SpecGenerator node failed', { sessionId: state.sessionId, error: error.message });
    return {
      response: '文档生成失败，请稍后重试。',
      stop: true,
    };
  }
}
