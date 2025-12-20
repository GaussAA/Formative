/**
 * LangGraph State Schema
 * 定义整个对话流程的状态结构
 */

import { Annotation } from '@langchain/langgraph';
import { Stage, RequirementProfile, StagesSummary, OptionChip } from '@/types';

/**
 * 核心状态定义
 * LangGraph使用Annotation来定义状态schema
 */
export const GraphState = Annotation.Root({
  // 会话标识
  sessionId: Annotation<string>,

  // 当前阶段
  currentStage: Annotation<Stage>,

  // 需求完备度 (0-100)
  completeness: Annotation<number>,

  // 需求画像
  profile: Annotation<RequirementProfile>,

  // 阶段性总结
  summary: Annotation<StagesSummary>,

  // 对话历史
  messages: Annotation<Array<{ role: string; content: string }>>,

  // 当前用户输入
  userInput: Annotation<string>,

  // 系统响应
  response: Annotation<string>,

  // 选项（如果需要用户选择）
  options: Annotation<OptionChip[] | undefined>,

  // 是否需要更多信息
  needMoreInfo: Annotation<boolean>,

  // 缺失字段
  missingFields: Annotation<string[]>,

  // 下一个要问的问题
  nextQuestion: Annotation<string | undefined>,

  // 已经问过的问题列表（用于循环检测）
  askedQuestions: Annotation<string[]>,

  // 停止标志（是否完成整个流程）
  stop: Annotation<boolean>,

  // 最终文档
  finalSpec: Annotation<string | undefined>,

  // 元数据
  metadata: Annotation<{
    createdAt?: number;
    updatedAt?: number;
    totalTokens?: number;
  }>,
});

// 导出类型
export type GraphStateType = typeof GraphState.State;
