'use client';

import React, { useState, useEffect } from 'react';
import { TechStackOption, Stage } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { useStage } from '@/contexts/StageContext';

export function TechStackStage() {
  const { stageData, updateStageData, completeStage, sessionId } = useStage();
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<TechStackOption[]>([]);
  const [selected, setSelected] = useState<TechStackOption | null>(null);

  useEffect(() => {
    if (stageData.techStack) {
      setOptions(stageData.techStack.options);
      setSelected(stageData.techStack.selected || null);
      setLoading(false);
    } else {
      fetchTechStackOptions();
    }
  }, []);

  const fetchTechStackOptions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tech-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          profile: stageData.requirement,
          riskApproach: stageData.riskAnalysis?.selectedApproach,
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

    updateStageData({
      techStack: {
        ...stageData.techStack!,
        selected,
      },
    });

    completeStage(Stage.TECH_STACK);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">正在生成技术栈推荐...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">技术栈推荐</h1>
          <p className="text-gray-600">基于您的需求和风险方案，推荐以下技术栈</p>
        </div>

        <div className="space-y-4">
          {options.map((option) => (
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
    </div>
  );
}
