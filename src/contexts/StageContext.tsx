'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Stage, TabStatus, TabConfig, StageData, RequirementProfile } from '@/types';
import sessionStorage, { SessionRecord } from '@/lib/sessionStorage';
import { generateProjectName } from '@/lib/projectNameGenerator';

/** 保存状态 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

  // 保存状态
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  manualSave: () => Promise<void>;

  // 重置功能
  resetAll: () => void;
}

const StageContext = createContext<StageContextValue | undefined>(undefined);

export function StageProvider({ children }: { children: React.ReactNode }) {
  const [currentStage, setCurrentStageState] = useState<Stage>(Stage.REQUIREMENT_COLLECTION);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 保存状态管理
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Refs 用于防抖保存逻辑
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const lastSaveTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 2000; // 防抖延迟：2秒

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

  /**
   * 执行实际的保存操作
   */
  const performSave = useCallback(async (currentStageValue: Stage, stageDataValue: StageData): Promise<void> => {
    if (!sessionId || isSavingRef.current) return;

    // 检查距离上次保存的时间，避免频繁写入
    const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
    if (timeSinceLastSave < DEBOUNCE_MS) {
      return;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      const session: SessionRecord = {
        sessionId,
        projectName: generateProjectName(stageDataValue),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completed: currentStageValue === Stage.DOCUMENT_GENERATION && !!stageDataValue.finalSpec,
        currentStage: currentStageValue,
        stageData: stageDataValue,
      };

      // 保留原创建时间
      const existing = await sessionStorage.getSession(sessionId);
      if (existing) {
        session.createdAt = existing.createdAt;
      }

      await sessionStorage.saveSession(session);

      lastSaveTimeRef.current = Date.now();
      setLastSavedAt(Date.now());
      setSaveStatus('saved');

      // 2秒后重置状态为 idle
      setTimeout(() => {
        if (saveStatus === 'saved') {
          setSaveStatus('idle');
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to save session:', error);
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [sessionId, saveStatus]);

  /**
   * 防抖保存：延迟执行保存操作
   */
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      performSave(currentStage, stageData);
    }, DEBOUNCE_MS);
  }, [currentStage, stageData, performSave]);

  /**
   * 手动保存：立即执行保存（绕过防抖）
   */
  const manualSave = useCallback(async (): Promise<void> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // 强制更新最后保存时间，允许立即保存
    lastSaveTimeRef.current = 0;
    await performSave(currentStage, stageData);
  }, [currentStage, stageData, performSave]);

  /**
   * 当会话数据变化时，调度防抖保存
   */
  useEffect(() => {
    if (sessionId && stageData.requirement && Object.keys(stageData.requirement).length > 0) {
      scheduleSave();
    }

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [sessionId, stageData, currentStage, scheduleSave]);

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
    saveStatus,
    lastSavedAt,
    manualSave,
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
