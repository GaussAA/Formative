/**
 * Tech Advisor Agent Integration Tests
 * Tests the technology stack recommendation node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { techAdvisorNode } from '@/lib/agents/tech-advisor';
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
      return 'You are a tech advisor.';
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

describe('TechAdvisor Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tech stack recommendations', () => {
    it('should provide tech stack options', async () => {
      const mockResponse = {
        recommendedCategory: 'frontend-only',
        reasoning: '由于需求简单，建议使用纯前端方案',
        options: [
          {
            id: 'react-static',
            label: 'React 静态站点',
            category: 'frontend-only',
            stack: {
              frontend: 'React',
              deployment: 'Vercel',
            },
            pros: ['简单', '快速', '成本低'],
            cons: ['功能有限'],
            suitableFor: '简单展示类应用',
            evolutionCost: '低',
            recommended: true,
          },
          {
            id: 'vue-static',
            label: 'Vue 静态站点',
            category: 'frontend-only',
            stack: {
              frontend: 'Vue',
              deployment: 'Netlify',
            },
            pros: ['轻量', '易上手'],
            cons: ['生态较小'],
            suitableFor: '简单应用',
            evolutionCost: '低',
          },
        ],
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        summary: {
          [Stage.RISK_ANALYSIS]: {
            risks: ['技术风险'],
            selectedApproach: 'mvp-first',
          },
        },
      });

      const result = await techAdvisorNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'tech',
        expect.any(String),
        expect.stringContaining('需求画像')
      );

      // Check summary is updated
      expect(result.summary?.[Stage.TECH_STACK]).toMatchObject({
        techStack: {
          category: 'frontend-only',
          frontend: 'React',
          // Note: deployment is NOT included in the summary by the actual code
        },
        reasoning: '由于需求简单，建议使用纯前端方案',
      });

      // Check response message
      expect(result.response).toContain('frontend-only');
      expect(result.response).toContain('由于需求简单，建议使用纯前端方案');

      // Check options
      expect(result.options).toHaveLength(2);
      expect(result.options?.[0]).toMatchObject({
        id: 'react-static',
        label: 'React 静态站点',
        value: JSON.stringify({ frontend: 'React', deployment: 'Vercel' }),
      });

      // Check stage flags
      expect(result.currentStage).toBe(Stage.TECH_STACK);
      expect(result.needMoreInfo).toBe(true);
    });

    it('should recommend fullstack option', async () => {
      const mockResponse = {
        recommendedCategory: 'fullstack',
        reasoning: '需要后端支持，建议使用全栈方案',
        options: [
          {
            id: 'nextjs-fullstack',
            label: 'Next.js 全栈',
            category: 'fullstack',
            stack: {
              frontend: 'Next.js',
              backend: 'Node.js',
              database: 'PostgreSQL',
              deployment: 'Vercel',
            },
            pros: ['完整解决方案', '生态成熟'],
            cons: ['复杂度较高'],
            suitableFor: '复杂应用',
            evolutionCost: '中',
            recommended: true,
          },
        ],
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile({
          needsMultiUser: true,
          needsAuth: true,
          needsDataStorage: true,
        }),
      });

      const result = await techAdvisorNode(state);

      expect(result.summary?.[Stage.TECH_STACK]?.techStack).toMatchObject({
        category: 'fullstack',
        frontend: 'Next.js',
        backend: 'Node.js',
        database: 'PostgreSQL',
        // Note: deployment is NOT included in summary
      });
    });

    it('should serialize tech stack to JSON in option value', async () => {
      const mockResponse = {
        recommendedCategory: 'baas',
        reasoning: '使用 BaaS 方案',
        options: [
          {
            id: 'supabase-option',
            label: 'Supabase 方案',
            category: 'baas',
            stack: {
              frontend: 'React',
              backend: 'Supabase',
              database: 'Supabase',
              deployment: 'Vercel',
            },
            pros: [],
            cons: [],
            suitableFor: '快速开发',
            evolutionCost: '中',
          },
        ],
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await techAdvisorNode(state);

      expect(result.options?.[0]?.value).toBe(
        JSON.stringify({
          frontend: 'React',
          backend: 'Supabase',
          database: 'Supabase',
          deployment: 'Vercel',
        })
      );
    });
  });

  describe('summary handling', () => {
    it('should preserve existing summary data', async () => {
      const mockResponse = {
        recommendedCategory: 'frontend-only',
        reasoning: 'Simple',
        options: [
          {
            id: 'react',
            label: 'React',
            category: 'frontend-only',
            stack: { frontend: 'React', deployment: 'Vercel' },
            pros: [],
            cons: [],
            suitableFor: 'Simple',
            evolutionCost: 'Low',
          },
        ],
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const existingSummary = {
        [Stage.REQUIREMENT_COLLECTION]: { productGoal: 'Test', targetUsers: 'Users', coreFunctions: ['Feature'] },
        [Stage.RISK_ANALYSIS]: { risks: ['Risk 1'], selectedApproach: 'approach-1' },
      };

      const state = createMockState({
        profile: createMockProfile(),
        summary: existingSummary,
      });

      const result = await techAdvisorNode(state);

      // Should preserve existing summaries
      expect(result.summary?.[Stage.REQUIREMENT_COLLECTION]).toEqual({ productGoal: 'Test', targetUsers: 'Users', coreFunctions: ['Feature'] });
      expect(result.summary?.[Stage.RISK_ANALYSIS]).toEqual({ risks: ['Risk 1'], selectedApproach: 'approach-1' });

      // Should add new tech stack summary
      expect(result.summary?.[Stage.TECH_STACK]).toBeDefined();
    });

    it('should include risk analysis in LLM context', async () => {
      const mockResponse = {
        recommendedCategory: 'frontend-only',
        reasoning: 'OK',
        options: [],
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        summary: {
          [Stage.RISK_ANALYSIS]: {
            risks: ['技术风险', '市场风险'],
            selectedApproach: 'mvp-first',
          },
        },
      });

      await techAdvisorNode(state);

      const contextArg = vi.mocked(callLLMWithJSONByAgent).mock.calls[0]?.[2];
      expect(contextArg).toContain('风险分析总结');
      expect(contextArg).toContain('技术风险');
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await techAdvisorNode(state);

      expect(result.response).toBe('建议使用Next.js + Supabase快速搭建MVP。');
      expect(result.currentStage).toBe(Stage.MVP_BOUNDARY);
      expect(result.needMoreInfo).toBe(false);
    });

    it('should transition to MVP_BOUNDARY on error', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('Network error'));

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.RISK_ANALYSIS,
      });

      const result = await techAdvisorNode(state);

      expect(result.currentStage).toBe(Stage.MVP_BOUNDARY);
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with tech config', async () => {
      const mockResponse = {
        recommendedCategory: 'frontend-only',
        reasoning: 'OK',
        options: [],
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile({
          projectName: 'MyApp',
          coreFunctions: ['Feature 1', 'Feature 2'],
        }),
      });

      await techAdvisorNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'tech',
        expect.any(String),
        expect.stringContaining('MyApp')
      );
    });
  });
});
