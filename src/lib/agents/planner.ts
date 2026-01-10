/**
 * Planner Node
 * 评估需求完备度，决定是否需要继续收集信息
 */

import { GraphStateType } from '../graph/state';
import { Stage } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import logger from '../logger';

interface PlannerResponse {
  completeness: number;
  checklist: {
    productGoal: boolean;
    targetUsers: boolean;
    useCases: boolean;
    coreFunctions: boolean;
    needsDataStorage: boolean;
    needsMultiUser: boolean;
  };
  missingCritical: string[];
  canProceed: boolean;
  recommendation: string;
}

export async function plannerNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('Planner', state.sessionId, 'Evaluating requirement completeness');

  // 严格检查：确保所有关键字段都已明确收集（不是推断）
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

  // 如果有缺失的关键字段，强制认为需要更多信息
  if (missingFields.length > 0) {
    logger.info('⏳ PLANNER: Missing critical fields, need more info', {
      missingFields,
      strictCompleteness,
    });

    return {
      completeness: strictCompleteness,
      missingFields,
      needMoreInfo: true,
      currentStage: Stage.REQUIREMENT_COLLECTION, // 保持在需求采集阶段
    };
  }

  try {
    const systemPrompt = await promptManager.getPrompt(PromptType.PLANNER);

    const contextMessage = `
当前需求画像：
${JSON.stringify(state.profile, null, 2)}

请评估需求完备度，判断是否可以进入下一阶段。
`;

    const result = await callLLMWithJSONByAgent<PlannerResponse>(
      'planner', // 使用 planner 配置：temperature: 0.2, maxTokens: 800
      systemPrompt,
      contextMessage
    );

    logger.agent('Planner', state.sessionId, 'Completeness evaluated', {
      completeness: result.completeness,
      canProceed: result.canProceed,
    });

    // 循环检测：如果已经问过5次以上同样的问题，强制进入下一阶段
    const askedCount = state.askedQuestions?.length || 0;
    const shouldForceNext = askedCount >= 5; // 最多问5轮

    if (shouldForceNext) {
      logger.warn('Loop detected, forcing next stage', {
        sessionId: state.sessionId,
        askedCount,
        currentStage: state.currentStage,
      });

      // 根据当前阶段强制进入下一阶段
      let forcedNextStage = state.currentStage;
      if (state.currentStage === Stage.REQUIREMENT_COLLECTION) {
        forcedNextStage = Stage.RISK_ANALYSIS;
      } else if (state.currentStage === Stage.RISK_ANALYSIS) {
        forcedNextStage = Stage.TECH_STACK;
      } else if (state.currentStage === Stage.TECH_STACK) {
        forcedNextStage = Stage.MVP_BOUNDARY;
      }

      return {
        completeness: 80, // 强制设置为80%
        needMoreInfo: false,
        currentStage: forcedNextStage,
      };
    }

    // 根据当前阶段决定是否需要更多信息以及下一阶段
    let nextStage = state.currentStage;
    let needMoreInfo = true;

    logger.info('📊 PLANNER: Evaluating stage', {
      currentStage: state.currentStage,
      canProceed: result.canProceed,
      completeness: result.completeness,
    });

    switch (state.currentStage) {
      case Stage.REQUIREMENT_COLLECTION:
        // 需求采集阶段：使用严格的completeness（必须所有字段都有）
        if (strictCompleteness >= 100) {
          needMoreInfo = false;
          nextStage = Stage.RISK_ANALYSIS;
          logger.info('✅ PLANNER: Requirements complete, transitioning to RISK_ANALYSIS', {
            strictCompleteness,
          });
        } else {
          needMoreInfo = true; // 继续收集需求
          logger.info('⏳ PLANNER: Requirements incomplete, need more info', {
            strictCompleteness,
            missingFields,
          });
        }
        break;

      case Stage.RISK_ANALYSIS:
        // 风险分析阶段：检查用户是否已选择风险应对方案
        // 如果summary中已有风险分析结果且用户回复过，说明已选择方案
        if (state.summary?.[Stage.RISK_ANALYSIS]?.selectedApproach) {
          needMoreInfo = false;
          nextStage = Stage.TECH_STACK;
          logger.info('✅ PLANNER: Risk approach selected, transitioning to TECH_STACK', {
            selectedApproach: state.summary[Stage.RISK_ANALYSIS].selectedApproach,
          });
        } else {
          // 等待risk_analyst节点生成选项或等待用户选择
          needMoreInfo = false; // 让路由决定下一步
          logger.info('⏳ PLANNER: Waiting for risk_analyst or user selection');
        }
        break;

      case Stage.TECH_STACK:
        // 技术选型阶段：检查用户是否已选择技术栈
        if (state.summary?.[Stage.TECH_STACK]?.techStack) {
          needMoreInfo = false;
          nextStage = Stage.MVP_BOUNDARY;
          logger.info('✅ PLANNER: Tech stack selected, transitioning to MVP_BOUNDARY', {
            techStack: state.summary[Stage.TECH_STACK].techStack,
          });
        } else {
          // 等待tech_advisor节点生成选项或等待用户选择
          needMoreInfo = false;
          logger.info('⏳ PLANNER: Waiting for tech_advisor or user selection');
        }
        break;

      case Stage.MVP_BOUNDARY:
        // MVP边界定义阶段：评估是否可以生成最终文档
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
      completeness: strictCompleteness, // 使用严格的completeness
      missingFields,
      needMoreInfo,
      currentStage: nextStage,
    };
  } catch (error: any) {
    logger.error('Planner node failed', { sessionId: state.sessionId, error: error.message });
    return {
      completeness: strictCompleteness,
      missingFields,
      needMoreInfo: true,
    };
  }
}
