'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, StageNames, OptionChip, RequirementProfile } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  options?: OptionChip[];
}

type Mode = 'chat' | 'form';

export default function HomePage() {
  const [mode, setMode] = useState<Mode>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我是定型（Formative），帮助你将想法转化为清晰的开发方案。\n\n请用一句话描述你想做的产品：',
    },
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<Stage>(Stage.INIT);
  const [completeness, setCompleteness] = useState(0);
  const [finalSpec, setFinalSpec] = useState<string | null>(null);
  const [profile, setProfile] = useState<RequirementProfile>({});
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 表单模式的状态
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

    // 添加用户消息
    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // 处理错误响应
      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message || '系统错误，请稍后重试',
          },
        ]);
        setLoading(false);
        return;
      }

      // 更新会话状态
      if (!sessionId) {
        setSessionId(data.sessionId);
      }
      setCurrentStage(data.currentStage);
      setCompleteness(data.completeness || 0);
      setProfile(data.profile || {});
      setAskedQuestions(data.askedQuestions || []);

      if (data.finalSpec) {
        setFinalSpec(data.finalSpec);
      }

      // 添加助手回复
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        options: data.options,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉，出现了错误，请稍后重试。',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleOptionClick = (value: string) => {
    sendMessage(value);
  };

  const copySpec = () => {
    if (finalSpec) {
      navigator.clipboard.writeText(finalSpec);
      alert('文档已复制到剪贴板！');
    }
  };

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

    // 验证必填字段
    if (!formData.productGoal || !formData.targetUsers ||
        !formData.coreFunctions || formData.coreFunctions.length === 0 ||
        formData.needsDataStorage === undefined ||
        formData.needsMultiUser === undefined ||
        formData.needsAuth === undefined) {
      alert('请填写所有必填字段');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/form-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: formData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      const data = await response.json();

      // 更新会话状态
      setSessionId(data.sessionId);
      setCurrentStage(data.currentStage);
      setCompleteness(data.completeness || 0);
      setProfile(data.profile || formData);

      if (data.finalSpec) {
        setFinalSpec(data.finalSpec);
      }

      // 切换到对话模式，显示验证结果
      setMode('chat');
      setMessages([
        {
          role: 'assistant',
          content: data.response,
          options: data.options,
        },
      ]);
    } catch (error) {
      console.error('Error:', error);
      alert('表单提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen max-w-7xl mx-auto">
      {/* 左侧主聊天区 */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold">定型 Formative</h1>
              <p className="text-sm text-gray-500">
                阶段 {currentStage}/5 · {StageNames[currentStage]} · 完备度 {completeness}%
              </p>
            </div>
            <div className="flex gap-2">
              {/* 模式切换按钮 */}
              {currentStage === Stage.INIT || currentStage === Stage.REQUIREMENT_COLLECTION ? (
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setMode('chat')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      mode === 'chat'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    💬 对话模式
                  </button>
                  <button
                    onClick={() => setMode('form')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      mode === 'form'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📝 表单模式
                  </button>
                </div>
              ) : null}
              {finalSpec && (
                <button
                  onClick={copySpec}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600"
                >
                  📋 复制文档
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 主内容区 - 根据模式显示不同内容 */}
        {mode === 'chat' ? (
          /* 对话模式 */
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => (
                <div key={index}>
                  <div
                    className={`flex ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-primary text-white'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>

                  {/* Options */}
                  {msg.options && msg.options.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.options.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => handleOptionClick(option.value)}
                          disabled={loading}
                          className="px-4 py-2 bg-white border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 p-3 rounded-lg">
                    <p className="text-gray-500">思考中...</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Final Spec Display */}
            {finalSpec && (
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {finalSpec}
                  </pre>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入您的消息..."
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  发送
                </button>
              </form>
            </div>
          </>
        ) : (
          /* 表单模式 */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-semibold mb-2">需求信息表单</h2>
                <p className="text-gray-600 mb-6">
                  请填写完整的需求信息，我们将为您快速生成开发方案
                </p>

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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* 核心功能 - 必填 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      核心功能 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={coreFunctionInput}
                        onChange={(e) => setCoreFunctionInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCoreFunction())}
                        placeholder="输入一个核心功能，按回车添加"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={handleAddCoreFunction}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600"
                      >
                        添加
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.coreFunctions?.map((func, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg"
                        >
                          <span className="flex-1 text-sm">{func}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCoreFunction(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    {formData.coreFunctions?.length === 0 && (
                      <p className="text-sm text-gray-500 mt-2">请至少添加一个核心功能</p>
                    )}
                  </div>

                  {/* 数据存储需求 - 必填 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      数据存储需求 <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="needsDataStorage"
                          checked={formData.needsDataStorage === true}
                          onChange={() => setFormData({ ...formData, needsDataStorage: true })}
                          className="mr-2"
                        />
                        需要数据存储（用户数据需要保存到服务器）
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="needsDataStorage"
                          checked={formData.needsDataStorage === false}
                          onChange={() => setFormData({ ...formData, needsDataStorage: false })}
                          className="mr-2"
                        />
                        不需要数据存储（纯前端应用）
                      </label>
                    </div>
                  </div>

                  {/* 多用户需求 - 必填 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      多用户功能 <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="needsMultiUser"
                          checked={formData.needsMultiUser === true}
                          onChange={() => setFormData({ ...formData, needsMultiUser: true })}
                          className="mr-2"
                        />
                        需要多用户（用户间有交互、协作）
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="needsMultiUser"
                          checked={formData.needsMultiUser === false}
                          onChange={() => setFormData({ ...formData, needsMultiUser: false })}
                          className="mr-2"
                        />
                        单用户即可（用户独立使用）
                      </label>
                    </div>
                  </div>

                  {/* 用户登录需求 - 必填 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      用户登录认证 <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="needsAuth"
                          checked={formData.needsAuth === true}
                          onChange={() => setFormData({ ...formData, needsAuth: true })}
                          className="mr-2"
                        />
                        需要用户登录（有用户系统）
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="needsAuth"
                          checked={formData.needsAuth === false}
                          onChange={() => setFormData({ ...formData, needsAuth: false })}
                          className="mr-2"
                        />
                        不需要登录（匿名使用）
                      </label>
                    </div>
                  </div>

                  {/* 提交按钮 */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {loading ? '提交中...' : '提交需求'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('chat')}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      切换到对话模式
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右侧信息展示面板 */}
      <div className="w-80 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">已收集信息</h2>

        {/* 完备度指示器 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">需求完备度</span>
            <span className="text-sm font-semibold">{completeness}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${completeness}%` }}
            ></div>
          </div>
        </div>

        {/* 需求画像 */}
        <div className="space-y-4">
          {profile.projectName && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">项目名称</div>
              <div className="text-sm font-medium">{profile.projectName}</div>
            </div>
          )}

          {profile.productGoal && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">产品目标</div>
              <div className="text-sm">{profile.productGoal}</div>
            </div>
          )}

          {profile.targetUsers && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">目标用户</div>
              <div className="text-sm">{profile.targetUsers}</div>
            </div>
          )}

          {profile.useCases && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">使用场景</div>
              <div className="text-sm">{profile.useCases}</div>
            </div>
          )}

          {profile.coreFunctions && profile.coreFunctions.length > 0 && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">核心功能</div>
              <ul className="text-sm space-y-1">
                {profile.coreFunctions.map((func, i) => (
                  <li key={i}>• {func}</li>
                ))}
              </ul>
            </div>
          )}

          {profile.needsDataStorage !== undefined && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">数据存储</div>
              <div className="text-sm">
                {profile.needsDataStorage ? '✓ 需要' : '✗ 不需要'}
              </div>
            </div>
          )}

          {profile.needsMultiUser !== undefined && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">多用户</div>
              <div className="text-sm">
                {profile.needsMultiUser ? '✓ 需要' : '✗ 不需要'}
              </div>
            </div>
          )}

          {profile.needsAuth !== undefined && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">用户登录</div>
              <div className="text-sm">
                {profile.needsAuth ? '✓ 需要' : '✗ 不需要'}
              </div>
            </div>
          )}

          {/* 已问问题数 */}
          {askedQuestions.length > 0 && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">提问轮次</div>
              <div className="text-sm">{askedQuestions.length} 轮对话</div>
            </div>
          )}

          {/* 空状态提示 */}
          {Object.keys(profile).length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">
              <p>暂无收集到的信息</p>
              <p className="mt-2">开始对话后，信息会显示在这里</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
