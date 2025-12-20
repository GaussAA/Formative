'use client';

import React, { useEffect, useState } from 'react';
import { RequirementProfile } from '@/types';
import { CircularProgress } from './CircularProgress';

interface LeftPanelProps {
  completeness: number;
  profile: RequirementProfile;
  onViewDocument?: () => void;
}

interface FieldHighlight {
  [key: string]: boolean;
}

export function LeftPanel({ completeness, profile, onViewDocument }: LeftPanelProps) {
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

  const getHighlightClass = (key: string) => {
    return highlights[key]
      ? 'ring-2 ring-primary ring-offset-2 bg-blue-50 border-primary animate-pulse'
      : '';
  };

  return (
    <div className="w-80 bg-slate-100 border-r border-slate-200 flex flex-col shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 bg-white border-b border-slate-200">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          已收集信息
        </h2>
        <p className="text-xs text-gray-500 mt-1.5">实时更新的需求画像</p>
      </div>

      {/* Collected Info - 滚动区域 */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="space-y-3">
          {profile.projectName && (
            <div className={`bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm transition-all duration-300 ${getHighlightClass('projectName')}`}>
              <div className="flex items-center mb-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">项目名称</div>
              </div>
              <div className="text-sm text-gray-900 font-medium pl-3.5">{profile.projectName}</div>
            </div>
          )}

          {profile.productGoal && (
            <div className={`bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm transition-all duration-300 ${getHighlightClass('productGoal')}`}>
              <div className="flex items-center mb-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">产品目标</div>
              </div>
              <div className="text-sm text-gray-900 leading-relaxed pl-3.5">{profile.productGoal}</div>
            </div>
          )}

          {profile.targetUsers && (
            <div className={`bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm transition-all duration-300 ${getHighlightClass('targetUsers')}`}>
              <div className="flex items-center mb-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">目标用户</div>
              </div>
              <div className="text-sm text-gray-900 pl-3.5">{profile.targetUsers}</div>
            </div>
          )}

          {profile.useCases && (
            <div className={`bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm transition-all duration-300 ${getHighlightClass('useCases')}`}>
              <div className="flex items-center mb-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">使用场景</div>
              </div>
              <div className="text-sm text-gray-900 leading-relaxed pl-3.5">{profile.useCases}</div>
            </div>
          )}

          {profile.coreFunctions && profile.coreFunctions.length > 0 && (
            <div className={`bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm transition-all duration-300 ${getHighlightClass('coreFunctions')}`}>
              <div className="flex items-center mb-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">核心功能</div>
              </div>
              <ul className="space-y-2 pl-3.5">
                {profile.coreFunctions.map((func, i) => (
                  <li key={i} className="text-sm text-gray-900 flex items-start">
                    <span className="text-primary mr-2 mt-0.5 font-bold">•</span>
                    <span>{func}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical Requirements Group */}
          {(profile.needsDataStorage !== undefined ||
            profile.needsMultiUser !== undefined ||
            profile.needsAuth !== undefined) && (
            <div className="bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">技术需求</div>
              </div>
              <div className="space-y-2 pl-3.5">
                {profile.needsDataStorage !== undefined && (
                  <div className={`flex items-center text-sm transition-all duration-300 ${getHighlightClass('needsDataStorage')}`}>
                    {profile.needsDataStorage ? (
                      <>
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-900">数据存储</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-500">无需数据存储</span>
                      </>
                    )}
                  </div>
                )}

                {profile.needsMultiUser !== undefined && (
                  <div className={`flex items-center text-sm transition-all duration-300 ${getHighlightClass('needsMultiUser')}`}>
                    {profile.needsMultiUser ? (
                      <>
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-900">多用户协作</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-500">单用户使用</span>
                      </>
                    )}
                  </div>
                )}

                {profile.needsAuth !== undefined && (
                  <div className={`flex items-center text-sm transition-all duration-300 ${getHighlightClass('needsAuth')}`}>
                    {profile.needsAuth ? (
                      <>
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-900">用户认证</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-500">无需登录</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {Object.keys(profile).filter(k => profile[k as keyof RequirementProfile] !== undefined).length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200">
                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 font-medium mb-1">暂无收集到的信息</p>
              <p className="text-xs text-gray-400">开始对话后，信息会在这里显示</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer - 环形进度条 */}
      <div className="px-6 py-6 bg-white border-t border-slate-200 shadow-sm">
        <div className="flex flex-col items-center">
          <CircularProgress progress={completeness} />

          <div className="mt-4 w-full">
            <button
              onClick={onViewDocument}
              disabled={completeness < 100}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
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
