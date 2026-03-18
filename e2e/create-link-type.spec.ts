import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for Create Link Type wizard.
 *
 * Prerequisites:
 * - Backend running on localhost:8000
 * - Frontend running on localhost:5173
 * - 4 object types exist: 公司, 研究员, 评级报告, 基金
 * - 5 datasets exist: companies, analysts, rating_reports, funds, fund_company_holdings
 *
 * Creates 5 link types in order:
 * FK #4: analyst-latest-report (many-to-one) — BO prerequisite
 * FK #5: company-latest-report (many-to-one) — BO prerequisite
 * FK #1: analyst-coverage (many-to-one)
 * JT #2: fund-holding (many-to-many simple)
 * BO #3: analyst-company-via-report (many-to-many rich) — depends on #4 and #5
 */

// Increase per-test timeout for wizard flows
test.setTimeout(60_000);

// ──────────── Helpers ────────────

async function navigateToLinkTypes(page: Page) {
  await page.goto('/link-types');
  await page.waitForLoadState('networkidle');
}

async function openCreateWizard(page: Page) {
  const btn = page.locator('button').filter({ hasText: /New link type|新建链接类型/ }).first();
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });
}

async function clickNext(page: Page) {
  const okBtn = page.locator('.ant-modal-footer .ant-btn-primary');
  await expect(okBtn).toBeEnabled({ timeout: 5000 });
  await okBtn.click();
}

/** Select a cardinality card by matching its title text */
async function selectCardinality(page: Page, label: RegExp) {
  const card = page.locator('[role="button"]').filter({ hasText: label });
  await expect(card.first()).toBeVisible({ timeout: 3000 });
  await card.first().click();
}

/** Select an option from an Ant Design Select dropdown */
async function selectAntOption(page: Page, selectLocator: ReturnType<Page['locator']>, search: string) {
  await selectLocator.click();
  await page.waitForTimeout(200);

  const input = selectLocator.locator('input.ant-select-selection-search-input');
  await input.fill(search);
  await page.waitForTimeout(500);

  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: search });
  await expect(option.first()).toBeVisible({ timeout: 5000 });
  await option.first().click();
  await page.waitForTimeout(300);
}

/** Helper to complete a FK link type creation */
async function createFkLink(
  page: Page,
  opts: {
    sideAName: string;
    sideBName: string;
    fkProperty: string;
    linkId: string;
  },
) {
  await openCreateWizard(page);

  // Step 0: many-to-one
  await selectCardinality(page, /Many to One|多对一/);
  await clickNext(page);

  // Step 1: Select OTs
  await page.waitForTimeout(500);
  const modal = page.locator('.ant-modal-content');

  await selectAntOption(page, modal.locator('.ant-select').nth(0), opts.sideAName);
  await selectAntOption(page, modal.locator('.ant-select').nth(1), opts.sideBName);

  // Wait for FK selector to appear
  await page.waitForTimeout(800);

  // Select FK property
  await selectAntOption(page, modal.locator('.ant-select').nth(2), opts.fkProperty);

  await clickNext(page);

  // Step 2: Set ID
  await page.waitForTimeout(500);
  const idInput = page.locator('input[placeholder*="e.g."]');
  await idInput.clear();
  await idInput.fill(opts.linkId);

  // Click Create
  await clickNext(page);

  // Wait for navigation to detail page
  await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 15000 });
}

// ──────────── Cleanup ────────────

