'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Stage, OptionChip, RequirementProfile } from '@/types';
import { Button } from '../shared/Button';
import { LeftPanel } from '../shared/LeftPanel';
import { useStage } from '@/contexts/StageContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  options?: OptionChip[];
}

type Mode = 'chat' | 'form';

export function RequirementStage() {
  const { stageData, updateStageData, completeStage, setSessionId } = useStage();
  const [mode, setMode] = useState<Mode>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我是定型（Formative），帮助你将想法转化为清晰的开发方案。\n\n请用一句话描述你想做的产品：',
    },
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setLocalSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [completeness, setCompleteness] = useState(0);
  const [profile, setProfile] = useState<RequirementProfile>(stageData.requirement);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 表单模式状态
  const [formData, setFormData] = useState<RequirementProfile>({
    projectName: '',
    productGoal: '',
    targetUsers: '',
    useCases: '',
    coreFunctions: [],
    needsDataStorage: undefined,
    needsMultiUser: undefined,
    needsAuth: undefined,
  });
  const [coreFunctionInput, setCoreFunctionInput] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.message || '系统错误，请稍后重试' },
        ]);
        setLoading(false);
        return;
      }

      if (!sessionId) {
        setLocalSessionId(data.sessionId);
        setSessionId(data.sessionId);
      }

      setCompleteness(data.completeness || 0);
      const updatedProfile = data.profile || {};
      setProfile(updatedProfile);

      // 更新全局状态
      updateStageData({ requirement: updatedProfile });

      // 如果需求采集完成（完备度100%），显示过渡消息并跳转
      if (data.completeness === 100) {
        const transitionMessage: Message = {
          role: 'assistant',
          content: '✅ 需求采集完成！\n\n正在为您分析潜在风险...',
        };
        setMessages((prev) => [...prev, transitionMessage]);

        setTimeout(() => {
          completeStage(Stage.REQUIREMENT_COLLECTION);
        }, 1500);
      } else {
        // 正常显示AI响应
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response,
          options: data.options,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '抱歉，出现了错误，请稍后重试。' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleOptionClick = (label: string) => {
    // 将选项的友好文本添加到输入框，而不是直接提交
    setInput((prevInput) => {
      // 如果输入框已有内容，用逗号+空格分隔
      if (prevInput.trim()) {
        return prevInput + ', ' + label;
      }
      return label;
    });
  };

  // 表单相关函数
  const handleAddCoreFunction = () => {
    if (coreFunctionInput.trim()) {
      setFormData({
        ...formData,
        coreFunctions: [...(formData.coreFunctions || []), coreFunctionInput.trim()],
      });
      setCoreFunctionInput('');
    }
  };

  const handleRemoveCoreFunction = (index: number) => {
    setFormData({
      ...formData,
      coreFunctions: formData.coreFunctions?.filter((_, i) => i !== index),
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.productGoal ||
      !formData.targetUsers ||
      !formData.coreFunctions ||
      formData.coreFunctions.length === 0 ||
      formData.needsDataStorage === undefined ||
      formData.needsMultiUser === undefined ||
      formData.needsAuth === undefined
    ) {
      alert('请填写所有必填字段');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/form-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: formData }),
      });

      if (!response.ok) throw new Error('Failed to submit form');

      const data = await response.json();

      setLocalSessionId(data.sessionId);
      setSessionId(data.sessionId);
      setCompleteness(data.completeness || 0);
      setProfile(data.profile || formData);

      // 更新全局状态
      updateStageData({ requirement: data.profile || formData });

      // 切换到对话模式
      setMode('chat');

      // 如果需求完备度达到100%，显示过渡消息并跳转
      if (data.completeness === 100) {
        const transitionMessage: Message = {
          role: 'assistant',
          content: '✅ 需求采集完成！\n\n正在为您分析潜在风险...',
        };
        setMessages([transitionMessage]);

        setTimeout(() => {
          completeStage(Stage.REQUIREMENT_COLLECTION);
        }, 1500);
      } else {
        // 正常显示验证结果
        setMessages([{ role: 'assistant', content: data.response, options: data.options }]);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('表单提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* 左侧收集面板 */}
      <LeftPanel
        completeness={completeness}
        profile={profile}
        onViewDocument={() => {
          // TODO: 导航到文档查看页面
          console.log('查看完整文档');
        }}
      />

      {/* 右侧主区域 - 对话/表单 */}
      <div className="flex-1 flex flex-col">
        {/* 主内容区 */}
        {mode === 'chat' ? (
          /* 对话模式 */
          <>
            {/* 对话区域头部 - 包含切换控件 */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">需求对话</h2>
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
            <div className="flex-1 overflow-y-auto px-6 py-8 bg-slate-50">
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((msg, index) => (
                  <div key={index}>
                    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] px-5 py-3.5 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                      </div>
                    </div>

                    {msg.options && msg.options.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.options.map((option) => (
                          <Button
                            key={option.id}
                            onClick={() => handleOptionClick(option.label)}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 px-5 py-3.5 rounded-2xl shadow-sm">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-gray-500 text-sm">正在思考...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="bg-white border-t border-gray-200 px-6 py-5 shadow-sm">
              <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSubmit} className="relative">
                  <div className="flex items-center bg-slate-50 border border-gray-300 rounded-2xl px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-sm">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="输入您的消息..."
                      disabled={loading}
                      className="flex-1 bg-transparent px-2 py-2.5 text-[15px] focus:outline-none disabled:opacity-50 placeholder:text-gray-400"
                    />
                    <button
                      type="submit"
                      disabled={loading || !input.trim()}
                      className="ml-2 p-2.5 bg-primary text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        ) : (
          /* 表单模式 */
          <>
            {/* 表单区域头部 - 包含切换控件 */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">需求表单</h2>
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
        )}
      </div>
    </div>
  );
}
