/**
 * Risk Analyst Agent Integration Tests
 * Tests the risk analysis and solution options generation node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { riskAnalystNode } from '@/lib/agents/risk-analyst';
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
      return 'You are a risk analyst.';
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

describe('RiskAnalyst Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('risk analysis', () => {
    it('should analyze risks and provide options', async () => {
      const mockResponse = {
        risks: [
          { type: 'technical', description: '技术复杂度高', severity: 'high' as const },
          { type: 'market', description: '市场竞争激烈', severity: 'medium' as const },
        ],
        options: [
          {
            id: 'mvp-first',
            label: 'MVP 优先',
            description: '先做最小可行产品',
            pros: ['快速上线', '降低风险'],
            cons: ['功能有限'],
            recommended: true,
          },
          {
            id: 'full-build',
            label: '完整构建',
            description: '一次性完成所有功能',
            pros: ['功能完整'],
            cons: ['开发周期长', '风险高'],
          },
        ],
        recommendation: '建议采用 MVP 优先方案',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await riskAnalystNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'risk',
        expect.any(String),
        expect.stringContaining('需求画像')
      );

      // Check summary is updated with risks
      expect(result.summary?.[Stage.RISK_ANALYSIS]).toMatchObject({
        risks: ['技术复杂度高', '市场竞争激烈'],
        selectedApproach: '',
      });

      // Check response message is generated
      expect(result.response).toContain('技术复杂度高');
      expect(result.response).toContain('市场竞争激烈');
      expect(result.response).toContain('请选择您倾向的方案');

      // Check options are returned
      expect(result.options).toHaveLength(2);
      expect(result.options?.[0]).toMatchObject({
        id: 'mvp-first',
        label: 'MVP 优先',
        value: 'mvp-first',
      });

      // Check stage and needMoreInfo flags
      expect(result.currentStage).toBe(Stage.RISK_ANALYSIS);
      expect(result.needMoreInfo).toBe(true);
    });

    it('should map risk descriptions to summary', async () => {
      const mockResponse = {
        risks: [
          { type: 'scope', description: '需求范围可能蔓延', severity: 'high' as const },
          { type: 'resource', description: '开发资源有限', severity: 'medium' as const },
          { type: 'timeline', description: '时间紧迫', severity: 'low' as const },
        ],
        options: [
          {
            id: 'agile',
            label: '敏捷开发',
            description: '采用敏捷开发方法',
            pros: ['灵活应对变化'],
            cons: ['需要频繁沟通'],
          },
        ],
        recommendation: '建议采用敏捷开发',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await riskAnalystNode(state);

      expect(result.summary?.[Stage.RISK_ANALYSIS]?.risks).toEqual([
        '需求范围可能蔓延',
        '开发资源有限',
        '时间紧迫',
      ]);
    });

    it('should format options correctly', async () => {
      const mockResponse = {
        risks: [],
        options: [
          {
            id: 'option-1',
            label: '方案一',
            description: '第一个方案',
            pros: ['优点1', '优点2'],
            cons: ['缺点1'],
          },
          {
            id: 'option-2',
            label: '方案二',
            description: '第二个方案',
            pros: ['优点A'],
            cons: ['缺点A', '缺点B'],
          },
          {
            id: 'option-3',
            label: '方案三',
            description: '第三个方案',
            pros: [],
            cons: [],
          },
        ],
        recommendation: '请选择',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await riskAnalystNode(state);

      expect(result.options).toEqual([
        { id: 'option-1', label: '方案一', value: 'option-1' },
        { id: 'option-2', label: '方案二', value: 'option-2' },
        { id: 'option-3', label: '方案三', value: 'option-3' },
      ]);
    });
  });

  describe('response generation', () => {
    it('should generate formatted response with numbered risks', async () => {
      const mockResponse = {
        risks: [
          { type: 'technical', description: '技术风险1', severity: 'high' as const },
          { type: 'technical', description: '技术风险2', severity: 'medium' as const },
          { type: 'market', description: '市场风险', severity: 'low' as const },
        ],
        options: [{ id: 'opt-1', label: '方案', description: 'desc', pros: [], cons: [] }],
        recommendation: '推荐方案',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await riskAnalystNode(state);

      expect(result.response).toMatch(/1\. 技术风险1/);
      expect(result.response).toMatch(/2\. 技术风险2/);
      expect(result.response).toMatch(/3\. 市场风险/);
      expect(result.response).toContain('推荐方案');
    });

    it('should include recommendation in response', async () => {
      const mockResponse = {
        risks: [],
        options: [],
        recommendation: '根据您的需求，我们建议采用渐进式开发策略。',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await riskAnalystNode(state);

      expect(result.response).toContain('根据您的需求，我们建议采用渐进式开发策略。');
    });
  });

  describe('summary handling', () => {
    it('should preserve existing summary data', async () => {
      const mockResponse = {
        risks: [{ type: 'technical', description: '新风险', severity: 'high' as const }],
        options: [{ id: 'opt-1', label: '方案', description: 'desc', pros: [], cons: [] }],
        recommendation: '推荐',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const existingSummary = {
        [Stage.REQUIREMENT_COLLECTION]: {
          productGoal: 'Build test app',
          targetUsers: 'Developers',
        },
      };

      const state = createMockState({
        profile: createMockProfile(),
        summary: existingSummary,
      });

      const result = await riskAnalystNode(state);

      // Should preserve existing summary
      expect(result.summary?.[Stage.REQUIREMENT_COLLECTION]).toEqual({
        productGoal: 'Build test app',
        targetUsers: 'Developers',
      });

      // Should add new risk analysis summary
      expect(result.summary?.[Stage.RISK_ANALYSIS]).toBeDefined();
    });

    it('should initialize selectedApproach as empty string', async () => {
      const mockResponse = {
        risks: [],
        options: [],
        recommendation: '推荐',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await riskAnalystNode(state);

      expect(result.summary?.[Stage.RISK_ANALYSIS]?.selectedApproach).toBe('');
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await riskAnalystNode(state);

      expect(result.response).toBe('风险分析完成，建议采用稳健的技术方案。');
      expect(result.currentStage).toBe(Stage.TECH_STACK);
      expect(result.needMoreInfo).toBe(false);
    });

    it('should transition to TECH_STACK on error', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('Network error'));

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.REQUIREMENT_COLLECTION,
      });

      const result = await riskAnalystNode(state);

      expect(result.currentStage).toBe(Stage.TECH_STACK);
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with risk config', async () => {
      const mockResponse = {
        risks: [],
        options: [],
        recommendation: 'OK',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const profile = createMockProfile({
        projectName: 'Test Project',
        productGoal: 'Test Goal',
      });

      const state = createMockState({
        profile,
      });

      await riskAnalystNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'risk',
        expect.any(String),
        expect.stringContaining('Test Project')
      );
      // No 4th argument - conversationHistory is not passed to risk_analyst
    });
  });
});
