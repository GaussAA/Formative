/**
 * 表单模式组件
 * 提供结构化的表单输入界面
 */

'use client';

import React from 'react';
import type { FormModeProps } from './types';
import { Button } from '../../shared/Button';

export function FormMode({
  formData,
  setFormData,
  coreFunctionInput,
  setCoreFunctionInput,
  loading,
  handleFormSubmit,
  handleAddCoreFunction,
  handleRemoveCoreFunction,
}: FormModeProps) {
  return (
    <>
      <ModeSwitcher mode="form" setMode={() => {}} title="需求表单" />

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-semibold mb-2">需求信息表单</h2>
            <p className="text-gray-600 mb-6">请填写完整的需求信息，我们将为您快速生成开发方案</p>
            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* 项目名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  项目名称（选填）
                </label>
                <input
                  type="text"
                  value={formData.projectName || ''}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  placeholder="例如：AI学习社区平台"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>

              {/* 产品目标 - 必填 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  产品目标 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.productGoal || ''}
                  onChange={(e) => setFormData({ ...formData, productGoal: e.target.value })}
                  placeholder="请简要描述您的产品要解决什么问题，实现什么目标"
                  rows={3}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>

              {/* 目标用户 - 必填 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  目标用户 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.targetUsers || ''}
                  onChange={(e) => setFormData({ ...formData, targetUsers: e.target.value })}
                  placeholder="例如：AI技术爱好者、开发者"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>

              {/* 使用场景 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  使用场景（选填）
                </label>
                <textarea
                  value={formData.useCases || ''}
                  onChange={(e) => setFormData({ ...formData, useCases: e.target.value })}
                  placeholder="描述用户在什么情况下使用这个产品"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>

              {/* 核心功能 - 必填 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  核心功能 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={coreFunctionInput}
                    onChange={(e) => setCoreFunctionInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCoreFunction())}
                    placeholder="输入一个核心功能，按回车添加"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddCoreFunction}
                    className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-all shadow-sm font-medium"
                  >
                    添加
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.coreFunctions?.map((func, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-lg border border-gray-200"
                    >
                      <span className="flex-1 text-sm text-gray-900">{func}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCoreFunction(index)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {(!formData.coreFunctions || formData.coreFunctions.length === 0) && (
                  <p className="text-sm text-gray-500 mt-2">请至少添加一个核心功能</p>
                )}
              </div>

              {/* 数据存储需求 - 必填 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  数据存储需求 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="needsDataStorage"
                      checked={formData.needsDataStorage === true}
                      onChange={() => setFormData({ ...formData, needsDataStorage: true })}
                      className="mr-3 w-4 h-4 text-primary"
                    />
                    <div>
                      <div className="font-medium text-gray-900">需要数据存储</div>
                      <div className="text-sm text-gray-500">用户数据需要保存到服务器</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="needsDataStorage"
                      checked={formData.needsDataStorage === false}
                      onChange={() => setFormData({ ...formData, needsDataStorage: false })}
                      className="mr-3 w-4 h-4 text-primary"
                    />
                    <div>
                      <div className="font-medium text-gray-900">不需要数据存储</div>
                      <div className="text-sm text-gray-500">纯前端应用</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 多用户需求 - 必填 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  多用户功能 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="needsMultiUser"
                      checked={formData.needsMultiUser === true}
                      onChange={() => setFormData({ ...formData, needsMultiUser: true })}
                      className="mr-3 w-4 h-4 text-primary"
                    />
                    <div>
                      <div className="font-medium text-gray-900">需要多用户</div>
                      <div className="text-sm text-gray-500">用户间有交互、协作</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="needsMultiUser"
                      checked={formData.needsMultiUser === false}
                      onChange={() => setFormData({ ...formData, needsMultiUser: false })}
                      className="mr-3 w-4 h-4 text-primary"
                    />
                    <div>
                      <div className="font-medium text-gray-900">单用户即可</div>
                      <div className="text-sm text-gray-500">用户独立使用</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 用户登录需求 - 必填 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  用户登录认证 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="needsAuth"
                      checked={formData.needsAuth === true}
                      onChange={() => setFormData({ ...formData, needsAuth: true })}
                      className="mr-3 w-4 h-4 text-primary"
                    />
                    <div>
                      <div className="font-medium text-gray-900">需要用户登录</div>
                      <div className="text-sm text-gray-500">有用户系统</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="needsAuth"
                      checked={formData.needsAuth === false}
                      onChange={() => setFormData({ ...formData, needsAuth: false })}
                      className="mr-3 w-4 h-4 text-primary"
                    />
                    <div>
                      <div className="font-medium text-gray-900">不需要登录</div>
                      <div className="text-sm text-gray-500">匿名使用</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="pt-4">
                <Button type="submit" disabled={loading} fullWidth loading={loading}>
                  {loading ? '提交中...' : '提交需求'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

// ModeSwitcher 组件（内联以避免循环依赖）
function ModeSwitcher({ mode, setMode, title }: { mode: 'chat' | 'form'; setMode: (m: 'chat' | 'form') => void; title: string }) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode('chat')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'chat'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            对话模式
          </button>
          <button
            onClick={() => setMode('form')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'form'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            表单模式
          </button>
        </div>
      </div>
    </div>
  );
}
