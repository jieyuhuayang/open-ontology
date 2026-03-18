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
 * 1. analyst-latest-report (FK, many-to-one)
 * 2. company-latest-report (FK, many-to-one)
 * 3. analyst-coverage (FK, many-to-one)
 * 4. fund-holding (JT, many-to-many)
 * 5. analyst-company-via-report (BO, many-to-many) — depends on #1 and #2
 */

// ──────────── Helpers ────────────

async function navigateToLinkTypes(page: Page) {
  await page.goto('/link-types');
  await page.waitForLoadState('networkidle');
}

async function openCreateWizard(page: Page) {
  // Click the "New link type" button
  const btn = page.locator('button').filter({ hasText: /New link type|新建链接类型/ });
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  // Wait for modal to appear
  await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });
}

async function clickNext(page: Page) {
  const okBtn = page.locator('.ant-modal-footer .ant-btn-primary');
  await expect(okBtn).toBeEnabled({ timeout: 3000 });
  await okBtn.click();
}

/** Select a cardinality card by matching its title text */
async function selectCardinality(page: Page, label: RegExp) {
  const card = page.locator('[role="button"]').filter({ hasText: label });
  await expect(card.first()).toBeVisible({ timeout: 3000 });
  await card.first().click();
}

/** Select an option from an Ant Design Select dropdown by typing to search */
async function selectAntOption(page: Page, selectLocator: ReturnType<Page['locator']>, search: string) {
  await selectLocator.click();
  // Type in search box
  const searchInput = page.locator('.ant-select-dropdown:visible input.ant-select-selection-search-input, .ant-select-dropdown:visible .ant-select-search input').first();
  // Sometimes the input is inside the select itself
  const activeInput = page.locator('.ant-select-focused input').first();
  if (await activeInput.isVisible()) {
    await activeInput.fill(search);
  } else {
    await selectLocator.locator('input').fill(search);
  }
  await page.waitForTimeout(300);
  // Click the matching option
  const option = page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: search });
  await expect(option.first()).toBeVisible({ timeout: 3000 });
  await option.first().click();
}

/** Get the nth Ant Select within a visible container */
function getNthSelect(page: Page, container: ReturnType<Page['locator']>, n: number) {
  return container.locator('.ant-select').nth(n);
}

// ──────────── Tests ────────────

