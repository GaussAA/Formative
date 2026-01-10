/**
 * 工具函数：从会话数据生成项目名称
 */

import { StageData } from '@/types';

/**
 * 从会话数据生成合适的项目名称
 * @param stageData 会话的阶段数据
 * @returns 生成的项目名称
 */
export function generateProjectName(stageData: StageData): string {
  // 方案 1: 如果有明确的项目名称，直接使用
  if (stageData.requirement.projectName) {
    return stageData.requirement.projectName;
  }

  // 方案 2: 从最终文档中提取标题
  if (stageData.finalSpec) {
    const titleMatch = stageData.finalSpec.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
  }

  // 方案 3: 从产品目标提取简短名称
  if (stageData.requirement.productGoal) {
    const goal = stageData.requirement.productGoal.trim();

    // 提取第一句话或前 30 个字符
    const firstSentence = goal.split(/[。！？\.\!\?]/)[0];
    if (firstSentence) {
      const shortName = firstSentence.length > 30
        ? firstSentence.substring(0, 27) + '...'
        : firstSentence;

      return shortName || '未命名项目';
    }
  }

  // 方案 4: 从目标用户和核心功能组合
  if (stageData.requirement.targetUsers || stageData.requirement.coreFunctions?.length) {
    const parts = [];

    if (stageData.requirement.targetUsers) {
      const users = stageData.requirement.targetUsers.substring(0, 10);
      parts.push(users);
    }

    if (stageData.requirement.coreFunctions && stageData.requirement.coreFunctions.length > 0) {
      const firstFunc = stageData.requirement.coreFunctions[0];
      if (firstFunc) {
        const func = firstFunc.substring(0, 10);
        parts.push(func);
      }
    }

    if (parts.length > 0) {
      return parts.join(' - ');
    }
  }

  // 兜底方案: 使用时间戳
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
  return `项目 ${dateStr}`;
}
