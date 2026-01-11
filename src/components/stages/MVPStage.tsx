'use client';

import React, { useState, useEffect } from 'react';
import { MVPFeature, DevPlan, Stage } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '../shared/Card';
import { Button } from '../shared/Button';
import { SkeletonLoader } from '../shared/SkeletonLoader';
import { useStage } from '@/contexts/StageContext';

export function MVPStage() {
  const { stageData, updateStageData, completeStage, sessionId } = useStage();
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<MVPFeature[]>([]);
  const [devPlan, setDevPlan] = useState<DevPlan | null>(null);

  useEffect(() => {
    if (stageData.mvpBoundary) {
      setFeatures(stageData.mvpBoundary.features);
      setDevPlan(stageData.mvpBoundary.devPlan);
      setLoading(false);
    } else {
      fetchMVPPlan();
    }
  }, []);

  const fetchMVPPlan = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mvp-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          profile: stageData.requirement,
          techStack: stageData.techStack?.selected,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch MVP plan');

      const data = await response.json();

      setFeatures(data.features || []);
      setDevPlan(data.devPlan);

      updateStageData({
        mvpBoundary: {
          features: data.features || [],
          devPlan: data.devPlan,
        },
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = (featureId: string) => {
    setFeatures((prev) =>
      prev.map((f) => (f.id === featureId ? { ...f, inMVP: !f.inMVP } : f))
    );
  };

  const handleConfirm = () => {
    if (!devPlan) {
      alert('开发计划尚未生成，请稍后重试');
      return;
    }

    updateStageData({
      mvpBoundary: {
        features,
        devPlan,
      },
    });

    completeStage(Stage.MVP_BOUNDARY);
  };

  if (loading) {
    return <SkeletonLoader stage="mvp" />;
  }

  const mvpFeatures = features.filter((f) => f.inMVP);
  const futureFeatures = features.filter((f) => !f.inMVP);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MVP功能边界定义</h1>
          <p className="text-gray-600">明确第一版本的功能范围，支持拖拽调整</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* MVP核心功能 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-green-700">✓ MVP核心功能</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mvpFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{feature.name}</div>
                      {feature.description && (
                        <div className="text-sm text-gray-600">{feature.description}</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFeature(feature.id)}
                    >
                      →
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 后续版本功能 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-gray-700">○ 后续版本功能</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {futureFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{feature.name}</div>
                      {feature.description && (
                        <div className="text-sm text-gray-600">{feature.description}</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFeature(feature.id)}
                    >
                      ←
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 开发计划 */}
        {devPlan && (
          <Card>
            <CardHeader>
              <CardTitle>📅 开发计划</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">阶段一</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {devPlan.phase1.map((task, i) => (
                      <li key={i}>• {task}</li>
                    ))}
                  </ul>
                </div>
                {devPlan.phase2 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">阶段二</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {devPlan.phase2.map((task, i) => (
                        <li key={i}>• {task}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-4 text-sm">
                  <div>
                    <strong>预估复杂度：</strong>
                    {devPlan.estimatedComplexity === 'low' && '较低'}
                    {devPlan.estimatedComplexity === 'medium' && '中等'}
                    {devPlan.estimatedComplexity === 'high' && '较高'}
                  </div>
                  {devPlan.estimatedWeeks && (
                    <div>
                      <strong>预估工期：</strong> {devPlan.estimatedWeeks}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={handleConfirm} size="lg">
            确认MVP范围，生成文档
          </Button>
        </div>
      </div>
    </div>
  );
}
