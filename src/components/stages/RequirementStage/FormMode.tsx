/**
 * 表单模式组件
 * 提供结构化的表单输入界面
 * React 19: 使用 Server Actions + useActionState
 */

'use client';

import React, { useActionState, useState, useTransition } from 'react';
import { Button } from '../../shared/Button';
import { submitRequirementForm, type RequirementFormState } from '@/app/actions/requirement-actions';

interface FormModeWithServerActionsProps {
  onFormSuccess?: (data: RequirementFormState) => void;
  onFormError?: (data: RequirementFormState) => void;
  switchToChatMode?: () => void;
}

export function FormMode({
  onFormSuccess,
  onFormError,
  switchToChatMode,
}: FormModeWithServerActionsProps) {
  // React 19: useActionState 管理表单状态
  const [state, formAction, isPending] = useActionState(submitRequirementForm, null);
  const [isTransitionPending, startTransition] = useTransition();

  // 本地表单状态（用于 UI 交互）
  const [coreFunctions, setCoreFunctions] = useState<string[]>([]);
  const [coreFunctionInput, setCoreFunctionInput] = useState('');

  // 添加核心功能
  const handleAddCoreFunction = () => {
    if (coreFunctionInput.trim()) {
      setCoreFunctions((prev) => [...prev, coreFunctionInput.trim()]);
      setCoreFunctionInput('');
    }
  };

  // 移除核心功能
  const handleRemoveCoreFunction = (index: number) => {
    setCoreFunctions((prev) => prev.filter((_, i) => i !== index));
  };

  // 监听 Server Action 返回状态
  React.useEffect(() => {
    if (state) {
      if (state.success) {
        startTransition(() => {
          onFormSuccess?.(state);
        });
      } else if (state.errors || state.message) {
        startTransition(() => {
          onFormError?.(state);
        });
      }
    }
  }, [state]);

  return (
    <>
      <ModeSwitcher mode="form" setMode={() => {}} title="需求表单" />

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-semibold mb-2">需求信息表单</h2>
            <p className="text-gray-600 mb-6">请填写完整的需求信息，我们将为您快速生成开发方案</p>

            {/* 错误提示 */}
            {state?.message && !state.success && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {state.message}
              </div>
            )}

            <form action={formAction} className="space-y-6">
              {/* 项目名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  项目名称（选填）
                </label>
                <input
                  type="text"
                  name="projectName"
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
                  name="productGoal"
                  placeholder="请简要描述您的产品要解决什么问题，实现什么目标"
                  rows={3}
                  required
                  minLength={10}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
                {state?.errors?.productGoal && (
                  <span className="text-red-500 text-sm mt-1">{state.errors.productGoal[0]}</span>
                )}
              </div>

              {/* 目标用户 - 必填 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  目标用户 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="targetUsers"
                  placeholder="例如：AI技术爱好者、开发者"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
                {state?.errors?.targetUsers && (
                  <span className="text-red-500 text-sm mt-1">{state.errors.targetUsers[0]}</span>
                )}
              </div>

              {/* 使用场景 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  使用场景（选填）
                </label>
                <textarea
                  name="useCases"
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

                {/* 隐藏字段存储 coreFunctions */}
                {coreFunctions.map((func, index) => (
                  <input
                    key={index}
                    type="hidden"
                    name="coreFunctions"
                    value={func}
                  />
                ))}

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={coreFunctionInput}
                    onChange={(e) => setCoreFunctionInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCoreFunction();
                      }
                    }}
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
                  {coreFunctions.map((func, index) => (
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
                {coreFunctions.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">请至少添加一个核心功能</p>
                )}
                {state?.errors?.coreFunctions && (
                  <span className="text-red-500 text-sm mt-1">{state.errors.coreFunctions[0]}</span>
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
                      value="true"
                      required
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
                      value="false"
                      required
                      className="mr-3 w-4 h-4 text-primary"
                    />
                    <div>
                      <div className="font-medium text-gray-900">不需要数据存储</div>
                      <div className="text-sm text-gray-500">纯前端应用</div>
                    </div>
                  </label>
                </div>
                {state?.errors?.needsDataStorage && (
                  <span className="text-red-500 text-sm mt-1">{state.errors.needsDataStorage[0]}</span>
                )}
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
                      value="true"
                      required
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
                      value="false"
                      required
                      className="mr-3 w-4 h-4 text-primary"
                    />
                    <div>
                      <div className="font-medium text-gray-900">单用户即可</div>
                      <div className="text-sm text-gray-500">用户独立使用</div>
                    </div>
                  </label>
                </div>
                {state?.errors?.needsMultiUser && (
                  <span className="text-red-500 text-sm mt-1">{state.errors.needsMultiUser[0]}</span>
                )}
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
                      value="true"
                      required
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
                      value="false"
                      required
                      className="mr-3 w-4 h-4 text-primary"
                    />
                    <div>
                      <div className="font-medium text-gray-900">不需要登录</div>
                      <div className="text-sm text-gray-500">匿名使用</div>
                    </div>
                  </label>
                </div>
                {state?.errors?.needsAuth && (
                  <span className="text-red-500 text-sm mt-1">{state.errors.needsAuth[0]}</span>
                )}
              </div>

              {/* 提交按钮 */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isPending || isTransitionPending || coreFunctions.length === 0}
                  fullWidth
                  loading={isPending || isTransitionPending}
                >
                  {isPending || isTransitionPending ? '提交中...' : '提交需求'}
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
