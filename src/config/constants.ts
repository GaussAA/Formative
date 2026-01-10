/**
 * 全局常量配置
 * 集中管理应用中的魔法数字和常量
 */

/**
 * 防抖延迟时间（毫秒）
 * 用于减少高频操作的执行次数
 */
export const DEBOUNCE_MS = 2000;

/**
 * 保存状态重置延迟时间（毫秒）
 * 保存完成后，显示"已保存"状态的时间
 */
export const SAVE_STATUS_RESET_MS = 2000;

/**
 * 最大对话历史条数
 * 保留最近的对话历史数量，避免上下文过长
 */
export const MAX_MESSAGE_HISTORY = 50;

/**
 * LLM 调用超时时间（毫秒）
 * 单次 LLM 调用的最大等待时间
 */
export const LLM_TIMEOUT_MS = 30000;

/**
 * IndexedDB 配置
 */
export const IDB_CONFIG = {
  /** 数据库名称 */
  DB_NAME: 'FormativeDB',
  /** 数据库版本 */
  DB_VERSION: 1,
  /** 对象存储名称 */
  STORE_NAME: 'sessions',
} as const;

/**
 * 阶段配置
 */
export const STAGE_CONFIG = {
  /** 总阶段数 */
  TOTAL_STAGES: 6,
  /** 初始阶段索引 */
  INITIAL_STAGE: 0,
} as const;
