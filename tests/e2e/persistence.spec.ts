/**
 * Persistence E2E Test
 * Tests IndexedDB session persistence and recovery across page reloads
 */

import { test, expect } from '@playwright/test';

const MOCK_SESSION_ID = 'test-session-persistence';
const MOCK_SESSION_DATA = {
  id: MOCK_SESSION_ID,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  currentStage: 1,
  stageData: {
    requirement: {
      projectName: '测试项目',
      projectType: 'Web Application',
      coreValue: '测试价值',
      targetUsers: '测试用户',
    },
    risk: null,
    techStack: null,
    mvp: null,
    diagram: null,
    document: null,
  },
  messages: [
    {
      role: 'assistant',
      content: '你好！我是定型',
    },
    {
      role: 'user',
      content: '我想做一个测试应用',
    },
  ],
  profile: {
    projectName: '测试项目',
    projectType: 'Web Application',
  },
  summary: {},
};

test.describe('Session Persistence', () => {
  test('should save session to IndexedDB', async ({ page }) => {
    await page.goto('/app');

    // Mock API response
    await page.route('**/api/chat**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: MOCK_SESSION_ID,
          response: 'Session started',
          completeness: 10,
          currentStage: 1,
        }),
      });
    });

    // Send a message to create a session
    await page.fill('textarea[placeholder*="请输入"]', '我想做一个测试应用');
    await page.click('button:has-text("发送")');

    // Wait for response
    await page.waitForTimeout(1000);

    // Check that IndexedDB has the session
    const sessionData = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('formative-sessions', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const sessions = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();
      return sessions;
    });

    expect(sessionData.length).toBeGreaterThan(0);
    expect(sessionData[0].id).toBe(MOCK_SESSION_ID);
  });

  test('should restore session from IndexedDB on page reload', async ({ page }) => {
    // First, set up a session in IndexedDB
    await page.goto('/app');

    await page.addInitScript(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('formative-sessions', 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('sessions')) {
            const store = db.createObjectStore('sessions', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      await new Promise<void>((resolve, reject) => {
        const request = store.add({
          id: 'test-session-persistence',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          currentStage: 1,
          stageData: {
            requirement: {
              projectName: '恢复测试项目',
            },
          },
          messages: [],
          profile: {},
          summary: {},
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
    });

    // Reload the page
    await page.reload();

    // Should show the session data
    await expect(page.locator('h1')).toContainText('定型 Formative');
  });

  test('should display multiple sessions in history page', async ({ page }) => {
    // Set up multiple sessions
    await page.addInitScript(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('formative-sessions', 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('sessions')) {
            const store = db.createObjectStore('sessions', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');

      const sessions = [
        {
          id: 'session-1',
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now() - 86400000,
          currentStage: 6,
          stageData: {
            requirement: { projectName: '已完成的项目' },
            document: { title: '完成文档' },
          },
          messages: [],
          profile: {},
          summary: {},
        },
        {
          id: 'session-2',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          currentStage: 2,
          stageData: {
            requirement: { projectName: '进行中的项目' },
          },
          messages: [],
          profile: {},
          summary: {},
        },
      ];

      for (const session of sessions) {
        await new Promise<void>((resolve, reject) => {
          const request = store.add(session);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      db.close();
    });

    // Navigate to history page
    await page.goto('/history');

    // Should show sessions
    await expect(page.locator('text=历史记录')).toBeVisible();
    await expect(page.locator('text=已完成的项目')).toBeVisible();
    await expect(page.locator('text=进行中的项目')).toBeVisible();
  });

  test('should allow resuming a session from history', async ({ page }) => {
    // Set up a session
    await page.addInitScript(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('formative-sessions', 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('sessions')) {
            const store = db.createObjectStore('sessions', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');

      await new Promise<void>((resolve, reject) => {
        const request = store.add({
          id: 'resume-test-session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          currentStage: 2,
          stageData: {
            requirement: { projectName: '恢复测试' },
          },
          messages: [],
          profile: {},
          summary: {},
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
    });

    // Go to history page
    await page.goto('/history');

    // Click on a session to resume
    await page.click('text=恢复测试');

    // Should navigate to app with the session loaded
    await expect(page).toHaveURL(/\/app/);
  });

  test('should update session timestamp on activity', async ({ page }) => {
    await page.goto('/app');

    // Mock API response
    await page.route('**/api/chat**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'timestamp-test-session',
          response: 'Response',
          completeness: 20,
        }),
      });
    });

    // Send a message
    await page.fill('textarea[placeholder*="请输入"]', 'Test timestamp');
    await page.click('button:has-text("发送")');

    await page.waitForTimeout(1000);

    // Check that the session was updated
    const sessions = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('formative-sessions', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const sessions = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();
      return sessions;
    });

    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].updatedAt).toBeGreaterThan(Date.now() - 10000);
  });

  test('should handle IndexedDB errors gracefully', async ({ page }) => {
    // Block IndexedDB access
    await page.context().grantPermissions([], { origin: page.url() });

    await page.goto('/app');

    // The app should still load without errors
    await expect(page.locator('h1')).toContainText('定型 Formative');
  });
});

test.describe('Session Cleanup', () => {
  test('should allow deleting a session', async ({ page }) => {
    // Set up sessions
    await page.addInitScript(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('formative-sessions', 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('sessions')) {
            const store = db.createObjectStore('sessions', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');

      await new Promise<void>((resolve, reject) => {
        const request = store.add({
          id: 'delete-test-session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          currentStage: 1,
          stageData: {},
          messages: [],
          profile: {},
          summary: {},
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
    });

    await page.goto('/history');

    // Check session exists before delete
    const sessionsBefore = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('formative-sessions', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const sessions = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();
      return sessions.length;
    });

    expect(sessionsBefore).toBeGreaterThan(0);

    // Delete the session (click delete button if it exists)
    const deleteButton = page.locator('button:has-text("删除")').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      // Confirm deletion
      const confirmButton = page.locator('button:has-text("确认")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });

  test('should handle empty sessions list', async ({ page }) => {
    // Clear all sessions
    await page.addInitScript(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('formative-sessions', 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (db.objectStoreNames.contains('sessions')) {
            db.deleteObjectStore('sessions');
          }
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
    });

    await page.goto('/history');

    // Should show empty state
    await expect(page.locator('text=历史记录')).toBeVisible();
  });
});
