'use client';

import React, { useState, useEffect } from 'react';
import { Stage } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '../shared/Card';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';
import { SkeletonLoader } from '../shared/SkeletonLoader';
import { Modal } from '../shared/Modal';
import { useStage } from '@/contexts/StageContext';

export function DocumentStage() {
  const { stageData, updateStageData, sessionId } = useStage();
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [showCopiedModal, setShowCopiedModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  useEffect(() => {
    if (stageData.finalSpec) {
      setDocument(stageData.finalSpec);
      setLoading(false);
    } else {
      generateDocument();
    }
  }, []);

  const generateDocument = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/generate-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          requirement: stageData.requirement,
          riskApproach: stageData.riskAnalysis?.selectedApproach,
          techStack: stageData.techStack?.selected,
          mvpBoundary: stageData.mvpBoundary,
          diagrams: stageData.diagrams, // 传递图表数据，但不会进入LLM上下文
        }),
      });

      if (!response.ok) throw new Error('Failed to generate document');

      const data = await response.json();
      setDocument(data.document);

      updateStageData({
        finalSpec: data.document,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([document], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${stageData.requirement.projectName || 'project'}-spec.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(document);
    setShowCopiedModal(true);
  };

  const handleRegenerate = () => {
    setShowRegenerateModal(true);
  };

  const confirmRegenerate = () => {
    setShowRegenerateModal(false);
    generateDocument();
  };

  if (loading) {
    return <SkeletonLoader stage="document" />;
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">产品需求文档</h1>
            <p className="text-gray-600">基于您的需求和选择，生成的完整开发方案</p>
          </div>
          <Badge variant="success">✅ 已完成</Badge>
        </div>

        {/* 快速信息卡片 */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent>
              <div className="text-sm text-gray-600 mb-1">项目名称</div>
              <div className="font-semibold text-gray-900">
                {stageData.requirement.projectName || '未命名项目'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="text-sm text-gray-600 mb-1">技术栈</div>
              <div className="font-semibold text-gray-900">
                {stageData.techStack?.selected?.name || '-'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="text-sm text-gray-600 mb-1">MVP功能数</div>
              <div className="font-semibold text-gray-900">
                {stageData.mvpBoundary?.features.filter((f) => f.inMVP).length || 0} 个核心功能
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 操作按钮 */}
        <Card>
          <CardHeader>
            <CardTitle>📥 导出选项</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button onClick={handleDownloadMarkdown} variant="primary">
                下载 Markdown
              </Button>
              <Button onClick={handleCopyToClipboard} variant="outline">
                复制到剪贴板
              </Button>
              <Button onClick={handleRegenerate} variant="ghost">
                🔄 重新生成
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              提示：Markdown 文件可以使用 Typora、Obsidian、VS Code 等工具打开，这些工具都支持 Mermaid 图表渲染。
            </p>
          </CardContent>
        </Card>

        {/* 文档预览 */}
        <Card>
          <CardHeader>
            <CardTitle>📄 文档预览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div
                className="prose prose-sm max-w-none"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                }}
              >
                <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                  {document}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 下一步建议 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">💡 下一步建议</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• 与技术团队分享此文档，确认技术可行性</li>
              <li>• 根据开发计划拆分任务，分配到开发人员</li>
              <li>• 设置项目里程碑和关键节点</li>
              <li>• 准备设计资源（UI/UX设计稿、品牌素材等）</li>
              <li>• 如需调整，可返回任意阶段重新选择</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 复制成功提示弹窗 */}
      <Modal
        isOpen={showCopiedModal}
        onClose={() => setShowCopiedModal(false)}
        title="复制成功"
        content="文档已成功复制到剪贴板！"
        confirmText="好的"
        showCancel={false}
        confirmVariant="success"
      />

      {/* 重新生成确认弹窗 */}
      <Modal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        onConfirm={confirmRegenerate}
        title="确认重新生成"
        content="确定要重新生成文档吗？这将覆盖当前内容，此操作无法撤销。"
        confirmText="确认重新生成"
        cancelText="取消"
        confirmVariant="danger"
      />
    </div>
  );
}
