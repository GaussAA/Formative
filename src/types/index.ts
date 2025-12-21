// ============= Session & Memory Types =============
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  options?: OptionChip[];
}

export interface OptionChip {
  id: string;
  label: string;
  value: string;
}

export interface SessionState {
  sessionId: string;
  currentStage: Stage;
  completeness: number; // 0-100
  profile: RequirementProfile;
  createdAt: number;
  updatedAt: number;
}

export interface SessionMemory {
  messages: Message[];
  state: SessionState;
  summary: StagesSummary;
}

// ============= Requirement Profile =============
export interface RequirementProfile {
  // 基本信息
  projectName?: string;
  productGoal?: string;
  targetUsers?: string;
  useCases?: string;
  coreFunctions?: string[];

  // 技术限制
  needsDataStorage?: boolean;
  needsMultiUser?: boolean;
  needsAuth?: boolean;

  // 方案相关
  selectedRisks?: string[];
  selectedTechStack?: TechStack;
  architecture?: Architecture;
  mvpBoundary?: string[];
  nonGoals?: string[];
}

export interface TechStack {
  category: 'frontend-only' | 'fullstack' | 'baas';
  frontend?: string; // 'React' | 'Vue'
  backend?: string; // 'Node.js' | 'Python'
  database?: string;
  runtime?: string;
}

export interface Architecture {
  dataModel?: string;
  keyApis?: string[];
}

// ============= Stages =============
export enum Stage {
  INIT = 0,
  REQUIREMENT_COLLECTION = 1,
  RISK_ANALYSIS = 2,
  TECH_STACK = 3,
  MVP_BOUNDARY = 4,
  DIAGRAM_DESIGN = 5,
  DOCUMENT_GENERATION = 6,
  COMPLETED = 7,
}

export const StageNames: Record<Stage, string> = {
  [Stage.INIT]: '初始化',
  [Stage.REQUIREMENT_COLLECTION]: '需求采集',
  [Stage.RISK_ANALYSIS]: '风险分析',
  [Stage.TECH_STACK]: '技术选型',
  [Stage.MVP_BOUNDARY]: 'MVP边界确认',
  [Stage.DIAGRAM_DESIGN]: '架构设计',
  [Stage.DOCUMENT_GENERATION]: '文档生成',
  [Stage.COMPLETED]: '已完成',
};

export interface StagesSummary {
  [Stage.REQUIREMENT_COLLECTION]?: {
    productGoal: string;
    targetUsers: string;
    coreFunctions: string[];
  };
  [Stage.RISK_ANALYSIS]?: {
    risks: string[];
    selectedApproach: string;
  };
  [Stage.TECH_STACK]?: {
    techStack: TechStack;
    reasoning: string;
  };
  [Stage.MVP_BOUNDARY]?: {
    mvpFeatures: string[];
    nonGoals: string[];
  };
  [Stage.DIAGRAM_DESIGN]?: {
    architectureDiagram: string;
    sequenceDiagram: string;
  };
  [Stage.DOCUMENT_GENERATION]?: {
    finalSpec: string; // Markdown content
  };
}

// ============= Agent Types =============
export interface AgentContext {
  sessionId: string;
  currentMessage: string;
  profile: RequirementProfile;
  summary: StagesSummary;
  currentStage: Stage;
}

export interface AgentResponse {
  nextStage?: Stage;
  message: string;
  options?: OptionChip[];
  updateProfile?: Partial<RequirementProfile>;
  updateSummary?: Partial<StagesSummary>;
  completeness?: number;
}

// ============= LLM Types =============
export interface LLMConfig {
  provider: 'deepseek' | 'qwen' | 'ollama';
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============= Spec Document Types =============
export interface SpecDocument {
  projectOverview: string;
  productGoals: string[];
  targetUsersAndScenarios: {
    users: string;
    scenarios: string;
  };
  mvpScope: string[];
  nonGoals: string[];
  techSolution: string;
  techStack: {
    category: string;
    choice: string;
    reasoning: string;
  }[];
  dataAndApiDesign?: string;
  developmentSteps: {
    day: number;
    task: string;
  }[];
}

// ============= Tab & Stage UI Types =============
export enum TabStatus {
  LOCKED = 'locked',       // 未解锁（灰色，不可点击）
  ACTIVE = 'active',       // 进行中（蓝色高亮）
  COMPLETED = 'completed', // 已完成（绿色，可回滚查看）
}

export interface TabConfig {
  id: number;
  stage: Stage;
  name: string;
  icon: string;
  status: TabStatus;
}

// ============= Risk Analysis Types =============
export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface Risk {
  id: string;
  type: string;
  description: string;
  severity: RiskSeverity;
  impact?: string[];
}

export interface RiskApproach {
  id: string;
  name: string;
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  timeline?: string;
  complexity?: string;
  recommended?: boolean;
}

// ============= Tech Stack Types =============
export interface TechStackOption {
  id: string;
  name: string;
  category: 'frontend-only' | 'fullstack' | 'baas';
  stack: {
    frontend: string;
    backend?: string;
    database?: string;
    deployment: string;
  };
  pros: string[];
  cons: string[];
  evolutionCost: string;
  suitableFor: string;
  recommended?: boolean;
}

// ============= Diagram Types =============
export interface Diagram {
  type: 'architecture' | 'sequence';
  mermaidCode: string;
  description?: string;
}

export interface DiagramsData {
  architectureDiagram: Diagram;
  sequenceDiagram: Diagram;
}

// ============= MVP Planning Types =============
export interface MVPFeature {
  id: string;
  name: string;
  description?: string;
  inMVP: boolean;
}

export interface DevPlan {
  phase1: string[];
  phase2?: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  estimatedWeeks?: string;
}

// ============= Stage Data Types =============
export interface StageData {
  requirement: RequirementProfile;
  riskAnalysis?: {
    risks: Risk[];
    approaches: RiskApproach[];
    selectedApproach?: string;
  };
  techStack?: {
    category: string;
    options: TechStackOption[];
    selected?: TechStackOption;
  };
  mvpBoundary?: {
    features: MVPFeature[];
    devPlan: DevPlan;
  };
  diagrams?: DiagramsData; // 图表数据，不参与文档生成的上下文
  finalSpec?: string;
}
