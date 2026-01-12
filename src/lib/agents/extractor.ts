/**
 * Extractor Node
 * 从用户输入中提取需求信息
 *
 * Migrated to new prompt engineering system with backward compatibility
 */

import { GraphStateType } from '../graph/state';
import { Stage, RequirementProfile } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import { AgentMigrationHelper } from '../prompts/migration-helper';
import { extractorResponseSchema, type ExtractorResponse } from '@/lib/schemas/agent-schemas';
import globalSchemaRegistry from '@/lib/schemas/schema-registry';
import logger from '../logger';

/**
 * Get stage label from current stage
 */
function getStageLabel(stage: Stage): string {
  const labels: Partial<Record<Stage, string>> = {
    [Stage.REQUIREMENT_COLLECTION]: '需求采集',
    [Stage.RISK_ANALYSIS]: '风险分析',
    [Stage.TECH_STACK]: '技术选型',
    [Stage.MVP_BOUNDARY]: 'MVP边界确认',
    [Stage.DIAGRAM_DESIGN]: '架构设计',
    [Stage.DOCUMENT_GENERATION]: '文档生成',
  };
  return labels[stage] || '未知阶段';
}

/**
 * Simple rule-based extraction (fallback)
 */
function simpleExtract(
  userInput: string,
  currentProfile: RequirementProfile
): Partial<RequirementProfile> {
  const extracted: Partial<RequirementProfile> = {};
  const input = userInput.toLowerCase();

  const profile = currentProfile || {};

  // Extract product goal keywords
  if (input.includes('想做') || input.includes('想要')) {
    if (!profile.productGoal) {
      extracted.productGoal = userInput;
    }
  }

  // Extract target users
  if (input.includes('爱好者') || input.includes('学习者')) {
    extracted.targetUsers = 'AI技术爱好者/学习者';
  } else if (input.includes('开发者') || input.includes('研究者')) {
    extracted.targetUsers = 'AI开发者/研究者';
  } else if (input.includes('普通大众') || input.includes('所有人')) {
    extracted.targetUsers = '对AI感兴趣的普通大众';
  } else if (input.includes('多种用户') || input.includes('以上')) {
    extracted.targetUsers = '多种类型用户（AI爱好者、开发者、普通大众）';
  }

  // Extract function keywords
  const functions: string[] = [];
  if (input.includes('社交')) functions.push('社交互动');
  if (input.includes('发布活动') || input.includes('活动发布')) functions.push('活动发布');
  if (input.includes('报名') || input.includes('活动报名')) functions.push('活动报名');
  if (input.includes('复盘') || input.includes('活动复盘')) functions.push('活动复盘');
  if (input.includes('分享') || input.includes('共享') || input.includes('资源共享')) functions.push('资源共享');
  if (input.includes('项目')) functions.push('项目展示');
  if (input.includes('信息') && input.includes('聚合')) functions.push('信息聚合');
  if (input.includes('新闻')) functions.push('新闻聚合');
  if (input.includes('活动管理')) functions.push('活动管理');

  if (functions.length > 0) {
    const existingFunctions = Array.isArray(profile.coreFunctions) ? profile.coreFunctions : [];
    extracted.coreFunctions = [...existingFunctions, ...functions];
    extracted.coreFunctions = [...new Set(extracted.coreFunctions)];
  }

  // Extract use cases
  if (input.includes('社交') && input.includes('活动')) {
    extracted.useCases = '社交活动场景：发布、报名、参与、复盘活动';
  } else if (input.includes('社区')) {
    extracted.useCases = 'AI技术社区交流和学习';
  } else if (input.includes('聚合')) {
    extracted.useCases = 'AI信息和资源聚合平台';
  }

  return extracted;
}

/**
 * Migration feature flag
 */
const USE_NEW_SYSTEM = process.env.EXTRACTOR_USE_NEW_SYSTEM === 'true';

// Singleton migration helper
let migrationHelper: AgentMigrationHelper | null = null;

function getMigrationHelper(): AgentMigrationHelper {
  if (!migrationHelper) {
    migrationHelper = new AgentMigrationHelper();
  }
  return migrationHelper;
}

