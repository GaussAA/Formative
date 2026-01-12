/**
 * Database Seed Script
 * Populates the database with sample data for development and testing
 */

import { initDatabase, saveDatabase, closeDatabase } from '@/db/connection';
import { sessions, messages, stageSummaries } from '@/db/schema';
import type { RequirementProfile, StagesSummary, Stage } from '@/types';
import logger from '@/lib/logger';

// Alias to avoid variable shadowing
const messagesTable = messages;

/**
 * Sample requirement profiles for testing
 */
const SAMPLE_PROFILES: Record<string, RequirementProfile> = {
  todo_app: {
    projectName: 'Todo App',
    productGoal: 'Help users manage their daily tasks efficiently',
    targetUsers: 'Busy professionals who need task tracking',
    useCases: 'Add, edit, delete, and organize daily tasks',
    coreFunctions: ['Task CRUD', 'Categories', 'Due dates', 'Priority levels'],
    needsDataStorage: true,
    needsMultiUser: false,
    needsAuth: true,
    selectedTechStack: {
      category: 'fullstack',
      frontend: 'React',
      backend: 'Node.js',
      database: 'SQLite',
    },
  },
  weather_dashboard: {
    projectName: 'Weather Dashboard',
    productGoal: 'Display weather information for multiple cities',
    targetUsers: 'General users who want quick weather updates',
    useCases: 'Search cities, view current weather, see forecasts',
    coreFunctions: ['City search', 'Current weather', '5-day forecast', 'Location-based'],
    needsDataStorage: false,
    needsMultiUser: false,
    needsAuth: false,
    selectedTechStack: {
      category: 'frontend-only',
      frontend: 'React',
    },
  },
  blog_platform: {
    projectName: 'Blog Platform',
    productGoal: 'Allow writers to publish and manage blog posts',
    targetUsers: 'Content creators and bloggers',
    useCases: 'Write posts, manage drafts, publish content, moderate comments',
    coreFunctions: ['Rich text editor', 'Draft management', 'Publishing', 'Comments'],
    needsDataStorage: true,
    needsMultiUser: true,
    needsAuth: true,
    selectedTechStack: {
      category: 'fullstack',
      frontend: 'React',
      backend: 'Node.js',
      database: 'PostgreSQL',
    },
  },
};

/**
 * Sample stage summaries for testing
 */
const SAMPLE_STAGE_SUMMARIES: Record<string, StagesSummary> = {
  todo_app: {
    1: { // REQUIREMENT_COLLECTION
      productGoal: 'Help users manage their daily tasks efficiently',
      targetUsers: 'Busy professionals who need task tracking',
      coreFunctions: ['Task CRUD', 'Categories', 'Due dates', 'Priority levels'],
    },
    2: { // RISK_ANALYSIS
      risks: ['Data loss', 'Sync conflicts', 'Performance at scale'],
      selectedApproach: 'Use SQLite with WAL mode, implement conflict resolution',
    },
    3: { // TECH_STACK
      techStack: {
        category: 'fullstack',
        frontend: 'React',
        backend: 'Node.js',
        database: 'SQLite',
      },
      reasoning: 'React for component reusability, Node.js for backend API, SQLite for simplicity',
    },
  },
  weather_dashboard: {
    1: {
      productGoal: 'Display weather information for multiple cities',
      targetUsers: 'General users who want quick weather updates',
      coreFunctions: ['City search', 'Current weather', '5-day forecast', 'Location-based'],
    },
    2: {
      risks: ['API rate limits', ' inaccurate data', 'CORS issues'],
      selectedApproach: 'Use caching, implement fallback APIs, add proxy server',
    },
    3: {
      techStack: {
        category: 'frontend-only',
        frontend: 'React',
      },
      reasoning: 'No backend needed, using public weather APIs with client-side fetching',
    },
  },
};

/**
 * Sample messages for testing
 */
