'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, StageNames, OptionChip, RequirementProfile } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  options?: OptionChip[];
}

export default function HomePage() {
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

  return (
    <div className="flex h-screen max-w-7xl mx-auto">
      {/* 左侧主聊天区 */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">定型 Formative</h1>
            <p className="text-sm text-gray-500">
              阶段 {currentStage}/5 · {StageNames[currentStage]} · 完备度 {completeness}%
            </p>
          </div>
          {finalSpec && (
            <button
              onClick={copySpec}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600"
            >
              📋 复制文档
            </button>
          )}
        </header>

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