export async function extractorNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('Extractor', state.sessionId, 'Starting information extraction', {
    currentProfile: state.profile,
    userInput: state.userInput,
    currentStage: state.currentStage,
    useNewSystem: USE_NEW_SYSTEM,
  });

  const currentProfile = state.profile || {};
  const currentSummary = state.summary || {};
  const userInput = state.userInput;

  // Handle risk analysis stage selection
  if (state.currentStage === Stage.RISK_ANALYSIS) {
    if (userInput.length < 50 && !userInput.includes(' ')) {
      logger.info('User selected risk approach', { selection: userInput });
      return {
        profile: currentProfile,
        summary: {
          ...currentSummary,
          [Stage.RISK_ANALYSIS]: {
            ...currentSummary[Stage.RISK_ANALYSIS],
            risks: currentSummary[Stage.RISK_ANALYSIS]?.risks || [],
            selectedApproach: userInput,
          },
        },
        missingFields: [],
      };
    }
  }

  // Handle tech stack selection
  if (state.currentStage === Stage.TECH_STACK) {
    try {
      const techStack = JSON.parse(userInput);
      if (techStack.frontend || techStack.backend) {
        logger.info('User selected tech stack', { techStack });
        return {
          profile: currentProfile,
          summary: {
            ...currentSummary,
            [Stage.TECH_STACK]: {
              ...currentSummary[Stage.TECH_STACK],
              techStack,
              reasoning: currentSummary[Stage.TECH_STACK]?.reasoning || '用户选择',
            },
          },
          missingFields: [],
        };
      }
    } catch {
      // Not JSON, continue processing
    }
  }

  // Simple rule extraction first (as supplement)
  const simpleExtracted = simpleExtract(userInput, currentProfile);
  logger.debug('Simple extraction result', { simpleExtracted });

  try {
    let result: ExtractorResponse;

    if (USE_NEW_SYSTEM) {
      // Use new migration system
      logger.debug('Extractor using new prompt system');

      const contextData = {
        currentProfileJson: JSON.stringify(currentProfile, null, 2),
        userInput,
        currentStageLabel: getStageLabel(state.currentStage),
        currentStage: state.currentStage,
        isRequirementCollectionStage: state.currentStage === Stage.REQUIREMENT_COLLECTION,
        isRiskAnalysisStage: state.currentStage === Stage.RISK_ANALYSIS,
        isTechStackStage: state.currentStage === Stage.TECH_STACK,
      };

      const migrationResult = await getMigrationHelper().migrateAgentCall(
        'extractor',
        await promptManager.getPrompt(PromptType.EXTRACTOR),
        contextData,
        {
          useTemplateEngine: true,
          enableTracking: true,
        },
        async (systemPrompt: string, userMessage: string) => {
          return await callLLMWithJSONByAgent<unknown>(
            'extractor',
            systemPrompt,
            userMessage,
            state.messages.slice(-5)
          );
        }
      );

      if (!migrationResult.success || !migrationResult.response) {
        throw new Error(migrationResult.error || 'Migration failed');
      }

      const parseResult = extractorResponseSchema.safeParse(migrationResult.response);
      if (!parseResult.success) {
        logger.warn('Extractor response validation failed', {
          errors: parseResult.error.issues,
        });
        throw new Error(`Schema validation failed: ${parseResult.error.issues.map(i => i.message).join(', ')}`);
      }

      result = parseResult.data;

      logger.info('Extractor new system call completed', {
        tokenUsage: migrationResult.tokenUsage,
        duration: migrationResult.duration,
      });
    } else {
      // Use legacy system
      logger.debug('Extractor using legacy system');

      const systemPrompt = await promptManager.getPrompt(PromptType.EXTRACTOR);

      const contextMessage = `
当前已收集的信息：
${JSON.stringify(currentProfile, null, 2)}

用户新输入：${userInput}

请从用户输入中提取新的信息，并补充到需求画像中。注意：
1. 保留所有已有信息
2. 只添加新的信息
3. 不要删除或覆盖已有字段
`;

      result = await callLLMWithJSONByAgent<ExtractorResponse>(
        'extractor',
        systemPrompt,
        contextMessage,
        state.messages.slice(-5)
      );
    }

    // Merge rule extraction and LLM extraction
    const updatedProfile = {
      ...currentProfile,
      ...simpleExtracted,
      ...result.extracted,
    };

    logger.agent('Extractor', state.sessionId, 'Information extracted successfully', {
      llmExtracted: Object.keys(result.extracted),
      simpleExtracted: Object.keys(simpleExtracted),
      updatedProfile,
    });

    return {
      profile: updatedProfile,
      summary: currentSummary,
      missingFields: result.missingFields,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Extractor failed', {
      sessionId: state.sessionId,
      error: errorMessage,
      stack: errorStack,
    });

    // Don't fallback - throw error to notify user
    throw new Error(`信息提取失败: ${errorMessage}。请检查LLM配置或稍后重试。`);
  }
}