const SAMPLE_MESSAGES: Record<string, Array<{ role: string; content: string }>> = {
  todo_app: [
    { role: 'system', content: 'You are a helpful assistant that helps users plan their software projects.' },
    { role: 'user', content: 'I want to build a todo app' },
    { role: 'assistant', content: 'Great! Let me help you plan your todo app. What is the main goal of your application?' },
    { role: 'user', content: 'Help users manage their daily tasks efficiently' },
  ],
  weather_dashboard: [
    { role: 'system', content: 'You are a helpful assistant that helps users plan their software projects.' },
    { role: 'user', content: 'I want to build a weather dashboard' },
    { role: 'assistant', content: 'Interesting! What should the dashboard display?' },
    { role: 'user', content: 'Weather information for multiple cities' },
  ],
};

/**
 * Seed the database with sample data
 */
export async function seedDatabase(): Promise<void> {
  try {
    logger.info('Starting database seed...');

    const { getDb } = await import('@/db/connection');
    const db = await getDb();

    // Clear existing data
    logger.info('Clearing existing data...');
    await db.delete(stageSummaries);
    await db.delete(messagesTable);
    await db.delete(sessions);
    logger.info('Existing data cleared');

    // Seed sessions
    const now = new Date();
    const sessionIds: string[] = [];

    for (const [key, profile] of Object.entries(SAMPLE_PROFILES)) {
      const sessionId = `seed-${key}-${Date.now()}`;
      sessionIds.push(sessionId);

      await db.insert(sessions).values({
        sessionId,
        projectName: profile.projectName,
        currentStage: 3, // TECH_STACK
        completeness: 60,
        completed: false,
        profile: JSON.stringify(profile),
        createdAt: new Date(now.getTime() - sessionIds.length * 86400000), // Staggered dates
        updatedAt: now,
      });

      logger.info(`Created session: ${sessionId} (${profile.projectName})`);
    }

    // Seed messages
    for (let i = 0; i < sessionIds.length; i++) {
      const sessionId = sessionIds[i];
      const key = sessionId.split('-')[1]; // todo_app, weather_dashboard, etc.
      const sampleMessages = SAMPLE_MESSAGES[key];

      if (sampleMessages) {
        for (const msg of sampleMessages) {
          await db.insert(messagesTable).values({
            sessionId,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: new Date(now.getTime() - (sampleMessages.length - i) * 60000),
          });
        }
        logger.info(`Created ${sampleMessages.length} messages for session: ${sessionId}`);
      }
    }

    // Seed stage summaries
    for (let i = 0; i < sessionIds.length; i++) {
      const sessionId = sessionIds[i];
      const key = sessionId.split('-')[1];
      const summaries = SAMPLE_STAGE_SUMMARIES[key];

      if (summaries) {
        for (const [stage, data] of Object.entries(summaries)) {
          await db.insert(stageSummaries).values({
            sessionId,
            stage: parseInt(stage) as Stage,
            data: JSON.stringify(data),
            createdAt: now,
            updatedAt: now,
          });
        }
        logger.info(`Created ${Object.keys(summaries).length} stage summaries for session: ${sessionId}`);
      }
    }

    // Save database
    saveDatabase();

    logger.info(`Database seed completed successfully!`);
    logger.info(`Created ${sessionIds.length} sessions with sample data`);
  } catch (error) {
    logger.error('Database seed failed', { error });
    throw error;
  }
}

/**
 * Reset and reseed the database
 * Clears all data and adds fresh seed data
 */
export async function reseedDatabase(): Promise<void> {
  try {
    logger.info('Reseeding database...');
    await seedDatabase();
    await closeDatabase();
    logger.info('Database reseed completed');
  } catch (error) {
    logger.error('Database reseed failed', { error });
    await closeDatabase();
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  (async () => {
    await seedDatabase();
    await closeDatabase();
    // Add delay for libuv cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));
    process.exit(0);
  })().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}
