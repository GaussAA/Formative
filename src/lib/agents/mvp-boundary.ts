/**
 * MVP Boundary Node
 * 定义MVP边界，明确第一版本的功能范围
 *
 * Migrated to new prompt engineering system with backward compatibility
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import { AgentMigrationHelper } from '../prompts/migration-helper';
import { mvpBoundaryResponseSchema, type MVPBoundaryResponse } from '@/lib/schemas/agent-schemas';
import logger from '../logger';

/**
 * Migration feature flag
 */
const USE_NEW_SYSTEM = process.env.MVP_USE_NEW_SYSTEM === 'true';

// Singleton migration helper
let migrationHelper: AgentMigrationHelper | null = null;

function getMigrationHelper(): AgentMigrationHelper {
  if (!migrationHelper) {
    migrationHelper = new AgentMigrationHelper();
  }
  return migrationHelper;
}

export async function mvpBoundaryNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('MVPBoundary', state.sessionId, 'Defining MVP boundaries', {
    useNewSystem: USE_NEW_SYSTEM,
  });

  try {
    let result: MVPBoundaryResponse;

    if (USE_NEW_SYSTEM) {
      // Use new migration system
      logger.debug('MVPBoundary using new prompt system');

      const contextData = {
        profileJson: JSON.stringify(state.profile, null, 2),
        riskAnalysisJson: JSON.stringify(state.summary[Stage.RISK_ANALYSIS] || {}, null, 2),
        techStackJson: JSON.stringify(state.summary[Stage.TECH_STACK] || {}, null, 2),
      };

      const migrationResult = await getMigrationHelper().migrateAgentCall(
        'mvp',
        await promptManager.getPrompt(PromptType.MVP),
        contextData,
        {
          useTemplateEngine: true,
          enableTracking: true,
        },
        async (systemPrompt: string, userMessage: string) => {
          return await callLLMWithJSONByAgent<unknown>(
            'mvp',
            systemPrompt,
            userMessage
          );
        }
      );

      if (!migrationResult.success || !migrationResult.response) {
        throw new Error(migrationResult.error || 'Migration failed');
      }

      const parseResult = mvpBoundaryResponseSchema.safeParse(migrationResult.response);
      if (!parseResult.success) {
        logger.warn('MVPBoundary response validation failed', {
          errors: parseResult.error.issues,
        });
        throw new Error(`Schema validation failed: ${parseResult.error.issues.map(i => i.message).join(', ')}`);
      }

      result = parseResult.data;

      logger.info('MVPBoundary new system call completed', {
        tokenUsage: migrationResult.tokenUsage,
        duration: migrationResult.duration,
      });
    } else {
      // Use legacy system
      logger.debug('MVPBoundary using legacy system');

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

      result = await callLLMWithJSONByAgent<MVPBoundaryResponse>(
        'mvp',
        systemPrompt,
        contextMessage
      );
    }

    logger.agent('MVPBoundary', state.sessionId, 'MVP boundaries defined', {
      coreFeaturesCount: result.coreFeatures.length,
      outOfScopeCount: result.outOfScope.length,
    });

    // Update summary - transform new schema to expected format
    const updatedSummary = {
      ...state.summary,
      [Stage.MVP_BOUNDARY]: {
        mvpFeatures: result.coreFeatures.map(f => f.name),
        nonGoals: result.outOfScope.map(f => `${f.feature} - ${f.reason}`),
      },
    };

    // Generate message
    const coreFeaturesList = result.coreFeatures
      .filter((f) => f.priority === 'must-have')
      .map((f, i) => `${i + 1}. ${f.name} (${f.estimatedEffort})`)
      .join('\n');

    const outOfScopeList = result.outOfScope
      .map((f, i) => `${i + 1}. ${f.feature} - ${f.reason}`)
      .join('\n');

    const phasesList = result.developmentPhases
      .map((p) => `**${p.phase}**: ${p.duration}\n- 功能: ${p.features.join('、')}\n- 交付物: ${p.deliverables.join('、')}`)
      .join('\n\n');

    const message = `根据您的需求，我们建议MVP（最小可行产品）包含以下核心功能：

**MVP核心功能**
${coreFeaturesList}

**后续版本功能**
${outOfScopeList}

**开发计划**
${phasesList}

**总预估工作量**: ${result.totalEstimatedEffort}

接下来我将为您生成完整的开发方案文档。`;

    return {
      summary: updatedSummary,
      response: message,
      currentStage: Stage.MVP_BOUNDARY,
      needMoreInfo: false,
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
