/**
 * LeftPanel 主组件
 * 左侧面板，显示已收集的信息和保存状态 - 现代化设计版本
 */

'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { RequirementProfile } from '@/types';
import { CircularProgress } from '../CircularProgress';
import { useStage } from '@/contexts/StageContext';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { InfoField, InfoListField, HighlightStyles } from './InfoField';
import { TechRequirementsSection } from './TechRequirementsSection';
import { FileText, Sparkles } from 'lucide-react';

interface LeftPanelProps {
  completeness: number;
  profile: RequirementProfile;
  onViewDocument?: () => void;
}

interface FieldHighlight {
  [key: string]: boolean;
}

export function LeftPanel({ completeness, profile, onViewDocument }: LeftPanelProps) {
  const { saveStatus, lastSavedAt, manualSave } = useStage();
  const [highlights, setHighlights] = useState<FieldHighlight>({});
  const [prevProfile, setPrevProfile] = useState<RequirementProfile>({});

  useEffect(() => {
    const newHighlights: FieldHighlight = {};

    Object.keys(profile).forEach((key) => {
      const currentValue = profile[key as keyof RequirementProfile];
      const prevValue = prevProfile[key as keyof RequirementProfile];

      if (currentValue !== undefined && currentValue !== prevValue) {
        newHighlights[key] = true;

        setTimeout(() => {
          setHighlights((prev) => ({ ...prev, [key]: false }));
        }, 3000);
      }
    });

    setHighlights(newHighlights);
    setPrevProfile(profile);
  }, [profile]);

  const getHighlightClass = useCallback(
    (key: string) => {
      return highlights[key]
        ? 'border-primary shadow-lg shadow-primary/20 animate-highlight-glow'
        : '';
    },
    [highlights]
  );

  const techRequirements = useMemo(() => {
    const reqs = [];
    if (profile.needsDataStorage !== undefined) {
      reqs.push({
        label: 'needsDataStorage',
        checked: profile.needsDataStorage,
        trueLabel: '数据存储',
        falseLabel: '无需数据存储',
      });
    }
    if (profile.needsMultiUser !== undefined) {
      reqs.push({
        label: 'needsMultiUser',
        checked: profile.needsMultiUser,
        trueLabel: '多用户协作',
        falseLabel: '单用户使用',
      });
    }
    if (profile.needsAuth !== undefined) {
      reqs.push({
        label: 'needsAuth',
        checked: profile.needsAuth,
        trueLabel: '用户认证',
        falseLabel: '无需登录',
      });
    }
    return reqs;
  }, [profile.needsDataStorage, profile.needsMultiUser, profile.needsAuth]);

  const hasInfo =
    Object.keys(profile).filter((k) => profile[k as keyof RequirementProfile] !== undefined)
      .length > 0;

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-xl">
      <HighlightStyles />

      {/* Header */}
      <div className="px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              已收集信息
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">实时需求画像</p>
          </div>
        </div>
      </div>

      {/* Collected Info - 滚动区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-5 custom-scrollbar">
        {hasInfo ? (
          <div className="space-y-3">
            {profile.projectName && (
              <InfoField
                label="项目名称"
                value={profile.projectName}
                highlight={highlights.projectName}
              />
            )}

            {profile.productGoal && (
              <InfoField
                label="产品目标"
                value={profile.productGoal}
                highlight={highlights.productGoal}
                multiline
              />
            )}

            {profile.targetUsers && (
              <InfoField
                label="目标用户"
                value={profile.targetUsers}
                highlight={highlights.targetUsers}
              />
            )}

            {profile.useCases && (
              <InfoField
                label="使用场景"
                value={profile.useCases}
                highlight={highlights.useCases}
                multiline
              />
            )}

            {profile.coreFunctions && profile.coreFunctions.length > 0 && (
              <InfoListField
                label="核心功能"
                items={profile.coreFunctions}
                highlight={highlights.coreFunctions}
              />
            )}

            {/* Technical Requirements Group */}
            {techRequirements.length > 0 && (
              <TechRequirementsSection
                requirements={techRequirements}
                getHighlightClass={getHighlightClass}
              />
            )}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex flex-col items-center">
          <CircularProgress progress={completeness} />

          <SaveStatusIndicator
            saveStatus={saveStatus}
            lastSavedAt={lastSavedAt}
            onManualSave={manualSave}
          />

          <div className="mt-3 w-full">
            <button
              onClick={onViewDocument}
              disabled={completeness < 100}
              className={`
                w-full px-4 py-3 rounded-xl font-medium text-sm
                flex items-center justify-center gap-2
                transition-all duration-300
                ${
                  completeness === 100
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5 active:translate-y-0'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {completeness === 100 ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  查看完整文档
                </>
              ) : (
                '继续完善需求'
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center leading-relaxed">
            {completeness < 30 && '继续对话，完善需求信息'}
            {completeness >= 30 && completeness < 70 && '信息逐步完善中...'}
            {completeness >= 70 && completeness < 100 && '即将完成，最后确认'}
            {completeness === 100 && '需求采集完成！'}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 空状态组件
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
        <FileText className="w-10 h-10 text-gray-300 dark:text-gray-500" />
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        暂无收集到的信息
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[180px]">
        开始对话后，信息会在这里显示
      </p>
    </div>
  );
}

export default React.memo(LeftPanel);
