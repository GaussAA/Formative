/**
 * Planner Node
 * 评估需求完备度，决定是否需要继续收集信息
 *
 * Migrated to new prompt engineering system with backward compatibility
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import { AgentMigrationHelper } from '../prompts/migration-helper';
import { plannerResponseSchema, type PlannerResponse } from '@/lib/schemas/agent-schemas';
import logger from '../logger';

/**
 * Migration feature flag
 */
const USE_NEW_SYSTEM = process.env.PLANNER_USE_NEW_SYSTEM === 'true';

// Singleton migration helper
let migrationHelper: AgentMigrationHelper | null = null;

function getMigrationHelper(): AgentMigrationHelper {
  if (!migrationHelper) {
    migrationHelper = new AgentMigrationHelper();
  }
  return migrationHelper;
}

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

export async function plannerNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('Planner', state.sessionId, 'Evaluating requirement completeness', {
    useNewSystem: USE_NEW_SYSTEM,
  });

  // Strict check: ensure all critical fields are explicitly collected
  const profile = state.profile || {};
  const requiredFields = {
    productGoal: !!profile.productGoal,
    targetUsers: !!profile.targetUsers,
    coreFunctions: !!(profile.coreFunctions && profile.coreFunctions.length > 0),
    needsDataStorage: profile.needsDataStorage !== undefined && profile.needsDataStorage !== null,
    needsMultiUser: profile.needsMultiUser !== undefined && profile.needsMultiUser !== null,
    needsAuth: profile.needsAuth !== undefined && profile.needsAuth !== null,
  };

  const missingFields: string[] = [];
  if (!requiredFields.productGoal) missingFields.push('产品目标');
  if (!requiredFields.targetUsers) missingFields.push('目标用户');
  if (!requiredFields.coreFunctions) missingFields.push('核心功能');
  if (!requiredFields.needsDataStorage) missingFields.push('数据存储需求');
  if (!requiredFields.needsMultiUser) missingFields.push('多用户需求');
  if (!requiredFields.needsAuth) missingFields.push('用户登录需求');

  const completedCount = Object.values(requiredFields).filter(Boolean).length;
  const totalRequired = Object.keys(requiredFields).length;
  const strictCompleteness = Math.floor((completedCount / totalRequired) * 100);

  logger.info('📊 PLANNER: Strict requirement check', {
    requiredFields,
    completedCount,
    totalRequired,
    strictCompleteness,
    missingFields,
  });

  // If there are missing critical fields, force need more info
  if (missingFields.length > 0) {
    logger.info('⏳ PLANNER: Missing critical fields, need more info', {
      missingFields,
      strictCompleteness,
    });

    return {
      completeness: strictCompleteness,
      missingFields,
      needMoreInfo: true,
      currentStage: Stage.REQUIREMENT_COLLECTION,
    };
  }

  try {
    let result: PlannerResponse;

    if (USE_NEW_SYSTEM) {
      // Use new migration system
      logger.debug('Planner using new prompt system');

      const contextData = {
        currentProfileJson: JSON.stringify(state.profile, null, 2),
        currentStageLabel: getStageLabel(state.currentStage),
        askedQuestionsCount: state.askedQuestions?.length || 0,
      };

      const migrationResult = await getMigrationHelper().migrateAgentCall(
        'planner',
        await promptManager.getPrompt(PromptType.PLANNER),
        contextData,
        {
          useTemplateEngine: true,
          enableTracking: true,
        },
        async (systemPrompt: string, userMessage: string) => {
          return await callLLMWithJSONByAgent<unknown>(
            'planner',
            systemPrompt,
            userMessage
          );
        }
      );

      if (!migrationResult.success || !migrationResult.response) {
        throw new Error(migrationResult.error || 'Migration failed');
      }

      const parseResult = plannerResponseSchema.safeParse(migrationResult.response);
      if (!parseResult.success) {
        logger.warn('Planner response validation failed', {
          errors: parseResult.error.issues,
        });
        throw new Error(`Schema validation failed: ${parseResult.error.issues.map(i => i.message).join(', ')}`);
      }

      result = parseResult.data;

      logger.info('Planner new system call completed', {
        tokenUsage: migrationResult.tokenUsage,
        duration: migrationResult.duration,
      });
    } else {
      // Use legacy system
      logger.debug('Planner using legacy system');

      const systemPrompt = await promptManager.getPrompt(PromptType.PLANNER);

      const contextMessage = `
当前需求画像：
${JSON.stringify(state.profile, null, 2)}

请评估需求完备度，判断是否可以进入下一阶段。
`;

      result = await callLLMWithJSONByAgent<PlannerResponse>(
        'planner',
        systemPrompt,
        contextMessage
      );
    }

    logger.agent('Planner', state.sessionId, 'Completeness evaluated', {
      completeness: result.completeness,
      canProceed: result.canProceed,
    });

    // Loop detection: if asked 5+ times same question, force next stage
    const askedCount = state.askedQuestions?.length || 0;
    const shouldForceNext = askedCount >= 5;

    if (shouldForceNext) {
      logger.warn('Loop detected, forcing next stage', {
        sessionId: state.sessionId,
        askedCount,
        currentStage: state.currentStage,
      });

      let forcedNextStage = state.currentStage;
      if (state.currentStage === Stage.REQUIREMENT_COLLECTION) {
        forcedNextStage = Stage.RISK_ANALYSIS;
      } else if (state.currentStage === Stage.RISK_ANALYSIS) {
        forcedNextStage = Stage.TECH_STACK;
      } else if (state.currentStage === Stage.TECH_STACK) {
        forcedNextStage = Stage.MVP_BOUNDARY;
      }

      return {
        completeness: 80,
        needMoreInfo: false,
        currentStage: forcedNextStage,
      };
    }

    // Decide next stage based on current stage
    let nextStage = state.currentStage;
    let needMoreInfo = true;

    logger.info('📊 PLANNER: Evaluating stage', {
      currentStage: state.currentStage,
      canProceed: result.canProceed,
      completeness: result.completeness,
    });

    switch (state.currentStage) {
      case Stage.REQUIREMENT_COLLECTION:
        if (strictCompleteness >= 100) {
          needMoreInfo = false;
          nextStage = Stage.RISK_ANALYSIS;
          logger.info('✅ PLANNER: Requirements complete, transitioning to RISK_ANALYSIS', {
            strictCompleteness,
          });
        } else {
          needMoreInfo = true;
          logger.info('⏳ PLANNER: Requirements incomplete, need more info', {
            strictCompleteness,
            missingFields,
          });
        }
        break;

      case Stage.RISK_ANALYSIS:
        if (state.summary?.[Stage.RISK_ANALYSIS]?.selectedApproach) {
          needMoreInfo = false;
          nextStage = Stage.TECH_STACK;
          logger.info('✅ PLANNER: Risk approach selected, transitioning to TECH_STACK', {
            selectedApproach: state.summary[Stage.RISK_ANALYSIS].selectedApproach,
          });
        } else {
          needMoreInfo = false;
          logger.info('⏳ PLANNER: Waiting for risk_analyst or user selection');
        }
        break;

      case Stage.TECH_STACK:
        if (state.summary?.[Stage.TECH_STACK]?.techStack) {
          needMoreInfo = false;
          nextStage = Stage.MVP_BOUNDARY;
          logger.info('✅ PLANNER: Tech stack selected, transitioning to MVP_BOUNDARY', {
            techStack: state.summary[Stage.TECH_STACK].techStack,
          });
        } else {
          needMoreInfo = false;
          logger.info('⏳ PLANNER: Waiting for tech_advisor or user selection');
        }
        break;

      case Stage.MVP_BOUNDARY:
        needMoreInfo = false;
        nextStage = Stage.DIAGRAM_DESIGN;
        logger.info('✅ PLANNER: MVP boundaries defined, transitioning to DIAGRAM_DESIGN');
        break;

      default:
        needMoreInfo = true;
        logger.warn('⚠️ PLANNER: Unknown stage', { stage: state.currentStage });
    }

    logger.info('📋 PLANNER RESULT', {
      currentStage: state.currentStage,
      nextStage,
      needMoreInfo,
      strictCompleteness,
    });

    return {
      completeness: strictCompleteness,
      missingFields,
      needMoreInfo,
      currentStage: nextStage,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Planner node failed', { sessionId: state.sessionId, error: errorMessage });
    return {
      completeness: strictCompleteness,
      missingFields,
      needMoreInfo: true,
    };
  }
}
