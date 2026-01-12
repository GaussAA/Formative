/**
 * 表单模式组件
 * 提供结构化的表单输入界面 - 现代化设计版本
 */

'use client';

import { useActionState, useState, useTransition, useEffect } from 'react';
import { Button } from '../../shared/Button';
import {
  submitRequirementForm,
  type RequirementFormState,
} from '@/app/actions/requirement-actions';
import { Plus, X, Check, Database, Users, Shield, Building2 } from 'lucide-react';

interface FormModeWithServerActionsProps {
  onFormSuccess?: (data: RequirementFormState) => void;
  onFormError?: (data: RequirementFormState) => void;
}

export function FormMode({ onFormSuccess, onFormError }: FormModeWithServerActionsProps) {
  const [state, formAction, isPending] = useActionState(submitRequirementForm, null);
  const [isTransitionPending, startTransition] = useTransition();

  const [coreFunctions, setCoreFunctions] = useState<string[]>([]);
  const [coreFunctionInput, setCoreFunctionInput] = useState('');

  const handleAddCoreFunction = () => {
    if (coreFunctionInput.trim()) {
      setCoreFunctions((prev) => [...prev, coreFunctionInput.trim()]);
      setCoreFunctionInput('');
    }
  };

  const handleRemoveCoreFunction = (index: number) => {
    setCoreFunctions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCoreFunction();
    }
  };

  useEffect(() => {
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

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <div className="max-w-2xl mx-auto">
          {/* 表单卡片 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-gray-900/30 border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* 卡片头部 */}
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-800/50 dark:to-gray-800/0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                需求信息表单
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                请填写完整的需求信息，我们将为您快速生成开发方案
              </p>
            </div>

            {/* 错误提示 */}
            {state?.message && !state.success && (
              <div className="mx-6 mt-6 sm:mx-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
                    <X className="w-3 h-3 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300">{state.message}</p>
                </div>
              </div>
            )}

            <form action={formAction} className="p-6 sm:p-8 space-y-8">
              {/* 项目名称 */}
              <FormSection>
                <FormLabel required={false}>项目名称（选填）</FormLabel>
                <FormInput name="projectName" placeholder="例如：AI学习社区平台" />
              </FormSection>

              {/* 产品目标 - 必填 */}
              <FormSection>
                <FormLabel>产品目标 *</FormLabel>
                <FormTextarea
                  name="productGoal"
                  placeholder="请简要描述您的产品要解决什么问题，实现什么目标"
                  rows={3}
                  required
                  minLength={10}
                  error={state?.errors?.productGoal?.[0]}
                />
              </FormSection>

              {/* 目标用户 - 必填 */}
              <FormSection>
                <FormLabel>目标用户 *</FormLabel>
                <FormInput
                  name="targetUsers"
                  placeholder="例如：AI技术爱好者、开发者"
                  required
                  error={state?.errors?.targetUsers?.[0]}
                />
              </FormSection>

              {/* 使用场景 */}
              <FormSection>
                <FormLabel required={false}>使用场景（选填）</FormLabel>
                <FormTextarea
                  name="useCases"
                  placeholder="描述用户在什么情况下使用这个产品"
                  rows={2}
                />
              </FormSection>

              {/* 核心功能 - 必填 */}
              <FormSection>
                <FormLabel>核心功能 *</FormLabel>

                {/* 隐藏字段存储 coreFunctions */}
                {coreFunctions.map((func, index) => (
                  <input key={index} type="hidden" name="coreFunctions" value={func} />
                ))}

                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={coreFunctionInput}
                      onChange={(e) => setCoreFunctionInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="输入一个核心功能，按回车添加"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCoreFunction}
                    className="px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 font-medium flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    添加
                  </button>
                </div>

                {/* 功能标签列表 */}
                <div className="space-y-2">
                  {coreFunctions.map((func, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 group animate-fadeIn"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                        {func}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCoreFunction(index)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {coreFunctions.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    请至少添加一个核心功能
                  </p>
                )}
                {state?.errors?.coreFunctions && (
                  <ErrorText>{state.errors.coreFunctions[0]}</ErrorText>
                )}
              </FormSection>

              {/* 数据存储需求 - 必填 */}
              <FormSection>
                <FormLabel>数据存储需求 *</FormLabel>
                <RadioGroup
                  name="needsDataStorage"
                  options={[
                    {
                      value: 'true',
                      label: '需要数据存储',
                      description: '用户数据需要保存到服务器',
                      icon: Database,
                    },
                    {
                      value: 'false',
                      label: '不需要数据存储',
                      description: '纯前端应用',
                      icon: Building2,
                    },
                  ]}
                  error={state?.errors?.needsDataStorage?.[0]}
                />
              </FormSection>

              {/* 多用户需求 - 必填 */}
              <FormSection>
                <FormLabel>多用户功能 *</FormLabel>
                <RadioGroup
                  name="needsMultiUser"
                  options={[
                    {
                      value: 'true',
                      label: '需要多用户',
                      description: '用户间有交互、协作',
                      icon: Users,
                    },
                    {
                      value: 'false',
                      label: '单用户即可',
                      description: '用户独立使用',
                      icon: Users,
                    },
                  ]}
                  error={state?.errors?.needsMultiUser?.[0]}
                />
              </FormSection>

              {/* 用户登录需求 - 必填 */}
              <FormSection>
                <FormLabel>用户登录认证 *</FormLabel>
                <RadioGroup
                  name="needsAuth"
                  options={[
                    {
                      value: 'true',
                      label: '需要用户登录',
                      description: '有用户系统',
                      icon: Shield,
                    },
                    { value: 'false', label: '不需要登录', description: '匿名使用', icon: Shield },
                  ]}
                  error={state?.errors?.needsAuth?.[0]}
                />
              </FormSection>

              {/* 提交按钮 */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isPending || isTransitionPending || coreFunctions.length === 0}
                  fullWidth
                  size="lg"
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

/**
 * 表单区域容器
 */
function FormSection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

/**
 * 表单标签
 */
function FormLabel({
  children,
  required = true,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

/**
 * 表单输入框
 */
function FormInput({
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onKeyDown,
  required,
  minLength,
  error,
}: {
  name: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  required?: boolean;
  minLength?: number;
  error?: string;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        required={required}
        minLength={minLength}
        className={`
          w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50
          border rounded-xl text-sm sm:text-base
          text-gray-900 dark:text-gray-100 placeholder:text-gray-400
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
          hover:bg-gray-100 dark:hover:bg-gray-700
          ${error ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-gray-600'}
        `}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

/**
 * 表单文本域
 */
function FormTextarea({
  name,
  placeholder,
  rows,
  required,
  minLength,
  error,
}: {
  name: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  minLength?: number;
  error?: string;
}) {
  return (
    <div className="relative">
      <textarea
        name={name}
        placeholder={placeholder}
        rows={rows}
        required={required}
        minLength={minLength}
        className={`
          w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50
          border rounded-xl text-sm sm:text-base
          text-gray-900 dark:text-gray-100 placeholder:text-gray-400
          transition-all duration-200 resize-none
          focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
          hover:bg-gray-100 dark:hover:bg-gray-700
          ${error ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-gray-600'}
        `}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

/**
 * 错误文本
 */
function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-red-500 text-sm mt-1.5 flex items-center gap-1 animate-fadeIn">
      <X className="w-3.5 h-3.5" />
      {children}
    </span>
  );
}

/**
 * 单选按钮组 - 卡片样式
 */
function RadioGroup({
  name,
  options,
  error,
}: {
  name: string;
  options: Array<{
    value: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      {options.map((option) => (
        <label
          key={option.value}
          className="group relative flex items-start p-4 bg-gray-50/50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white dark:hover:bg-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md"
        >
          <input type="radio" name={name} value={option.value} required className="sr-only peer" />
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-500 mr-4 flex items-center justify-center flex-shrink-0 mt-0.5 peer-checked:border-primary-500 peer-checked:bg-primary-500 transition-all">
            <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100 transition-opacity" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <option.icon className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
              <span className="font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 ml-6">
              {option.description}
            </p>
          </div>
          <div className="absolute inset-0 rounded-xl border-2 border-primary-500 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
        </label>
      ))}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

/**
 * 模式切换器组件
 */
function ModeSwitcher({
  mode,
  setMode,
  title,
}: {
  mode: 'chat' | 'form';
  setMode: (_: 'chat' | 'form') => void;
  title: string;
}) {
  return (
    <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 px-4 sm:px-6 py-3.5 sm:py-4">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <div className="inline-flex bg-gray-100/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-1">
          <button
            onClick={() => setMode('chat')}
            className={`
              px-4 py-1.5 sm:px-5 sm:py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${
                mode === 'chat'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }
            `}
          >
            对话模式
          </button>
          <button
            onClick={() => setMode('form')}
            className={`
              px-4 py-1.5 sm:px-5 sm:py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${
                mode === 'form'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }
            `}
          >
            表单模式
          </button>
        </div>
      </div>
    </div>
  );
}
