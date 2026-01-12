/**
 * Risk Analyst Node
 * 分析潜在风险并提供方案选项
 *
 * Migrated to new prompt engineering system with backward compatibility
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import { AgentMigrationHelper } from '../prompts/migration-helper';
import { riskResponseSchema, type RiskResponse } from '@/lib/schemas/agent-schemas';
import logger from '../logger';

/**
 * Migration feature flag
 */
const USE_NEW_SYSTEM = process.env.RISK_USE_NEW_SYSTEM === 'true';

// Singleton migration helper
let migrationHelper: AgentMigrationHelper | null = null;

function getMigrationHelper(): AgentMigrationHelper {
  if (!migrationHelper) {
    migrationHelper = new AgentMigrationHelper();
  }
  return migrationHelper;
}

export async function riskAnalystNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('RiskAnalyst', state.sessionId, 'Analyzing risks', {
    useNewSystem: USE_NEW_SYSTEM,
  });

  try {
    let result: RiskResponse;

    if (USE_NEW_SYSTEM) {
      // Use new migration system
      logger.debug('RiskAnalyst using new prompt system');

      const contextData = {
        profileJson: JSON.stringify(state.profile, null, 2),
      };

      const migrationResult = await getMigrationHelper().migrateAgentCall(
        'risk',
        await promptManager.getPrompt(PromptType.RISK),
        contextData,
        {
          useTemplateEngine: true,
          enableTracking: true,
        },
        async (systemPrompt: string, userMessage: string) => {
          return await callLLMWithJSONByAgent<unknown>(
            'risk',
            systemPrompt,
            userMessage
          );
        }
      );

      if (!migrationResult.success || !migrationResult.response) {
        throw new Error(migrationResult.error || 'Migration failed');
      }

      const parseResult = riskResponseSchema.safeParse(migrationResult.response);
      if (!parseResult.success) {
        logger.warn('RiskAnalyst response validation failed', {
          errors: parseResult.error.issues,
        });
        throw new Error(`Schema validation failed: ${parseResult.error.issues.map(i => i.message).join(', ')}`);
      }

      result = parseResult.data;

      logger.info('RiskAnalyst new system call completed', {
        tokenUsage: migrationResult.tokenUsage,
        duration: migrationResult.duration,
      });
    } else {
      // Use legacy system
      logger.debug('RiskAnalyst using legacy system');

      const systemPrompt = await promptManager.getPrompt(PromptType.RISK);

      const contextMessage = `
需求画像：
${JSON.stringify(state.profile, null, 2)}

请分析潜在风险并提供2-3种可选方案。
`;

      result = await callLLMWithJSONByAgent<RiskResponse>(
        'risk',
        systemPrompt,
        contextMessage
      );
    }

    logger.agent('RiskAnalyst', state.sessionId, 'Risks analyzed', {
      risksCount: result.risks.length,
      optionsCount: result.solutions.length,
    });

    // Update summary - transform new schema to expected format
    const updatedSummary = {
      ...state.summary,
      [Stage.RISK_ANALYSIS]: {
        risks: result.risks.map(r => `${r.category}: ${r.description}`),
        selectedApproach: '',
      },
    };

    // Generate message with options
    const message = `我们分析了您的需求，发现以下几个需要注意的点：\n\n${result.risks
      .map((r, i) => `${i + 1}. **${r.category}**: ${r.description} (${r.severity === 'high' ? '高' : r.severity === 'medium' ? '中' : '低'}风险)`)
      .join('\n')}\n\n${result.reasoning}\n\n请选择您倾向的方案：`;

    const options = result.solutions.map((sol) => ({
      id: sol.id,
      label: sol.name,
      value: sol.id,
    }));

    return {
      summary: updatedSummary,
      response: message,
      options,
      currentStage: Stage.RISK_ANALYSIS,
      needMoreInfo: true,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RiskAnalyst node failed', { sessionId: state.sessionId, error: errorMessage });
    return {
      response: '风险分析完成，建议采用稳健的技术方案。',
      currentStage: Stage.TECH_STACK,
      needMoreInfo: false,
    };
  }
}
