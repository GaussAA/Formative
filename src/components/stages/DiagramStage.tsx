'use client';

import React, { useState, useEffect } from 'react';
import { useStage } from '@/contexts/StageContext';
import { Stage, Diagram } from '@/types';
import { MermaidPreview } from '../shared/MermaidPreview';
import { Button } from '../shared/Button';
import { SkeletonLoader } from '../shared/SkeletonLoader';

export function DiagramStage() {
  const { stageData, updateStageData, completeStage } = useStage();
  const [loading, setLoading] = useState(false);
  const [architectureDiagram, setArchitectureDiagram] = useState<Diagram | null>(null);
  const [sequenceDiagram, setSequenceDiagram] = useState<Diagram | null>(null);
  const [editingType, setEditingType] = useState<'architecture' | 'sequence' | null>(null);
  const [editInput, setEditInput] = useState('');
  const [updating, setUpdating] = useState(false);

  // 初始化：检查是否已有图表数据，如果没有则生成
  useEffect(() => {
    if (stageData.diagrams) {
      setArchitectureDiagram(stageData.diagrams.architectureDiagram);
      setSequenceDiagram(stageData.diagrams.sequenceDiagram);
    } else {
      generateInitialDiagrams();
    }
  }, []);

  const generateInitialDiagrams = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/generate-diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: stageData.requirement,
          techStack: stageData.techStack?.selected,
          mvpFeatures: stageData.mvpBoundary?.features,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate diagrams');

      const data = await response.json();

      setArchitectureDiagram(data.architectureDiagram);
      setSequenceDiagram(data.sequenceDiagram);

      // 更新全局状态
      updateStageData({
        diagrams: {
          architectureDiagram: data.architectureDiagram,
          sequenceDiagram: data.sequenceDiagram,
        },
      });
    } catch (error) {
      console.error('Error generating diagrams:', error);
      alert('生成图表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDiagram = (type: 'architecture' | 'sequence') => {
    setEditingType(type);
    setEditInput('');
  };

  const handleUpdateDiagram = async () => {
    if (!editInput.trim() || !editingType) return;

    setUpdating(true);
    try {
      const currentDiagram = editingType === 'architecture' ? architectureDiagram : sequenceDiagram;

      const response = await fetch('/api/update-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagramType: editingType,
          currentMermaidCode: currentDiagram?.mermaidCode,
          userRequest: editInput,
          requirement: stageData.requirement,
          techStack: stageData.techStack?.selected,
        }),
      });

      if (!response.ok) throw new Error('Failed to update diagram');

      const data = await response.json();

      if (editingType === 'architecture' && sequenceDiagram) {
        setArchitectureDiagram(data.diagram);
        updateStageData({
          diagrams: {
            architectureDiagram: data.diagram,
            sequenceDiagram,
          },
        });
      } else if (architectureDiagram) {
        setSequenceDiagram(data.diagram);
        updateStageData({
          diagrams: {
            architectureDiagram,
            sequenceDiagram: data.diagram,
          },
        });
      }

      setEditingType(null);
      setEditInput('');
    } catch (error) {
      console.error('Error updating diagram:', error);
      alert('更新图表失败，请稍后重试');
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirm = () => {
    completeStage(Stage.DIAGRAM_DESIGN);
  };

  if (loading) {
    return <SkeletonLoader stage="diagram" />;
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">架构与流程设计</h2>
          <p className="text-gray-600">
            我们为您生成了系统架构图和核心流程时序图。您可以通过自然语言描述来修改图表。
          </p>
        </div>

        {/* 架构图 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">系统架构图</h3>
            <Button
              onClick={() => handleEditDiagram('architecture')}
              variant="outline"
              size="sm"
            >
              修改架构图
            </Button>
          </div>

          {architectureDiagram && (
            <MermaidPreview
              code={architectureDiagram.mermaidCode}
              title="Architecture Diagram"
            />
          )}

          {editingType === 'architecture' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                描述您想要的修改
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editInput}
                  onChange={(e) => setEditInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateDiagram()}
                  placeholder="例如：添加一个缓存层，使用 Redis"
                  disabled={updating}
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-gray-700 rounded-lg focus:bg-slate-100 dark:focus:bg-gray-600 transition-all"
                />
                <Button
                  onClick={handleUpdateDiagram}
                  disabled={!editInput.trim() || updating}
                  loading={updating}
                >
                  {updating ? '更新中...' : '更新'}
                </Button>
                <Button
                  onClick={() => setEditingType(null)}
                  variant="outline"
                  disabled={updating}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 时序图 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">核心流程时序图</h3>
            <Button
              onClick={() => handleEditDiagram('sequence')}
              variant="outline"
              size="sm"
            >
              修改时序图
            </Button>
          </div>

          {sequenceDiagram && (
            <MermaidPreview
              code={sequenceDiagram.mermaidCode}
              title="Sequence Diagram"
            />
          )}

          {editingType === 'sequence' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                描述您想要的修改
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editInput}
                  onChange={(e) => setEditInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateDiagram()}
                  placeholder="例如：添加身份验证步骤"
                  disabled={updating}
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-gray-700 rounded-lg focus:bg-slate-100 dark:focus:bg-gray-600 transition-all"
                />
                <Button
                  onClick={handleUpdateDiagram}
                  disabled={!editInput.trim() || updating}
                  loading={updating}
                >
                  {updating ? '更新中...' : '更新'}
                </Button>
                <Button
                  onClick={() => setEditingType(null)}
                  variant="outline"
                  disabled={updating}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 确认按钮 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              确认图表无误后，点击右侧按钮继续生成完整的开发方案文档。
            </p>
            <Button onClick={handleConfirm} size="lg">
              确认并继续
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
