'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import sessionStorage, { SessionRecord } from '@/lib/sessionStorage';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { StageNames, MVPFeature } from '@/types';

export default function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.sessionId as string;

  const [session, setSession] = useState<SessionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const data = await sessionStorage.getSession(sessionId);
      setSession(data);
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!session?.stageData.finalSpec) return;

    const blob = new Blob([session.stageData.finalSpec], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.projectName || 'project'}-spec.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">记录不存在</h2>
          <p className="text-gray-600 mb-6">该历史记录可能已被删除</p>
          <Button onClick={() => router.push('/history')}>
            返回历史记录
          </Button>
        </div>
      </div>
    );
  }

  const { stageData } = session;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/history')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{session.projectName}</h1>
                <p className="text-xs text-gray-500">
                  创建于 {formatDate(session.createdAt)} • 最后更新 {formatDate(session.updatedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {session.completed ? (
                <Badge variant="success">✅ 已完成</Badge>
              ) : (
                <Badge variant="default">进行中 - {StageNames[session.currentStage]}</Badge>
              )}
              {stageData.finalSpec && (
                <Button onClick={handleDownload} variant="primary">
                  下载文档
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* 需求采集 */}
        <Card>
          <CardHeader>
            <CardTitle>📝 需求采集</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stageData.requirement.productGoal && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">产品目标</h4>
                <p className="text-sm text-gray-600">{stageData.requirement.productGoal}</p>
              </div>
            )}
            {stageData.requirement.targetUsers && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">目标用户</h4>
                <p className="text-sm text-gray-600">{stageData.requirement.targetUsers}</p>
              </div>
            )}
            {stageData.requirement.coreFunctions && stageData.requirement.coreFunctions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">核心功能</h4>
                <ul className="text-sm text-gray-600 list-disc list-inside">
                  {stageData.requirement.coreFunctions.map((func: string, i: number) => (
                    <li key={i}>{func}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 风险评估 */}
        {stageData.riskAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle>⚠️ 风险评估</CardTitle>
            </CardHeader>
            <CardContent>
              {stageData.riskAnalysis.selectedApproach && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">选择的方案</h4>
                  <p className="text-sm text-gray-600">{stageData.riskAnalysis.selectedApproach}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 技术选型 */}
        {stageData.techStack?.selected && (
          <Card>
            <CardHeader>
              <CardTitle>🔧 技术选型</CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                {stageData.techStack.selected.name}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                <p><strong>前端：</strong> {stageData.techStack.selected.stack.frontend}</p>
                {stageData.techStack.selected.stack.backend && (
                  <p><strong>后端：</strong> {stageData.techStack.selected.stack.backend}</p>
                )}
                {stageData.techStack.selected.stack.database && (
                  <p><strong>数据库：</strong> {stageData.techStack.selected.stack.database}</p>
                )}
                <p><strong>部署：</strong> {stageData.techStack.selected.stack.deployment}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MVP 规划 */}
        {stageData.mvpBoundary && (
          <Card>
            <CardHeader>
              <CardTitle>📋 MVP 规划</CardTitle>
            </CardHeader>
            <CardContent>
              {stageData.mvpBoundary.features && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">MVP 功能</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {stageData.mvpBoundary.features.filter((f: MVPFeature) => f.inMVP).map((feature: MVPFeature, i: number) => (
                      <li key={i}>✅ {feature.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 最终文档 */}
        {stageData.finalSpec && (
          <Card>
            <CardHeader>
              <CardTitle>📄 最终文档</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">
                  {stageData.finalSpec}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
