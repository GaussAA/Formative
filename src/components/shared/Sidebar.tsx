'use client';

import React from 'react';
import { RequirementProfile } from '@/types';

interface SidebarProps {
  completeness: number;
  profile: RequirementProfile;
}

export function Sidebar({ completeness, profile }: SidebarProps) {
  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          收集进度
        </h2>
      </div>

      {/* Progress Section */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-xs font-medium text-gray-600">需求完备度</span>
          <span className="text-2xl font-bold text-primary">{completeness}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${completeness}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {completeness < 30 && '刚刚开始，继续完善需求...'}
          {completeness >= 30 && completeness < 70 && '进展顺利，补充更多细节...'}
          {completeness >= 70 && completeness < 100 && '即将完成，最后确认...'}
          {completeness === 100 && '需求采集完成！'}
        </p>
      </div>

      {/* Collected Info */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-4">
          已收集信息
        </h3>

        <div className="space-y-3">
          {profile.projectName && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1.5 font-medium">项目名称</div>
              <div className="text-sm text-gray-900">{profile.projectName}</div>
            </div>
          )}

          {profile.productGoal && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1.5 font-medium">产品目标</div>
              <div className="text-sm text-gray-900 leading-relaxed">{profile.productGoal}</div>
            </div>
          )}

          {profile.targetUsers && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1.5 font-medium">目标用户</div>
              <div className="text-sm text-gray-900">{profile.targetUsers}</div>
            </div>
          )}

          {profile.useCases && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1.5 font-medium">使用场景</div>
              <div className="text-sm text-gray-900 leading-relaxed">{profile.useCases}</div>
            </div>
          )}

          {profile.coreFunctions && profile.coreFunctions.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-2 font-medium">核心功能</div>
              <ul className="space-y-1.5">
                {profile.coreFunctions.map((func, i) => (
                  <li key={i} className="text-sm text-gray-900 flex items-start">
                    <span className="text-primary mr-2 mt-0.5">•</span>
                    <span>{func}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.needsDataStorage !== undefined && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1.5 font-medium">数据存储</div>
              <div className="text-sm text-gray-900 flex items-center">
                {profile.needsDataStorage ? (
                  <>
                    <span className="text-green-500 mr-1.5">✓</span> 需要
                  </>
                ) : (
                  <>
                    <span className="text-gray-400 mr-1.5">✗</span> 不需要
                  </>
                )}
              </div>
            </div>
          )}

          {profile.needsMultiUser !== undefined && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1.5 font-medium">多用户</div>
              <div className="text-sm text-gray-900 flex items-center">
                {profile.needsMultiUser ? (
                  <>
                    <span className="text-green-500 mr-1.5">✓</span> 需要
                  </>
                ) : (
                  <>
                    <span className="text-gray-400 mr-1.5">✗</span> 不需要
                  </>
                )}
              </div>
            </div>
          )}

          {profile.needsAuth !== undefined && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1.5 font-medium">用户登录</div>
              <div className="text-sm text-gray-900 flex items-center">
                {profile.needsAuth ? (
                  <>
                    <span className="text-green-500 mr-1.5">✓</span> 需要
                  </>
                ) : (
                  <>
                    <span className="text-gray-400 mr-1.5">✗</span> 不需要
                  </>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {Object.keys(profile).filter(k => profile[k as keyof RequirementProfile] !== undefined).length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-1">暂无收集到的信息</p>
              <p className="text-xs text-gray-400">开始对话后，信息会显示在这里</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
