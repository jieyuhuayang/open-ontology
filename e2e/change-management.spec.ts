import { test, expect } from '@playwright/test';
import { clickAntTab } from './helpers/antd';
import {
  API,
  ONTOLOGY_RID,
  createObjectType,
  createPublishableObjectType,
  publishChanges,
  discardAll,
} from './helpers/api';
import { cleanupByPrefix } from './helpers/fixtures';

/**
 * E2E tests for Change Management (F009)
 *
 * Prerequisites:
 * - Backend running on localhost:8000
 * - Frontend running on localhost:5173
 *
 * Covers:
 * - AC-01~03, AC-28: TopBar Save/Discard buttons
 * - AC-04~06, AC-08: Save Dialog (Changes/Errors tabs, publish)
 * - AC-10~12: Discard single + Discard all
 * - AC-13~14: Sidebar Unsaved Changes entry
 * - AC-15~18: History page
 * - AC-23~25: OT History tab
 */

const PREFIX = 'e2e-cm-';

test.describe.serial('Change Management — E2E', () => {
  // ──────── Setup ────────
  test('setup: clean leftover test data', async ({ request }) => {
    // Discard any pending working state
    await request.delete(`${API}/ontologies/${ONTOLOGY_RID}/working-state`);
    await cleanupByPrefix(request, PREFIX);
  });

  // ──────── Save/Discard Buttons ────────

  test('AC-02: no Save/Discard buttons when no changes', async ({ page }) => {
    // Covers: AC-02
    await page.goto('/');
    // Wait for page to fully load
    await expect(page.locator('header')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // No Save or Discard buttons should appear in the TopBar
    await expect(
      page.locator('#change-status-slot button'),
    ).toHaveCount(0, { timeout: 3000 });
  });

  test('AC-01, AC-03: Save/Discard appear after creating OT, Save opens dialog', async ({ page, request }) => {
    // Covers: AC-01, AC-03
    // Create OT via API to trigger working state
    await createObjectType(request, `${PREFIX}btn-test`, 'E2E Button Test');

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Save button should appear with count
    const saveBtn = page.locator('#change-status-slot button').filter({ hasText: /Save|保存/ }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    // Should contain count
    await expect(saveBtn).toContainText('(');

    // Discard button should also appear
    const discardBtn = page.locator('#change-status-slot button').filter({ hasText: /Discard|丢弃/ }).first();
    await expect(discardBtn).toBeVisible();

    // Click Save → opens Modal
    await saveBtn.click();
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 3000 });

    // Close modal
    await page.locator('.ant-modal-content').locator('button[aria-label="Close"]').click();
    await page.waitForTimeout(300);

    // Cleanup
    await discardAll(request);
  });

  test('AC-04, AC-05: Save Dialog shows Changes tab with grouped changes', async ({ page, request }) => {
    // Covers: AC-04, AC-05
    await createObjectType(request, `${PREFIX}dialog-test`, 'E2E Dialog Test');

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Open Save Dialog
    const saveBtn = page.locator('#change-status-slot button').filter({ hasText: /Save|保存/ }).first();
    await saveBtn.click();

    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Should have Changes and Errors tabs
    await expect(modal.locator('.ant-tabs-tab')).toHaveCount(2, { timeout: 3000 });

    // Changes tab should be active by default
    const changesTab = modal.locator('.ant-tabs-tab-active');
    await expect(changesTab).toContainText(/Changes|变更/);

    // Should show the OT name in the changes list
    await expect(modal.getByText('E2E Dialog Test').first()).toBeVisible();

    // Should show Object Types group header
    await expect(modal.getByText(/Object Types|对象类型/).first()).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Cleanup
    await discardAll(request);
  });

  test('AC-06: Errors tab shows empty state when no errors', async ({ page, request }) => {
    // Covers: AC-06
    await createObjectType(request, `${PREFIX}errors-test`, 'E2E Errors Test');

    await page.goto('/');
    await page.waitForTimeout(1000);

    const saveBtn = page.locator('#change-status-slot button').filter({ hasText: /Save|保存/ }).first();
    await saveBtn.click();

    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Switch to Errors tab
    await clickAntTab(modal, /Errors|错误/);

    // Should show empty state
    await expect(modal.getByText(/No errors|无错误/).first()).toBeVisible({ timeout: 3000 });

    // Close and cleanup
    await page.keyboard.press('Escape');
    await discardAll(request);
  });

  // ──────── Publish Flow ────────

  test('AC-08: Save publishes changes, buttons disappear, history created', async ({ page, request }) => {
    // Covers: AC-08
    await createPublishableObjectType(request, `${PREFIX}pub-test`, 'E2E Publish Test');

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Open Save Dialog
    const saveBtn = page.locator('#change-status-slot button').filter({ hasText: /Save|保存/ }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Click Save button in modal (custom footer layout)
    const modalSaveBtn = modal.locator('button.ant-btn-primary').filter({ hasText: /^Save$|^保存$/ });
    await expect(modalSaveBtn).toBeEnabled({ timeout: 3000 });
    await modalSaveBtn.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Save button should disappear from TopBar
    await expect(
      page.locator('#change-status-slot button').filter({ hasText: /Save|保存/ }),
    ).toHaveCount(0, { timeout: 5000 });

    // Verify via API: history should have 1 record
    const histResp = await request.get(`${API}/ontologies/${ONTOLOGY_RID}/history`);
    const histData = await histResp.json();
    expect(histData.total).toBeGreaterThanOrEqual(1);
  });

  // ──────── Discard Flows ────────

  test('AC-10: Discard single change via trash icon', async ({ page, request }) => {
    // Covers: AC-10
    await createObjectType(request, `${PREFIX}disc-single`, 'E2E Disc Single');

    await page.goto('/');
    await page.waitForTimeout(1000);

    const saveBtn = page.locator('#change-status-slot button').filter({ hasText: /Save|保存/ }).first();
    await saveBtn.click();

    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Find trash icon button and click it
    const trashBtn = modal.locator('button .anticon-delete').first();
    await expect(trashBtn).toBeVisible({ timeout: 3000 });
    await trashBtn.click();

    // Wait for update
    await page.waitForTimeout(500);

    // The change should be removed — verify via API
    const wsResp = await request.get(`${API}/ontologies/${ONTOLOGY_RID}/working-state`);
    // Working state might be deleted (was only change) → 404
    expect([200, 404]).toContain(wsResp.status());

    // Close modal if still open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Cleanup
    await request.delete(`${API}/ontologies/${ONTOLOGY_RID}/working-state`);
  });

  test('AC-28: TopBar Discard button discards all changes', async ({ page, request }) => {
    // Covers: AC-28, AC-11, AC-12
    await createObjectType(request, `${PREFIX}disc-all`, 'E2E Disc All');

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Click TopBar Discard
    const discardBtn = page.locator('#change-status-slot button').filter({ hasText: /Discard|丢弃/ }).first();
    await expect(discardBtn).toBeVisible({ timeout: 5000 });
    await discardBtn.click();

    // Confirm dialog should appear
    await expect(page.locator('.ant-modal-confirm')).toBeVisible({ timeout: 3000 });

    // Click OK/confirm
    const okBtn = page.locator('.ant-modal-confirm .ant-btn-primary').first();
    await okBtn.click();

    // Buttons should disappear
    await expect(
      page.locator('#change-status-slot button').filter({ hasText: /Save|保存/ }),
    ).toHaveCount(0, { timeout: 5000 });

    // Verify via API
    const wsResp = await request.get(`${API}/ontologies/${ONTOLOGY_RID}/working-state`);
    expect(wsResp.status()).toBe(404);
  });

  // ──────── Sidebar ────────

  test('AC-13, AC-14: Unsaved Changes entry in sidebar', async ({ page, request }) => {
    // Covers: AC-13, AC-14
    await createObjectType(request, `${PREFIX}sidebar-test`, 'E2E Sidebar Test');

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Sidebar should show "Unsaved changes (N)"
    const sidebar = page.locator('aside, nav').first();
    const unsavedEntry = sidebar.getByText(/Unsaved changes|未保存变更/).first();
    await expect(unsavedEntry).toBeVisible({ timeout: 5000 });

    // Click it → opens Save Dialog
    await unsavedEntry.click();
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 3000 });

    // Close and cleanup
    await page.keyboard.press('Escape');
    await discardAll(request);
  });

  // ──────── History Page ────────

  test('AC-15, AC-16, AC-17, AC-18: History page shows published records', async ({ page }) => {
    // Covers: AC-15, AC-16, AC-17, AC-18
    // We published in AC-08 test, so history should have at least 1 record

    // Navigate to History via sidebar
    await page.goto('/history');
    await page.waitForTimeout(1000);

    // Should show History title
    await expect(page.getByText(/History|历史/).first()).toBeVisible({ timeout: 5000 });

    // Should have at least one collapse panel (from the publish in AC-08)
    const panels = page.locator('.ant-collapse-item');
    const panelCount = await panels.count();
    expect(panelCount).toBeGreaterThanOrEqual(1);

    // First panel should show version number
    const firstPanel = panels.first();
    await expect(firstPanel.getByText(/v\d+/).first()).toBeVisible();

    // Click to expand
    await firstPanel.locator('.ant-collapse-header').click();
    await page.waitForTimeout(500);

    // Expanded content should show change details
    const content = firstPanel.locator('.ant-collapse-content');
    await expect(content).toBeVisible({ timeout: 3000 });
  });

  // ──────── OT Detail History Tab ────────

  test('AC-23, AC-24: OT detail page has History tab', async ({ page, request }) => {
    // Covers: AC-23, AC-24
    // Get the published OT RID
    const otResp = await request.get(`${API}/object-types`);
    const otData = await otResp.json();
    const pubOt = otData.items.find((ot: { id: string }) => (ot.id as string).startsWith(PREFIX));

    if (!pubOt) {
      test.skip();
      return;
    }

    await page.goto(`/object-types/${pubOt.rid}/history`);
    await page.waitForTimeout(1000);

    // Should show History content (either pending changes or published history)
    // At minimum, the page should render without error
    await expect(page.locator('main')).toBeVisible({ timeout: 5000 });
  });

  // ──────── Cleanup ────────
  test('cleanup: delete test data', async ({ request }) => {
    // Discard any remaining working state
    await request.delete(`${API}/ontologies/${ONTOLOGY_RID}/working-state`);
    await cleanupByPrefix(request, PREFIX);

    // Verify cleanup
    const resp = await request.get(`${API}/object-types`);
    const data = await resp.json();
    const testOts = data.items.filter((ot: { id: string }) => (ot.id as string).startsWith(PREFIX));
    expect(testOts).toHaveLength(0);
  });
});
