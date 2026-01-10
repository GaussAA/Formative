/**
 * Extractor Node
 * 从用户输入中提取需求信息
 */

import { GraphStateType } from '../graph/state';
import { Stage, RequirementProfile } from '@/types';
import { callLLMWithJSONByAgent } from '../llm/helper';
import promptManager, { PromptType } from '../prompts';
import logger from '../logger';

interface ExtractorResponse {
  extracted: {
    projectName?: string;
    productGoal?: string;
    targetUsers?: string;
    useCases?: string;
    coreFunctions?: string[];
    needsDataStorage?: boolean;
    needsMultiUser?: boolean;
    needsAuth?: boolean;
  };
  missingFields: string[];
  nextQuestion?: string;
  options?: Array<{ id: string; label: string; value: string }>;
}

/**
 * 简单规则提取（备用方案）
 *
 * @param userInput - 用户输入
 * @param currentProfile - 当前需求画像
 * @returns 提取的需求信息
 */
function simpleExtract(
  userInput: string,
  currentProfile: RequirementProfile
): Partial<RequirementProfile> {
  const extracted: Partial<RequirementProfile> = {};
  const input = userInput.toLowerCase();

  // 确保 currentProfile 不为空
  const profile = currentProfile || {};

  // 提取产品目标关键词
  if (input.includes('想做') || input.includes('想要')) {
    if (!profile.productGoal) {
      extracted.productGoal = userInput;
    }
  }

  // 提取目标用户
  if (input.includes('爱好者') || input.includes('学习者')) {
    extracted.targetUsers = 'AI技术爱好者/学习者';
  } else if (input.includes('开发者') || input.includes('研究者')) {
    extracted.targetUsers = 'AI开发者/研究者';
  } else if (input.includes('普通大众') || input.includes('所有人')) {
    extracted.targetUsers = '对AI感兴趣的普通大众';
  } else if (input.includes('多种用户') || input.includes('以上')) {
    extracted.targetUsers = '多种类型用户（AI爱好者、开发者、普通大众）';
  }

  // 提取功能关键词
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
    // 安全地合并数组
    const existingFunctions = Array.isArray(profile.coreFunctions) ? profile.coreFunctions : [];
    extracted.coreFunctions = [...existingFunctions, ...functions];
    // 去重
    extracted.coreFunctions = [...new Set(extracted.coreFunctions)];
  }

  // 提取使用场景
  if (input.includes('社交') && input.includes('活动')) {
    extracted.useCases = '社交活动场景：发布、报名、参与、复盘活动';
  } else if (input.includes('社区')) {
    extracted.useCases = 'AI技术社区交流和学习';
  } else if (input.includes('聚合')) {
    extracted.useCases = 'AI信息和资源聚合平台';
  }

  return extracted;
}

export async function extractorNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.agent('Extractor', state.sessionId, 'Starting information extraction', {
    currentProfile: state.profile,
    userInput: state.userInput,
    currentStage: state.currentStage,
  });

  // 确保 profile 和 summary 不为空
  const currentProfile = state.profile || {};
  const currentSummary = state.summary || {};

  // 检查是否是阶段选择（风险方案、技术栈选择等）
  const userInput = state.userInput;

  // 处理风险分析阶段的用户选择
  if (state.currentStage === Stage.RISK_ANALYSIS) {
    // 如果用户输入看起来是一个选项ID（简短的标识符）
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

  // 处理技术选型阶段的用户选择
  if (state.currentStage === Stage.TECH_STACK) {
    // 尝试解析技术栈JSON
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
      // 不是JSON，继续正常处理
    }
  }

  // 先尝试简单规则提取（作为补充）
  const simpleExtracted = simpleExtract(state.userInput, currentProfile);
  logger.debug('Simple extraction result', { simpleExtracted });

  try {
    const systemPrompt = await promptManager.getPrompt(PromptType.EXTRACTOR);

    // 构建上下文
    const contextMessage = `
当前已收集的信息：
${JSON.stringify(currentProfile, null, 2)}

用户新输入：${userInput}

请从用户输入中提取新的信息，并补充到需求画像中。注意：
1. 保留所有已有信息
2. 只添加新的信息
3. 不要删除或覆盖已有字段
`;

    const result = await callLLMWithJSONByAgent<ExtractorResponse>(
      'extractor', // 使用 extractor 配置：temperature: 0.1, maxTokens: 1000
      systemPrompt,
      contextMessage,
      state.messages.slice(-5) // 保留最近5轮对话作为上下文
    );

    // 合并规则提取和LLM提取的结果（规则提取作为补充）
    const updatedProfile = {
      ...currentProfile, // 保留原有信息
      ...simpleExtracted, // 规则提取的信息（补充）
      ...result.extracted, // LLM提取的信息（优先级最高）
    };

    logger.agent('Extractor', state.sessionId, 'Information extracted successfully', {
      llmExtracted: Object.keys(result.extracted),
      simpleExtracted: Object.keys(simpleExtracted),
      updatedProfile,
    });

    return {
      profile: updatedProfile,
      summary: currentSummary, // 保持summary不变
      missingFields: result.missingFields,
      // 不传递nextQuestion和options，避免污染状态
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Extractor LLM call failed - System Error', {
      sessionId: state.sessionId,
      error: errorMessage,
      stack: errorStack,
    });

    // LLM失败时，抛出错误，不要降级
    throw new Error(`信息提取失败: ${errorMessage}。请检查LLM配置或稍后重试。`);
  }
}
