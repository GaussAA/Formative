/**
 * Asker Node
 * 生成问题引导用户补全信息
 *
 * Migrated to new prompt engineering system with backward compatibility
 */

import { GraphStateType } from '../graph/state';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import { AgentMigrationHelper } from '../prompts/migration-helper';
import { askerResponseSchema, type AskerResponse } from '@/lib/schemas/agent-schemas';
import globalSchemaRegistry from '@/lib/schemas/schema-registry';
import logger from '../logger';

/**
 * Legacy Asker Response interface (for backward compatibility)
 */
interface LegacyAskerResponse {
  message: string;
  options?: Array<{ id: string; label: string; value: string }>;
  type: 'single-choice' | 'multiple-choice' | 'text';
}

/**
 * Get stage label from current stage number
 */
function getStageLabel(stage: number): string {
  const labels: Record<number, string> = {
    1: '需求采集',
    2: '风险分析',
    3: '技术选型',
  };
  return labels[stage] || '未知阶段';
}

/**
 * Normalize response to handle both old (message) and new (question) formats
 */
function normalizeResponse(response: unknown): {
  question: string;
  options?: Array<{ id: string; label: string; value: string }>;
  context?: string;
} {
  const r = response as Record<string, unknown>;

  // New format (question)
  if (r.question && typeof r.question === 'string') {
    return {
      question: r.question,
      options: r.options as Array<{ id: string; label: string; value: string }> | undefined,
      context: r.context as string | undefined,
    };
  }

  // Legacy format (message)
  if (r.message && typeof r.message === 'string') {
    return {
      question: r.message,
      options: r.options as Array<{ id: string; label: string; value: string }> | undefined,
    };
  }

  // Fallback
  return {
    question: '请提供更多信息',
    options: undefined,
  };
}

/**
 * Migration feature flag
 * Set environment variable ASKER_USE_NEW_SYSTEM=true to enable new system
 */
const USE_NEW_SYSTEM = process.env.ASKER_USE_NEW_SYSTEM === 'true';

// Singleton migration helper
let migrationHelper: AgentMigrationHelper | null = null;

function getMigrationHelper(): AgentMigrationHelper {
  if (!migrationHelper) {
    migrationHelper = new AgentMigrationHelper();
  }
  return migrationHelper;
}

export async function askerNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('Asker', state.sessionId, 'Generating question for user', {
    currentStage: state.currentStage,
    missingFields: state.missingFields,
    useNewSystem: USE_NEW_SYSTEM,
  });

  try {
    let result: AskerResponse;

    if (USE_NEW_SYSTEM) {
      // Use new migration system
      logger.debug('Asker using new prompt system');

      // Get schema from registry
      const schemaEntry = globalSchemaRegistry.get('asker');

      // Prepare context data for template rendering
      const contextData = {
        currentStageLabel: getStageLabel(state.currentStage),
        currentStage: state.currentStage,
        missingFields: state.missingFields || [],
        profileJson: JSON.stringify(state.profile, null, 2),
        askedQuestions: state.askedQuestions || [],
        isRequirementCollectionStage: state.currentStage === 1,
        isRiskAnalysisStage: state.currentStage === 2,
        isTechStackStage: state.currentStage === 3,
      };

      // Build prompt using migration helper
      const migrationResult = await getMigrationHelper().migrateAgentCall(
        'asker',
        await promptManager.getPrompt(PromptType.ASKER),
        contextData,
        {
          useTemplateEngine: true,
          enableTracking: true,
        },
        async (systemPrompt: string, userMessage: string) => {
          // Call LLM and return raw string response
          return await callLLMWithJSONByAgent<unknown>(
            'asker',
            systemPrompt,
            userMessage
          );
        }
      );

      if (!migrationResult.success || !migrationResult.response) {
        throw new Error(migrationResult.error || 'Migration failed');
      }

      // Validate and parse response using schema
      const parseResult = askerResponseSchema.safeParse(migrationResult.response);
      if (!parseResult.success) {
        logger.warn('Asker response validation failed', {
          errors: parseResult.error.issues,
        });
        // Use normalized response as fallback
        const normalized = normalizeResponse(migrationResult.response);
        result = {
          question: normalized.question,
          options: normalized.options || [],
          context: normalized.context,
        };
      } else {
        result = parseResult.data;
      }

      logger.info('Asker new system call completed', {
        tokenUsage: migrationResult.tokenUsage,
        duration: migrationResult.duration,
      });
    } else {
      // Use legacy system (backward compatible)
      logger.debug('Asker using legacy system');

      const systemPrompt = await promptManager.getPrompt(PromptType.ASKER);

      const contextMessage = `
当前需求画像：
${JSON.stringify(state.profile, null, 2)}

缺失的字段：${state.missingFields?.join(', ') || '无'}

已经问过的问题：
${(state.askedQuestions || []).join('\n')}

当前阶段：${state.currentStage}（${getStageLabel(state.currentStage)}）

请生成一个NEW的问题来补全这些信息，不要重复之前的问题。
**重要**：
1. 如果当前阶段是需求采集(1)，只问需求相关的问题（目标用户、使用场景、核心功能等）
2. 不要提前问技术选型的问题
3. 生成的选项要与问题匹配
`;

      const legacyResult = await callLLMWithJSONByAgent<LegacyAskerResponse>(
        'asker',
        systemPrompt,
        contextMessage
      );

      // Normalize legacy response to new format
      const normalized = normalizeResponse(legacyResult);
      result = {
        question: normalized.question,
        options: normalized.options || [],
        context: normalized.context,
      };
    }

    logger.agent('Asker', state.sessionId, 'Question generated', {
      question: result.question,
      optionsCount: result.options?.length || 0,
    });

    // Record asked questions
    const askedQuestions = state.askedQuestions || [];

    return {
      response: result.question,
      options: result.options?.map(opt => ({
        id: opt.id,
        label: opt.label,
        value: opt.value,
      })),
      askedQuestions: [...askedQuestions, result.question],
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Asker node failed', { sessionId: state.sessionId, error: errorMessage });

    // Fallback: use simple default question
    const firstMissing = state.missingFields?.[0];
    let defaultQuestion = '请描述一下您的产品目标是什么？';
    let defaultOptions = undefined;

    if (firstMissing?.includes('targetUsers')) {
      defaultQuestion = '这个产品主要是给谁用的？';
      defaultOptions = [
        { id: 'general', label: '普通大众', value: '普通大众' },
        { id: 'business', label: '企业用户', value: '企业用户' },
        { id: 'developers', label: '开发者', value: '开发者' },
        { id: 'other', label: '其他', value: '其他' },
      ];
    } else if (firstMissing?.includes('coreFunctions')) {
      defaultQuestion = '您希望这个产品有哪些核心功能？';
      defaultOptions = [
        { id: 'user-mgmt', label: '用户管理', value: '用户管理' },
        { id: 'content', label: '内容管理', value: '内容管理' },
        { id: 'search', label: '搜索功能', value: '搜索功能' },
        { id: 'other', label: '其他', value: '其他' },
      ];
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
