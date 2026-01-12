/**
 * 对话模式组件
 * 处理用户与 AI 的对话交互 - 现代化设计版本
 */

'use client';

import { useCallback, type FormEvent } from 'react';
import type { ChatModeProps } from './types';
import { User, Sparkles, Send, Bot } from 'lucide-react';

export function ChatMode({
  messages,
  input,
  setInput,
  loading,
  sendMessage,
  messagesEndRef,
  streamingContent = '',
}: ChatModeProps) {
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage]
  );

  const handleOptionClick = useCallback(
    (label: string) => {
      setInput((prevInput) => {
        if (prevInput.trim()) {
          return prevInput + ', ' + label;
        }
        return label;
      });
    },
    [setInput]
  );

  return (
    <>
      <ModeSwitcher mode="chat" setMode={() => {}} title="需求对话" />

      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, index) => (
            <MessageBubble
              key={index}
              message={msg}
              onOptionClick={handleOptionClick}
              loading={loading}
            />
          ))}

          {loading && <TypingIndicator streamingContent={streamingContent} />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 px-2 py-2 border border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 focus-within:shadow-xl focus-within:shadow-primary-500/10 focus-within:border-primary-500/30">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="描述您的产品想法..."
                disabled={loading}
                className="flex-1 px-4 py-3 bg-transparent text-[15px] sm:text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none disabled:opacity-50 transition-all"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className={`
                  p-3 rounded-xl transition-all duration-300 flex-shrink-0
                  ${
                    input.trim() && !loading
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-105 active:scale-95'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  }
                `}
                aria-label="发送消息"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/**
 * 消息气泡组件
 */
function MessageBubble({
  message,
  onOptionClick,
  loading,
}: {
  message: {
    role: string;
    content: string;
    options?: Array<{ id: string; label: string; value: string }>;
  };
  onOptionClick: (label: string) => void;
  loading: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 头像 */}
      <div
        className={`
          flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-md
          ${
            isUser
              ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
              : 'bg-gradient-to-br from-accent-500 to-accent-600 text-white'
          }
        `}
      >
        {isUser ? (
          <User className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </div>

      {/* 消息内容 */}
      <div
        className={`flex flex-col max-w-[75%] sm:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`
            px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl
            ${
              isUser
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/20 rounded-tr-sm'
                : 'bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 shadow-md dark:shadow-gray-900/20 rounded-tl-sm'
            }
          `}
        >
          <p className="whitespace-pre-wrap text-[14px] sm:text-[15px] leading-relaxed">
            {message.content}
          </p>
        </div>

        {/* 选项按钮 */}
        {message.options && message.options.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.options.map((option) => (
              <button
                key={option.id}
                onClick={() => onOptionClick(option.label)}
                disabled={loading}
                className="
                  px-3 py-1.5 sm:px-4 sm:py-2 bg-white dark:bg-gray-800
                  border border-gray-200 dark:border-gray-700
                  rounded-full text-sm
                  text-gray-700 dark:text-gray-300
                  shadow-sm hover:shadow-md
                  hover:border-primary-300 dark:hover:border-primary-600
                  hover:bg-primary-50/50 dark:hover:bg-primary-900/20
                  hover:text-primary-600 dark:hover:text-primary-400
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  disabled:hover:bg-white dark:disabled:hover:bg-gray-800
                  disabled:hover:border-gray-200 dark:disabled:hover:border-gray-700
                "
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 打字指示器组件
 */
function TypingIndicator({ streamingContent }: { streamingContent: string }) {
  return (
    <div className="flex gap-3">
      {/* AI 头像 */}
      <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-md">
        <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
      </div>

      {/* 打字动画 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl rounded-tl-sm shadow-md px-4 py-3.5 sm:px-5">
        {streamingContent ? (
          <div className="flex items-center gap-1">
            <p className="whitespace-pre-wrap text-[14px] sm:text-[15px] leading-relaxed text-gray-900 dark:text-gray-100">
              {streamingContent}
            </p>
            <span className="inline-flex">
              <span className="w-1.5 h-4 bg-gradient-to-b from-primary-500 to-primary-600 rounded-full animate-pulse" />
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span
                className="w-2 h-2 bg-gray-400 dark:text-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-2 h-2 bg-gray-400 dark:text-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-2 h-2 bg-gray-400 dark:text-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">AI 正在思考...</span>
          </div>
        )}
      </div>
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
  setMode: (m: 'chat' | 'form') => void;
  title: string;
}) {
  return (
    <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 px-4 sm:px-6 py-3.5 sm:py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
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
