/**
 * Asker Agent Integration Tests
 * Tests the question generation node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { askerNode } from '@/lib/agents/asker';
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
      return 'You are a question generator.';
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

describe('Asker Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('question generation', () => {
    it('should generate a question for missing fields', async () => {
      const mockResponse = {
        message: '您的产品主要面向哪些用户群体？',
        type: 'text' as const,
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile({
          targetUsers: undefined,
        }),
        missingFields: ['目标用户'],
      });

      const result = await askerNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'asker',
        expect.any(String),
        expect.stringContaining('缺失的字段')
      );

      expect(result.response).toBe('您的产品主要面向哪些用户群体？');
      expect(result.askedQuestions).toContain('您的产品主要面向哪些用户群体？');
    });

    it('should generate question with options', async () => {
      const mockResponse = {
        message: '您希望产品的核心功能是什么？',
        type: 'single-choice' as const,
        options: [
          { id: 'opt-1', label: '内容展示', value: 'content' },
          { id: 'opt-2', label: '社交互动', value: 'social' },
          { id: 'opt-3', label: '电商交易', value: 'ecommerce' },
        ],
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        missingFields: ['核心功能'],
      });

      const result = await askerNode(state);

      expect(result.response).toBe('您希望产品的核心功能是什么？');
      expect(result.options).toEqual([
        { id: 'opt-1', label: '内容展示', value: 'content' },
        { id: 'opt-2', label: '社交互动', value: 'social' },
        { id: 'opt-3', label: '电商交易', value: 'ecommerce' },
      ]);
    });

    it('should append new question to askedQuestions', async () => {
      const mockResponse = {
        message: '新的问题？',
        type: 'text' as const,
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        askedQuestions: ['问题1', '问题2'],
      });

      const result = await askerNode(state);

      expect(result.askedQuestions).toEqual(['问题1', '问题2', '新的问题？']);
    });
  });

  describe('context building', () => {
    it('should include missing fields in context', async () => {
      const mockResponse = {
        message: '问题？',
        type: 'text' as const,
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        missingFields: ['产品目标', '目标用户', '核心功能'],
      });

      await askerNode(state);

      const contextArg = vi.mocked(callLLMWithJSONByAgent).mock.calls[0][2];
      expect(contextArg).toContain('缺失的字段：产品目标, 目标用户, 核心功能');
    });

    it('should include current stage in context', async () => {
      const mockResponse = {
        message: '问题？',
        type: 'text' as const,
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        currentStage: Stage.TECH_STACK,
      });

      await askerNode(state);

      const contextArg = vi.mocked(callLLMWithJSONByAgent).mock.calls[0][2];
      expect(contextArg).toContain('当前阶段：3');
    });

    it('should include previously asked questions', async () => {
      const mockResponse = {
        message: '新问题？',
        type: 'text' as const,
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        askedQuestions: ['之前的问题1', '之前的问题2'],
      });

      await askerNode(state);

      const contextArg = vi.mocked(callLLMWithJSONByAgent).mock.calls[0][2];
      expect(contextArg).toContain('已经问过的问题：');
      expect(contextArg).toContain('之前的问题1');
      expect(contextArg).toContain('之前的问题2');
    });
  });

  describe('error handling', () => {
    it('should provide default question for targetUsers when LLM fails', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
        // The code checks if firstMissing includes 'targetUsers'
        missingFields: ['targetUsers - 需要填写'],
      });

      const result = await askerNode(state);

      expect(result.response).toBe('这个产品主要是给谁用的？');
      expect(result.options).toBeUndefined();
      expect(result.askedQuestions).toContain('这个产品主要是给谁用的？');
    });

    it('should provide default question for coreFunctions when LLM fails', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
        // The code checks if firstMissing includes 'coreFunctions'
        missingFields: ['coreFunctions - 需要填写'],
      });

      const result = await askerNode(state);

      expect(result.response).toBe('您希望这个产品有哪些核心功能？');
      expect(result.options).toBeUndefined();
    });

    it('should provide default question with options for needsDataStorage when LLM fails', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
        // The code checks if firstMissing includes 'needsDataStorage'
        missingFields: ['needsDataStorage - 需要填写'],
      });

      const result = await askerNode(state);

      expect(result.response).toBe('用户发布的内容需要保存下来吗？');
      expect(result.options).toEqual([
        { id: 'yes', label: '需要保存', value: 'true' },
        { id: 'no', label: '不需要保存', value: 'false' },
      ]);
    });

    it('should provide generic default question when no specific missing field', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
        missingFields: ['其他字段'],
      });

      const result = await askerNode(state);

      expect(result.response).toBe('请描述一下您的产品目标是什么？');
    });

    it('should append default question to askedQuestions', async () => {
      vi.mocked(callLLMWithJSONByAgent).mockRejectedValueOnce(new Error('API Error'));

      const state = createMockState({
        profile: createMockProfile(),
        missingFields: ['targetUsers - 需要填写'],
        askedQuestions: ['之前的问题'],
      });

      const result = await askerNode(state);

      expect(result.askedQuestions).toEqual(['之前的问题', '这个产品主要是给谁用的？']);
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with asker config', async () => {
      const mockResponse = {
        message: '生成的问题？',
        type: 'text' as const,
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile({
          productName: 'TestApp',
        }),
      });

      await askerNode(state);

      expect(callLLMWithJSONByAgent).toHaveBeenCalledWith(
        'asker',
        expect.any(String),
        expect.stringContaining('TestApp')
      );
    });

    it('should handle empty askedQuestions array', async () => {
      const mockResponse = {
        message: '问题？',
        type: 'text' as const,
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        askedQuestions: [],
      });

      const result = await askerNode(state);

      expect(result.askedQuestions).toEqual(['问题？']);
    });

    it('should handle undefined askedQuestions', async () => {
      const mockResponse = {
        message: '问题？',
        type: 'text' as const,
      };

      vi.mocked(callLLMWithJSONByAgent).mockResolvedValueOnce(mockResponse);

      const state = createMockState({
        profile: createMockProfile(),
        askedQuestions: undefined,
      });

      const result = await askerNode(state);

      expect(result.askedQuestions).toEqual(['问题？']);
    });
  });
});
