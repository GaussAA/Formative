/**
 * API 类型定义
 * 统一所有 API 路由的响应类型
 */

import type { RequirementProfile, TechStackOption, Risk, RiskApproach, MVPFeature } from './index';

/**
 * 通用 API 响应格式
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 聊天 API 响应
 */
export interface ChatResponse {
  sessionId: string;
  completeness: number;
  profile: RequirementProfile;
  response?: string;
  options?: OptionChip[];
  currentStage?: number;
}

/**
 * 表单提交响应
 */
export interface FormSubmitResponse {
  sessionId: string;
  completeness: number;
  profile: RequirementProfile;
  isValid: boolean;
  response: string;
  options?: OptionChip[];
  currentStage: number;
}

/**
 * 风险分析响应
 */
export interface RiskAnalysisResponse {
  risks: Risk[];
  approaches: RiskApproach[];
  selectedApproach?: string;
}

/**
 * 技术栈响应
 */
export interface TechStackResponse {
  category: string;
  options: TechStackOption[];
  selected?: TechStackOption;
  reasoning?: string;
}

/**
 * MVP 规划响应
 */
export interface MVPPlanResponse {
  coreFeatures: MVPFeature[];
  niceToHave: MVPFeature[];
  timeline: string;
  reasoning: string;
}

/**
 * 架构图响应
 */
export interface DiagramResponse {
  architecture: string;
  sequence: string;
  dataFlow: string;
}

/**
 * 文档生成响应
 */
export interface SpecResponse {
  spec: string;
  format: 'markdown';
}

/**
 * 选项卡片
 */
export interface OptionChip {
  id: string;
  label: string;
  value: string;
}
