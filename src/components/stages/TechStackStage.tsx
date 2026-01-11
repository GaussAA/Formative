'use client';

import React, { useState, useEffect, useDeferredValue } from 'react';
import { TechStackOption, Stage } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { SkeletonLoader } from '../shared/SkeletonLoader';
import { Modal } from '../shared/Modal';
import { useStage } from '@/contexts/StageContext';

// 常见技术栈选项
const TECH_OPTIONS = {
  frontend: ['React', 'Vue', 'Angular', 'Svelte', 'Solid'],
  backend: ['Node.js', 'Python', 'Java', 'PHP', 'Go', 'Ruby', '.NET'],
  database: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite'],
};

export function TechStackStage() {
  const { stageData, updateStageData, completeStage, sessionId, isTransitionPending } = useStage();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<TechStackOption[]>([]);
  const [selected, setSelected] = useState<TechStackOption | null>(null);

  // 技术偏好选择
  const [showPreferenceModal, setShowPreferenceModal] = useState(true);
  const [showTechSelectionModal, setShowTechSelectionModal] = useState(false);
  const [selectedFrontend, setSelectedFrontend] = useState<string[]>([]);
  const [selectedBackend, setSelectedBackend] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string[]>([]);

  // React 19: 使用 useDeferredValue 优化列表渲染
  // 当用户快速点击选择技术时，使用延迟值保持 UI 响应
  const deferredOptions = useDeferredValue(options);
  const deferredSelectedFrontend = useDeferredValue(selectedFrontend);
  const deferredSelectedBackend = useDeferredValue(selectedBackend);
  const deferredSelectedDatabase = useDeferredValue(selectedDatabase);

  useEffect(() => {
    if (stageData.techStack) {
      setOptions(stageData.techStack.options);
      setSelected(stageData.techStack.selected || null);
      setLoading(false);
      setShowPreferenceModal(false); // 已有数据，不显示偏好选择
    }
  }, []);

  const handleUseAI = () => {
    setShowPreferenceModal(false);
    fetchTechStackOptions();
  };

  const handleUseTechPreference = () => {
    setShowPreferenceModal(false);
    setShowTechSelectionModal(true);
  };

  const toggleTechSelection = (category: 'frontend' | 'backend' | 'database', tech: string) => {
    const setters = {
      frontend: setSelectedFrontend,
      backend: setSelectedBackend,
      database: setSelectedDatabase,
    };
    const getters = {
      frontend: selectedFrontend,
      backend: selectedBackend,
      database: selectedDatabase,
    };

    const setter = setters[category];
    const selected = getters[category];

    if (selected.includes(tech)) {
      setter(selected.filter(t => t !== tech));
    } else {
      setter([...selected, tech]);
    }
  };

  const handleConfirmTechSelection = () => {
    setShowTechSelectionModal(false);
    const userPreferences = {
      frontend: selectedFrontend,
      backend: selectedBackend,
      database: selectedDatabase,
    };
    fetchTechStackOptions(userPreferences);
  };

  const fetchTechStackOptions = async (userPreferences?: { frontend?: string[]; backend?: string[]; database?: string[] }) => {
    setLoading(true);
    try {
      const response = await fetch('/api/tech-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          profile: stageData.requirement,
          riskApproach: stageData.riskAnalysis?.selectedApproach,
          userPreferences, // 传递用户的技术偏好
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch tech stack options');

      const data = await response.json();
      setOptions(data.options || []);

      updateStageData({
        techStack: {
          category: data.category,
          options: data.options || [],
          selected: undefined,
        },
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (option: TechStackOption) => {
    setSelected(option);
  };

  const handleConfirm = () => {
    if (!selected) {
      alert('请选择一个技术栈方案');
      return;
    }

    if (!stageData.techStack) {
      alert('技术栈数据尚未准备好');
      return;
    }

    updateStageData({
      techStack: {
        ...stageData.techStack,
        selected,
      },
    });

    completeStage(Stage.TECH_STACK);
  };

  if (loading) {
    return <SkeletonLoader stage="tech" />;
  }

  // React 19: 应用过渡状态样式，提供视觉反馈
  const containerOpacity = isTransitionPending ? 0.7 : 1;

  return (
    <div className="h-full overflow-y-auto p-6" style={{ opacity: containerOpacity }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">技术栈推荐</h1>
          <p className="text-gray-600">基于您的需求和风险方案，推荐以下技术栈</p>
        </div>

        <div className="space-y-4">
          {/* React 19: 使用延迟值渲染列表，保持输入响应 */}
          {deferredOptions.map((option) => (
            <Card
              key={option.id}
              className={`cursor-pointer transition-all ${
                selected?.id === option.id ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
              }`}
              onClick={() => handleSelect(option)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{option.name}</span>
                  {option.recommended && <Badge variant="success">⭐ 推荐</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      <strong>前端：</strong> {option.stack.frontend}
                    </p>
                    {option.stack.backend && (
                      <p className="text-sm text-gray-600">
                        <strong>后端：</strong> {option.stack.backend}
                      </p>
                    )}
                  </div>
                  <div>
                    {option.stack.database && (
                      <p className="text-sm text-gray-600">
                        <strong>数据库：</strong> {option.stack.database}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      <strong>部署：</strong> {option.stack.deployment}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-green-700 mb-1">✅ 优点</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {option.pros.map((pro, i) => (
                        <li key={i}>• {pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-700 mb-1">⚠️ 注意</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {option.cons.map((con, i) => (
                        <li key={i}>• {con}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
                  <p><strong>演进成本：</strong> {option.evolutionCost}</p>
                  <p><strong>适合：</strong> {option.suitableFor}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleConfirm} size="lg" disabled={!selected}>
            确认选择，继续下一步
          </Button>
        </div>
      </div>

      {/* 技术偏好选择模态框 */}
      <Modal
        isOpen={showPreferenceModal}
        onClose={() => {}} // 不允许直接关闭，必须选择一个选项
        title="技术栈生成方式"
        content={
          <div className="space-y-4">
            <p className="text-gray-700">
              请选择您希望如何生成技术栈建议：
            </p>
            <div className="space-y-3">
              <button
                onClick={handleUseAI}
                className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-primary hover:bg-blue-50 transition-all text-left"
              >
                <h3 className="font-semibold text-gray-900 mb-1">🤖 AI 智能推荐</h3>
                <p className="text-sm text-gray-600">
                  完全由 AI 根据您的需求和风险评估智能推荐最合适的技术栈
                </p>
              </button>
              <button
                onClick={handleUseTechPreference}
                className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-primary hover:bg-blue-50 transition-all text-left"
              >
                <h3 className="font-semibold text-gray-900 mb-1">👤 基于我的技术背景</h3>
                <p className="text-sm text-gray-600">
                  根据您熟悉的技术栈（如 Vue、Java、PHP 等）来生成更适合的方案
                </p>
              </button>
            </div>
          </div>
        }
        showCancel={false}
        confirmText=""
      />

      {/* 技术栈选择模态框 */}
      {showTechSelectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">选择您熟悉的技术栈</h2>
              <p className="text-sm text-gray-600 mt-1">可以多选，AI 会优先考虑您选择的技术</p>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* 前端技术 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">前端框架</h3>
                <div className="flex flex-wrap gap-2">
                  {TECH_OPTIONS.frontend.map((tech) => (
                    <button
                      key={tech}
                      onClick={() => toggleTechSelection('frontend', tech)}
                      /* React 19: 使用延迟值判断选中状态，保持输入响应 */
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        deferredSelectedFrontend.includes(tech)
                          ? 'border-primary bg-blue-50 text-primary font-medium'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {tech}
                    </button>
                  ))}
                </div>
              </div>

              {/* 后端技术 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">后端语言/框架</h3>
                <div className="flex flex-wrap gap-2">
                  {TECH_OPTIONS.backend.map((tech) => (
                    <button
                      key={tech}
                      onClick={() => toggleTechSelection('backend', tech)}
                      /* React 19: 使用延迟值判断选中状态，保持输入响应 */
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        deferredSelectedBackend.includes(tech)
                          ? 'border-primary bg-blue-50 text-primary font-medium'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {tech}
                    </button>
                  ))}
                </div>
              </div>

              {/* 数据库技术 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">数据库</h3>
                <div className="flex flex-wrap gap-2">
                  {TECH_OPTIONS.database.map((tech) => (
                    <button
                      key={tech}
                      onClick={() => toggleTechSelection('database', tech)}
                      /* React 19: 使用延迟值判断选中状态，保持输入响应 */
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        deferredSelectedDatabase.includes(tech)
                          ? 'border-primary bg-blue-50 text-primary font-medium'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {tech}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3">
              <Button
                onClick={() => {
                  setShowTechSelectionModal(false);
                  setShowPreferenceModal(true);
                }}
                variant="outline"
              >
                返回
              </Button>
              <Button
                onClick={handleConfirmTechSelection}
                disabled={selectedFrontend.length === 0 && selectedBackend.length === 0 && selectedDatabase.length === 0}
              >
                确认并生成建议
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
