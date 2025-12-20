/**
 * Form Validator Node
 * 验证用户手动填写的表单数据的合理性
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMWithJSON } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import logger from '../logger';

interface FormValidatorResponse {
  isValid: boolean;
  issues: Array<{
    field: string;
    issue: string;
    suggestion: string;
  }>;
  clarificationQuestions?: Array<{
    question: string;
    field: string;
    reason: string;
  }>;
  recommendation: string;
}

export async function formValidatorNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('FormValidator', state.sessionId, 'Validating form submission', {
    profile: state.profile,
  });

  try {
    const systemPrompt = await promptManager.getPrompt(PromptType.FORM_VALIDATOR);

    const contextMessage = `
用户提交的表单数据：
${JSON.stringify(state.profile, null, 2)}

请检查这些信息的合理性和完整性：
1. 产品目标是否清晰具体？
2. 目标用户是否明确？
3. 核心功能是否可行？
4. 各项需求设置是否合理匹配？
5. 是否有明显的矛盾或不合理之处？

如果有问题，请指出需要澄清的地方。
`;

    const result = await callLLMWithJSON<FormValidatorResponse>(systemPrompt, contextMessage);

    logger.agent('FormValidator', state.sessionId, 'Validation completed', {
      isValid: result.isValid,
      issuesCount: result.issues.length,
      hasQuestions: !!result.clarificationQuestions,
    });

    if (!result.isValid && result.clarificationQuestions && result.clarificationQuestions.length > 0) {
      // 有需要澄清的问题
      const firstQuestion = result.clarificationQuestions[0];
      const message = `我们检查了您提交的信息，有几个地方需要确认一下：

${result.issues.map((issue, i) => `${i + 1}. **${issue.field}**: ${issue.issue}`).join('\n')}

${firstQuestion.question}

原因：${firstQuestion.reason}`;

      return {
        response: message,
        needMoreInfo: true,
        currentStage: Stage.REQUIREMENT_COLLECTION, // 停留在需求采集阶段
      };
    }

    if (!result.isValid) {
      // 有问题但没有具体问题，返回一般性建议
      const message = `我们检查了您提交的信息，发现以下需要注意的地方：

${result.issues.map((issue, i) => `${i + 1}. **${issue.field}**: ${issue.issue}\n   💡 建议：${issue.suggestion}`).join('\n\n')}

${result.recommendation}

请问您想要调整这些内容吗？如果确认无误，我们可以继续进行风险分析。`;

      return {
        response: message,
        needMoreInfo: true,
        currentStage: Stage.REQUIREMENT_COLLECTION,
      };
    }

    // 表单验证通过，准备进入风险分析阶段
    logger.info('✅ FormValidator: Form validated successfully, ready for risk analysis');

    return {
      response: `感谢您提供的详细信息！我们已经收集到了完整的需求画像。

${result.recommendation}

接下来，我们将为您分析潜在的技术风险和实现方案。`,
      needMoreInfo: false,
      currentStage: Stage.RISK_ANALYSIS, // 直接进入风险分析阶段
      completeness: 100,
    };
  } catch (error: any) {
    logger.error('FormValidator node failed', {
      sessionId: state.sessionId,
      error: error.message,
    });

    // 验证失败，保守处理：进入对话模式
    return {
      response: '表单验证遇到问题，我们将通过对话方式继续收集信息。',
      needMoreInfo: true,
      currentStage: Stage.REQUIREMENT_COLLECTION,
    };
  }
}
