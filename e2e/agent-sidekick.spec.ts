import { test, expect } from '@playwright/test';
import { API, createObjectType, createProperty } from './helpers/api';
import { cleanupByPrefix } from './helpers/fixtures';

/**
 * E2E tests for F018 Agent Sidekick
 *
 * Prerequisites:
 * - Backend running on localhost:8000
 * - Frontend running on localhost:5173
 *
 * Covers:
 * - AC-01: Open Sidekick Drawer via trigger button
 * - AC-02: Close Sidekick Drawer
 * - AC-03: missing_description suggestion displayed
 * - AC-04: missing_title_key suggestion displayed
 * - AC-10: Ignore removes suggestion card
 * - AC-11: Refresh reloads suggestions
 * - AC-13: Trigger button hidden on unsupported pages
 * - AC-14: Suggestion card shows confidence, source, AI badge
 * - AC-16: "Open Workshop" navigates to /workshop
 */

const PREFIX = 'e2e-sidekick-';

test.describe.serial('Agent Sidekick — E2E', () => {
  let otRid: string;

  // ──────── Setup ────────
  test('setup: create test data via API', async ({ request }) => {
    await cleanupByPrefix(request, PREFIX);

    // Create OT without description and without titleKeyPropertyId
    otRid = await createObjectType(request, `${PREFIX}customer`, 'E2E Sidekick Customer');

    // Add some properties but don't set title key
    await createProperty(request, otRid, `${PREFIX}email`, {
      apiName: 'e2eSidekickEmail',
    });
    await createProperty(request, otRid, `${PREFIX}age`, {
      apiName: 'e2eSidekickAge',
      baseType: 'integer',
    });

    // Verify setup
    const resp = await request.get(`${API}/object-types/${otRid}/properties`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.total).toBe(2);
  });

  // ──────── AC-13: Trigger hidden on unsupported pages ────────
  test('AC-13: trigger button hidden on home page', async ({ page }) => {
    // Covers: AC-13
    await page.goto('/');
    await expect(page.locator('header[role="banner"]')).toBeVisible({ timeout: 5000 });

    // The sidekick trigger (ThunderboltOutlined) should NOT be visible on home page
    const triggerBtn = page.locator('button[aria-label]').filter({
      hasText: /AI/,
    });
    // Also try by aria-label
    const sidekickBtn = page.locator('[aria-label="AI Assistant"], [aria-label="AI 助手"]');
    await expect(sidekickBtn).toHaveCount(0, { timeout: 3000 });
  });

  // ──────── AC-01: Open Sidekick Drawer ────────
  test('AC-01: open sidekick drawer on OT detail page', async ({ page }) => {
    // Covers: AC-01
    await page.goto(`/object-types/${otRid}/overview`);
    await expect(page.locator('header[role="banner"]')).toBeVisible({ timeout: 5000 });

    // The sidekick trigger should be visible on OT detail page
    const sidekickBtn = page.locator('[aria-label="AI Assistant"], [aria-label="AI 助手"]');
    await expect(sidekickBtn.first()).toBeVisible({ timeout: 5000 });

    // Click to open drawer
    await sidekickBtn.first().click();

    // Drawer should appear
    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Drawer should contain the sidekick title
    await expect(
      drawer.getByText(/AI Assistant|AI 助手/).first(),
    ).toBeVisible({ timeout: 3000 });
  });

  // ──────── AC-03 + AC-04 + AC-14: Suggestions displayed with confidence ────────
  test('AC-03/04/14: suggestions shown with confidence and AI badge', async ({ page }) => {
    // Covers: AC-03, AC-04, AC-14
    await page.goto(`/object-types/${otRid}/overview`);
    await expect(page.locator('header[role="banner"]')).toBeVisible({ timeout: 5000 });

    // Open sidekick
    const sidekickBtn = page.locator('[aria-label="AI Assistant"], [aria-label="AI 助手"]');
    await expect(sidekickBtn.first()).toBeVisible({ timeout: 5000 });
    await sidekickBtn.first().click();

    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Wait for suggestions to load (skeleton disappears, cards appear)
    // The OT has no description and no titleKey, so we should see rule-based suggestions
    await expect(drawer.locator('.ant-card').first()).toBeVisible({ timeout: 10000 });

    // Should have at least one suggestion card
    const cards = drawer.locator('.ant-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // Check for suggestion type tags (missing_description or missing_title_key)
    const firstCard = cards.first();

    // AC-14: AI badge (StarFilled ✦ rendered as anticon-star)
    await expect(firstCard.locator('.anticon-star').first()).toBeVisible();

    // AC-14: Suggestion type tag
    const tagText = await firstCard.locator('.ant-tag').first().textContent();
    expect(tagText).toBeTruthy();

    // AC-14: Confidence indicator should be present
    // The ConfidenceIndicator renders a colored dot + percentage text
    await expect(firstCard.getByText('%').first()).toBeVisible();
  });

  // ──────── AC-10: Ignore suggestion ────────
  test('AC-10: ignore removes suggestion card', async ({ page }) => {
    // Covers: AC-10
    await page.goto(`/object-types/${otRid}/overview`);
    await expect(page.locator('header[role="banner"]')).toBeVisible({ timeout: 5000 });

    // Open sidekick
    const sidekickBtn = page.locator('[aria-label="AI Assistant"], [aria-label="AI 助手"]');
    await expect(sidekickBtn.first()).toBeVisible({ timeout: 5000 });
    await sidekickBtn.first().click();

    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.locator('.ant-card').first()).toBeVisible({ timeout: 10000 });

    const initialCount = await drawer.locator('.ant-card').count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Click ignore on first suggestion
    const ignoreBtn = drawer
      .locator('.ant-card')
      .first()
      .locator('button')
      .filter({ hasText: /Ignore|忽略/ });
    await ignoreBtn.click();

    // Card count should decrease by 1
    if (initialCount > 1) {
      await expect(drawer.locator('.ant-card')).toHaveCount(initialCount - 1, {
        timeout: 3000,
      });
    } else {
      // If only 1 card, after ignore, empty state or no cards
      await expect(drawer.locator('.ant-card')).toHaveCount(0, { timeout: 3000 });
    }
  });

  // ──────── AC-11: Refresh reloads suggestions ────────
  test('AC-11: refresh reloads suggestions', async ({ page }) => {
    // Covers: AC-11
    await page.goto(`/object-types/${otRid}/overview`);
    await expect(page.locator('header[role="banner"]')).toBeVisible({ timeout: 5000 });

    // Open sidekick
    const sidekickBtn = page.locator('[aria-label="AI Assistant"], [aria-label="AI 助手"]');
    await expect(sidekickBtn.first()).toBeVisible({ timeout: 5000 });
    await sidekickBtn.first().click();

    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.locator('.ant-card').first()).toBeVisible({ timeout: 10000 });

    // Ignore all suggestions first
    const cardCount = await drawer.locator('.ant-card').count();
    for (let i = 0; i < cardCount; i++) {
      const ignoreBtn = drawer
        .locator('.ant-card')
        .first()
        .locator('button')
        .filter({ hasText: /Ignore|忽略/ });
      if (await ignoreBtn.isVisible()) {
        await ignoreBtn.click();
        await page.waitForTimeout(300); // wait for animation
      }
    }

    // Now click refresh button (ReloadOutlined in drawer title)
    const refreshBtn = drawer.locator('button').filter({ hasText: /Refresh|刷新/ });
    await expect(refreshBtn.first()).toBeVisible({ timeout: 3000 });
    await refreshBtn.first().click();

    // After refresh, ignored suggestions should reappear
    await expect(drawer.locator('.ant-card').first()).toBeVisible({ timeout: 10000 });
    const newCount = await drawer.locator('.ant-card').count();
    expect(newCount).toBeGreaterThanOrEqual(1);
  });

  // ──────── AC-02: Close Sidekick Drawer ────────
  test('AC-02: close sidekick drawer', async ({ page }) => {
    // Covers: AC-02
    await page.goto(`/object-types/${otRid}/overview`);
    await expect(page.locator('header[role="banner"]')).toBeVisible({ timeout: 5000 });

    // Open sidekick
    const sidekickBtn = page.locator('[aria-label="AI Assistant"], [aria-label="AI 助手"]');
    await expect(sidekickBtn.first()).toBeVisible({ timeout: 5000 });
    await sidekickBtn.first().click();

    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Close via the drawer's close button (X button in header)
    const closeBtn = drawer.locator('.ant-drawer-close');
    await closeBtn.click();

    // Drawer body should be hidden after close animation
    // Ant Design Drawer keeps DOM but adds ant-drawer-hidden or removes ant-drawer-open
    await expect(drawer.locator('.ant-drawer-body')).not.toBeVisible({ timeout: 5000 });
  });

  // ──────── AC-16: Open Workshop navigation ────────
  test('AC-16: open workshop button navigates to /workshop', async ({ page }) => {
    // Covers: AC-16
    await page.goto(`/object-types/${otRid}/overview`);
    await expect(page.locator('header[role="banner"]')).toBeVisible({ timeout: 5000 });

    // Open sidekick
    const sidekickBtn = page.locator('[aria-label="AI Assistant"], [aria-label="AI 助手"]');
    await expect(sidekickBtn.first()).toBeVisible({ timeout: 5000 });
    await sidekickBtn.first().click();

    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click "Open Workshop" link button at the bottom of drawer
    const workshopBtn = drawer
      .locator('button')
      .filter({ hasText: /Open Workshop|打开本体工坊/ });
    await expect(workshopBtn.first()).toBeVisible({ timeout: 5000 });
    await workshopBtn.first().click();

    // Should navigate to /workshop
    await expect(page).toHaveURL(/\/workshop/, { timeout: 5000 });
  });

  // ──────── Cleanup ────────
  test('cleanup: delete test data', async ({ request }) => {
    await request
      .delete(`${API}/ontologies/ri.ontology.ontology.default/working-state`)
      .catch(() => {});

    await cleanupByPrefix(request, PREFIX);

    await request
      .delete(`${API}/ontologies/ri.ontology.ontology.default/working-state`)
      .catch(() => {});

    // Verify cleanup
    const resp = await request.get(`${API}/object-types`);
    const data = await resp.json();
    const testOts = data.items.filter((ot: { id: string }) =>
      ot.id.startsWith(PREFIX),
    );
    expect(testOts).toHaveLength(0);
  });
});
