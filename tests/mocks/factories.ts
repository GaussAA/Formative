/**
 * Test Data Factories
 * Provides factory functions for creating test data
 */

import type { GraphStateType } from '@/lib/graph/state';
import { Stage, type RequirementProfile, type StagesSummary, type OptionChip } from '@/types';

/**
 * Creates a mock GraphState with sensible defaults
 *
 * @param overrides - Partial state to override defaults
 * @returns A complete GraphStateType object
 */
export function createMockState(overrides: Partial<GraphStateType> = {}): GraphStateType {
  const now = Date.now();

  return {
    sessionId: 'test-session-id',
    currentStage: Stage.REQUIREMENT_COLLECTION,
    completeness: 0,
    profile: {},
    summary: {},
    messages: [],
    userInput: '',
    response: '',
    options: undefined,
    needMoreInfo: false,
    missingFields: [],
    nextQuestion: undefined,
    askedQuestions: [],
    stop: false,
    finalSpec: undefined,
    metadata: {
      createdAt: now,
      updatedAt: now,
    },
    ...overrides,
  };
}

/**
 * Creates a mock RequirementProfile
 *
 * @param overrides - Partial profile to override defaults
 * @returns A complete RequirementProfile object
 */
export function createMockProfile(overrides: Partial<RequirementProfile> = {}): RequirementProfile {
  return {
    projectName: 'Test Project',
    productGoal: 'To build a test application',
    targetUsers: 'Test users',
    useCases: 'Testing scenarios',
    coreFunctions: ['Function 1', 'Function 2'],
    needsDataStorage: true,
    needsMultiUser: false,
    needsAuth: false,
    ...overrides,
  };
}

/**
 * Creates a mock Stage Summary
 *
 * @param stage - The stage to create summary for
 * @param overrides - Partial summary to override defaults
 * @returns A partial StagesSummary object
 */
export function createMockSummary(
  stage?: Stage,
  overrides: Partial<StagesSummary> = {}
): StagesSummary {
  const summaries: Partial<Record<Stage, unknown>> = {
    [Stage.REQUIREMENT_COLLECTION]: {
      productGoal: 'To build a test application',
      targetUsers: 'Test users',
      coreFunctions: ['Function 1', 'Function 2'],
    },
    [Stage.RISK_ANALYSIS]: {
      risks: ['Risk 1', 'Risk 2'],
      selectedApproach: 'approach-1',
    },
    [Stage.TECH_STACK]: {
      techStack: {
        category: 'frontend-only' as const,
        frontend: 'React',
      },
      reasoning: 'Test reasoning',
    },
    [Stage.MVP_BOUNDARY]: {
      mvpFeatures: ['Feature 1', 'Feature 2'],
      nonGoals: ['Non-goal 1'],
    },
    [Stage.DIAGRAM_DESIGN]: {
      architectureDiagram: 'graph TD;\n  A-->B;',
      sequenceDiagram: 'participant User\n  User->>System: Action',
    },
    [Stage.DOCUMENT_GENERATION]: {
      finalSpec: '# Test Specification\n\nThis is a test.',
    },
  };

  if (stage !== undefined) {
    return {
      [stage]: summaries[stage],
      ...overrides,
    } as StagesSummary;
  }

  return summaries as StagesSummary;
}

/**
 * Creates mock OptionChip items
 *
 * @param count - Number of options to create
 * @param prefix - Prefix for option IDs and labels
 * @returns Array of OptionChip objects
 */
