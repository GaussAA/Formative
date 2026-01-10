/**
 * 对话模式组件
 * 处理用户与 AI 的对话交互
 */

'use client';

import React, { useCallback, FormEvent } from 'react';
import type { ChatModeProps } from './types';
import { Button } from '../../shared/Button';

export function ChatMode({
  messages,
  input,
  setInput,
  loading,
  sendMessage,
  messagesEndRef,
}: ChatModeProps) {
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage]
  );

  const handleOptionClick = useCallback((label: string) => {
    setInput((prevInput) => {
      if (prevInput.trim()) {
        return prevInput + ', ' + label;
      }
      return label;
    });
  }, [setInput]);

  return (
    <>
      <ModeSwitcher mode="chat" setMode={() => {}} title="需求对话" />

      {/* 对话区域 */}
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

      {/* 输入区域 */}
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
  );
}

// 导入 ModeSwitcher（避免循环依赖）
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
