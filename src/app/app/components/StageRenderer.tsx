'use client';

import { useStage } from '@/contexts/StageContext';
import { Stage } from '@/types';
import { RequirementStage } from '@/components/stages/RequirementStage';
import { RiskStage } from '@/components/stages/RiskStage';
import { TechStackStage } from '@/components/stages/TechStackStage';
import { MVPStage } from '@/components/stages/MVPStage';
import { DiagramStage } from '@/components/stages/DiagramStage';
import { DocumentStage } from '@/components/stages/DocumentStage';

/**
 * Stage renderer component
 * Dynamically renders the active stage component based on current stage
 */
export function StageRenderer() {
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
      case Stage.DIAGRAM_DESIGN:
        return <DiagramStage />;
      case Stage.DOCUMENT_GENERATION:
        return <DocumentStage />;
      default:
        return <RequirementStage />;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {renderStage()}
    </div>
  );
}
