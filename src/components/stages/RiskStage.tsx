'use client';

import React, { useState, useEffect } from 'react';
import { Risk, RiskApproach, RiskSeverity, Stage } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { SkeletonLoader } from '../shared/SkeletonLoader';
import { useStage } from '@/contexts/StageContext';

/**
 * Risk analysis stage with responsive layout
 * Features:
 * - Mobile-first responsive grid (1/2/3 columns)
 * - Dark mode support
 * - Accessible risk cards with color coding
 */
export function RiskStage() {
  const { stageData, updateStageData, completeStage, sessionId } = useStage();
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [approaches, setApproaches] = useState<RiskApproach[]>([]);
  const [selectedApproach, setSelectedApproach] = useState<string | null>(null);

  useEffect(() => {
    if (stageData.riskAnalysis) {
      setRisks(stageData.riskAnalysis.risks);
      setApproaches(stageData.riskAnalysis.approaches);
      setSelectedApproach(stageData.riskAnalysis.selectedApproach || null);
      setLoading(false);
    } else {
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

    updateStageData({
      riskAnalysis: {
        ...stageData.riskAnalysis,
        selectedApproach,
      },
    });

    completeStage(Stage.RISK_ANALYSIS);
  };

  if (loading) {
    return <SkeletonLoader stage="risk" />;
  }

  const highRisks = risks.filter((r) => r.severity === RiskSeverity.HIGH);
  const mediumRisks = risks.filter((r) => r.severity === RiskSeverity.MEDIUM);
  const lowRisks = risks.filter((r) => r.severity === RiskSeverity.LOW);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            风险分析
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            根据您的需求，我们识别到以下风险点：
          </p>
        </div>

        {/* Risk Display - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* High Risk */}
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <span className="text-error-500 mr-2">●</span> 高风险
            </h3>
            <div className="space-y-2">
              {highRisks.map((risk) => (
                <Card
                  key={risk.id}
                  className="bg-error-50 dark:bg-error-900/30"
                >
                  <CardContent className="text-sm">
                    <div className="font-medium text-error-900 dark:text-error-100 mb-1">
                      {risk.type}
                    </div>
                    <div className="text-error-700 dark:text-error-300 text-xs">
                      {risk.description}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {highRisks.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-600 italic">
                  暂无高风险项
                </p>
              )}
            </div>
          </div>

          {/* Medium Risk */}
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <span className="text-warning-500 mr-2">●</span> 中风险
            </h3>
            <div className="space-y-2">
              {mediumRisks.map((risk) => (
                <Card
                  key={risk.id}
                  className="bg-warning-50 dark:bg-warning-900/30"
                >
                  <CardContent className="text-sm">
                    <div className="font-medium text-warning-900 dark:text-warning-100 mb-1">
                      {risk.type}
                    </div>
                    <div className="text-warning-700 dark:text-warning-300 text-xs">
                      {risk.description}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {mediumRisks.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-600 italic">
                  暂无中风险项
                </p>
              )}
            </div>
          </div>

          {/* Low Risk */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <span className="text-success-500 mr-2">●</span> 低风险
            </h3>
            <div className="space-y-2">
              {lowRisks.map((risk) => (
                <Card
                  key={risk.id}
                  className="bg-success-50 dark:bg-success-900/30"
                >
                  <CardContent className="text-sm">
                    <div className="font-medium text-success-900 dark:text-success-100 mb-1">
                      {risk.type}
                    </div>
                    <div className="text-success-700 dark:text-success-300 text-xs">
                      {risk.description}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {lowRisks.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-600 italic">
                  暂无低风险项
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Approach Comparison */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            推荐实施方案
          </h2>

          {/* Comparison Table - Responsive */}
          <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden mb-6 overflow-x-auto shadow-sm">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    对比项
                  </th>
                  {approaches.map((approach) => (
                    <th
                      key={approach.id}
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300"
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
              <tbody>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    开发周期
                  </td>
                  {approaches.map((approach) => (
                    <td
                      key={approach.id}
                      className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400"
                    >
                      {approach.timeline || '-'}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    技术复杂度
                  </td>
                  {approaches.map((approach) => (
                    <td
                      key={approach.id}
                      className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400"
                    >
                      {approach.complexity || '-'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Approach Cards - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {approaches.map((approach) => (
              <Card
                key={approach.id}
                hoverable
                className={`${
                  selectedApproach === approach.id
                    ? 'ring-2 ring-primary-500 shadow-lg dark:ring-primary-400'
                    : ''
                }`}
                onClick={() => handleSelectApproach(approach.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                    <span>{approach.label}</span>
                    {approach.recommended && <Badge variant="success">推荐</Badge>}
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {approach.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-success-700 dark:text-success-400 mb-1">
                        ✓ 优点
                      </h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {approach.pros.map((pro, i) => (
                          <li key={i}>• {pro}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-error-700 dark:text-error-400 mb-1">
                        ! 注意
                      </h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {approach.cons.map((con, i) => (
                          <li key={i}>• {con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {selectedApproach === approach.id && (
                    <div className="mt-4 pt-4 bg-gray-50 dark:bg-gray-800 -mx-5 px-5 pb-2 -mb-5 rounded-b-2xl">
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

        {/* Confirm Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleConfirm} size="lg" disabled={!selectedApproach}>
            确认选择，继续下一步
          </Button>
        </div>
      </div>
    </div>
  );
}
