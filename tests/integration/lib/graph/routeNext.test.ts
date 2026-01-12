/**
 * Route Function Tests
 * Tests the routeNext function for all stage transitions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { routeNext } from '@/lib/graph/index';
import { END } from '@langchain/langgraph';
import { Stage } from '@/types';
import type { GraphStateType } from '@/lib/graph/state';
import { createMockState } from '../../../mocks/factories';

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

describe('routeNext', () => {
  describe('stop condition', () => {
    it('should return END when stop is true', () => {
      const state = createMockState({
        stop: true,
        currentStage: Stage.REQUIREMENT_COLLECTION,
        needMoreInfo: false,
      });

      expect(routeNext(state)).toBe('__end__');
    });

    it('should return END when stop is true regardless of stage', () => {
      const state = createMockState({
        stop: true,
        currentStage: Stage.TECH_STACK,
        needMoreInfo: false,
      });

      expect(routeNext(state)).toBe('__end__');
    });
  });

  describe('INIT stage', () => {
    it('should route to asker when needMoreInfo is true', () => {
      const state = createMockState({
        currentStage: Stage.INIT,
        needMoreInfo: true,
      });

      expect(routeNext(state)).toBe('asker');
    });

    it('should route to risk_analyst when needMoreInfo is false', () => {
      const state = createMockState({
        currentStage: Stage.INIT,
        needMoreInfo: false,
      });

      expect(routeNext(state)).toBe('risk_analyst');
    });
  });

  describe('REQUIREMENT_COLLECTION stage', () => {
    it('should route to asker when needMoreInfo is true', () => {
      const state = createMockState({
        currentStage: Stage.REQUIREMENT_COLLECTION,
        needMoreInfo: true,
      });

      expect(routeNext(state)).toBe('asker');
    });

    it('should route to risk_analyst when needMoreInfo is false', () => {
      const state = createMockState({
        currentStage: Stage.REQUIREMENT_COLLECTION,
        needMoreInfo: false,
      });

      expect(routeNext(state)).toBe('risk_analyst');
    });
  });

  describe('RISK_ANALYSIS stage', () => {
    it('should route to risk_analyst on first visit (no summary)', () => {
      const state = createMockState({
        currentStage: Stage.RISK_ANALYSIS,
        needMoreInfo: false,
        summary: {},
      });

      expect(routeNext(state)).toBe('risk_analyst');
    });

    it('should route to risk_analyst when summary exists but no risks', () => {
      const state = createMockState({
        currentStage: Stage.RISK_ANALYSIS,
        needMoreInfo: false,
        summary: {
          [Stage.RISK_ANALYSIS]: { risks: [], selectedApproach: 'mvp' },
        },
      });

      expect(routeNext(state)).toBe('risk_analyst');
    });

    it('should route to risk_analyst on first visit (no risks in summary)', () => {
      const state = createMockState({
        currentStage: Stage.RISK_ANALYSIS,
        needMoreInfo: false,
        summary: {
          [Stage.REQUIREMENT_COLLECTION]: { productGoal: 'Test', targetUsers: 'Users', coreFunctions: [] },
        },
      });

      expect(routeNext(state)).toBe('risk_analyst');
    });

    it('should return END when has risks and needMoreInfo is true (waiting for user selection)', () => {
      const state = createMockState({
        currentStage: Stage.RISK_ANALYSIS,
        needMoreInfo: true,
        summary: {
          [Stage.RISK_ANALYSIS]: {
            risks: ['Technical risk', 'Market risk'],
            selectedApproach: '',
          },
        },
      });

      expect(routeNext(state)).toBe('__end__');
    });

    it('should route to tech_advisor when user has selected approach (risks exist, needMoreInfo false)', () => {
      const state = createMockState({
        currentStage: Stage.RISK_ANALYSIS,
        needMoreInfo: false,
        summary: {
          [Stage.RISK_ANALYSIS]: {
            risks: ['Technical risk'],
            selectedApproach: 'mvp-first',
          },
        },
      });

      expect(routeNext(state)).toBe('tech_advisor');
    });
  });

  describe('TECH_STACK stage', () => {
    it('should route to tech_advisor on first visit (no techStack)', () => {
      const state = createMockState({
        currentStage: Stage.TECH_STACK,
        needMoreInfo: false,
        summary: {},
      });

      expect(routeNext(state)).toBe('tech_advisor');
    });

    it('should route to tech_advisor when no techStack or reasoning in summary', () => {
      const state = createMockState({
        currentStage: Stage.TECH_STACK,
        needMoreInfo: false,
        summary: {
          [Stage.RISK_ANALYSIS]: { risks: ['Risk1'], selectedApproach: '' },
        },
      });

      expect(routeNext(state)).toBe('tech_advisor');
    });

    it('should return END when has techStack and needMoreInfo is true (waiting for user selection)', () => {
      const state = createMockState({
        currentStage: Stage.TECH_STACK,
        needMoreInfo: true,
        summary: {
          [Stage.TECH_STACK]: {
            techStack: { category: 'frontend-only', frontend: 'React' },
            reasoning: 'Simple project',
          },
        },
      });

      expect(routeNext(state)).toBe('__end__');
    });

    it('should return END when has reasoning and needMoreInfo is true', () => {
      const state = createMockState({
        currentStage: Stage.TECH_STACK,
        needMoreInfo: true,
        summary: {
          [Stage.TECH_STACK]: {
            techStack: { category: 'frontend-only' as const, frontend: 'React' },
            reasoning: 'Use frontend-only',
          },
        },
      });

      expect(routeNext(state)).toBe('__end__');
    });

    it('should route to mvp_boundary when user has selected tech stack (techStack exists, needMoreInfo false)', () => {
      const state = createMockState({
        currentStage: Stage.TECH_STACK,
        needMoreInfo: false,
        summary: {
          [Stage.TECH_STACK]: {
            techStack: { category: 'fullstack', frontend: 'Next.js', backend: 'Node.js' },
            reasoning: 'Needs backend',
          },
        },
      });

      expect(routeNext(state)).toBe('mvp_boundary');
    });
  });

  describe('MVP_BOUNDARY stage', () => {
    it('should route to mvp_boundary on first visit (no mvpFeatures)', () => {
      const state = createMockState({
        currentStage: Stage.MVP_BOUNDARY,
        needMoreInfo: false,
        summary: {},
      });

      expect(routeNext(state)).toBe('mvp_boundary');
    });

    it('should return END when has mvpFeatures and needMoreInfo is true', () => {
      const state = createMockState({
        currentStage: Stage.MVP_BOUNDARY,
        needMoreInfo: true,
        summary: {
          [Stage.MVP_BOUNDARY]: {
            mvpFeatures: ['Auth', 'Dashboard'],
            nonGoals: ['Analytics', 'Reports'],
          },
        },
      });

      expect(routeNext(state)).toBe('__end__');
    });

    it('should route to spec_generator when mvpFeatures defined and needMoreInfo is false', () => {
      const state = createMockState({
        currentStage: Stage.MVP_BOUNDARY,
        needMoreInfo: false,
        summary: {
          [Stage.MVP_BOUNDARY]: {
            mvpFeatures: ['Feature 1', 'Feature 2'],
            nonGoals: ['Feature 3'],
          },
        },
      });

      expect(routeNext(state)).toBe('spec_generator');
    });
  });

  describe('COMPLETED stage', () => {
    it('should return END', () => {
      const state = createMockState({
        currentStage: Stage.COMPLETED,
        needMoreInfo: false,
      });

      expect(routeNext(state)).toBe('__end__');
    });

    it('should return END even when needMoreInfo is true', () => {
      const state = createMockState({
        currentStage: Stage.COMPLETED,
        needMoreInfo: true,
      });

      expect(routeNext(state)).toBe('__end__');
    });
  });

  describe('DIAGRAM_DESIGN stage', () => {
    it('should return END', () => {
      const state = createMockState({
        currentStage: Stage.DIAGRAM_DESIGN,
        needMoreInfo: false,
      });

      expect(routeNext(state)).toBe('__end__');
    });
  });

  describe('DOCUMENT_GENERATION stage', () => {
    it('should return END', () => {
      const state = createMockState({
        currentStage: Stage.DOCUMENT_GENERATION,
        needMoreInfo: false,
      });

      expect(routeNext(state)).toBe('__end__');
    });
  });

  describe('unknown stage', () => {
    it('should default to asker for unknown stage', () => {
      const state = createMockState({
        currentStage: 999 as Stage,
        needMoreInfo: false,
      });

      expect(routeNext(state)).toBe('asker');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined summary', () => {
      const state = createMockState({
        currentStage: Stage.RISK_ANALYSIS,
        needMoreInfo: false,
        summary: undefined as unknown as Record<number, unknown>,
      });

      expect(routeNext(state)).toBe('risk_analyst');
    });

    it('should handle null summary', () => {
      const state = createMockState({
        currentStage: Stage.TECH_STACK,
        needMoreInfo: false,
        summary: null as unknown as Record<number, unknown>,
      });

      expect(routeNext(state)).toBe('tech_advisor');
    });
  });
});
