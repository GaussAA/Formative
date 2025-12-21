'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Stage, TabStatus, TabConfig, StageData, RequirementProfile } from '@/types';
import sessionStorage, { SessionRecord } from '@/lib/sessionStorage';
import { generateProjectName } from '@/lib/projectNameGenerator';

interface StageContextValue {
  // 当前状态
  currentStage: Stage;
  tabs: TabConfig[];
  stageData: StageData;

  // 操作方法
  setCurrentStage: (stage: Stage) => void;
  updateTabStatus: (stage: Stage, status: TabStatus) => void;
  updateStageData: (updates: Partial<StageData>) => void;
  completeStage: (stage: Stage) => void;
  goToStage: (stage: Stage) => void;

  // 会话信息
  sessionId: string | null;
  setSessionId: (id: string) => void;

  // 重置功能
  resetAll: () => void;
}

const StageContext = createContext<StageContextValue | undefined>(undefined);

export function StageProvider({ children }: { children: React.ReactNode }) {
  const [currentStage, setCurrentStageState] = useState<Stage>(Stage.REQUIREMENT_COLLECTION);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [tabs, setTabs] = useState<TabConfig[]>([
    {
      id: 1,
      stage: Stage.REQUIREMENT_COLLECTION,
      name: '需求采集',
      icon: '📝',
      status: TabStatus.ACTIVE,
    },
    {
      id: 2,
      stage: Stage.RISK_ANALYSIS,
      name: '风险评估',
      icon: '⚠️',
      status: TabStatus.LOCKED,
    },
    {
      id: 3,
      stage: Stage.TECH_STACK,
      name: '技术选型',
      icon: '🔧',
      status: TabStatus.LOCKED,
    },
    {
      id: 4,
      stage: Stage.MVP_BOUNDARY,
      name: 'MVP规划',
      icon: '📋',
      status: TabStatus.LOCKED,
    },
    {
      id: 5,
      stage: Stage.DIAGRAM_DESIGN,
      name: '架构设计',
      icon: '🏗️',
      status: TabStatus.LOCKED,
    },
    {
      id: 6,
      stage: Stage.DOCUMENT_GENERATION,
      name: '生成文档',
      icon: '📄',
      status: TabStatus.LOCKED,
    },
  ]);

  const [stageData, setStageData] = useState<StageData>({
    requirement: {},
  });

  // 保存会话到 IndexedDB
  const saveSessionToStorage = useCallback(async () => {
    if (!sessionId) return;

    try {
      const session: SessionRecord = {
        sessionId,
        projectName: generateProjectName(stageData), // 使用智能生成的项目名称
        createdAt: Date.now(), // 首次创建时会被保留
        updatedAt: Date.now(),
        completed: currentStage === Stage.DOCUMENT_GENERATION && !!stageData.finalSpec,
        currentStage,
        stageData,
      };

      // 检查是否已存在，如果存在则保留原创建时间
      const existing = await sessionStorage.getSession(sessionId);
      if (existing) {
        session.createdAt = existing.createdAt;
      }

      await sessionStorage.saveSession(session);
    } catch (error) {
      console.error('Failed to save session to storage:', error);
    }
  }, [sessionId, currentStage, stageData]);

  // 当会话数据变化时，自动保存
  useEffect(() => {
    if (sessionId && stageData.requirement.productGoal) {
      // 延迟保存，避免频繁写入
      const timer = setTimeout(() => {
        saveSessionToStorage();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [sessionId, stageData, saveSessionToStorage]);

  const setCurrentStage = useCallback((stage: Stage) => {
    setCurrentStageState(stage);

    // 更新tab状态：将目标tab设置为ACTIVE
    setTabs((prev) =>
      prev.map((tab) => ({
        ...tab,
        status: tab.stage === stage ? TabStatus.ACTIVE : tab.status,
      }))
    );
  }, []);

  const updateTabStatus = useCallback((stage: Stage, status: TabStatus) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.stage === stage ? { ...tab, status } : tab))
    );
  }, []);

  const updateStageData = useCallback((updates: Partial<StageData>) => {
    setStageData((prev) => ({ ...prev, ...updates }));
  }, []);

  const completeStage = useCallback(
    (stage: Stage) => {
      // 标记当前stage为完成
      updateTabStatus(stage, TabStatus.COMPLETED);

      // 解锁并激活下一个stage
      const currentTabIndex = tabs.findIndex((tab) => tab.stage === stage);
      if (currentTabIndex < tabs.length - 1) {
        const nextStage = tabs[currentTabIndex + 1].stage;
        updateTabStatus(nextStage, TabStatus.ACTIVE);
        setCurrentStage(nextStage);
      }
    },
    [tabs, updateTabStatus, setCurrentStage]
  );

  const goToStage = useCallback(
    (stage: Stage) => {
      const targetTab = tabs.find((tab) => tab.stage === stage);
      // 只允许跳转到已完成或当前激活的tab
      if (targetTab && (targetTab.status === TabStatus.COMPLETED || targetTab.status === TabStatus.ACTIVE)) {
        // 将之前的ACTIVE tab设为COMPLETED
        setTabs((prev) =>
          prev.map((tab) => ({
            ...tab,
            status:
              tab.status === TabStatus.ACTIVE && tab.stage !== stage
                ? TabStatus.COMPLETED
                : tab.status,
          }))
        );
        setCurrentStage(stage);
      }
    },
    [tabs, setCurrentStage]
  );

  const resetAll = useCallback(() => {
    // 重置到初始状态
    setCurrentStageState(Stage.REQUIREMENT_COLLECTION);
    setSessionId(null);
    setStageData({ requirement: {} });
    setTabs([
      {
        id: 1,
        stage: Stage.REQUIREMENT_COLLECTION,
        name: '需求采集',
        icon: '📝',
        status: TabStatus.ACTIVE,
      },
      {
        id: 2,
        stage: Stage.RISK_ANALYSIS,
        name: '风险评估',
        icon: '⚠️',
        status: TabStatus.LOCKED,
      },
      {
        id: 3,
        stage: Stage.TECH_STACK,
        name: '技术选型',
        icon: '🔧',
        status: TabStatus.LOCKED,
      },
      {
        id: 4,
        stage: Stage.MVP_BOUNDARY,
        name: 'MVP规划',
        icon: '📋',
        status: TabStatus.LOCKED,
      },
      {
        id: 5,
        stage: Stage.DIAGRAM_DESIGN,
        name: '架构设计',
        icon: '🏗️',
        status: TabStatus.LOCKED,
      },
      {
        id: 6,
        stage: Stage.DOCUMENT_GENERATION,
        name: '生成文档',
        icon: '📄',
        status: TabStatus.LOCKED,
      },
    ]);
  }, []);

  const value: StageContextValue = {
    currentStage,
    tabs,
    stageData,
    setCurrentStage,
    updateTabStatus,
    updateStageData,
    completeStage,
    goToStage,
    sessionId,
    setSessionId,
    resetAll,
  };

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function useStage() {
  const context = useContext(StageContext);
  if (!context) {
    throw new Error('useStage must be used within StageProvider');
  }
  return context;
}
