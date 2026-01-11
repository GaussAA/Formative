/**
 * MVP Boundary Node
 * 定义MVP边界，明确第一版本的功能范围
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import logger from '../logger';

interface MVPBoundaryResponse {
  mvpFeatures: string[];
  futureFeatures: string[];
  devPlan: {
    phase1: string[];
    phase2?: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
  };
  recommendation: string;
}

export async function mvpBoundaryNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('MVPBoundary', state.sessionId, 'Defining MVP boundaries');

  try {
    const systemPrompt = await promptManager.getPrompt(PromptType.MVP);

    const contextMessage = `
需求画像：
${JSON.stringify(state.profile, null, 2)}

风险分析：
${JSON.stringify(state.summary[Stage.RISK_ANALYSIS], null, 2)}

技术选型：
${JSON.stringify(state.summary[Stage.TECH_STACK], null, 2)}

请根据以上信息，定义MVP的功能边界和开发计划。
明确哪些功能应该放在第一版本，哪些可以延后。
`;

    const result = await callLLMWithJSONByAgent<MVPBoundaryResponse>(
      'mvp', // 使用 mvp 配置：temperature: 0.3, maxTokens: 1500
      systemPrompt,
      contextMessage
    );

    logger.agent('MVPBoundary', state.sessionId, 'MVP boundaries defined', {
      mvpFeaturesCount: result.mvpFeatures.length,
      futureFeaturesCount: result.futureFeatures.length,
    });

    // 更新summary
    const updatedSummary = {
      ...state.summary,
      [Stage.MVP_BOUNDARY]: {
        mvpFeatures: result.mvpFeatures,
        nonGoals: result.futureFeatures,
      },
    };

    // 生成消息
    const message = `根据您的需求，我们建议MVP（最小可行产品）包含以下核心功能：

**MVP核心功能**
${result.mvpFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

**后续版本功能**
${result.futureFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

**开发计划**
- 第一阶段：${result.devPlan.phase1.join('、')}
${result.devPlan.phase2 ? `- 第二阶段：${result.devPlan.phase2.join('、')}` : ''}
- 预估复杂度：${result.devPlan.estimatedComplexity === 'low' ? '较低' : result.devPlan.estimatedComplexity === 'medium' ? '中等' : '较高'}

${result.recommendation}

接下来我将为您生成完整的开发方案文档。`;

    return {
      summary: updatedSummary,
      response: message,
      currentStage: Stage.MVP_BOUNDARY,
      needMoreInfo: false, // 直接进入下一阶段生成文档
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('MVPBoundary node failed', { sessionId: state.sessionId, error: errorMessage });
    return {
      response: 'MVP边界定义完成，准备生成开发方案。',
      currentStage: Stage.DOCUMENT_GENERATION,
      needMoreInfo: false,
    };
  }
}
