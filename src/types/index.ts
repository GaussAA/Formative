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
  SPEC_GENERATION = 5,
  COMPLETED = 6,
}

export const StageNames: Record<Stage, string> = {
  [Stage.INIT]: '初始化',
  [Stage.REQUIREMENT_COLLECTION]: '需求采集',
  [Stage.RISK_ANALYSIS]: '风险分析',
  [Stage.TECH_STACK]: '技术选型',
  [Stage.MVP_BOUNDARY]: 'MVP边界确认',
  [Stage.SPEC_GENERATION]: '文档生成',
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
  [Stage.SPEC_GENERATION]?: {
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
