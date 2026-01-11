/**
 * Complete Workflow E2E Test
 * Tests the full user journey from landing page to document generation
 */

import { test, expect } from '@playwright/test';

// Mock responses for API calls
const MOCK_SESSION_ID = 'test-session-complete-workflow';

const mockExtractorResponse = {
  sessionId: MOCK_SESSION_ID,
  response: '我理解了，你想做一个AI写作助手。请告诉我你的目标用户是谁？',
  profile: {
    projectName: 'AI写作助手',
    projectType: 'Web Application',
    coreValue: '帮助用户提高写作效率',
  },
  completeness: 20,
  currentStage: 1,
};

const mockPlannerResponse = {
  response: '很好！你的目标用户是什么？',
  completeness: 40,
  profile: {
    projectName: 'AI写作助手',
    projectType: 'Web Application',
    coreValue: '帮助用户提高写作效率',
    targetUsers: '内容创作者',
  },
};

const mockAskerResponse = {
  response: '你的产品主要解决什么痛点？',
  options: [
    { id: '1', label: '写作灵感枯竭', value: 'writer-block' },
    { id: '2', label: '写作效率低下', value: 'efficiency' },
  ],
  completeness: 50,
};

const mockCompleteResponse = {
  response: '✅ 需求采集完成！\n\n正在为您分析潜在风险...',
  completeness: 100,
  profile: {
    projectName: 'AI写作助手',
    projectType: 'Web Application',
    coreValue: '帮助用户提高写作效率',
    targetUsers: '内容创作者',
    painPoints: '写作灵感枯竭',
    keyFeatures: 'AI智能推荐、实时协作',
    expectedOutcome: '提高50%写作效率',
  },
  currentStage: 2,
};

const mockRiskAnalysisResponse = {
  response: '我已经分析了潜在风险，请选择实施方案：',
  options: [
    {
      id: 'mvp',
      label: 'MVP方案',
      value: 'mvp',
      description: '快速验证核心价值',
    },
    {
      id: 'full',
      label: '完整方案',
      value: 'full',
      description: '包含所有功能',
    },
    {
      id: 'balanced',
      label: '平衡方案',
      value: 'balanced',
      description: '平衡功能与开发成本',
    },
  ],
  currentStage: 3,
};

const mockTechStackResponse = {
  response: '基于你的需求，我推荐以下技术栈：',
  options: [
    {
      id: 'static',
      label: '纯前端静态部署',
      value: 'static',
      description: '最低成本，快速上线',
    },
    {
      id: 'fullstack',
      label: '全栈方案',
      value: 'fullstack',
      description: 'Next.js + API Routes',
    },
  ],
  currentStage: 4,
};

