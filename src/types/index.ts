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

// ============= Prompt Engineering Types =============

/**
 * Template variables for prompt rendering
 */
export type TemplateVariables = Record<string, unknown>;

/**
 * Template validation result
 */
export interface TemplateValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Prompt metadata
 */
export interface PromptMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags: string[];
  variables: string[];
  examples?: PromptExample[];
  lastModified: Date;
}

/**
 * Prompt example for few-shot learning
 */
export interface PromptExample {
  id: string;
  input: string;
  output: unknown;
  context?: Record<string, unknown>;
  tags: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  domain?: string;
}

/**
 * Loaded template with metadata
 */
export interface LoadedTemplate {
  content: string;
  metadata: PromptMetadata;
  version: string;
}

/**
 * Prompt version entry
 */
export interface PromptVersion {
  version: string;
  content: string;
  metadata: PromptMetadata;
  createdAt: Date;
  isActive: boolean;
}

/**
 * A/B Test configuration
 */
export interface ABTestConfig {
  id: string;
  name: string;
  agentType: string;
  versionA: string;
  versionB: string;
  trafficSplit: number; // 0-1, percentage for version A
  startDate: Date;
  endDate?: Date;
  description?: string;
}

/**
 * A/B Test results
 */
export interface ABTestResults {
  testId: string;
  status: 'running' | 'completed' | 'paused';
  versionA: {
    version: string;
    usageCount: number;
    avgTokens: number;
    avgDuration: number;
    errorRate: number;
  };
  versionB: {
    version: string;
    usageCount: number;
    avgTokens: number;
    avgDuration: number;
    errorRate: number;
  };
  winner?: 'A' | 'B' | 'inconclusive';
  confidence: number;
  recommendation?: string;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  versionA: string;
  versionB: string;
  improvement: {
    tokenUsage: number; // percentage
    duration: number; // percentage
    successRate: number; // percentage
  };
  recommendation: string;
}

/**
 * Prompt usage tracking
 */
export interface PromptUsage {
  agentType: string;
  version: string;
  timestamp: Date;
  duration: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  outcome: 'success' | 'error';
  error?: string;
  traceId?: string;
  spanId?: string;
}

// ============= Context Engineering Types =============

/**
 * Context build parameters
 */
export interface BuildContextParams {
  systemPrompt: string;
  conversationHistory: ConversationMessage[];
  currentQuery: string;
  agentType: string;
  maxTotalTokens?: number;
  metadata?: {
    sessionId: string;
    stage: number;
    [key: string]: unknown;
  };
}

/**
 * Context build result
 */
export interface BuildContextResult {
  messages: LLMMessage[];
  stats: {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    strategy: string;
  };
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  role: string;
  content: string;
  timestamp?: number;
}

/**
 * Compression parameters
 */
export interface CompressionParams {
  messages: ConversationMessage[];
  maxTokens: number;
  currentQuery: string;
  strategy?: 'summarization' | 'importance' | 'hybrid';
}

/**
 * Compressed context result
 */
export interface CompressedContext {
  messages: ConversationMessage[];
  stats: {
    originalCount: number;
    compressedCount: number;
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    strategy: string;
  };
}

/**
 * Token allocation parameters
 */
export interface AllocationParams {
  maxTotalTokens: number;
  systemPrompt: string;
  conversationHistory: ConversationMessage[];
  currentQuery: string;
  agentType: string;
}

/**
 * Token allocation result
 */
export interface TokenAllocation {
  systemPrompt: number;
  conversationHistory: number;
  currentQuery: number;
  reservedResponse: number;
  total: number;
}

/**
 * Context statistics
 */
export interface ContextStats {
  totalMessages: number;
  totalTokens: number;
  compressionRatio: number;
  lastCompressed?: Date;
}

/**
 * Rolling window options
 */
export interface RollingWindowOptions {
  minSize?: number;
  maxSize?: number;
  adaptive?: boolean;
  tokenLimit?: number;
}

/**
 * Context metadata
 */
export interface ContextMetadata {
  sessionId: string;
  stage: number;
  agentType: string;
  totalTokens?: number;
}

// ============= Schema Types =============

/**
 * Registered schema metadata
 */
export interface RegisteredSchema {
  agentType: string;
  zodSchema: unknown;
  jsonSchema: object;
  example: unknown;
  version: string;
  lastModified: Date;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors: string[];
  path?: string;
}

/**
 * Structured output options
 */
export interface StructuredOutputOptions {
  retryOnValidationError?: boolean;
  maxRetries?: number;
  includeValidationInPrompt?: boolean;
  initialDelay?: number;
  timeout?: number;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Structured output result
 */
export interface StructuredOutputResult<T> {
  data: T;
  rawOutput: string;
  validation: SchemaValidationResult<T>;
  tokenUsage: TokenUsage;
  duration: number;
  attempt: number;
}

// ============= Observability Types =============

/**
 * Trace metadata
 */
export interface TraceMetadata {
  sessionId: string;
  agentType: string;
  startTime: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Span in trace
 */
export interface Span {
  id: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
  status?: 'ok' | 'error';
  error?: string;
}

/**
 * Trace
 */
export interface Trace {
  id: string;
  metadata: TraceMetadata;
  spans: Span[];
  startTime: number;
  endTime?: number;
}

/**
 * Trace filters
 */
export interface TraceFilters {
  sessionId?: string;
  agentType?: string;
  startTime?: number;
  endTime?: number;
  minDuration?: number;
}

/**
 * LLM call cost
 */
export interface LLMLCallCost {
  agentType: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
  timestamp: Date;
  cost?: number;
}

/**
 * Cost filters
 */
export interface CostFilters {
  agentType?: string;
  startDate?: Date;
  endDate?: Date;
  minCost?: number;
}

/**
 * Cost summary
 */
export interface CostSummary {
  totalCost: number;
  totalCalls: number;
  avgCostPerCall: number;
  byAgentType: Record<string, number>;
  byModel: Record<string, number>;
}

/**
 * Agent cost breakdown
 */
export interface AgentCostBreakdown {
  agentType: string;
  totalCost: number;
  totalCalls: number;
  avgCostPerCall: number;
  avgTokensPerCall: number;
  costByDay: Record<string, number>;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  type: 'caching' | 'compression' | 'temperature' | 'maxTokens';
  agentType: string;
  current: number;
  suggested: number;
  potentialSavings: number;
  reasoning: string;
}

/**
 * Cost forecast
 */
export interface CostForecast {
  period: string;
  forecastedCost: number;
  confidence: number;
  factors: string[];
}

/**
 * Time period
 */
export interface TimePeriod {
  start: Date;
  end: Date;
}

/**
 * Telemetry metrics
 */
export interface TelemetryMetrics {
  promptCalls: number;
  totalTokens: number;
  avgDuration: number;
  errorRate: number;
  cacheHitRate: number;
  byAgentType: Record<string, number>;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  name: string;
  metrics: string[];
  filters?: Record<string, unknown>;
  refreshInterval?: number;
}

/**
 * Dashboard
 */
export interface Dashboard {
  name: string;
  metrics: TelemetryMetrics;
  lastUpdated: Date;
}
