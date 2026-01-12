/**
 * Schemas Module - Unified Export
 *
 * 导出所有 Schema 相关功能
 */

// Schema registry and types
export { default as schemaRegistry } from './schema-registry';
export { SchemaRegistry } from './schema-registry';
export type {
  RegisteredSchema,
  SchemaValidationResult,
} from './schema-registry';

// Agent schemas
export {
  agentSchemas,
  getAgentSchema,
  optionChipSchema,
  extractorResponseSchema,
  plannerResponseSchema,
  askerResponseSchema,
  riskResponseSchema,
  techStackResponseSchema,
  mvpBoundaryResponseSchema,
  diagramResponseSchema,
  specResponseSchema,
  formValidatorResponseSchema,
} from './agent-schemas';
export type {
  OptionChip,
  ExtractorResponse,
  PlannerResponse,
  AskerResponse,
  RiskResponse,
  TechStackResponse,
  MVPBoundaryResponse,
  DiagramResponse,
  SpecResponse,
  FormValidatorResponse,
  AgentSchemaType,
  AgentResponse,
} from './agent-schemas';