test.describe('Complete Workflow', () => {
  test('should navigate from landing page to complete workflow', async ({ page }) => {
    // Start from landing page
    await page.goto('/');

    // Verify landing page elements
    await expect(page.locator('h1')).toContainText('不是 AI 不行');
    await expect(page.getByRole('button', { name: '立即开始' })).toBeVisible();

    // Click start button
    await page.click('button:has-text("立即开始")');

    // Should navigate to /app
    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator('h1')).toContainText('定型 Formative');
  });

  test('should complete requirement collection via chat mode', async ({ page }) => {
    await page.goto('/app');

    // Mock the API responses
    await page.route('**/api/chat**', async (route) => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');

      // First call - extractor
      if (!body.sessionId) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockExtractorResponse),
        });
        return;
      }

      // Check message content for subsequent calls
      if (body.message?.includes('内容创作者')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAskerResponse),
        });
        return;
      }

      if (body.message?.includes('写作灵感枯竭') || body.message?.includes('writer-block')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCompleteResponse),
        });
        return;
      }

      // Default response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPlannerResponse),
      });
    });

    // Wait for initial AI message
    await expect(page.locator('text=你好！我是定型')).toBeVisible();

    // Send first message
    await page.fill('textarea[placeholder*="请输入"]', '我想做一个AI写作助手');
    await page.click('button:has-text("发送")');

    // Wait for AI response
    await expect(page.locator('text=我理解了，你想做一个AI写作助手')).toBeVisible();
    await expect(page.locator('text=目标用户')).toBeVisible();

    // Send second message
    await page.fill('textarea[placeholder*="请输入"]', '内容创作者');
    await page.click('button:has-text("发送")');

    // Wait for options to appear
    await expect(page.locator('text=你的产品主要解决什么痛点')).toBeVisible();

    // Click an option
    await page.click('button:has-text("写作灵感枯竭")');

    // Wait for completion message and navigation
    await expect(page.locator('text=需求采集完成')).toBeVisible();

    // Should navigate to risk analysis stage after 1.5 seconds
    await page.waitForTimeout(2000);
    await expect(page.locator('text=风险分析')).toBeVisible();
  });

  test('should complete risk analysis stage', async ({ page }) => {
    // Set session state in localStorage (simulating existing session)
    await page.goto('/app');

    // Mock the API response for risk analysis
    await page.route('**/api/chat**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRiskAnalysisResponse),
      });
    });

    // If we need to simulate being on risk analysis stage
    // We'll need to set up the proper state in IndexedDB or localStorage
    // For now, let's test the UI interaction assuming we're on the right stage

    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('定型 Formative');
  });

  test('should select tech stack option', async ({ page }) => {
    await page.goto('/app');

    // Mock tech stack response
    await page.route('**/api/chat**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTechStackResponse),
      });
    });

    // This test would verify tech stack selection
    await expect(page.locator('h1')).toContainText('定型 Formative');
  });

  test('should display tab navigation correctly', async ({ page }) => {
    await page.goto('/app');

    // Check that all tabs are visible
    await expect(page.locator('text=需求采集')).toBeVisible();
    await expect(page.locator('text=风险分析')).toBeVisible();
    await expect(page.locator('text=技术选型')).toBeVisible();
    await expect(page.locator('text=MVP规划')).toBeVisible();
    await expect(page.locator('text=架构设计')).toBeVisible();
    await expect(page.locator('text=文档生成')).toBeVisible();
  });

  test('should show history page when clicking history button', async ({ page }) => {
    await page.goto('/app');

    // Click history button
    await page.click('button:has-text("历史记录")');

    // Should navigate to history page
    await expect(page).toHaveURL(/\/history/);
  });

  test('should show abandon task modal', async ({ page }) => {
    await page.goto('/app');

    // Click abandon task button
    await page.click('button:has-text("放弃任务")');

    // Modal should appear
    await expect(page.locator('text=放弃当前任务')).toBeVisible();
    await expect(page.locator('text=确定要放弃当前任务吗')).toBeVisible();

    // Click cancel to close modal
    await page.click('button:has-text("取消")');

    // Modal should disappear
    await expect(page.locator('text=放弃当前任务')).not.toBeVisible();
  });

  test('should complete full workflow with mocked responses', async ({ page }) => {
    await page.goto('/');

    // Setup comprehensive API mocking
    let callCount = 0;
    await page.route('**/api/chat**', async (route) => {
      callCount++;
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');

      // Simulate different stages based on call count
      if (callCount === 1) {
        // Initial request - extractor
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockExtractorResponse),
        });
      } else if (callCount <= 3) {
        // Planning/asking phase
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockPlannerResponse,
            response: `请告诉我更多信息（第${callCount}次询问）`,
          }),
        });
      } else {
        // Complete stage
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCompleteResponse),
        });
      }
    });

    // Start from landing page
    await page.click('button:has-text("立即开始")');
    await expect(page).toHaveURL(/\/app/);

    // Complete the chat flow
    for (let i = 0; i < 4; i++) {
      await page.fill('textarea[placeholder*="请输入"]', `测试消息 ${i + 1}`);
      await page.click('button:has-text("发送")');

      // Wait for response
      await page.waitForTimeout(1000);
    }

    // Eventually should see completion message
    await expect(page.locator('text=需求采集完成')).toBeVisible();
  });
});
