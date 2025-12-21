'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StageProvider, useStage } from '@/contexts/StageContext';
import { TabNavigation } from '@/components/TabNavigation';
import { RequirementStage } from '@/components/stages/RequirementStage';
import { RiskStage } from '@/components/stages/RiskStage';
import { TechStackStage } from '@/components/stages/TechStackStage';
import { MVPStage } from '@/components/stages/MVPStage';
import { DiagramStage } from '@/components/stages/DiagramStage';
import { DocumentStage } from '@/components/stages/DocumentStage';
import { Modal } from '@/components/shared/Modal';
import { Stage } from '@/types';

function MainContent() {
  const { currentStage, resetAll } = useStage();
  const router = useRouter();
  const [isAbandonModalOpen, setIsAbandonModalOpen] = useState(false);

  const handleAbandonTask = () => {
    setIsAbandonModalOpen(true);
  };

  const handleConfirmAbandon = () => {
    resetAll();
    // 自动刷新页面以重新开始
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  const renderStage = () => {
    switch (currentStage) {
      case Stage.REQUIREMENT_COLLECTION:
        return <RequirementStage />;
      case Stage.RISK_ANALYSIS:
        return <RiskStage />;
      case Stage.TECH_STACK:
        return <TechStackStage />;
      case Stage.MVP_BOUNDARY:
        return <MVPStage />;
      case Stage.DIAGRAM_DESIGN:
        return <DiagramStage />;
      case Stage.DOCUMENT_GENERATION:
        return <DocumentStage />;
      default:
        return <RequirementStage />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">F</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">定型 Formative</h1>
                <p className="text-xs text-gray-500">AI驱动的产品开发方案生成器</p>
              </div>
            </div>
            <button
              onClick={handleAbandonTask}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200 hover:border-red-300"
            >
              放弃任务
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <TabNavigation />

      {/* Main Stage Content */}
      <main className="flex-1 overflow-hidden">
        {renderStage()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-500">
          Powered by Claude AI • 定型 v1.0
        </div>
      </footer>

      {/* 放弃任务确认弹窗 */}
      <Modal
        isOpen={isAbandonModalOpen}
        onClose={() => setIsAbandonModalOpen(false)}
        onConfirm={handleConfirmAbandon}
        title="放弃当前任务"
        content="确定要放弃当前任务吗？所有进度将会丢失，此操作无法撤销。"
        confirmText="确认放弃"
        cancelText="取消"
        confirmVariant="danger"
      />
    </div>
  );
}

export default function Home() {
  return (
    <StageProvider>
      <MainContent />
    </StageProvider>
  );
}
