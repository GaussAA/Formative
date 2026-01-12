/**
 * LeftPanel 主组件
 * 左侧面板，显示已收集的信息和保存状态
 */

'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { RequirementProfile } from '@/types';
import { CircularProgress } from '../CircularProgress';
import { useStage } from '@/contexts/StageContext';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { InfoField, InfoListField, HighlightStyles } from './InfoField';
import { TechRequirementsSection } from './TechRequirementsSection';

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

  // 检测新字段并触发高亮动画
  useEffect(() => {
    const newHighlights: FieldHighlight = {};

    Object.keys(profile).forEach((key) => {
      const currentValue = profile[key as keyof RequirementProfile];
      const prevValue = prevProfile[key as keyof RequirementProfile];

      // 如果字段从无到有，或者值发生变化，触发高亮
      if (currentValue !== undefined && currentValue !== prevValue) {
        newHighlights[key] = true;

        // 3秒后取消高亮
        setTimeout(() => {
          setHighlights((prev) => ({ ...prev, [key]: false }));
        }, 3000);
      }
    });

    setHighlights(newHighlights);
    setPrevProfile(profile);
  }, [profile]);

  // 使用 useMemo 缓存 getHighlightClass 函数
  const getHighlightClass = useCallback(
    (key: string) => {
      return highlights[key]
        ? 'border-primary shadow-lg shadow-primary/20 animate-highlight-glow'
        : '';
    },
    [highlights]
  );

  // 使用 useMemo 缓存技术需求数据
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
    <div className="w-80 bg-slate-100 border-r border-slate-200 flex flex-col shadow-sm">
      <HighlightStyles />

      {/* Header */}
      <div className="px-6 py-5 bg-white border-b border-slate-200">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
          <svg
            className="w-5 h-5 mr-2 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          已收集信息
        </h2>
        <p className="text-xs text-gray-600 mt-1.5">实时更新的需求画像</p>
      </div>

      {/* Collected Info - 滚动区域 */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
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
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200">
              <svg
                className="w-10 h-10 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-1">暂无收集到的信息</p>
            <p className="text-xs text-gray-500">开始对话后，信息会在这里显示</p>
          </div>
        )}
      </div>

      {/* Footer - 环形进度条 */}
      <div className="px-6 py-6 bg-white border-t border-slate-200 shadow-sm">
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
              className="w-full px-4 py-2.5 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {completeness === 100 ? '查看完整文档' : '继续完善需求'}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-3 text-center leading-relaxed">
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
 * LeftPanel 组件 - 使用 React.memo 避免不必要的重渲染
 * 只有当 props (completeness, profile, onViewDocument) 实际变化时才重新渲染
 */
export default React.memo(LeftPanel);
