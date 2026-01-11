/**
 * Input Validator Middleware
 *
 * Provides Zod-based request validation with security checks
 * to prevent injection attacks and ensure data integrity.
 */

import { z } from 'zod';
import { NextRequest } from 'next/server';
import logger from '@/lib/logger';

/**
 * UUID validation schema
 */
const UUIDSchema = z.string().uuid();

/**
 * Chat message input schema
 */
export const chatInputSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message too long (max 10000 characters)')
    // Prevent potential injection attacks
    .transform(val => val.trim())
    .refine(
      val => !/<script[^>]*>.*?<\/script>/i.test(val),
      'Script tags are not allowed'
    )
    .refine(
      val => !/javascript:/i.test(val),
      'JavaScript URLs are not allowed'
    )
    .refine(
      val => !/on\w+\s*=/i.test(val),
      'Inline event handlers are not allowed'
    ),
  sessionId: z.string().uuid().nullish(),
  stream: z.boolean().optional().default(false),
});

/**
 * Form submit input schema
 */
export const formSubmitSchema = z.object({
  profile: z.object({
    projectName: z.string().min(1).max(200).optional(),
    productGoal: z.string().min(1).max(1000).optional(),
    targetUsers: z.string().min(1).max(1000).optional(),
    useCases: z.array(z.string().max(500)).optional(),
    coreFunctions: z.array(z.string().max(500)).optional(),
    needsDataStorage: z.boolean().optional(),
    needsMultiUser: z.boolean().optional(),
    needsAuth: z.boolean().optional(),
  }),
  sessionId: UUIDSchema.optional(),
});

/**
 * Risk analysis input schema
 */
export const riskAnalysisSchema = z.object({
  profile: z.object({
    projectName: z.string().min(1).max(200),
    productGoal: z.string().min(1).max(1000),
    targetUsers: z.string().min(1).max(1000),
  }).passthrough(),
  sessionId: UUIDSchema.optional(),
});

/**
 * Tech stack input schema
 */
export const techStackSchema = z.object({
  profile: z.object({
    projectName: z.string().min(1).max(200),
    productGoal: z.string().min(1).max(1000),
  }).passthrough(),
  riskApproach: z.string().min(1).max(5000).optional(),
  userPreferences: z.object({
    frontend: z.string().optional(),
    backend: z.string().optional(),
    database: z.string().optional(),
  }).optional(),
  sessionId: UUIDSchema.optional(),
});

/**
 * MVP plan input schema
 */
export const mvpPlanSchema = z.object({
  profile: z.object({
    projectName: z.string().min(1).max(200),
  }).passthrough(),
  techStack: z.object({
    category: z.string(),
    frontend: z.string().optional(),
    backend: z.string().optional(),
    database: z.string().optional(),
  }),
  sessionId: UUIDSchema.optional(),
});

/**
 * Diagram generation input schema
 */
export const diagramSchema = z.object({
  requirement: z.string().min(1).max(5000),
  techStack: z.object({
    category: z.string(),
    frontend: z.string().optional(),
    backend: z.string().optional(),
  }),
  mvpFeatures: z.array(z.object({
    name: z.string(),
    inMVP: z.boolean(),
  })).optional(),
  sessionId: UUIDSchema.optional(),
});

/**
 * Diagram update input schema
 */
export const diagramUpdateSchema = z.object({
  diagramType: z.enum(['architecture', 'sequence']),
  currentMermaidCode: z.string().min(1),
  userRequest: z.string().min(1).max(1000),
  sessionId: UUIDSchema.optional(),
});

/**
 * Spec generation input schema
 */
export const specSchema = z.object({
  requirement: z.string().min(1).max(5000),
  riskApproach: z.string().min(1).max(5000),
  techStack: z.object({
    category: z.string(),
    frontend: z.string().optional(),
    backend: z.string().optional(),
    database: z.string().optional(),
  }),
  mvpBoundary: z.object({
    features: z.array(z.any()),
  }),
  diagrams: z.object({
    architectureDiagram: z.string().optional(),
    sequenceDiagram: z.string().optional(),
  }),
  sessionId: UUIDSchema.optional(),
});

/**
 * Validation error response
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate request body against schema
 * @param schema - Zod schema to validate against
 * @param body - Request body to validate
 * @returns Validated data or throws validation error
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: ValidationError[] = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      logger.warn('Request validation failed', {
        errors,
        input: typeof body === 'object' ? JSON.stringify(body).substring(0, 500) : body,
      });

      throw new ValidationErrorException(errors);
    }
    throw error;
  }
}

/**
 * Validation error exception
 */
export class ValidationErrorException extends Error {
  public errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationErrorException';
    this.errors = errors;
  }

  /**
   * Convert to API response format
   */
  toJSON() {
    return {
      error: true,
      message: 'Request validation failed',
      details: this.errors,
    };
  }
}

/**
 * Extract and validate request body
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Validated data
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return validateRequest(schema, body);
  } catch (error) {
    if (error instanceof ValidationErrorException) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      logger.warn('Invalid JSON in request body', {
        url: request.url,
      });
      throw new ValidationErrorException([
        { field: 'body', message: 'Invalid JSON format' },
      ]);
    }
    throw error;
  }
}

/**
 * Sanitize HTML content (basic XSS prevention)
 */
export function sanitizeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Check for SQL injection patterns (basic)
 */
export function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /\b(select|insert|update|delete|drop|union|exec|script)\b/i,
    /'(\s*)(--|;|or|and)/i,
    /['"]\s*(or|and)\s+/i,
    /;\s*(drop|delete|update|insert)\b/i,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for NoSQL injection patterns
 */
export function containsNoSQLInjection(input: string): boolean {
  const nosqlPatterns = [
    /\$where/i,
    /\$ne/i,
    /\$gt/i,
    /\$lt/i,
    /\{.*\$.*\}/,
  ];

  return nosqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Comprehensive security check
 */
export function securityCheck(input: string): { safe: boolean; reason?: string } {
  if (containsSQLInjection(input)) {
    return { safe: false, reason: 'Potential SQL injection detected' };
  }

  if (containsNoSQLInjection(input)) {
    return { safe: false, reason: 'Potential NoSQL injection detected' };
  }

  if (/<script[^>]*>.*?<\/script>/i.test(input)) {
    return { safe: false, reason: 'Script tags are not allowed' };
  }

  if (/javascript:/i.test(input)) {
    return { safe: false, reason: 'JavaScript URLs are not allowed' };
  }

  return { safe: true };
}

/**
 * Export all schemas for use in API routes
 */
export const schemas = {
  chat: chatInputSchema,
  formSubmit: formSubmitSchema,
  riskAnalysis: riskAnalysisSchema,
  techStack: techStackSchema,
  mvpPlan: mvpPlanSchema,
  diagram: diagramSchema,
  diagramUpdate: diagramUpdateSchema,
  spec: specSchema,
};