test.describe.serial('Create Link Types — ordered', () => {
  // Clean up existing link types before the suite
  test('cleanup: delete all existing link types', async ({ request }) => {
    const resp = await request.get('http://localhost:8000/api/v1/link-types');
    const data = await resp.json();
    for (const lt of data.items) {
      await request.delete(`http://localhost:8000/api/v1/link-types/${lt.rid}`);
    }
    // Verify clean state
    const check = await request.get('http://localhost:8000/api/v1/link-types');
    const checkData = await check.json();
    expect(checkData.items).toHaveLength(0);
  });

  // ────── FK #4: analyst-latest-report ──────
  test('FK #4: analyst-latest-report (many-to-one)', async ({ page }) => {
    await navigateToLinkTypes(page);
    await createFkLink(page, {
      sideAName: '研究员',
      sideBName: '评级报告',
      fkProperty: 'latest_report_id',
      linkId: 'analyst-latest-report',
    });
  });

  // ────── FK #5: company-latest-report ──────
  test('FK #5: company-latest-report (many-to-one)', async ({ page }) => {
    await navigateToLinkTypes(page);
    await createFkLink(page, {
      sideAName: '公司',
      sideBName: '评级报告',
      fkProperty: 'latest_report_id',
      linkId: 'company-latest-report',
    });
  });

  // ────── FK #1: analyst-coverage ──────
  test('FK #1: analyst-coverage (many-to-one)', async ({ page }) => {
    await navigateToLinkTypes(page);
    await createFkLink(page, {
      sideAName: '研究员',
      sideBName: '公司',
      fkProperty: 'company_id',
      linkId: 'analyst-coverage',
    });
  });

  // ────── JT #2: fund-holding ──────
  test('JT #2: fund-holding (many-to-many simple)', async ({ page }) => {
    await navigateToLinkTypes(page);
    await openCreateWizard(page);

    // Step 0: many-to-many + simple relationship
    await selectCardinality(page, /Many to Many|多对多/);
    await page.waitForTimeout(500);
    const simpleCard = page.locator('[role="button"]').filter({ hasText: /Simple Relationship|简单关系/ });
    await expect(simpleCard.first()).toBeVisible({ timeout: 3000 });
    await simpleCard.first().click();
    await clickNext(page);

    // Step 1: Side A = 基金, Side B = 公司
    await page.waitForTimeout(500);
    const modal = page.locator('.ant-modal-content');

    await selectAntOption(page, modal.locator('.ant-select').nth(0), '基金');
    await selectAntOption(page, modal.locator('.ant-select').nth(1), '公司');

    // Select join table dataset
    await page.waitForTimeout(800);
    await selectAntOption(page, modal.locator('.ant-select').nth(2), 'fund_company_holdings');

    // Wait for column selectors
    await page.waitForTimeout(1000);

    // Column mappings
    await selectAntOption(page, modal.locator('.ant-select').nth(3), 'fund_id');
    await selectAntOption(page, modal.locator('.ant-select').nth(4), 'company_id');

    await clickNext(page);

    // Step 2: Set ID
    await page.waitForTimeout(500);
    const idInput = page.locator('input[placeholder*="e.g."]');
    await idInput.clear();
    await idInput.fill('fund-holding');

    await clickNext(page);
    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 15000 });
  });

  // ────── BO #3: analyst-company-via-report ──────
  test('BO #3: analyst-company-via-report (many-to-many rich)', async ({ page }) => {
    await navigateToLinkTypes(page);
    await openCreateWizard(page);

    // Step 0: many-to-many + rich relationship
    await selectCardinality(page, /Many to Many|多对多/);
    await page.waitForTimeout(500);
    const richCard = page.locator('[role="button"]').filter({ hasText: /Rich Relationship|丰富关系/ });
    await expect(richCard.first()).toBeVisible({ timeout: 3000 });
    await richCard.first().click();
    await clickNext(page);

    // Step 1: Side A = 研究员, Backing OT = 评级报告, Side B = 公司
    await page.waitForTimeout(500);
    const modal = page.locator('.ant-modal-content');

    // BO mode has 3 selects: Side A (0), Backing OT (1), Side B (2)
    await selectAntOption(page, modal.locator('.ant-select').nth(0), '研究员');
    await selectAntOption(page, modal.locator('.ant-select').nth(1), '评级报告');
    await selectAntOption(page, modal.locator('.ant-select').nth(2), '公司');

    // Wait for side link selectors to appear (they may auto-select if only one option)
    await page.waitForTimeout(2000);

    // Check if side A link is auto-selected, if not select it
    const sideALinkSelect = modal.locator('.ant-select').nth(3);
    const sideALinkHasValue = await sideALinkSelect.locator('.ant-select-selection-item').count();
    if (sideALinkHasValue === 0) {
      await selectAntOption(page, sideALinkSelect, 'analyst-latest-report');
    }

    // Check if side B link is auto-selected
    const sideBLinkSelect = modal.locator('.ant-select').nth(4);
    const sideBLinkHasValue = await sideBLinkSelect.locator('.ant-select-selection-item').count();
    if (sideBLinkHasValue === 0) {
      await selectAntOption(page, sideBLinkSelect, 'company-latest-report');
    }

    await clickNext(page);

    // Step 2: Set ID
    await page.waitForTimeout(500);
    const idInput = page.locator('input[placeholder*="e.g."]');
    await idInput.clear();
    await idInput.fill('analyst-company-via-report');

    await clickNext(page);
    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 15000 });
  });

  // ────── Verify all created ──────
  test('verify: all 5 link types exist via API', async ({ request }) => {
    const resp = await request.get('http://localhost:8000/api/v1/link-types');
    const data = await resp.json();

    const ids = data.items.map((lt: { id: string }) => lt.id).sort();
    expect(ids).toEqual([
      'analyst-company-via-report',
      'analyst-coverage',
      'analyst-latest-report',
      'company-latest-report',
      'fund-holding',
    ]);

    // Verify specific properties
    const byId = Object.fromEntries(data.items.map((lt: { id: string }) => [lt.id, lt]));

    // FK links should have cardinality many-to-one and joinMethod foreign-key
    expect(byId['analyst-latest-report'].cardinality).toBe('many-to-one');
    expect(byId['analyst-latest-report'].joinMethod).toBe('foreign-key');

    expect(byId['company-latest-report'].cardinality).toBe('many-to-one');
    expect(byId['company-latest-report'].joinMethod).toBe('foreign-key');

    expect(byId['analyst-coverage'].cardinality).toBe('many-to-one');
    expect(byId['analyst-coverage'].joinMethod).toBe('foreign-key');

    // JT link
    expect(byId['fund-holding'].cardinality).toBe('many-to-many');
    expect(byId['fund-holding'].joinMethod).toBe('join-table');
    expect(byId['fund-holding'].joinTableDatasetRid).toBeTruthy();

    // BO link
    expect(byId['analyst-company-via-report'].cardinality).toBe('many-to-many');
    expect(byId['analyst-company-via-report'].joinMethod).toBe('backing-object');
    expect(byId['analyst-company-via-report'].backingObjectTypeRid).toBeTruthy();
    expect(byId['analyst-company-via-report'].sideALinkTypeRid).toBeTruthy();
    expect(byId['analyst-company-via-report'].sideBLinkTypeRid).toBeTruthy();
  });
});
