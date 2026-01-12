/**
 * Agent Response Schemas
 *
 * 定义所有 Agent 的响应结构 Schema
 * 使用 Zod 进行类型安全的验证
 */

import { z } from 'zod';

/**
 * Option chip for user selection
 */
export const optionChipSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
});

export type OptionChip = z.infer<typeof optionChipSchema>;

/**
 * Extractor Response Schema
 */
export const extractorResponseSchema = z.object({
  extracted: z.object({
    projectName: z.string().optional(),
    productGoal: z.string().optional(),
    targetUsers: z.string().optional(),
    useCases: z.string().optional(),
    coreFunctions: z.array(z.string()).optional(),
    needsDataStorage: z.boolean().optional(),
    needsMultiUser: z.boolean().optional(),
    needsAuth: z.boolean().optional(),
  }),
  missingFields: z.array(z.string()),
  nextQuestion: z.string().optional(),
  options: z.array(optionChipSchema).optional(),
});

export type ExtractorResponse = z.infer<typeof extractorResponseSchema>;

/**
 * Planner Response Schema
 */
export const plannerResponseSchema = z.object({
  completeness: z.number().min(0).max(100),
  checklist: z.object({
    productGoal: z.boolean(),
    targetUsers: z.boolean(),
    useCases: z.boolean(),
    coreFunctions: z.boolean(),
    needsDataStorage: z.boolean(),
    needsMultiUser: z.boolean(),
  }),
  missingCritical: z.array(z.string()),
  canProceed: z.boolean(),
  recommendation: z.string(),
});

export type PlannerResponse = z.infer<typeof plannerResponseSchema>;

/**
 * Asker Response Schema
 */
export const askerResponseSchema = z.object({
  question: z.string(),
  options: z.array(optionChipSchema),
  context: z.string().optional(),
});

export type AskerResponse = z.infer<typeof askerResponseSchema>;

/**
 * Risk Analysis Response Schema
 */
export const riskResponseSchema = z.object({
  risks: z.array(
    z.object({
      category: z.string(),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      mitigation: z.string().optional(),
    })
  ),
  solutions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      approach: z.enum(['conservative', 'balanced', 'aggressive']),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
      estimatedEffort: z.string(),
    })
  ),
  recommendedSolution: z.string(),
  reasoning: z.string(),
});

export type RiskResponse = z.infer<typeof riskResponseSchema>;

/**
 * Tech Stack Response Schema
 */
export const techStackResponseSchema = z.object({
  recommended: z.array(
    z.object({
      category: z.string(),
      options: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          pros: z.array(z.string()),
          cons: z.array(z.string()),
          useCase: z.string(),
        })
      ),
      recommendation: z.string().optional(),
    })
  ),
  architecture: z.enum(['frontend-only', 'frontend-baas', 'fullstack']),
  reasoning: z.string(),
  migrationPath: z.string().optional(),
});

export type TechStackResponse = z.infer<typeof techStackResponseSchema>;

/**
 * MVP Boundary Response Schema
 */
export const mvpBoundaryResponseSchema = z.object({
  coreFeatures: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      priority: z.enum(['must-have', 'should-have', 'nice-to-have']),
      estimatedEffort: z.string(),
      dependencies: z.array(z.string()).optional(),
    })
  ),
  outOfScope: z.array(
    z.object({
      feature: z.string(),
      reason: z.string(),
      suggestedPhase: z.string().optional(),
    })
  ),
  developmentPhases: z.array(
    z.object({
      phase: z.string(),
      duration: z.string(),
      features: z.array(z.string()),
      deliverables: z.array(z.string()),
    })
  ),
  totalEstimatedEffort: z.string(),
});

export type MVPBoundaryResponse = z.infer<typeof mvpBoundaryResponseSchema>;

/**
 * Diagram Response Schema
 */
export const diagramResponseSchema = z.object({
  systemArchitecture: z.string().optional(), // Mermaid diagram
  sequenceDiagram: z.string().optional(), // Mermaid diagram
  dataFlow: z.string().optional(), // Mermaid diagram
  componentDiagram: z.string().optional(), // Mermaid diagram
  explanation: z.string().optional(),
  edgeCases: z.array(z.string()).optional(),
});

export type DiagramResponse = z.infer<typeof diagramResponseSchema>;

/**
 * Spec Generator Response Schema
 */
export const specResponseSchema = z.object({
  document: z.string(), // Markdown document
  metadata: z.object({
    projectName: z.string(),
    version: z.string(),
    generatedAt: z.string(),
    estimatedTokens: z.number().optional(),
  }),
  sections: z.object({
    overview: z.string().optional(),
    productGoals: z.array(z.string()).optional(),
    targetUsers: z.string().optional(),
    mvpFeatures: z.array(z.string()).optional(),
    nonGoals: z.array(z.string()).optional(),
    technicalApproach: z.string().optional(),
    techStack: z
      .array(
        z.object({
          category: z.string(),
          selection: z.string(),
          rationale: z.string(),
        })
      )
      .optional(),
    dataDesign: z.string().optional(),
    interfaces: z.array(z.string()).optional(),
    developmentPlan: z.array(z.string()).optional(),
  }),
});

export type SpecResponse = z.infer<typeof specResponseSchema>;

/**
 * Form Validator Response Schema
 */
export const formValidatorResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
      severity: z.enum(['error', 'warning', 'info']),
    })
  ),
  warnings: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
    })
  ),
  suggestions: z.array(
    z.object({
      field: z.string(),
      suggestion: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    })
  ),
  clarificationNeeded: z.array(z.string()).optional(),
});

export type FormValidatorResponse = z.infer<typeof formValidatorResponseSchema>;

/**
 * All agent schemas mapping
 */
export const agentSchemas = {
  extractor: extractorResponseSchema,
  planner: plannerResponseSchema,
  asker: askerResponseSchema,
  risk: riskResponseSchema,
  tech: techStackResponseSchema,
  mvp: mvpBoundaryResponseSchema,
  diagram: diagramResponseSchema,
  spec: specResponseSchema,
  formValidator: formValidatorResponseSchema,
} as const;

/**
 * Agent schema type
 */
export type AgentSchemaType = keyof typeof agentSchemas;

/**
 * Get schema for agent type
 */
export function getAgentSchema(agentType: AgentSchemaType) {
  return agentSchemas[agentType];
}

/**
 * Get schema type for agent type
 */
export type AgentResponse<T extends AgentSchemaType> = z.infer<(typeof agentSchemas)[T]>;
