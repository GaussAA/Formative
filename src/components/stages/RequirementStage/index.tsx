/**
 * RequirementStage - 需求采集阶段主组件
 * 支持对话模式和表单模式两种输入方式
 */

'use client';

import React, { useState, useRef, useEffect, useCallback, useTransition } from 'react';
import { Stage, RequirementProfile } from '@/types';
import { LeftPanel } from '../../shared/LeftPanel';
import { useStage } from '@/contexts/StageContext';
import { ChatMode } from './ChatMode';
import { FormMode } from './FormMode';
import type { Message, Mode } from './types';

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
  const [streamingContent, setStreamingContent] = useState(''); // React 19: 流式响应状态
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // React 19: useTransition for non-urgent updates
  const [isPending, startTransition] = useTransition();

  // 表单提交成功处理
  const handleFormSuccess = useCallback((data: any) => {
    if (data.sessionId) {
      setLocalSessionId(data.sessionId);
      setSessionId(data.sessionId);
    }

    setCompleteness(data.completeness || 0);
    const updatedProfile = data.profile || {};
    setProfile(updatedProfile);

    // 更新全局状态
    updateStageData({ requirement: updatedProfile });

    // 如果验证通过且完备度达到100%，直接进入下一阶段
    if (data.completeness === 100 && data.currentStage === Stage.RISK_ANALYSIS) {
      completeStage(Stage.REQUIREMENT_COLLECTION);
    } else {
      // 验证未通过或需要澄清，切换到对话模式
      setMode('chat');
      setMessages([{ role: 'assistant', content: data.response, options: data.options }]);
    }
  }, [setSessionId, updateStageData, completeStage]);

  // 表单提交错误处理
  const handleFormError = useCallback((data: any) => {
    // 错误已在 FormMode 组件中显示
    console.error('Form submission error:', data);
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 发送消息（对话模式）- React 19: 支持流式响应
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStreamingContent(''); // 重置流式内容

    try {
      // React 19: 使用流式响应（添加 stream=true 参数）
      const response = await fetch('/api/chat?stream=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = 'Failed to send message';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // 检查是否是流式响应
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        // 流式响应处理
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        if (reader) {
          // 用于存储从流中接收的元数据
          let streamMetadata: {
            options?: Array<{ id: string; label: string; value: string }>;
            profile?: RequirementProfile;
            completeness?: number;
          } = {};

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') {
                  // 流式完成信号，在循环结束后统一处理
                  break;
                } else if (data) {
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.chunk) {
                      // 文本内容块
                      fullContent += parsed.chunk;
                      // React 19: 使用 startTransition 更新流式内容（低优先级）
                      startTransition(() => {
                        setStreamingContent(fullContent);
                      });
                    } else if (parsed.metadata) {
                      // 元数据块（在流式结束时发送）
                      streamMetadata = parsed.metadata;
                    }
                  } catch {
                    // 忽略解析错误
                  }
                }
              }
            }
          }

          // 流式完成后，统一处理响应
          const newSessionId = response.headers.get('X-Session-Id');

          if (newSessionId && !sessionId) {
            setLocalSessionId(newSessionId);
            setSessionId(newSessionId);
          }

          // 更新完备度和 profile
          if (streamMetadata.completeness !== undefined) {
            setCompleteness(streamMetadata.completeness);
          }
          if (streamMetadata.profile) {
            setProfile(streamMetadata.profile);
            updateStageData({ requirement: streamMetadata.profile });
          }

          setStreamingContent('');

          // 如果需求采集完成（完备度100%），显示过渡消息并跳转
          if (streamMetadata.completeness === 100) {
            const transitionMessage: Message = {
              role: 'assistant',
              content: fullContent + '\n\n✅ 需求采集完成！\n\n正在为您分析潜在风险...',
            };
            startTransition(() => {
              setMessages((prev) => [...prev, transitionMessage]);
            });

            setTimeout(() => {
              completeStage(Stage.REQUIREMENT_COLLECTION);
            }, 1500);
          } else {
            // 正常显示AI响应（包含 options）
            const assistantMessage: Message = {
              role: 'assistant',
              content: fullContent,
              options: streamMetadata.options,
            };
            startTransition(() => {
              setMessages((prev) => [...prev, assistantMessage]);
            });
          }

          setLoading(false);
        }
      } else {
        // 非流式响应（原有逻辑）
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
        setLoading(false);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : '抱歉，出现了错误，请稍后重试。';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ 错误: ${errorMessage}`,
        },
      ]);
      setLoading(false);
      setStreamingContent('');
    }
  };

  return (
    <div className="flex h-full">
      {/* 左侧收集面板 */}
      <LeftPanel
        completeness={completeness}
        profile={profile}
        onViewDocument={() => {
          // TODO: 导航到文档查看页面
        }}
      />

      {/* 右侧主区域 - 对话/表单 */}
      <div className="flex-1 flex flex-col">
        {mode === 'chat' ? (
          <ChatMode
            messages={messages}
            input={input}
            setInput={setInput}
            loading={loading}
            sendMessage={sendMessage}
            messagesEndRef={messagesEndRef}
            streamingContent={streamingContent} // React 19: 传递流式内容
          />
        ) : (
          <FormMode
            onFormSuccess={handleFormSuccess}
            onFormError={handleFormError}
          />
        )}
      </div>
    </div>
  );
}
