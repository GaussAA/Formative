/**
 * Workflow Integration Tests
 * Tests runWorkflow and continueWorkflow functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runWorkflow, continueWorkflow } from '@/lib/graph/index';
import { Stage } from '@/types';
import type { GraphStateType } from '@/lib/graph/state';

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    agent: vi.fn(),
  },
}));

// Mock all agent nodes
vi.mock('@/lib/agents/extractor', () => ({
  extractorNode: vi.fn(),
}));

vi.mock('@/lib/agents/planner', () => ({
  plannerNode: vi.fn(),
}));

vi.mock('@/lib/agents/asker', () => ({
  askerNode: vi.fn(),
}));

vi.mock('@/lib/agents/risk-analyst', () => ({
  riskAnalystNode: vi.fn(),
}));

vi.mock('@/lib/agents/tech-advisor', () => ({
  techAdvisorNode: vi.fn(),
}));

vi.mock('@/lib/agents/mvp-boundary', () => ({
  mvpBoundaryNode: vi.fn(),
}));

vi.mock('@/lib/agents/spec-generator', () => ({
  specGeneratorNode: vi.fn(),
}));

import { extractorNode } from '@/lib/agents/extractor';
import { plannerNode } from '@/lib/agents/planner';
import { askerNode } from '@/lib/agents/asker';

describe('Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runWorkflow', () => {
    it('should handle needMoreInfo state and route to asker', async () => {
      vi.mocked(extractorNode).mockResolvedValueOnce({
        profile: { projectName: 'Test' },
        missingFields: ['targetUsers'],
        response: 'Need more info',
      });

      vi.mocked(plannerNode).mockResolvedValueOnce({
        completeness: 60,
        missingFields: ['targetUsers'],
        needMoreInfo: true,
        nextQuestion: 'Who are your target users?',
        response: 'Who are your target users?',
        currentStage: Stage.REQUIREMENT_COLLECTION,
      });

      vi.mocked(askerNode).mockResolvedValueOnce({
        response: 'What is your target audience?',
        currentStage: Stage.REQUIREMENT_COLLECTION,
        needMoreInfo: true,
        options: [],
      });

      const result = await runWorkflow('test-session', 'Build app');

      expect(result.needMoreInfo).toBe(true);
      expect(result.currentStage).toBe(Stage.REQUIREMENT_COLLECTION);
      expect(askerNode).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error when workflow fails', async () => {
      vi.mocked(extractorNode).mockRejectedValueOnce(new Error('Extraction failed'));

      await expect(runWorkflow('test-session', 'Build app')).rejects.toThrow('Extraction failed');
    });

    it('should log error on workflow failure', async () => {
      const logger = await import('@/lib/logger');
      vi.mocked(extractorNode).mockRejectedValueOnce(new Error('API Error'));

      try {
        await runWorkflow('test-session', 'Build app');
      } catch {
        // Expected to throw
      }

      expect(logger.default.error).toHaveBeenCalledWith(
        'Workflow execution failed',
        expect.objectContaining({
          sessionId: 'test-session',
          error: 'API Error',
        })
      );
    });

    it('should log error on continueWorkflow failure', async () => {
      const logger = await import('@/lib/logger');
      vi.mocked(extractorNode).mockRejectedValueOnce(new Error('Network error'));

      try {
        await continueWorkflow('test-session', 'Continue');
      } catch {
        // Expected to throw
      }

      expect(logger.default.error).toHaveBeenCalledWith(
        'Failed to continue workflow',
        expect.objectContaining({
          sessionId: 'test-session',
          error: 'Network error',
        })
      );
    });
  });
});