test.describe.serial('Create Link Types — ordered', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToLinkTypes(page);
  });

  // ────── Link #4: analyst-latest-report (FK, many-to-one) ──────
  test('Link #4: analyst-latest-report (FK, many-to-one)', async ({ page }) => {
    await openCreateWizard(page);

    // Step 0: Select many-to-one
    await selectCardinality(page, /Many to One|多对一/);
    await clickNext(page);

    // Step 1: Side A = 研究员 (Analyst), Side B = 评级报告 (RatingReport)
    await page.waitForTimeout(500);
    const step1 = page.locator('.ant-modal-content');

    // Side A select (first select)
    const sideASelect = step1.locator('.ant-select').nth(0);
    await selectAntOption(page, sideASelect, '研究员');

    // Side B select (second select — no backing OT in FK mode)
    const sideBSelect = step1.locator('.ant-select').nth(1);
    await selectAntOption(page, sideBSelect, '评级报告');

    // Wait for FK property selector to appear
    await page.waitForTimeout(500);

    // FK property selector — select latest_report_id
    const fkSelect = step1.locator('.ant-select').nth(2);
    await selectAntOption(page, fkSelect, 'latest_report_id');

    await clickNext(page);

    // Step 2: Naming — fields should be auto-populated
    await page.waitForTimeout(500);

    // Change the ID
    const idInput = page.locator('input[placeholder*="e.g."]');
    await idInput.clear();
    await idInput.fill('analyst-latest-report');

    // Click Create
    await clickNext(page);

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 10000 });
  });

  // ────── Link #5: company-latest-report (FK, many-to-one) ──────
  test('Link #5: company-latest-report (FK, many-to-one)', async ({ page }) => {
    await openCreateWizard(page);

    // Step 0: Select many-to-one
    await selectCardinality(page, /Many to One|多对一/);
    await clickNext(page);

    // Step 1: Side A = 公司 (Company), Side B = 评级报告 (RatingReport)
    await page.waitForTimeout(500);
    const step1 = page.locator('.ant-modal-content');

    const sideASelect = step1.locator('.ant-select').nth(0);
    await selectAntOption(page, sideASelect, '公司');

    const sideBSelect = step1.locator('.ant-select').nth(1);
    await selectAntOption(page, sideBSelect, '评级报告');

    await page.waitForTimeout(500);

    // FK property — latest_report_id on Company (Side A)
    const fkSelect = step1.locator('.ant-select').nth(2);
    await selectAntOption(page, fkSelect, 'latest_report_id');

    await clickNext(page);

    // Step 2: Change ID
    await page.waitForTimeout(500);
    const idInput = page.locator('input[placeholder*="e.g."]');
    await idInput.clear();
    await idInput.fill('company-latest-report');

    await clickNext(page);
    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 10000 });
  });

  // ────── Link #1: analyst-coverage (FK, many-to-one) ──────
  test('Link #1: analyst-coverage (FK, many-to-one)', async ({ page }) => {
    await openCreateWizard(page);

    // Step 0: many-to-one
    await selectCardinality(page, /Many to One|多对一/);
    await clickNext(page);

    // Step 1: Side A = 研究员, Side B = 公司
    await page.waitForTimeout(500);
    const step1 = page.locator('.ant-modal-content');

    const sideASelect = step1.locator('.ant-select').nth(0);
    await selectAntOption(page, sideASelect, '研究员');

    const sideBSelect = step1.locator('.ant-select').nth(1);
    await selectAntOption(page, sideBSelect, '公司');

    await page.waitForTimeout(500);

    // FK property — company_id on Analyst (Side A)
    const fkSelect = step1.locator('.ant-select').nth(2);
    await selectAntOption(page, fkSelect, 'company_id');

    await clickNext(page);

    // Step 2: Change ID
    await page.waitForTimeout(500);
    const idInput = page.locator('input[placeholder*="e.g."]');
    await idInput.clear();
    await idInput.fill('analyst-coverage');

    await clickNext(page);
    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 10000 });
  });

  // ────── Link #2: fund-holding (JT, many-to-many) ──────
  test('Link #2: fund-holding (JT, many-to-many simple)', async ({ page }) => {
    await openCreateWizard(page);

    // Step 0: many-to-many
    await selectCardinality(page, /Many to Many|多对多/);

    // Wait for N:N sub-selector
    await page.waitForTimeout(500);

    // Select "Simple Relationship" (Join Table)
    const simpleCard = page.locator('[role="button"]').filter({ hasText: /Simple Relationship|简单关系/ });
    await expect(simpleCard.first()).toBeVisible({ timeout: 3000 });
    await simpleCard.first().click();

    await clickNext(page);

    // Step 1: Side A = 基金, Side B = 公司
    await page.waitForTimeout(500);
    const step1 = page.locator('.ant-modal-content');

    const sideASelect = step1.locator('.ant-select').nth(0);
    await selectAntOption(page, sideASelect, '基金');

    const sideBSelect = step1.locator('.ant-select').nth(1);
    await selectAntOption(page, sideBSelect, '公司');

    // Select join table dataset: fund_company_holdings
    await page.waitForTimeout(500);
    const datasetSelect = step1.locator('.ant-select').nth(2);
    await selectAntOption(page, datasetSelect, 'fund_company_holdings');

    // Wait for column selectors to load
    await page.waitForTimeout(1000);

    // Side A column mapping: fund_id
    const sideAColSelect = step1.locator('.ant-select').nth(3);
    await selectAntOption(page, sideAColSelect, 'fund_id');

    // Side B column mapping: company_id
    const sideBColSelect = step1.locator('.ant-select').nth(4);
    await selectAntOption(page, sideBColSelect, 'company_id');

    await clickNext(page);

    // Step 2: Change ID
    await page.waitForTimeout(500);
    const idInput = page.locator('input[placeholder*="e.g."]');
    await idInput.clear();
    await idInput.fill('fund-holding');

    await clickNext(page);
    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 10000 });
  });

  // ────── Link #3: analyst-company-via-report (BO, many-to-many) ──────
  test('Link #3: analyst-company-via-report (BO, many-to-many rich)', async ({ page }) => {
    await openCreateWizard(page);

    // Step 0: many-to-many
    await selectCardinality(page, /Many to Many|多对多/);

    // Wait for N:N sub-selector
    await page.waitForTimeout(500);

    // Select "Rich Relationship" (Backing Object)
    const richCard = page.locator('[role="button"]').filter({ hasText: /Rich Relationship|丰富关系/ });
    await expect(richCard.first()).toBeVisible({ timeout: 3000 });
    await richCard.first().click();

    await clickNext(page);

    // Step 1: Side A = 研究员, Backing OT = 评级报告, Side B = 公司
    await page.waitForTimeout(500);
    const step1 = page.locator('.ant-modal-content');

    // In BO mode: Side A (0th), Backing OT (1st), Side B (2nd)
    const sideASelect = step1.locator('.ant-select').nth(0);
    await selectAntOption(page, sideASelect, '研究员');

    const backingOtSelect = step1.locator('.ant-select').nth(1);
    await selectAntOption(page, backingOtSelect, '评级报告');

    const sideBSelect = step1.locator('.ant-select').nth(2);
    await selectAntOption(page, sideBSelect, '公司');

    // Wait for side link selectors to appear
    await page.waitForTimeout(1000);

    // Side A → Backing OT link: should auto-select analyst-latest-report if only one
    // Side B → Backing OT link: should auto-select company-latest-report if only one
    // Check if they are already auto-selected; if not, select manually
    const sideALinkSelect = step1.locator('.ant-select').nth(3);
    const sideBLinkSelect = step1.locator('.ant-select').nth(4);

    // Verify side A link has a value (auto-selected)
    const sideALinkValue = await sideALinkSelect.locator('.ant-select-selection-item').textContent().catch(() => '');
    if (!sideALinkValue) {
      await selectAntOption(page, sideALinkSelect, 'analyst-latest-report');
    }

    const sideBLinkValue = await sideBLinkSelect.locator('.ant-select-selection-item').textContent().catch(() => '');
    if (!sideBLinkValue) {
      await selectAntOption(page, sideBLinkSelect, 'company-latest-report');
    }

    await clickNext(page);

    // Step 2: Change ID
    await page.waitForTimeout(500);
    const idInput = page.locator('input[placeholder*="e.g."]');
    await idInput.clear();
    await idInput.fill('analyst-company-via-report');

    await clickNext(page);
    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 10000 });
  });
});

// ──────────── Verification ────────────

test.describe('Verify created link types', () => {
  test('all 5 link types exist on the list page', async ({ page }) => {
    await navigateToLinkTypes(page);

    // Verify all 5 link types are visible in the table
    const expectedIds = [
      'analyst-latest-report',
      'company-latest-report',
      'analyst-coverage',
      'fund-holding',
      'analyst-company-via-report',
    ];

    for (const id of expectedIds) {
      await expect(page.locator('td, .ant-table-cell').filter({ hasText: id })).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
