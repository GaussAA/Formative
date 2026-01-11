/**
 * LangGraph Workflow
 * 使用StateGraph编排整个对话流程
 *
 * P1 Optimization: Integrated persistent checkpoint storage
 * - Replaced MemorySaver with CheckpointFactory for state persistence
 * - Added circuit breaker for fault tolerance
 * - Added adaptive retry with error classification
 */

import { StateGraph, END } from '@langchain/langgraph';
import { GraphState, GraphStateType } from './state';
import { Stage } from '@/types';
import { extractorNode } from '../agents/extractor';
import { plannerNode } from '../agents/planner';
import { askerNode } from '../agents/asker';
import { riskAnalystNode } from '../agents/risk-analyst';
import { techAdvisorNode } from '../agents/tech-advisor';
import { mvpBoundaryNode } from '../agents/mvp-boundary';
import { specGeneratorNode } from '../agents/spec-generator';
import logger from '../logger';
import { getCheckpointer } from '@/lib/storage/checkpoint-factory';
import { getCircuitBreaker } from '@/lib/circuit-breaker/circuit-breaker';
import { retryWithBackoffAdaptive } from '@/lib/utils/retry';

// P1: Get circuit breaker for workflow execution
const workflowCircuitBreaker = getCircuitBreaker('workflow', {
  threshold: 5,
  timeout: 60000,
  halfOpenAttempts: 2,
});

/**
 * 路由函数：决定下一个节点
 * Exported for testing
 */
export function routeNext(state: GraphStateType): string {
  logger.info('🔀 ROUTING DECISION', {
    currentStage: state.currentStage,
    needMoreInfo: state.needMoreInfo,
    hasSummary: !!state.summary,
    summaryKeys: Object.keys(state.summary || {}),
  });

  // 如果已完成，结束流程
  if (state.stop) {
    logger.info('⛔ ROUTING: Stopping workflow (stop=true)');
    return END;
  }

  // 根据当前阶段和是否需要更多信息来决定路由
  switch (state.currentStage) {
    case Stage.INIT:
    case Stage.REQUIREMENT_COLLECTION:
      if (state.needMoreInfo) {
        logger.info('➡️ ROUTING: REQUIREMENT_COLLECTION -> asker (need more requirements)');
        return 'asker'; // 需要继续提问
      } else {
        logger.info('➡️ ROUTING: REQUIREMENT_COLLECTION -> risk_analyst (requirements complete)');
        return 'risk_analyst'; // 进入风险分析阶段，运行risk_analyst
      }

    case Stage.RISK_ANALYSIS:
      // 检查是否已经运行过risk_analyst（通过检查summary中是否有risks）
      const hasRiskAnalysis = !!state.summary?.[Stage.RISK_ANALYSIS]?.risks;
      logger.info(`🔍 RISK_ANALYSIS stage check: hasRiskAnalysis=${hasRiskAnalysis}, needMoreInfo=${state.needMoreInfo}, hasResponse=${!!state.response}`);

      if (!hasRiskAnalysis) {
        logger.info('➡️ ROUTING: RISK_ANALYSIS -> risk_analyst (first time, need to analyze risks)');
        return 'risk_analyst'; // 第一次进入，运行risk_analyst
      } else if (state.needMoreInfo) {
        // risk_analyst已经运行并设置了response和options，直接返回给用户
        // 不要再调用asker，否则会覆盖risk_analyst的输出
        logger.info('➡️ ROUTING: RISK_ANALYSIS -> END (risk options ready, waiting for user selection)');
        return END;
      } else {
        logger.info('➡️ ROUTING: RISK_ANALYSIS -> tech_advisor (user selected risk approach, moving to tech stack)');
        return 'tech_advisor'; // 用户已选择，进入技术选型阶段
      }

    case Stage.TECH_STACK:
      // 检查是否已经运行过tech_advisor
      const hasTechAnalysis = !!(state.summary?.[Stage.TECH_STACK]?.techStack || state.summary?.[Stage.TECH_STACK]?.reasoning);
      logger.info(`🔍 TECH_STACK stage check: hasTechAnalysis=${hasTechAnalysis}, needMoreInfo=${state.needMoreInfo}, hasResponse=${!!state.response}`);

      if (!hasTechAnalysis) {
        logger.info('➡️ ROUTING: TECH_STACK -> tech_advisor (first time, need tech recommendations)');
        return 'tech_advisor'; // 第一次进入，运行tech_advisor
      } else if (state.needMoreInfo) {
        // tech_advisor已经运行并设置了response和options，直接返回给用户
        logger.info('➡️ ROUTING: TECH_STACK -> END (tech options ready, waiting for user selection)');
        return END;
      } else {
        logger.info('➡️ ROUTING: TECH_STACK -> mvp_boundary (user selected tech stack, defining MVP)');
        return 'mvp_boundary'; // 用户已选择，进入MVP边界定义阶段
      }

    case Stage.MVP_BOUNDARY:
      // 检查是否已经运行过mvp_boundary
      const hasMVPBoundary = !!state.summary?.[Stage.MVP_BOUNDARY]?.mvpFeatures;
      logger.info(`🔍 MVP_BOUNDARY stage check: hasMVPBoundary=${hasMVPBoundary}, needMoreInfo=${state.needMoreInfo}, hasResponse=${!!state.response}`);

      if (!hasMVPBoundary) {
        logger.info('➡️ ROUTING: MVP_BOUNDARY -> mvp_boundary (first time, defining MVP)');
        return 'mvp_boundary'; // 第一次进入，运行mvp_boundary
      } else if (state.needMoreInfo) {
        // mvp_boundary已经运行并设置了response，直接返回给用户
        logger.info('➡️ ROUTING: MVP_BOUNDARY -> END (MVP defined, waiting for user confirmation)');
        return END;
      } else {
        logger.info('➡️ ROUTING: MVP_BOUNDARY -> spec_generator (generating final document)');
        return 'spec_generator'; // 进入最终文档生成
      }

    case Stage.DIAGRAM_DESIGN:
    case Stage.DOCUMENT_GENERATION:
    case Stage.COMPLETED:
      logger.info('⛔ ROUTING: Ending workflow (stage complete)');
      return END;

    default:
      logger.warn('⚠️ ROUTING: Unknown stage, defaulting to asker', { stage: state.currentStage });
      return 'asker';
  }
}

