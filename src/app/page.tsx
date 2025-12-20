'use client';

import React from 'react';
import { StageProvider, useStage } from '@/contexts/StageContext';
import { TabNavigation } from '@/components/TabNavigation';
import { RequirementStage } from '@/components/stages/RequirementStage';
import { RiskStage } from '@/components/stages/RiskStage';
import { TechStackStage } from '@/components/stages/TechStackStage';
import { MVPStage } from '@/components/stages/MVPStage';
import { DocumentStage } from '@/components/stages/DocumentStage';
import { Stage } from '@/types';

function MainContent() {
  const { currentStage } = useStage();

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
