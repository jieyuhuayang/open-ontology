import { test, expect } from '@playwright/test';
import { API, createPublishableObjectType, publishChanges, discardAll } from './helpers/api';
import { cleanupByPrefix } from './helpers/fixtures';

/**
 * E2E tests for Object Instance Sync (F011)
 *
 * Covers:
 * - AC-15: Instances Tab in OT detail nav
 * - AC-16: Sync status bar with sync record
 * - AC-17: Empty state when no sync
 * - AC-18: Dynamic columns from mapped properties
 * - AC-19: Sync Now button triggers sync
 * - AC-20: Sync Now disabled without datasource
 */

const PREFIX = 'e2e-sync-';

test.describe.serial('Object Instance Sync — E2E', () => {
  let otRidWithDs: string;
  let otRidNoDs: string;

  // ──────── Setup: publishable OT ────────
  test('setup: create publishable OT with datasource', async ({ request }) => {
    await discardAll(request);
    await cleanupByPrefix(request, PREFIX);

    otRidWithDs = await createPublishableObjectType(
      request,
      `${PREFIX}employee`,
      'E2E Sync Employee',
    );
  });

  // ──────── AC-15: Instances Tab in navigation ────────
  test('AC-15: Instances Tab appears in OT detail nav', async ({ page }) => {
    // Covers: AC-15
    await page.goto(`/object-types/${otRidWithDs}/overview`);
    await expect(page.getByText(/Instances|实例/)).toBeVisible({ timeout: 5000 });
  });

  // ──────── AC-17: Empty state before any sync ────────
  test('AC-17: shows empty state when no sync record', async ({ page }) => {
    // Covers: AC-17
    await page.goto(`/object-types/${otRidWithDs}/instances`);
    await expect(
      page.getByText(/No sync has been performed yet|尚未执行同步/),
    ).toBeVisible({ timeout: 5000 });
  });

  // ──────── Publish to trigger auto-sync ────────
  test('publish triggers auto-sync for OT with datasource', async ({ request }) => {
    await publishChanges(request);

    // Verify sync job was created
    const statusResp = await request.get(`${API}/object-types/${otRidWithDs}/sync/status`);
    expect(statusResp.ok()).toBeTruthy();
    const syncJob = await statusResp.json();
    expect(syncJob).not.toBeNull();
    expect(syncJob.status).toBe('completed');
    expect(syncJob.triggeredBy).toBe('system');

    // Verify instances were created
    const instancesResp = await request.get(`${API}/object-types/${otRidWithDs}/instances`);
    expect(instancesResp.ok()).toBeTruthy();
    const instances = await instancesResp.json();
    expect(instances.total).toBe(2); // Alice + Bob from CSV
  });

  // ──────── AC-16: Sync status bar with record ────────
  test('AC-16: shows sync status bar after sync', async ({ page }) => {
    // Covers: AC-16
    await page.goto(`/object-types/${otRidWithDs}/instances`);
    await expect(
      page.getByText(/Synced|已同步/).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/Sync Now|立即同步/),
    ).toBeVisible();
  });

  // ──────── AC-18: Dynamic columns ────────
  test('AC-18: table shows dynamic columns from mapped properties', async ({ page }) => {
    // Covers: AC-18
    await page.goto(`/object-types/${otRidWithDs}/instances`);
    // Wait for table to load
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });
    // Verify mapped property columns appear (PK and Name columns from setup)
    await expect(page.locator('.ant-table-thead th').filter({ hasText: 'PK' })).toBeVisible();
    await expect(page.locator('.ant-table-thead th').filter({ hasText: 'Name' })).toBeVisible();
    // Verify instance data is shown
    await expect(page.getByText('Alice').first()).toBeVisible();
    await expect(page.getByText('Bob').first()).toBeVisible();
  });

  // ──────── AC-19: Sync Now button ────────
  test('AC-19: Sync Now button triggers manual sync', async ({ page, request }) => {
    // Covers: AC-19
    await page.goto(`/object-types/${otRidWithDs}/instances`);
    const syncBtn = page.locator('button').filter({ hasText: /Sync Now|立即同步/ });
    await expect(syncBtn).toBeVisible({ timeout: 5000 });
    await expect(syncBtn).toBeEnabled();
    await syncBtn.click();

    // Wait for sync to complete — button should return to enabled state
    await expect(syncBtn).toBeEnabled({ timeout: 10000 });

    // Verify via API that a new manual sync job was created
    const statusResp = await request.get(`${API}/object-types/${otRidWithDs}/sync/status`);
    const syncJob = await statusResp.json();
    expect(syncJob.triggeredBy).toBe('manual');
    expect(syncJob.status).toBe('completed');
  });

  // ──────── Setup: OT without datasource (created after publish) ────────
  test('setup: create OT without datasource', async ({ request }) => {
    const nodsResp = await request.post(`${API}/object-types`, {
      data: {
        id: `${PREFIX}no-ds`,
        apiName: `${PREFIX}no-ds`
          .replace(/-/g, '')
          .replace(/^(.)/, (_, c: string) => c.toUpperCase()),
        displayName: 'E2E No Datasource',
        icon: { name: 'box', color: '#1677ff' },
      },
    });
    expect(nodsResp.ok()).toBeTruthy();
    otRidNoDs = (await nodsResp.json()).rid;
  });

  // ──────── AC-20: No datasource shows configure message ────────
  test('AC-20: shows configure datasource message and no sync button when OT has no datasource', async ({ page }) => {
    // Covers: AC-20
    await page.goto(`/object-types/${otRidNoDs}/instances`);
    await expect(
      page.getByText(/Configure a backing datasource|配置底层数据源/),
    ).toBeVisible({ timeout: 5000 });
    // Sync Now button should not be present (Alert shown instead of sync bar)
    const syncBtn = page.locator('button').filter({ hasText: /Sync Now|立即同步/ });
    await expect(syncBtn).toHaveCount(0);
  });

  // ──────── Cleanup ────────
  test('cleanup: delete test data', async ({ request }) => {
    await discardAll(request);
    await cleanupByPrefix(request, PREFIX);

    const resp = await request.get(`${API}/object-types`);
    const data = await resp.json();
    const testOts = data.items.filter((ot: { id: string }) =>
      (ot.id as string).startsWith(PREFIX),
    );
    expect(testOts).toHaveLength(0);
  });
});
