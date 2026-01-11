/**
 * Tech Advisor Node
 * 提供技术选型建议
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import logger from '../logger';

interface TechAdvisorResponse {
  recommendedCategory: string;
  reasoning: string;
  options: Array<{
    id: string;
    label: string;
    category: string;
    stack: {
      frontend: string;
      backend?: string;
      database?: string;
      deployment: string;
    };
    pros: string[];
    cons: string[];
    suitableFor: string;
    evolutionCost: string;
    recommended?: boolean;
  }>;
  furtherQuestions?: Array<{
    question: string;
    options: Array<{ id: string; label: string; value: string }>;
  }>;
}

export async function techAdvisorNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('TechAdvisor', state.sessionId, 'Providing tech stack recommendations');

  try {
    const systemPrompt = await promptManager.getPrompt(PromptType.TECH);

    const contextMessage = `
需求画像：
${JSON.stringify(state.profile, null, 2)}

风险分析总结：
${JSON.stringify(state.summary[Stage.RISK_ANALYSIS], null, 2)}

请根据需求和风险分析结果，推荐合适的技术方案。
`;

    const result = await callLLMWithJSONByAgent<TechAdvisorResponse>(
      'tech', // 使用 tech 配置：temperature: 0.3, maxTokens: 1500
      systemPrompt,
      contextMessage
    );

    logger.agent('TechAdvisor', state.sessionId, 'Tech recommendations provided', {
      recommendedCategory: result.recommendedCategory,
      optionsCount: result.options.length,
    });

    // 更新summary
    const updatedSummary = {
      ...state.summary,
      [Stage.TECH_STACK]: {
        techStack: {
          category: result.recommendedCategory as 'frontend-only' | 'fullstack' | 'baas',
          frontend: result.options[0]?.stack.frontend,
          backend: result.options[0]?.stack.backend,
          database: result.options[0]?.stack.database,
        },
        reasoning: result.reasoning,
      },
    };

    // 生成消息和选项
    const message = `根据您的需求，我们建议采用「${result.recommendedCategory}」方案。\n\n${result.reasoning}\n\n以下是具体的技术栈选项：`;

    const options = result.options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      value: JSON.stringify(opt.stack),
    }));

    return {
      summary: updatedSummary,
      response: message,
      options,
      currentStage: Stage.TECH_STACK,
      needMoreInfo: true,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('TechAdvisor node failed', { sessionId: state.sessionId, error: errorMessage });
    return {
      response: '建议使用Next.js + Supabase快速搭建MVP。',
      currentStage: Stage.MVP_BOUNDARY,
      needMoreInfo: false,
    };
  }
}
