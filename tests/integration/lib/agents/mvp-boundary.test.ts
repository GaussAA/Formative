/**
 * MVP Boundary Agent Integration Tests
 * Tests the MVP feature boundary definition node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mvpBoundaryNode } from '@/lib/agents/mvp-boundary';
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
      return 'You are an MVP planner.';
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

describe('MVPBoundary Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MVP feature definition', () => {
    it('should define MVP and future features', async () => {
      const mockResponse = {
        mvpFeatures: ['用户注册', '内容发布', '内容浏览'],
        futureFeatures: ['社交分享', '评论系统', '推送通知'],
        devPlan: {
          phase1: ['项目搭建', '核心功能开发'],
          phase2: ['优化', '测试'],
          estimatedComplexity: 'medium' as const,
        },
        recommendation: '建议先完成核心功能再逐步扩展',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        summary: {
          [Stage.RISK_ANALYSIS]: {
            risks: ['技术风险'],
            selectedApproach: 'mvp-first',
          },
          [Stage.TECH_STACK]: {
            techStack: { category: 'fullstack', frontend: 'Next.js' },
            reasoning: '全栈方案适合复杂应用',
          },
        },
      });

      const result = await mvpBoundaryNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'mvp',
        expect.any(String),
        expect.stringContaining('需求画像')
      );

      // Check summary is updated
      expect(result.summary?.[Stage.MVP_BOUNDARY]).toMatchObject({
        mvpFeatures: ['用户注册', '内容发布', '内容浏览'],
        nonGoals: ['社交分享', '评论系统', '推送通知'],
      });

      // Check response includes MVP and future features
      expect(result.response).toContain('MVP核心功能');
      expect(result.response).toContain('用户注册');
      expect(result.response).toContain('后续版本功能');
      expect(result.response).toContain('社交分享');

      // Check stage flags
      expect(result.currentStage).toBe(Stage.MVP_BOUNDARY);
      expect(result.needMoreInfo).toBe(false);
    });

    it('should format development plan in response', async () => {
      const mockResponse = {
        mvpFeatures: ['功能A'],
        futureFeatures: [],
        devPlan: {
          phase1: ['搭建项目', '实现功能A'],
          phase2: ['优化性能', '用户测试'],
          estimatedComplexity: 'low' as const,
        },
        recommendation: 'OK',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await mvpBoundaryNode(state);

      expect(result.response).toContain('第一阶段：搭建项目、实现功能A');
      expect(result.response).toContain('第二阶段：优化性能、用户测试');
      expect(result.response).toContain('预估复杂度：较低');
    });

    it('should handle response without phase2', async () => {
      const mockResponse = {
        mvpFeatures: ['功能1'],
        futureFeatures: [],
        devPlan: {
          phase1: ['开发功能1'],
          estimatedComplexity: 'high' as const,
        },
        recommendation: 'OK',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await mvpBoundaryNode(state);

      expect(result.response).toContain('第一阶段：开发功能1');
      expect(result.response).not.toContain('第二阶段');
      expect(result.response).toContain('预估复杂度：较高');
    });

    it('should include complexity mapping', async () => {
      const complexities = [
        { input: 'low' as const, expected: '较低' },
        { input: 'medium' as const, expected: '中等' },
        { input: 'high' as const, expected: '较高' },
      ];

      for (const { input, expected } of complexities) {
        const mockResponse = {
          mvpFeatures: [],
          futureFeatures: [],
          devPlan: {
            phase1: ['Dev'],
            estimatedComplexity: input,
          },
          recommendation: 'OK',
        };

        vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

        const state = createMockState({
          profile: createMockProfile(),
        });

        const result = await mvpBoundaryNode(state);

        expect(result.response).toContain(`预估复杂度：${expected}`);
      }
    });
  });

  describe('summary handling', () => {
    it('should preserve existing summary data', async () => {
      const mockResponse = {
        mvpFeatures: ['功能1'],
        futureFeatures: [],
        devPlan: {
          phase1: ['Dev'],
          estimatedComplexity: 'low' as const,
        },
        recommendation: 'OK',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const existingSummary = {
        [Stage.REQUIREMENT_COLLECTION]: { productGoal: 'Test', targetUsers: 'Users', coreFunctions: ['Feature'] },
        [Stage.RISK_ANALYSIS]: { risks: ['Risk'], selectedApproach: 'approach-1' },
        [Stage.TECH_STACK]: { techStack: { category: 'frontend-only' as const, frontend: 'React' }, reasoning: 'Simple' },
      };

      const state = createMockState({
        profile: createMockProfile(),
        summary: existingSummary,
      });

      const result = await mvpBoundaryNode(state);

      // Should preserve existing summaries
      expect(result.summary?.[Stage.REQUIREMENT_COLLECTION]).toEqual({ productGoal: 'Test', targetUsers: 'Users', coreFunctions: ['Feature'] });
      expect(result.summary?.[Stage.RISK_ANALYSIS]).toEqual({ risks: ['Risk'], selectedApproach: 'approach-1' });
      expect(result.summary?.[Stage.TECH_STACK]).toEqual({ techStack: { category: 'frontend-only' as const, frontend: 'React' }, reasoning: 'Simple' });

      // Should add new MVP summary
      expect(result.summary?.[Stage.MVP_BOUNDARY]).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await mvpBoundaryNode(state);

      expect(result.response).toBe('MVP边界定义完成，准备生成开发方案。');
      expect(result.currentStage).toBe(Stage.DOCUMENT_GENERATION);
      expect(result.needMoreInfo).toBe(false);
    });
  });

  describe('LLM interaction', () => {
    it('should include risk analysis and tech stack in context', async () => {
      const mockResponse = {
        mvpFeatures: [],
        futureFeatures: [],
        devPlan: {
          phase1: [],
          estimatedComplexity: 'low' as const,
        },
        recommendation: 'OK',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        summary: {
          [Stage.RISK_ANALYSIS]: {
            risks: ['技术风险', '市场风险'],
            selectedApproach: 'agile',
          },
          [Stage.TECH_STACK]: {
            techStack: { category: 'fullstack', frontend: 'Next.js' },
            reasoning: '全栈方案',
          },
        },
      });

      await mvpBoundaryNode(state);

      const contextArg = vi.mocked(callLLMWithJSONByAgent).mock.calls[0]?.[2];
      expect(contextArg).toContain('风险分析');
      expect(contextArg).toContain('技术选型');
    });
  });

  describe('response generation', () => {
    it('should add transition message at end', async () => {
      const mockResponse = {
        mvpFeatures: ['功能1'],
        futureFeatures: [],
        devPlan: {
          phase1: ['开发'],
          estimatedComplexity: 'low' as const,
        },
        recommendation: '推荐方案',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await mvpBoundaryNode(state);

      expect(result.response).toContain('接下来我将为您生成完整的开发方案文档。');
    });

    it('should include recommendation in response', async () => {
      const mockResponse = {
        mvpFeatures: [],
        futureFeatures: [],
        devPlan: {
          phase1: [],
          estimatedComplexity: 'medium' as const,
        },
        recommendation: '建议采用敏捷开发，分阶段交付',
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await mvpBoundaryNode(state);

      expect(result.response).toContain('建议采用敏捷开发，分阶段交付');
    });
  });
});