export function createMockOptions(count: number, prefix = 'option'): OptionChip[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    label: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} ${i + 1}`,
    value: `value-${i + 1}`,
  }));
}

/**
 * Creates a mock LLM message
 *
 * @param role - Message role ('user' | 'assistant' | 'system')
 * @param content - Message content
 * @returns A message object
 */
export function createMockMessage(
  role: 'user' | 'assistant' | 'system',
  content: string
): { role: string; content: string } {
  return { role, content };
}

/**
 * Creates a mock conversation history
 *
 * @param count - Number of message pairs to create
 * @returns Array of message objects
 */
export function createMockConversationHistory(count = 2): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = [];

  for (let i = 0; i < count; i++) {
    messages.push({ role: 'user', content: `User message ${i + 1}` });
    messages.push({ role: 'assistant', content: `Assistant response ${i + 1}` });
  }

  return messages;
}

/**
 * Creates a mock extractor response
 *
 * @param overrides - Partial response to override defaults
 * @returns A mock ExtractorResponse object
 */
export function createMockExtractorResponse(
  overrides: Partial<{
    extracted: Partial<RequirementProfile>;
    missingFields: string[];
    nextQuestion: string;
    options: Array<{ id: string; label: string; value: string }>;
  }> = {}
) {
  return {
    extracted: overrides.extracted || {
      projectName: 'Test Project',
      productGoal: 'To build a test application',
      targetUsers: 'Test users',
      useCases: 'Testing scenarios',
      coreFunctions: ['Function 1', 'Function 2'],
      needsDataStorage: true,
      needsMultiUser: false,
      needsAuth: false,
    },
    missingFields: overrides.missingFields ?? [],
    nextQuestion: overrides.nextQuestion,
    options: overrides.options,
  };
}

/**
 * Creates a mock planner response
 *
 * @param overrides - Partial response to override defaults
 * @returns A mock PlannerResponse object
 */
export function createMockPlannerResponse(overrides: Partial<unknown> = {}) {
  return {
    completeness: 80,
    checklist: {
      productGoal: true,
      targetUsers: true,
      useCases: true,
      coreFunctions: true,
      needsDataStorage: true,
      needsMultiUser: true,
    },
    missingCritical: [],
    canProceed: true,
    recommendation: 'Requirements are complete',
    ...overrides,
  };
}

/**
 * Creates a mock risk analyst response
 *
 * @param overrides - Partial response to override defaults
 * @returns A mock risk analysis response object
 */
export function createMockRiskAnalystResponse(overrides: Partial<unknown> = {}) {
  return {
    risks: [
      { id: 'risk-1', type: 'technical', description: 'Technical risk', severity: 'high' as const },
      { id: 'risk-2', type: 'market', description: 'Market risk', severity: 'medium' as const },
    ],
    approaches: [
      {
        id: 'approach-1',
        name: 'MVP First',
        label: 'MVP 优先',
        description: 'Start with minimum viable product',
        pros: ['Quick to market', 'Lower risk'],
        cons: ['Limited features'],
        recommended: true,
      },
      {
        id: 'approach-2',
        name: 'Full Build',
        label: '完整构建',
        description: 'Build all features at once',
        pros: ['Complete feature set'],
        cons: ['Higher risk', 'Longer timeline'],
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock tech advisor response
 *
 * @param overrides - Partial response to override defaults
 * @returns A mock tech stack analysis response object
 */
export function createMockTechAdvisorResponse(overrides: Partial<unknown> = {}) {
  return {
    options: [
      {
        id: 'stack-1',
        name: 'React Static Site',
        category: 'frontend-only' as const,
        stack: {
          frontend: 'React',
          deployment: 'Vercel',
        },
        pros: ['Simple', 'Fast'],
        cons: ['Limited backend'],
        evolutionCost: 'Low',
        suitableFor: 'Simple apps',
        recommended: true,
      },
      {
        id: 'stack-2',
        name: 'Next.js Fullstack',
        category: 'fullstack' as const,
        stack: {
          frontend: 'Next.js',
          backend: 'Node.js',
          database: 'PostgreSQL',
          deployment: 'Vercel',
        },
        pros: ['Complete solution', 'Scalable'],
        cons: ['More complex'],
        evolutionCost: 'Medium',
        suitableFor: 'Complex apps',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock MVP boundary response
 *
 * @param overrides - Partial response to override defaults
 * @returns A mock MVP planning response object
 */
export function createMockMVPBoundaryResponse(overrides: Partial<unknown> = {}) {
  return {
    features: [
      { id: 'feature-1', name: 'Core Feature 1', description: 'Essential feature', inMVP: true },
      { id: 'feature-2', name: 'Nice to have 1', description: 'Optional feature', inMVP: false },
    ],
    devPlan: {
      phase1: ['Setup project', 'Build core features'],
      phase2: ['Add polish', 'Testing'],
      estimatedComplexity: 'medium' as const,
      estimatedWeeks: '2-3',
    },
    nonGoals: ['Advanced analytics', 'Multi-language support'],
    ...overrides,
  };
}

/**
 * Creates a mock diagram design response
 *
 * @param overrides - Partial response to override defaults
 * @returns A mock diagram design response object
 */
export function createMockDiagramResponse(overrides: Partial<unknown> = {}) {
  return {
    architectureDiagram: 'graph TD;\n  User[User] --> App[Application]\n  App --> DB[Database]',
    sequenceDiagram:
      'sequenceDiagram\n  participant User\n  participant App\n  User->>App: Request\n  App-->>User: Response',
    explanation: 'System architecture showing user interaction flow',
    ...overrides,
  };
}

/**
 * Creates a mock spec generator response
 *
 * @param overrides - Partial response to override defaults
 * @returns A mock spec document response object
 */
export function createMockSpecResponse(overrides: Partial<unknown> = {}) {
  return {
    projectOverview: 'Test project for automated testing',
    productGoals: ['Goal 1', 'Goal 2'],
    targetUsersAndScenarios: {
      users: 'Test users',
      scenarios: 'Testing scenarios',
    },
    mvpScope: ['Feature 1', 'Feature 2'],
    nonGoals: ['Non-goal 1'],
    techSolution: 'Using React and Next.js',
    techStack: [
      {
        category: 'frontend',
        choice: 'React',
        reasoning: 'Popular and well-supported',
      },
    ],
    developmentSteps: [
      { day: 1, task: 'Setup' },
      { day: 2, task: 'Build features' },
      { day: 3, task: 'Testing' },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock asker response
 *
 * @param overrides - Partial response to override defaults
 * @returns A mock question generation response object
 */
export function createMockAskerResponse(overrides: Partial<unknown> = {}) {
  return {
    question: 'What is the primary goal of your application?',
    options: [
      { id: 'opt-1', label: 'E-commerce', value: 'ecommerce' },
      { id: 'opt-2', label: 'Social', value: 'social' },
      { id: 'opt-3', label: 'Content', value: 'content' },
    ],
    reasoning: 'Need to understand the primary use case',
    ...overrides,
  };
}

/**
 * Creates a mock form validator response
 *
 * @param overrides - Partial response to override defaults
 * @returns A mock validation response object
 */
export function createMockFormValidatorResponse(overrides: Partial<unknown> = {}) {
  return {
    valid: true,
    errors: [],
    warnings: [],
    suggestions: [],
    ...overrides,
  };
}
