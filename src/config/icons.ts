import {
  FileEdit,
  AlertTriangle,
  Settings,
  ClipboardList,
  Building2,
  FileText,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  ChevronRight,
  Save,
  History,
  type LucideIcon,
} from 'lucide-react';
import { Stage } from '@/types';

/**
 * Icon mapping for each stage
 * Replaces emoji with professional Lucide React SVG icons
 */
export const StageIcons: Record<number, LucideIcon> = {
  [Stage.REQUIREMENT_COLLECTION]: FileEdit,
  [Stage.RISK_ANALYSIS]: AlertTriangle,
  [Stage.TECH_STACK]: Settings,
  [Stage.MVP_BOUNDARY]: ClipboardList,
  [Stage.DIAGRAM_DESIGN]: Building2,
  [Stage.DOCUMENT_GENERATION]: FileText,
};

/**
 * Common UI icons
 */
export const UIIcons = {
  Check: CheckCircle2,
  X: XCircle,
  Tip: Lightbulb,
  ArrowRight,
  ChevronRight,
  Save,
  History,
} as const;
