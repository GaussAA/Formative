/**
 * Form Validator Agent Integration Tests
 * Tests the form data validation node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formValidatorNode } from '@/lib/agents/form-validator';
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
      return 'You are a form validator.';
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

describe('FormValidator Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('form validation - valid form', () => {
    it('should validate and transition to RISK_ANALYSIS when form is valid', async () => {
      const mockResponse = {
        isValid: true,
        issues: [],
        recommendation: '您的需求非常清晰，可以直接进入下一阶段。',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile({
          projectName: 'Valid Project',
          productGoal: 'Clear goal',
          targetUsers: 'Developers',
          coreFunctions: ['Function 1', 'Function 2'],
        }),
      });

      const result = await formValidatorNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'formValidator',
        expect.any(String),
        expect.stringContaining('请检查这些信息的合理性和完整性')
      );

      expect(result.response).toContain('感谢您提供的详细信息');
      expect(result.response).toContain('您的需求非常清晰，可以直接进入下一阶段。');
      expect(result.response).toContain('接下来，我们将为您分析潜在的技术风险和实现方案。');

      expect(result.currentStage).toBe(Stage.RISK_ANALYSIS);
      expect(result.needMoreInfo).toBe(false);
      expect(result.completeness).toBe(100);
    });

    it('should include recommendation in response for valid form', async () => {
      const mockResponse = {
        isValid: true,
        issues: [],
        recommendation: '建议采用敏捷开发模式，分阶段实现功能。',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await formValidatorNode(state);

      expect(result.response).toContain('建议采用敏捷开发模式，分阶段实现功能。');
    });
  });

  describe('form validation - invalid with clarification questions', () => {
    it('should request clarification when form has issues with questions', async () => {
      const mockResponse = {
        isValid: false,
        issues: [
          {
            field: 'productGoal',
            issue: '产品目标过于宽泛',
            suggestion: '请具体描述要解决什么问题',
          },
          {
            field: 'timeline',
            issue: '时间设置不现实',
            suggestion: '考虑延长开发周期',
          },
        ],
        clarificationQuestions: [
          {
            question: '您希望核心功能"快速上线"是指多长时间内完成？',
            field: 'timeline',
            reason: '了解时间预期有助于评估技术方案',
          },
        ],
        recommendation: '建议先明确时间预期',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await formValidatorNode(state);

      // Should stay in requirement collection
      expect(result.currentStage).toBe(Stage.REQUIREMENT_COLLECTION);
      expect(result.needMoreInfo).toBe(true);

      // Response should include issues and first question
      expect(result.response).toContain('有几个地方需要确认一下');
      expect(result.response).toContain('**productGoal**: 产品目标过于宽泛');
      expect(result.response).toContain('**timeline**: 时间设置不现实');
      expect(result.response).toContain('您希望核心功能"快速上线"是指多长时间内完成？');
      expect(result.response).toContain('原因：了解时间预期有助于评估技术方案');
    });

    it('should only show first clarification question when multiple exist', async () => {
      const mockResponse = {
        isValid: false,
        issues: [
          { field: 'budget', issue: 'Budget unclear', suggestion: 'Clarify budget' },
        ],
        clarificationQuestions: [
          {
            question: 'First question?',
            field: 'budget',
            reason: 'Need budget info',
          },
          {
            question: 'Second question?',
            field: 'timeline',
            reason: 'Need timeline info',
          },
          {
            question: 'Third question?',
            field: 'scope',
            reason: 'Need scope info',
          },
        ],
        recommendation: 'Clarify details',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await formValidatorNode(state);

      // Should only include first question
      expect(result.response).toContain('First question?');
      expect(result.response).not.toContain('Second question?');
      expect(result.response).not.toContain('Third question?');
    });
  });

  describe('form validation - invalid without clarification questions', () => {
    it('should show issues with suggestions when no clarification questions', async () => {
      const mockResponse = {
        isValid: false,
        issues: [
          {
            field: 'productGoal',
            issue: '目标不够具体',
            suggestion: '请明确具体要解决的用户痛点',
          },
          {
            field: 'targetUsers',
            issue: '用户群体定义模糊',
            suggestion: '请具体描述目标用户的特征',
          },
        ],
        clarificationQuestions: [],
        recommendation: '建议进一步明确产品定位',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await formValidatorNode(state);

      // Should stay in requirement collection
      expect(result.currentStage).toBe(Stage.REQUIREMENT_COLLECTION);
      expect(result.needMoreInfo).toBe(true);

      // Response should include numbered issues with suggestions
      expect(result.response).toContain('发现以下需要注意的地方');
      expect(result.response).toContain('1. **productGoal**: 目标不够具体');
      expect(result.response).toContain('💡 建议：请明确具体要解决的用户痛点');
      expect(result.response).toContain('2. **targetUsers**: 用户群体定义模糊');
      expect(result.response).toContain('💡 建议：请具体描述目标用户的特征');
      expect(result.response).toContain('建议进一步明确产品定位');
      expect(result.response).toContain('请问您想要调整这些内容吗？');
    });

    it('should handle single issue without questions', async () => {
      const mockResponse = {
        isValid: false,
        issues: [
          {
            field: 'coreFunctions',
            issue: '功能描述过于简单',
            suggestion: '请详细描述每个功能的具体作用',
          },
        ],
        clarificationQuestions: [],
        recommendation: '建议完善功能描述',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await formValidatorNode(state);

      expect(result.response).toContain('1. **coreFunctions**: 功能描述过于简单');
      expect(result.response).toContain('💡 建议：请详细描述每个功能的具体作用');
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await formValidatorNode(state);

      expect(result.response).toBe('表单验证遇到问题，我们将通过对话方式继续收集信息。');
      expect(result.currentStage).toBe(Stage.REQUIREMENT_COLLECTION);
      expect(result.needMoreInfo).toBe(true);
    });

    it('should transition to conversation mode on network error', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('Network error'));

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.REQUIREMENT_COLLECTION,
      });

      const result = await formValidatorNode(state);

      expect(result.currentStage).toBe(Stage.REQUIREMENT_COLLECTION);
      expect(result.needMoreInfo).toBe(true);
      expect(result.response).toContain('对话方式');
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with formValidator config', async () => {
      const mockResponse = {
        isValid: true,
        issues: [],
        recommendation: 'Good',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile({
          projectName: 'TestProject',
          productGoal: 'Test Goal',
        }),
      });

      await formValidatorNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'formValidator',
        expect.any(String),
        expect.stringContaining('TestProject')
      );
    });

    it('should include form validation checklist in context', async () => {
      const mockResponse = {
        isValid: true,
        issues: [],
        recommendation: 'OK',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      await formValidatorNode(state);

      const contextArg = vi.mocked(callLLMWithJSONByAgent).mock.calls[0]?.[2];
      expect(contextArg).toContain('请检查这些信息的合理性和完整性');
      expect(contextArg).toContain('产品目标是否清晰具体？');
      expect(contextArg).toContain('目标用户是否明确？');
      expect(contextArg).toContain('核心功能是否可行？');
    });
  });

  describe('edge cases', () => {
    it('should handle valid form with empty issues array', async () => {
      const mockResponse = {
        isValid: true,
        issues: [],
        recommendation: 'All good!',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await formValidatorNode(state);

      expect(result.currentStage).toBe(Stage.RISK_ANALYSIS);
      expect(result.needMoreInfo).toBe(false);
    });

    it('should handle valid form with recommendation', async () => {
      const mockResponse = {
        isValid: true,
        issues: [],
        recommendation: '需求完整，建议采用MVP方式快速验证。',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await formValidatorNode(state);

      expect(result.response).toContain('需求完整，建议采用MVP方式快速验证。');
    });
  });
});
