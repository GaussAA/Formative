/**
 * Tech Advisor Node
 * 提供技术选型建议
 *
 * Migrated to new prompt engineering system with backward compatibility
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import { AgentMigrationHelper } from '../prompts/migration-helper';
import { techStackResponseSchema, type TechStackResponse } from '@/lib/schemas/agent-schemas';
import logger from '../logger';

/**
 * Migration feature flag
 */
const USE_NEW_SYSTEM = process.env.TECH_USE_NEW_SYSTEM === 'true';

// Singleton migration helper
let migrationHelper: AgentMigrationHelper | null = null;

function getMigrationHelper(): AgentMigrationHelper {
  if (!migrationHelper) {
    migrationHelper = new AgentMigrationHelper();
  }
  return migrationHelper;
}

export async function techAdvisorNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('TechAdvisor', state.sessionId, 'Providing tech stack recommendations', {
    useNewSystem: USE_NEW_SYSTEM,
  });

  try {
    let result: TechStackResponse;

    if (USE_NEW_SYSTEM) {
      // Use new migration system
      logger.debug('TechAdvisor using new prompt system');

      const contextData = {
        profileJson: JSON.stringify(state.profile, null, 2),
        riskAnalysisJson: JSON.stringify(state.summary[Stage.RISK_ANALYSIS] || {}, null, 2),
      };

      const migrationResult = await getMigrationHelper().migrateAgentCall(
        'tech',
        await promptManager.getPrompt(PromptType.TECH),
        contextData,
        {
          useTemplateEngine: true,
          enableTracking: true,
        },
        async (systemPrompt: string, userMessage: string) => {
          return await callLLMWithJSONByAgent<unknown>(
            'tech',
            systemPrompt,
            userMessage
          );
        }
      );

      if (!migrationResult.success || !migrationResult.response) {
        throw new Error(migrationResult.error || 'Migration failed');
      }

      const parseResult = techStackResponseSchema.safeParse(migrationResult.response);
      if (!parseResult.success) {
        logger.warn('TechAdvisor response validation failed', {
          errors: parseResult.error.issues,
        });
        throw new Error(`Schema validation failed: ${parseResult.error.issues.map(i => i.message).join(', ')}`);
      }

      result = parseResult.data;

      logger.info('TechAdvisor new system call completed', {
        tokenUsage: migrationResult.tokenUsage,
        duration: migrationResult.duration,
      });
    } else {
      // Use legacy system
      logger.debug('TechAdvisor using legacy system');

      const systemPrompt = await promptManager.getPrompt(PromptType.TECH);

      const contextMessage = `
需求画像：
${JSON.stringify(state.profile, null, 2)}

风险分析总结：
${JSON.stringify(state.summary[Stage.RISK_ANALYSIS], null, 2)}

请根据需求和风险分析结果，推荐合适的技术方案。
`;

      result = await callLLMWithJSONByAgent<TechStackResponse>(
        'tech',
        systemPrompt,
        contextMessage
      );
    }

    logger.agent('TechAdvisor', state.sessionId, 'Tech recommendations provided', {
      architecture: result.architecture,
      optionsCount: result.recommended.length,
    });

    // Update summary - transform new schema to expected format
    // Map architecture values to expected TechStack format
    const categoryMap: Record<string, 'frontend-only' | 'fullstack' | 'baas'> = {
      'frontend-only': 'frontend-only',
      'frontend-baas': 'baas',
      'fullstack': 'fullstack',
    };

    // Get first option as the recommended stack
    const firstOption = result.recommended[0]?.options[0];
    const techStack = {
      category: categoryMap[result.architecture] || 'frontend-only',
      frontend: firstOption?.name || 'Next.js',
      backend: result.architecture === 'fullstack' ? 'Node.js' : undefined,
      database: result.architecture !== 'frontend-only' ? 'Supabase' : undefined,
      runtime: 'Node.js',
    };

    const updatedSummary = {
      ...state.summary,
      [Stage.TECH_STACK]: {
        techStack,
        reasoning: result.reasoning,
      },
    };

    // Generate message and options
    const message = `根据您的需求，我们建议采用「${result.architecture}」方案。\n\n${result.reasoning}\n\n以下是具体的技术栈选项：`;

    // Flatten options from all categories
    const options: { id: string; label: string; value: string }[] = [];
    result.recommended.forEach((category) => {
      category.options.forEach((opt) => {
        options.push({
          id: opt.id,
          label: opt.name,
          value: JSON.stringify({
            architecture: result.architecture,
            option: opt,
            category: category.category,
          }),
        });
      });
    });

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
