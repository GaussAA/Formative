/**
 * Risk Analyst Node
 * 分析潜在风险并提供方案选项
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import logger from '../logger';

interface RiskAnalystResponse {
  risks: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  options: Array<{
    id: string;
    label: string;
    description: string;
    pros: string[];
    cons: string[];
    recommended?: boolean;
  }>;
  recommendation: string;
}

export async function riskAnalystNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('RiskAnalyst', state.sessionId, 'Analyzing risks');

  try {
    const systemPrompt = await promptManager.getPrompt(PromptType.RISK);

    const contextMessage = `
需求画像：
${JSON.stringify(state.profile, null, 2)}

请分析潜在风险并提供2-3种可选方案。
`;

    const result = await callLLMWithJSONByAgent<RiskAnalystResponse>(
      'risk', // 使用 risk 配置：temperature: 0.3, maxTokens: 1500
      systemPrompt,
      contextMessage
    );

    logger.agent('RiskAnalyst', state.sessionId, 'Risks analyzed', {
      risksCount: result.risks.length,
      optionsCount: result.options.length,
    });

    // 更新summary
    const updatedSummary = {
      ...state.summary,
      [Stage.RISK_ANALYSIS]: {
        risks: result.risks.map((r) => r.description),
        selectedApproach: '', // 用户稍后选择
      },
    };

    // 生成带选项的问题
    const message = `我们分析了您的需求，发现以下几个需要注意的点：\n\n${result.risks
      .map((r, i) => `${i + 1}. ${r.description}`)
      .join('\n')}\n\n${result.recommendation}\n\n请选择您倾向的方案：`;

    const options = result.options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      value: opt.id,
    }));

    return {
      summary: updatedSummary,
      response: message,
      options,
      currentStage: Stage.RISK_ANALYSIS,
      needMoreInfo: true,
    };
  } catch (error: any) {
    logger.error('RiskAnalyst node failed', { sessionId: state.sessionId, error: error.message });
    return {
      response: '风险分析完成，建议采用稳健的技术方案。',
      currentStage: Stage.TECH_STACK,
      needMoreInfo: false,
    };
  }
}
