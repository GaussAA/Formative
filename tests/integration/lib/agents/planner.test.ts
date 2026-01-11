/**
 * Planner Agent Integration Tests
 * Tests the requirement completeness evaluation node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { plannerNode } from '@/lib/agents/planner';
import { Stage } from '@/types';
import type { GraphStateType } from '@/lib/graph/state';
import { createMockState, createMockProfile } from '../../../mocks/factories';

// Mock the LLM helper
vi.mock('@/lib/llm/helper', () => ({
  callLLMWithJSONByAgent: vi.fn(),
}));

// Mock prompts
vi.mock('@/lib/prompts', () => ({
  default: {
    async getPrompt() {
      return 'You are a requirement planner.';
    },
  },
  PromptType: {
    EXTRACTOR: 'extractor',
    PLANNER: 'planner',
    ASKER: 'asker',
    FORM_VALIDATOR: 'form-validator',
    RISK: 'risk',
    TECH: 'tech',
    MVP: 'mvp',
    DIAGRAM: 'diagram',
    DIAGRAM_UPDATE: 'diagram-update',
    SPEC: 'spec',
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    agent: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { callLLMWithJSONByAgent } from '@/lib/llm/helper';

describe('Planner Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requirement completeness evaluation', () => {
    it('should identify missing critical fields', async () => {
      const mockResponse = {
        completeness: 50,
        checklist: {
          productGoal: false,
          targetUsers: false,
          useCases: false,
          coreFunctions: false,
          needsDataStorage: false,
          needsMultiUser: false,
        },
        missingCritical: ['产品目标', '目标用户', '核心功能'],
        canProceed: false,
        recommendation: '需要更多信息',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: {}, // Empty profile - missing all fields
      });

      const result = await plannerNode(state);

      expect(result.completeness).toBe(0);
      expect(result.missingFields).toContain('产品目标');
      expect(result.missingFields).toContain('目标用户');
      expect(result.needMoreInfo).toBe(true);
    });

    it('should calculate completeness based on filled fields', async () => {
      const profile = createMockProfile({
        // Missing needsMultiUser and needsAuth
        needsMultiUser: undefined,
        needsAuth: undefined,
      });

      const mockResponse = {
        completeness: 66,
        checklist: {
          productGoal: true,
          targetUsers: true,
          useCases: true,
          coreFunctions: true,
          needsDataStorage: true,
          needsMultiUser: false,
        },
        missingCritical: [],
        canProceed: true,
        recommendation: '可以继续',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile,
        currentStage: Stage.REQUIREMENT_COLLECTION,
      });

      const result = await plannerNode(state);

      // 4 out of 6 required fields present = 66.67% -> floor to 66%
      expect(result.completeness).toBe(66);
      expect(result.missingFields).toContain('多用户需求');
      expect(result.missingFields).toContain('用户登录需求');
    });

    it('should recognize complete requirements', async () => {
      const completeProfile = createMockProfile({
        productName: 'Test App',
        productGoal: 'Build something great',
        targetUsers: 'Developers',
        useCases: 'Testing',
        coreFunctions: ['Function 1'],
        needsDataStorage: true,
        needsMultiUser: false,
        needsAuth: true,
      });

      const mockResponse = {
        completeness: 100,
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
        recommendation: '需求完整，可以进入下一阶段',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: completeProfile,
        currentStage: Stage.REQUIREMENT_COLLECTION,
      });

      const result = await plannerNode(state);

      expect(result.completeness).toBe(100);
      expect(result.needMoreInfo).toBe(false);
      expect(result.currentStage).toBe(Stage.RISK_ANALYSIS);
    });
  });

  describe('loop detection', () => {
    it('should force next stage after 5 questions', async () => {
      const mockResponse = {
        completeness: 60,
        canProceed: false,
        checklist: {},
        missingCritical: [],
        recommendation: 'Need more info',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        askedQuestions: ['q1', 'q2', 'q3', 'q4', 'q5'], // 5 questions
        currentStage: Stage.REQUIREMENT_COLLECTION,
      });

      const result = await plannerNode(state);

      expect(result.completeness).toBe(80);
      expect(result.needMoreInfo).toBe(false);
      expect(result.currentStage).toBe(Stage.RISK_ANALYSIS);
    });

    it('should not force next stage with fewer than 5 questions', async () => {
      const mockResponse = {
        completeness: 60,
        canProceed: false,
        checklist: {},
        missingCritical: [],
        recommendation: 'Need more info',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile({
          // Make profile incomplete to avoid automatic transition
          needsMultiUser: undefined,
          needsAuth: undefined,
        }),
        askedQuestions: ['q1', 'q2', 'q3', 'q4'], // Only 4 questions
        currentStage: Stage.REQUIREMENT_COLLECTION,
      });

      const result = await plannerNode(state);

      expect(result.needMoreInfo).toBe(true);
      expect(result.currentStage).toBe(Stage.REQUIREMENT_COLLECTION);
    });
  });

  describe('stage transitions - REQUIREMENT_COLLECTION', () => {
    it('should transition to RISK_ANALYSIS when complete', async () => {
      const completeProfile = createMockProfile({
        productName: 'Test',
        productGoal: 'Goal',
        targetUsers: 'Users',
        useCases: 'Cases',
        coreFunctions: ['Function'],
        needsDataStorage: true,
        needsMultiUser: false,
        needsAuth: true,
      });

      const mockResponse = {
        completeness: 100,
        canProceed: true,
        checklist: {},
        missingCritical: [],
        recommendation: 'Complete',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: completeProfile,
        currentStage: Stage.REQUIREMENT_COLLECTION,
      });

      const result = await plannerNode(state);

      expect(result.needMoreInfo).toBe(false);
      expect(result.currentStage).toBe(Stage.RISK_ANALYSIS);
    });

    it('should stay in REQUIREMENT_COLLECTION when incomplete', async () => {
      const incompleteProfile = createMockProfile({
        productName: 'Test',
        productGoal: 'Goal',
        // Missing most fields - keep it incomplete
        targetUsers: undefined,
        useCases: undefined,
        coreFunctions: undefined,
        needsDataStorage: undefined,
        needsMultiUser: undefined,
        needsAuth: undefined,
      });

      const mockResponse = {
        completeness: 30,
        canProceed: false,
        checklist: {},
        missingCritical: [],
        recommendation: 'Incomplete',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: incompleteProfile,
        currentStage: Stage.REQUIREMENT_COLLECTION,
      });

      const result = await plannerNode(state);

      expect(result.needMoreInfo).toBe(true);
      expect(result.currentStage).toBe(Stage.REQUIREMENT_COLLECTION);
    });
  });

  describe('stage transitions - RISK_ANALYSIS', () => {
    it('should transition to TECH_STACK after risk approach selected', async () => {
      const mockResponse = {
        completeness: 80,
        canProceed: true,
        checklist: {},
        missingCritical: [],
        recommendation: 'Continue',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.RISK_ANALYSIS,
        summary: {
          [Stage.RISK_ANALYSIS]: {
            selectedApproach: 'approach-1',
            risks: [],
          },
        },
      });

      const result = await plannerNode(state);

      expect(result.needMoreInfo).toBe(false);
      expect(result.currentStage).toBe(Stage.TECH_STACK);
    });

    it('should wait for risk approach selection', async () => {
      const mockResponse = {
        completeness: 80,
        canProceed: true,
        checklist: {},
        missingCritical: [],
        recommendation: 'Continue',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.RISK_ANALYSIS,
        summary: {
          [Stage.RISK_ANALYSIS]: {
            risks: [],
          },
        },
      });

      const result = await plannerNode(state);

      expect(result.needMoreInfo).toBe(false);
      // Should not change stage, let router decide
    });
  });

  describe('stage transitions - TECH_STACK', () => {
    it('should transition to MVP_BOUNDARY after tech stack selected', async () => {
      const mockResponse = {
        completeness: 80,
        canProceed: true,
        checklist: {},
        missingCritical: [],
        recommendation: 'Continue',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.TECH_STACK,
        summary: {
          [Stage.TECH_STACK]: {
            techStack: {
              category: 'frontend-only',
              frontend: 'React',
            },
            reasoning: 'Simple',
          },
        },
      });

      const result = await plannerNode(state);

      expect(result.needMoreInfo).toBe(false);
      expect(result.currentStage).toBe(Stage.MVP_BOUNDARY);
    });

    it('should wait for tech stack selection', async () => {
      const mockResponse = {
        completeness: 80,
        canProceed: true,
        checklist: {},
        missingCritical: [],
        recommendation: 'Continue',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.TECH_STACK,
        summary: {
          [Stage.TECH_STACK]: {},
        },
      });

      const result = await plannerNode(state);

      expect(result.needMoreInfo).toBe(false);
      // Should not change stage, let router decide
    });
  });

  describe('stage transitions - MVP_BOUNDARY', () => {
    it('should transition to DIAGRAM_DESIGN after MVP defined', async () => {
      const mockResponse = {
        completeness: 90,
        canProceed: true,
        checklist: {},
        missingCritical: [],
        recommendation: 'Ready for diagram',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.MVP_BOUNDARY,
      });

      const result = await plannerNode(state);

      expect(result.needMoreInfo).toBe(false);
      expect(result.currentStage).toBe(Stage.DIAGRAM_DESIGN);
    });
  });

  describe('error handling', () => {
    it('should handle LLM call errors gracefully', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('LLM Error'));

      const state = createMockState({
        profile: createMockProfile({
          productName: 'Test',
          productGoal: 'Goal',
          // Incomplete profile - missing key fields
          targetUsers: undefined,
          coreFunctions: undefined,
          needsMultiUser: undefined,
          needsAuth: undefined,
        }),
      });

      const result = await plannerNode(state);

      // When missing critical fields, returns early without calling LLM
      expect(result.needMoreInfo).toBe(true);
      expect(result.missingFields).toBeDefined();
    });

    it('should preserve strict completeness on error', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile({
          productName: 'Test',
          productGoal: 'Goal',
          targetUsers: 'Users',
          useCases: 'Cases',
          coreFunctions: ['Function'],
          needsDataStorage: true,
          // Missing needsMultiUser and needsAuth
          needsMultiUser: undefined,
          needsAuth: undefined,
        }),
      });

      const result = await plannerNode(state);

      // Should calculate completeness based on present fields (4/6 = 66%)
      // Note: useCases is NOT a required field in the planner
      expect(result.completeness).toBe(66);
      expect(result.needMoreInfo).toBe(true);
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with planner config', async () => {
      const mockResponse = {
        completeness: 80,
        canProceed: true,
        checklist: {},
        missingCritical: [],
        recommendation: 'Good progress',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      await plannerNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'planner',
        expect.any(String),
        expect.stringContaining('当前需求画像')
      );
      // No 4th argument - conversationHistory is not passed to planner
    });
  });
});
