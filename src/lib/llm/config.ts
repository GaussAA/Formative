/**
 * LLM 配置
 * 根据不同的 Agent 类型优化 LLM 参数，降低成本并提升响应速度
 */

export interface LLMConfig {
  temperature: number;
  maxTokens?: number;
  description: string;
}

/**
 * 各 Agent 的 LLM 配置
 *
 * 设计原则：
 * - extractor: 需要结构化输出，低温确保一致性
 * - planner: 短对话，适度温度平衡灵活性
 * - asker: 需要生成澄清问题，中低温度
 * - risk: 风险分析需要一定创造性，中温度
 * - tech: 技术选型，低温度确保逻辑严谨
 * - mvp: 功能规划，中低温度
 * - diagram: 图表生成需要精确格式，低温度
 * - spec: 文档生成，低温度，高 token 限制
 */
export const LLM_CONFIGS: Record<string, LLMConfig> = {
  // 需求提取 - 结构化 JSON 输出，低温确保一致性
  extractor: {
    temperature: 0.1,
    maxTokens: 1000,
    description: '需求信息提取，结构化JSON输出',
  },

  // 规划者 - 短对话任务
  planner: {
    temperature: 0.2,
    maxTokens: 800,
    description: '对话规划，引导用户完成需求采集',
  },

  // 提问者 - 生成澄清问题
  asker: {
    temperature: 0.5,
    maxTokens: 500,
    description: '生成针对性澄清问题',
  },

  // 风险分析 - 需要一定的创造性识别风险
  risk: {
    temperature: 0.3,
    maxTokens: 1500,
    description: '风险识别和分析',
  },

  // 技术选型 - 需要逻辑严谨
  tech: {
    temperature: 0.3,
    maxTokens: 1500,
    description: '技术栈选型建议',
  },

  // MVP 规划 - 功能优先级排序
  mvp: {
    temperature: 0.3,
    maxTokens: 1500,
    description: 'MVP 功能边界规划',
  },

  // 架构设计 - 图表生成需要精确格式
  diagram: {
    temperature: 0.1,
    maxTokens: 2000,
    description: '架构图表和流程图生成',
  },

  // 文档生成 - 完整开发方案文档
  spec: {
    temperature: 0.2,
    maxTokens: 4000,
    description: '完整开发方案文档生成',
  },

  // 表单验证 - 验证需求合理性
  formValidator: {
    temperature: 0.2,
    maxTokens: 1000,
    description: '表单数据验证和澄清',
  },
};

/**
 * 获取指定 Agent 的 LLM 配置
 */
export function getLLMConfig(agentType: string): LLMConfig {
  return (
    LLM_CONFIGS[agentType] || {
      temperature: 0.3,
      maxTokens: 1500,
      description: '默认配置',
    }
  );
}

/**
 * 默认配置
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  temperature: 0.3,
  maxTokens: 1500,
  description: '默认 LLM 配置',
};
