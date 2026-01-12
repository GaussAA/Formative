/**
 * Spec Generator Agent Integration Tests
 * Tests the final specification document generation node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { specGeneratorNode } from '@/lib/agents/spec-generator';
import { Stage } from '@/types';
import type { GraphStateType } from '@/lib/graph/state';
import { createMockState, createMockProfile } from '../../../mocks/factories';

// Mock the LLM helper
vi.mock('@/lib/llm/helper', () => ({
  callLLMByAgent: vi.fn(),
  callLLMWithJSONByAgent: vi.fn(),
}));

// Mock prompts
vi.mock('@/lib/prompts', () => ({
  default: {
    async getPrompt() {
      return 'You are a specification writer.';
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

import { callLLMByAgent } from '@/lib/llm/helper';

describe('SpecGenerator Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('specification generation', () => {
    it('should generate final specification document', async () => {
      const mockSpec = `# 开发方案文档

## 1. 项目概述
本项目旨在构建一个AI技术社区平台

## 2. 产品目标
为AI开发者提供交流学习的平台

## 3. 技术方案
使用 Next.js + Supabase 构建

## 9. 开发计划
分两个阶段完成`;

      vi.mocked(callLLMByAgent).mockResolvedValueOnce(mockSpec);

      const state = createMockState({
        profile: createMockProfile(),
        summary: {
          [Stage.REQUIREMENT_COLLECTION]: { productGoal: 'AI社区', targetUsers: '开发者', coreFunctions: ['内容发布', '交流讨论'] },
          [Stage.RISK_ANALYSIS]: { risks: ['技术风险'], selectedApproach: 'mvp' },
          [Stage.TECH_STACK]: { techStack: { category: 'fullstack', frontend: 'Next.js' }, reasoning: '全栈方案' },
          [Stage.MVP_BOUNDARY]: { mvpFeatures: ['注册', '发布'], nonGoals: ['支付功能'] },
        },
      });

      const result = await specGeneratorNode(state);

      expect(callLLMByAgent).toHaveBeenCalledWith(
        'spec',
        expect.any(String),
        expect.stringContaining('请根据以下信息生成开发方案文档')
      );

      // Check final spec is returned
      expect(result.finalSpec).toBe(mockSpec);
      expect(result.summary?.[Stage.DOCUMENT_GENERATION]?.finalSpec).toBe(mockSpec);

      // Check response
      expect(result.response).toContain('开发方案文档已生成');

      // Check stage flags
      expect(result.currentStage).toBe(Stage.COMPLETED);
      expect(result.stop).toBe(true);
      expect(result.needMoreInfo).toBe(false);
    });

    it('should include all stage summaries in context', async () => {
      const mockSpec = '# 文档';
      vi.mocked(callLLMByAgent).mockResolvedValueOnce(mockSpec);

      const state = createMockState({
        profile: createMockProfile(),
        summary: {
          [Stage.REQUIREMENT_COLLECTION]: { productGoal: 'Goal', targetUsers: 'Users', coreFunctions: ['Feature1'] },
          [Stage.RISK_ANALYSIS]: { risks: ['Risk1'], selectedApproach: 'approach-1' },
          [Stage.TECH_STACK]: { techStack: { category: 'frontend-only' as const, frontend: 'React' }, reasoning: '前端框架' },
          [Stage.MVP_BOUNDARY]: { mvpFeatures: ['Feature1'], nonGoals: [] },
        },
      });

      await specGeneratorNode(state);

      const contextArg = vi.mocked(callLLMByAgent).mock.calls[0]?.[2];
      expect(contextArg).toContain('阶段总结');
      // Note: JSON.stringify uses numeric keys for Stage enum
      expect(contextArg).toContain('"1"'); // REQUIREMENT_COLLECTION
      expect(contextArg).toContain('"2"'); // RISK_ANALYSIS
      expect(contextArg).toContain('"3"'); // TECH_STACK
      expect(contextArg).toContain('"4"'); // MVP_BOUNDARY
    });
  });

  describe('summary handling', () => {
    it('should preserve existing summary data', async () => {
      const mockSpec = '# Spec';
      vi.mocked(callLLMByAgent).mockResolvedValueOnce(mockSpec);

      const existingSummary = {
        [Stage.REQUIREMENT_COLLECTION]: { productGoal: 'Test Goal', targetUsers: 'Test Users', coreFunctions: ['Feature'] },
        [Stage.RISK_ANALYSIS]: { risks: ['Risk'], selectedApproach: 'approach-1' },
        [Stage.TECH_STACK]: { techStack: { category: 'frontend-only' as const, frontend: 'React' }, reasoning: '前端框架' },
      };

      const state = createMockState({
        profile: createMockProfile(),
        summary: existingSummary,
      });

      const result = await specGeneratorNode(state);

      // Should preserve all existing summaries
      expect(result.summary?.[Stage.REQUIREMENT_COLLECTION]).toEqual({ productGoal: 'Test Goal', targetUsers: 'Test Users', coreFunctions: ['Feature'] });
      expect(result.summary?.[Stage.RISK_ANALYSIS]).toEqual({ risks: ['Risk'], selectedApproach: 'approach-1' });
      expect(result.summary?.[Stage.TECH_STACK]).toEqual({ techStack: { category: 'frontend-only' as const, frontend: 'React' }, reasoning: '前端框架' });

      // Should add new documentation summary
      expect(result.summary?.[Stage.DOCUMENT_GENERATION]?.finalSpec).toBe('# Spec');
    });

    it('should store final spec in DOCUMENT_GENERATION stage summary', async () => {
      const mockSpec = '# 完整开发方案';
      vi.mocked(callLLMByAgent).mockResolvedValueOnce(mockSpec);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await specGeneratorNode(state);

      expect(result.summary?.[Stage.DOCUMENT_GENERATION]).toEqual({
        finalSpec: '# 完整开发方案',
      });
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      vi.mocked(callLLMByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await specGeneratorNode(state);

      expect(result.response).toBe('文档生成失败，请稍后重试。');
      expect(result.stop).toBe(true);
      expect(result.currentStage).toBeUndefined();
      expect(result.finalSpec).toBeUndefined();
    });

    it('should set stop flag even on error', async () => {
      vi.mocked(callLLMByAgent).mockRejectedValueOnce(new Error('Network error'));

      const state = createMockState({
        profile: createMockProfile(),
        stop: false,
      });

      const result = await specGeneratorNode(state);

      expect(result.stop).toBe(true);
    });
  });

  describe('final stage transition', () => {
    it('should transition to COMPLETED stage', async () => {
      const mockSpec = '# Final Spec';
      vi.mocked(callLLMByAgent).mockResolvedValueOnce(mockSpec);

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.MVP_BOUNDARY,
        stop: false,
      });

      const result = await specGeneratorNode(state);

      expect(result.currentStage).toBe(Stage.COMPLETED);
      expect(result.stop).toBe(true);
    });

    it('should set needMoreInfo to false', async () => {
      const mockSpec = '# Spec';
      vi.mocked(callLLMByAgent).mockResolvedValueOnce(mockSpec);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await specGeneratorNode(state);

      expect(result.needMoreInfo).toBe(false);
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with spec config', async () => {
      const mockSpec = '# Spec';
      vi.mocked(callLLMByAgent).mockResolvedValueOnce(mockSpec);

      const state = createMockState({
        profile: createMockProfile({
          projectName: 'TestProject',
        }),
      });

      await specGeneratorNode(state);

      expect(callLLMByAgent).toHaveBeenCalledWith(
        'spec',
        expect.any(String),
        expect.stringContaining('TestProject')
      );
    });

    it('should use callLLMByAgent (not JSON)', async () => {
      const mockSpec = '# Spec';
      vi.mocked(callLLMByAgent).mockResolvedValueOnce(mockSpec);

      const state = createMockState({
        profile: createMockProfile(),
      });

      await specGeneratorNode(state);

      // Verify it's called (not checking for JSON parsing)
      expect(callLLMByAgent).toHaveBeenCalled();
    });
  });

  describe('response message', () => {
    it('should return completion message', async () => {
      const mockSpec = '# Complete Spec';
      vi.mocked(callLLMByAgent).mockResolvedValueOnce(mockSpec);

      const state = createMockState({
        profile: createMockProfile(),
      });

      const result = await specGeneratorNode(state);

      expect(result.response).toBe('开发方案文档已生成！您可以复制下面的文档，直接交给AI进行开发。');
    });
  });
});
