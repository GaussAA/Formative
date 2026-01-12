/**
 * Tab 配置常量
 * 集中管理 Tab 的初始配置
 */

import { Stage, TabStatus } from '@/types';
import type { TabConfig } from '@/types';

/**
 * Initial tab configuration
 * Icons are now rendered via StageIcons mapping (lucide-react)
 */
export const INITIAL_TABS: TabConfig[] = [
  {
    id: 1,
    stage: Stage.REQUIREMENT_COLLECTION,
    name: '需求采集',
    icon: 'FileEdit',
    status: TabStatus.ACTIVE,
  },
  {
    id: 2,
    stage: Stage.RISK_ANALYSIS,
    name: '风险评估',
    icon: 'AlertTriangle',
    status: TabStatus.LOCKED,
  },
  {
    id: 3,
    stage: Stage.TECH_STACK,
    name: '技术选型',
    icon: 'Settings',
    status: TabStatus.LOCKED,
  },
  {
    id: 4,
    stage: Stage.MVP_BOUNDARY,
    name: 'MVP规划',
    icon: 'ClipboardList',
    status: TabStatus.LOCKED,
  },
  {
    id: 5,
    stage: Stage.DIAGRAM_DESIGN,
    name: '架构设计',
    icon: 'Building2',
    status: TabStatus.LOCKED,
  },
  {
    id: 6,
    stage: Stage.DOCUMENT_GENERATION,
    name: '生成文档',
    icon: 'FileText',
    status: TabStatus.LOCKED,
  },
] as const;
