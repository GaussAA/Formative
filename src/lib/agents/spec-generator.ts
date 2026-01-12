/**
 * Spec Generator Node
 * 生成最终的开发文档
 *
 * Migrated to new prompt engineering system with backward compatibility
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import { AgentMigrationHelper } from '../prompts/migration-helper';
import logger from '../logger';

/**
 * Migration feature flag
 */
const USE_NEW_SYSTEM = process.env.SPEC_USE_NEW_SYSTEM === 'true';

// Singleton migration helper
let migrationHelper: AgentMigrationHelper | null = null;

function getMigrationHelper(): AgentMigrationHelper {
  if (!migrationHelper) {
    migrationHelper = new AgentMigrationHelper();
  }
  return migrationHelper;
}

export async function specGeneratorNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('SpecGenerator', state.sessionId, 'Generating final specification document', {
    useNewSystem: USE_NEW_SYSTEM,
  });

  try {
    let finalSpec: string;

    if (USE_NEW_SYSTEM) {
      // Use new migration system
      logger.debug('SpecGenerator using new prompt system');

      const contextData = {
        profileJson: JSON.stringify(state.profile, null, 2),
        summaryJson: JSON.stringify(state.summary, null, 2),
      };

      const migrationResult = await getMigrationHelper().migrateAgentCall(
        'spec',
        await promptManager.getPrompt(PromptType.SPEC),
        contextData,
        {
          useTemplateEngine: true,
          enableTracking: true,
        },
        async (systemPrompt: string, userMessage: string) => {
          // Spec returns text (markdown), not JSON
          return await callLLMByAgent(
            'spec',
            systemPrompt,
            userMessage
          );
        }
      );

      if (!migrationResult.success || !migrationResult.response) {
        throw new Error(migrationResult.error || 'Migration failed');
      }

      // For spec, response is already a string (markdown)
      finalSpec = typeof migrationResult.response === 'string'
        ? migrationResult.response
        : JSON.stringify(migrationResult.response, null, 2);

      logger.info('SpecGenerator new system call completed', {
        tokenUsage: migrationResult.tokenUsage,
        duration: migrationResult.duration,
      });
    } else {
      // Use legacy system
      logger.debug('SpecGenerator using legacy system');

      const systemPrompt = await promptManager.getPrompt(PromptType.SPEC);

      const contextMessage = `
请根据以下信息生成开发方案文档：

需求画像：
${JSON.stringify(state.profile, null, 2)}

阶段总结：
${JSON.stringify(state.summary, null, 2)}

请按照9章节结构生成完整的Markdown文档。
`;

      finalSpec = await callLLMByAgent(
        'spec',
        systemPrompt,
        contextMessage
      );
    }

    logger.agent('SpecGenerator', state.sessionId, 'Specification document generated', {
      length: finalSpec.length,
    });

    // Update summary
    const updatedSummary = {
      ...state.summary,
      [Stage.DOCUMENT_GENERATION]: {
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('SpecGenerator node failed', { sessionId: state.sessionId, error: errorMessage });
    return {
      response: '文档生成失败，请稍后重试。',
      stop: true,
    };
  }
}
