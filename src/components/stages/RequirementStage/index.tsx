/**
 * RequirementStage - 需求采集阶段主组件
 * 支持对话模式和表单模式两种输入方式
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 发送消息（对话模式）
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

  // 表单相关函数
  const handleAddCoreFunction = useCallback(() => {
    if (coreFunctionInput.trim()) {
      setFormData({
        ...formData,
        coreFunctions: [...(formData.coreFunctions || []), coreFunctionInput.trim()],
      });
      setCoreFunctionInput('');
    }
  }, [formData, coreFunctionInput]);

  const handleRemoveCoreFunction = useCallback((index: number) => {
    setFormData({
      ...formData,
      coreFunctions: formData.coreFunctions?.filter((_, i) => i !== index),
    });
  }, [formData]);

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

      // 如果验证通过且完备度达到100%，直接进入下一阶段
      if (data.completeness === 100 && data.currentStage === Stage.RISK_ANALYSIS) {
        // 直接进入下一阶段，不切换到对话模式
        completeStage(Stage.REQUIREMENT_COLLECTION);
      } else {
        // 验证未通过或需要澄清，切换到对话模式
        setMode('chat');
        // 显示验证结果或澄清问题
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
          />
        ) : (
          <FormMode
            formData={formData}
            setFormData={setFormData}
            coreFunctionInput={coreFunctionInput}
            setCoreFunctionInput={setCoreFunctionInput}
            loading={loading}
            handleFormSubmit={handleFormSubmit}
            handleAddCoreFunction={handleAddCoreFunction}
            handleRemoveCoreFunction={handleRemoveCoreFunction}
          />
        )}
      </div>
    </div>
  );
}
