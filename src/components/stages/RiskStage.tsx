'use client';

import React, { useState, useEffect } from 'react';
import { Risk, RiskApproach, RiskSeverity, Stage } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { SkeletonLoader } from '../shared/SkeletonLoader';
import { useStage } from '@/contexts/StageContext';

export function RiskStage() {
  const { stageData, updateStageData, completeStage, sessionId } = useStage();
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [approaches, setApproaches] = useState<RiskApproach[]>([]);
  const [selectedApproach, setSelectedApproach] = useState<string | null>(null);

  useEffect(() => {
    // 如果已有风险分析数据，直接使用
    if (stageData.riskAnalysis) {
      setRisks(stageData.riskAnalysis.risks);
      setApproaches(stageData.riskAnalysis.approaches);
      setSelectedApproach(stageData.riskAnalysis.selectedApproach || null);
      setLoading(false);
    } else {
      // 否则调用API进行风险分析
      analyzeRisks();
    }
  }, []);

  const analyzeRisks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analyze-risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          profile: stageData.requirement,
        }),
      });

      if (!response.ok) throw new Error('Failed to analyze risks');

      const data = await response.json();

      setRisks(data.risks || []);
      setApproaches(data.approaches || []);

      // 更新全局状态
      updateStageData({
        riskAnalysis: {
          risks: data.risks || [],
          approaches: data.approaches || [],
          selectedApproach: undefined,
        },
      });
    } catch (error) {
      console.error('Error analyzing risks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectApproach = (approachId: string) => {
    setSelectedApproach(approachId);
  };

  const handleConfirm = () => {
    if (!selectedApproach) {
      alert('请选择一个实施方案');
      return;
    }

    if (!stageData.riskAnalysis) {
      alert('风险分析数据尚未准备好');
      return;
    }

    // 更新全局状态
    updateStageData({
      riskAnalysis: {
        ...stageData.riskAnalysis,
        selectedApproach,
      },
    });

    // 完成当前阶段，进入下一阶段
    completeStage(Stage.RISK_ANALYSIS);
  };

  if (loading) {
    return <SkeletonLoader stage="risk" />;
  }

  // 按严重程度分组风险
  const highRisks = risks.filter((r) => r.severity === RiskSeverity.HIGH);
  const mediumRisks = risks.filter((r) => r.severity === RiskSeverity.MEDIUM);
  const lowRisks = risks.filter((r) => r.severity === RiskSeverity.LOW);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 标题 */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">风险分析</h1>
          <p className="text-gray-600">根据您的需求，我们识别到以下风险点：</p>
        </div>

        {/* 风险展示区 */}
        <div className="grid grid-cols-3 gap-4">
          {/* 高风险 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="text-red-500 mr-2">🔴</span> 高风险
            </h3>
            <div className="space-y-2">
              {highRisks.map((risk) => (
                <Card key={risk.id} className="border-red-200 bg-red-50">
                  <CardContent className="text-sm">
                    <div className="font-medium text-red-900 mb-1">{risk.type}</div>
                    <div className="text-red-700 text-xs">{risk.description}</div>
                  </CardContent>
                </Card>
              ))}
              {highRisks.length === 0 && (
                <p className="text-sm text-gray-500 italic">暂无高风险项</p>
              )}
            </div>
          </div>

          {/* 中风险 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="text-yellow-500 mr-2">🟡</span> 中风险
            </h3>
            <div className="space-y-2">
              {mediumRisks.map((risk) => (
                <Card key={risk.id} className="border-yellow-200 bg-yellow-50">
                  <CardContent className="text-sm">
                    <div className="font-medium text-yellow-900 mb-1">{risk.type}</div>
                    <div className="text-yellow-700 text-xs">{risk.description}</div>
                  </CardContent>
                </Card>
              ))}
              {mediumRisks.length === 0 && (
                <p className="text-sm text-gray-500 italic">暂无中风险项</p>
              )}
            </div>
          </div>

          {/* 低风险 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="text-green-500 mr-2">🟢</span> 低风险
            </h3>
            <div className="space-y-2">
              {lowRisks.map((risk) => (
                <Card key={risk.id} className="border-green-200 bg-green-50">
                  <CardContent className="text-sm">
                    <div className="font-medium text-green-900 mb-1">{risk.type}</div>
                    <div className="text-green-700 text-xs">{risk.description}</div>
                  </CardContent>
                </Card>
              ))}
              {lowRisks.length === 0 && (
                <p className="text-sm text-gray-500 italic">暂无低风险项</p>
              )}
            </div>
          </div>
        </div>

        {/* 方案对比 */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">推荐实施方案</h2>

          {/* 方案对比表格 */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    对比项
                  </th>
                  {approaches.map((approach) => (
                    <th
                      key={approach.id}
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-700"
                    >
                      {approach.label}
                      {approach.recommended && (
                        <Badge variant="success" className="ml-2 text-xs">
                          推荐
                        </Badge>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700">开发周期</td>
                  {approaches.map((approach) => (
                    <td key={approach.id} className="px-4 py-3 text-sm text-center text-gray-600">
                      {approach.timeline || '-'}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-700">技术复杂度</td>
                  {approaches.map((approach) => (
                    <td key={approach.id} className="px-4 py-3 text-sm text-center text-gray-600">
                      {approach.complexity || '-'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 方案卡片 */}
          <div className="grid grid-cols-3 gap-4">
            {approaches.map((approach) => (
              <Card
                key={approach.id}
                className={`cursor-pointer transition-all ${
                  selectedApproach === approach.id
                    ? 'ring-2 ring-primary shadow-lg'
                    : 'hover:shadow-md'
                }`}
                onClick={() => handleSelectApproach(approach.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{approach.label}</span>
                    {approach.recommended && <Badge variant="success">推荐</Badge>}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-2">{approach.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-green-700 mb-1">✅ 优点</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {approach.pros.map((pro, i) => (
                          <li key={i}>• {pro}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-red-700 mb-1">⚠️ 注意</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {approach.cons.map((con, i) => (
                          <li key={i}>• {con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {selectedApproach === approach.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <Badge variant="info" className="w-full justify-center">
                        已选择
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 确认按钮 */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleConfirm} size="lg" disabled={!selectedApproach}>
            确认选择，继续下一步
          </Button>
        </div>
      </div>
    </div>
  );
}