/**
 * 创建工作流图
 * P1: Uses persistent checkpoint storage
 */
export async function createWorkflow() {
  const workflow = new StateGraph(GraphState)
    // 添加节点
    .addNode('extractor', extractorNode)
    .addNode('planner', plannerNode)
    .addNode('asker', askerNode)
    .addNode('risk_analyst', riskAnalystNode)
    .addNode('tech_advisor', techAdvisorNode)
    .addNode('mvp_boundary', mvpBoundaryNode)
    .addNode('spec_generator', specGeneratorNode)

    // 定义边：从入口到extractor
    .addEdge('__start__', 'extractor')

    // extractor -> planner
    .addEdge('extractor', 'planner')

    // planner -> 条件路由
    .addConditionalEdges('planner', routeNext)

    // asker -> END (等待用户输入，下次从extractor重新开始)
    .addEdge('asker', END)

    // risk_analyst -> 条件路由
    .addConditionalEdges('risk_analyst', routeNext)

    // tech_advisor -> 条件路由
    .addConditionalEdges('tech_advisor', routeNext)

    // mvp_boundary -> 条件路由
    .addConditionalEdges('mvp_boundary', routeNext)

    // spec_generator -> END
    .addEdge('spec_generator', END);

  // 编译图，使用持久化checkpointer
  const checkpointer = await getCheckpointer();
  const app = workflow.compile({ checkpointer });

  logger.info('Workflow compiled successfully with persistent checkpointer');

  return app;
}

/**
 * 运行工作流
 * P1: Integrated circuit breaker and adaptive retry
 */
export async function runWorkflow(sessionId: string, userInput: string) {
  return workflowCircuitBreaker.execute(async () => {
    return retryWithBackoffAdaptive(
      async () => {
        const app = await createWorkflow();

        const initialState: Partial<GraphStateType> = {
          sessionId,
          userInput,
          currentStage: Stage.REQUIREMENT_COLLECTION,
          completeness: 0,
          profile: {},
          summary: {},
          messages: [],
          needMoreInfo: true,
          missingFields: [],
          askedQuestions: [], // 初始化已问问题列表
          stop: false,
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        };

        const config = {
          configurable: {
            thread_id: sessionId,
          },
        };

        logger.info('Running workflow', { sessionId, userInput });

        // 运行工作流
        const result = await app.invoke(initialState, config);

        logger.info('Workflow completed', {
          sessionId,
          currentStage: result.currentStage,
          stop: result.stop,
        });

        return result;
      },
      {
        maxRetries: 3,
        adaptive: true,
        onRetry: (attempt, error) => {
          logger.warn('Workflow retry', { attempt, error: error.message });
        },
      }
    );
  });
}

/**
 * 继续已有会话的工作流
 * P1: Integrated circuit breaker and adaptive retry
 */
export async function continueWorkflow(sessionId: string, userInput: string) {
  return workflowCircuitBreaker.execute(async () => {
    return retryWithBackoffAdaptive(
      async () => {
        const app = await createWorkflow();

        const config = {
          configurable: {
            thread_id: sessionId,
          },
        };

        // 获取当前状态
        const currentState = await app.getState(config);

        if (!currentState || !currentState.values) {
          // 如果没有找到会话，创建新会话
          logger.warn('Session not found, creating new session', { sessionId });
          return runWorkflow(sessionId, userInput);
        }

        // 确保messages是数组
        const existingMessages = Array.isArray(currentState.values.messages)
          ? currentState.values.messages
          : [];

        // 确保profile不为空
        const existingProfile = currentState.values.profile || {};

        // 更新用户输入和消息历史
        const updatedState: Partial<GraphStateType> = {
          ...currentState.values,
          userInput,
          profile: existingProfile, // 确保profile存在
          messages: [
            ...existingMessages,
            { role: 'user', content: userInput },
          ],
          metadata: {
            ...currentState.values.metadata,
            updatedAt: Date.now(),
          },
        };

        logger.info('Continuing workflow', { sessionId, userInput });

        // 继续运行工作流
        const result = await app.invoke(updatedState, config);

        logger.info('Workflow continued', {
          sessionId,
          currentStage: result.currentStage,
          stop: result.stop,
        });

        return result;
      },
      {
        maxRetries: 3,
        adaptive: true,
        onRetry: (attempt, error) => {
          logger.warn('Continue workflow retry', { attempt, error: error.message });
        },
      }
    );
  });
}
