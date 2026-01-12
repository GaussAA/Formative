/**
 * Database Schema
 * Drizzle ORM schema definitions for SQLite
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Sessions table
 * Stores the core session metadata and state
 */
export const sessions = sqliteTable('sessions', {
  sessionId: text('session_id').primaryKey(),
  projectName: text('project_name'),
  currentStage: integer('current_stage').notNull().default(0),
  completeness: integer('completeness').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  // Profile data stored as JSON for flexibility
  profile: text('profile'), // JSON: RequirementProfile
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  updatedAtIdx: index('sessions_updated_at_idx').on(table.updatedAt),
}));

/**
 * Messages table
 * Stores all chat messages for each session
 */
export const messages = sqliteTable('messages', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().references(() => sessions.sessionId, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  options: text('options'), // JSON: OptionChip[]
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  sessionIdx: index('messages_session_id_idx').on(table.sessionId),
  timestampIdx: index('messages_timestamp_idx').on(table.timestamp),
}));

/**
 * Stage summaries table
 * Stores summary data for each completed stage
 */
export const stageSummaries = sqliteTable('stage_summaries', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().references(() => sessions.sessionId, { onDelete: 'cascade' }),
  stage: integer('stage').notNull(), // Stage enum value
  data: text('data').notNull(), // JSON: Stage-specific summary data
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  sessionStageIdx: index('stage_summaries_session_stage_idx').on(table.sessionId, table.stage),
}));

/**
 * Type exports for query results
 */
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type StageSummary = typeof stageSummaries.$inferSelect;
export type NewStageSummary = typeof stageSummaries.$inferInsert;
