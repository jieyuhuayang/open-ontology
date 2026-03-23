import { test, expect, type Page } from '@playwright/test';
import { selectAntOption } from './helpers/antd';

/**
 * E2E: Full Ontology Setup — Create 4 Object Types + 5 Link Types
 *
 * Prerequisites:
 * - Backend running on localhost:8000
 * - Frontend running on localhost:5173
 * - 5 datasets imported: companies, analysts, rating_reports, funds, fund_company_holdings
 *
 * Flow:
 * Phase 1 — Create 4 Object Types (via wizard, selecting backing datasets):
 *   公司 (companies), 研究员 (analysts), 评级报告 (rating_reports), 基金 (funds)
 *
 * Phase 2 — Create 5 Link Types in dependency order:
 *   FK #4: analyst-latest-report (many-to-one)  — BO prerequisite
 *   FK #5: company-latest-report (many-to-one)  — BO prerequisite
 *   FK #1: analyst-coverage (many-to-one)
 *   JT #2: fund-holding (many-to-many simple)
 *   BO #3: analyst-company-via-report (many-to-many rich) — depends on #4 and #5
 */

test.setTimeout(60_000);

const API = 'http://localhost:8000/api/v1';

// ──────────── Object Type Helpers ────────────

async function navigateToObjectTypes(page: Page) {
  await page.goto('/object-types');
  await page.waitForLoadState('networkidle');
}

async function openOtWizard(page: Page) {
  const btn = page
    .locator('button')
    .filter({ hasText: /New object type|新建对象类型/ })
    .first();
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });
}

async function clickWizardNext(page: Page) {
  const nextBtn = page
    .locator('.ant-modal-footer .ant-btn-primary')
    .filter({ hasText: /Next|下一步/ });
  await expect(nextBtn).toBeEnabled({ timeout: 5000 });
  await nextBtn.click();
}

async function clickWizardCreate(page: Page) {
  const createBtn = page
    .locator('.ant-modal-footer .ant-btn-primary')
    .filter({ hasText: /Create|创建/ });
  await expect(createBtn).toBeEnabled({ timeout: 5000 });
  await createBtn.click();
}

/**
 * Create an Object Type via the wizard.
 * Steps: Datasource → Metadata → Properties → Actions → Save Location → Create
 */
async function createObjectTypeViaWizard(
  page: Page,
  opts: {
    datasetName: string;
    displayName: string;
    pkColumn: string;
    tkColumn: string;
  },
) {
  await openOtWizard(page);

  // Step 0: Datasource — click the row matching the dataset name
  await page.waitForTimeout(500);
  const modal = page.locator('.ant-modal-content');
  const dsRow = modal.locator('.ant-table-row').filter({ hasText: opts.datasetName });
  await expect(dsRow.first()).toBeVisible({ timeout: 5000 });
  await dsRow.first().click();
  // Wait for row to be highlighted (selected)
  await page.waitForTimeout(300);
  await clickWizardNext(page);

  // Step 1: Metadata — fill display name
  await page.waitForTimeout(500);
  const displayNameInput = modal.locator('.ant-form-item input').first();
  // The icon selector is the first form item; displayName is the second
  const formItems = modal.locator('.ant-form-item');
  const dnInput = formItems.nth(1).locator('input');
  await dnInput.clear();
  await dnInput.fill(opts.displayName);
  await clickWizardNext(page);

  // Step 2: Properties — auto-mapped from dataset columns.
  // Select PK and TK from the Select dropdowns.
  await page.waitForTimeout(500);

  // PK selector is the first Select, TK is the second
  const pkSelect = modal.locator('.ant-select').first();
  await selectAntOption(page, pkSelect, opts.pkColumn);

  const tkSelect = modal.locator('.ant-select').nth(1);
  await selectAntOption(page, tkSelect, opts.tkColumn);

  await clickWizardNext(page);

  // Step 3: Actions — skip (just click Next)
  await page.waitForTimeout(300);
  await clickWizardNext(page);

  // Step 4: Save Location — click Create
  await page.waitForTimeout(300);
  await clickWizardCreate(page);

  // Should navigate to the object type detail page
  await expect(page).toHaveURL(/\/object-types\/ri\.ontology\.object-type\./, {
    timeout: 15000,
  });
}

// ──────────── Link Type Helpers ────────────

async function navigateToLinkTypes(page: Page) {
  await page.goto('/link-types');
  await page.waitForLoadState('networkidle');
}

async function openLtWizard(page: Page) {
  const btn = page
    .locator('button')
    .filter({ hasText: /New link type|新建链接类型/ })
    .first();
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 5000 });
}

async function clickLtNext(page: Page) {
  const okBtn = page.locator('.ant-modal-footer .ant-btn-primary');
  await expect(okBtn).toBeEnabled({ timeout: 5000 });
  await okBtn.click();
}

async function selectCardinality(page: Page, label: RegExp) {
  const card = page.locator('[role="button"]').filter({ hasText: label });
  await expect(card.first()).toBeVisible({ timeout: 3000 });
  await card.first().click();
}

async function createFkLink(
  page: Page,
  opts: {
    sideAName: string;
    sideBName: string;
    fkProperty: string;
    linkId: string;
  },
) {
  await openLtWizard(page);

  // Step 0: many-to-one
  await selectCardinality(page, /Many to One|多对一/);
  await clickLtNext(page);

  // Step 1: Select OTs
  await page.waitForTimeout(500);
  const modal = page.locator('.ant-modal-content');

  await selectAntOption(page, modal.locator('.ant-select').nth(0), opts.sideAName);
  await selectAntOption(page, modal.locator('.ant-select').nth(1), opts.sideBName);

  // Wait for FK selector to appear
  await page.waitForTimeout(800);

  // Select FK property
  await selectAntOption(page, modal.locator('.ant-select').nth(2), opts.fkProperty);

  await clickLtNext(page);

  // Step 2: Set ID
  await page.waitForTimeout(500);
  const idInput = page.locator('input[placeholder*="e.g."]');
  await idInput.clear();
  await idInput.fill(opts.linkId);

  // Click Create
  await clickLtNext(page);

  // Wait for navigation to detail page
  await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, {
    timeout: 15000,
  });
}

// ──────────── Tests ────────────

test.describe.serial('Full Ontology Setup — OT + LT creation', () => {
  // ═══════ Cleanup ═══════

  test('cleanup: delete existing link types and object types', async ({ request }) => {
    // Delete all link types first (they reference OTs)
    const ltResp = await request.get(`${API}/link-types`);
    if (ltResp.ok()) {
      const ltData = await ltResp.json();
      for (const lt of ltData.items) {
        await request.delete(`${API}/link-types/${lt.rid}`);
      }
    }

    // Delete all object types
    const otResp = await request.get(`${API}/object-types`);
    if (otResp.ok()) {
      const otData = await otResp.json();
      for (const ot of otData.items) {
        // Clean up properties first
        const propResp = await request.get(`${API}/object-types/${ot.rid}/properties`);
        if (propResp.ok()) {
          const propData = await propResp.json();
          for (const prop of propData.items) {
            if (prop.isPrimaryKey) {
              await request.put(`${API}/object-types/${ot.rid}/properties/${prop.rid}`, {
                data: { isPrimaryKey: false },
              });
            }
            if (prop.status === 'active') {
              await request.put(`${API}/object-types/${ot.rid}/properties/${prop.rid}`, {
                data: { status: 'deprecated' },
              });
            }
            await request.delete(`${API}/object-types/${ot.rid}/properties/${prop.rid}`);
          }
        }
        await request.delete(`${API}/object-types/${ot.rid}`);
      }
    }

    // Discard any pending changes
    await request.delete(`${API}/ontologies/ri.ontology.ontology.default/working-state`);

    // Verify clean state
    const checkOt = await request.get(`${API}/object-types`);
    const checkOtData = await checkOt.json();
    expect(checkOtData.items).toHaveLength(0);

    const checkLt = await request.get(`${API}/link-types`);
    const checkLtData = await checkLt.json();
    expect(checkLtData.items).toHaveLength(0);
  });

  // ═══════ Phase 1: Create 4 Object Types ═══════

  test('OT: create 公司 (companies dataset)', async ({ page }) => {
    await navigateToObjectTypes(page);
    await createObjectTypeViaWizard(page, {
      datasetName: 'companies',
      displayName: '公司',
      pkColumn: 'id',
      tkColumn: 'name',
    });
  });

  test('OT: create 研究员 (analysts dataset)', async ({ page }) => {
    await navigateToObjectTypes(page);
    await createObjectTypeViaWizard(page, {
      datasetName: 'analysts',
      displayName: '研究员',
      pkColumn: 'id',
      tkColumn: 'name',
    });
  });

  test('OT: create 评级报告 (rating_reports dataset)', async ({ page }) => {
    await navigateToObjectTypes(page);
    await createObjectTypeViaWizard(page, {
      datasetName: 'rating_reports',
      displayName: '评级报告',
      pkColumn: 'id',
      tkColumn: 'summary',
    });
  });

  test('OT: create 基金 (funds dataset)', async ({ page }) => {
    await navigateToObjectTypes(page);
    await createObjectTypeViaWizard(page, {
      datasetName: 'funds',
      displayName: '基金',
      pkColumn: 'id',
      tkColumn: 'name',
    });
  });

  test('verify: 4 object types exist via API', async ({ request }) => {
    const resp = await request.get(`${API}/object-types`);
    const data = await resp.json();
    expect(data.items.length).toBe(4);

    const names = data.items.map((ot: { displayName: string }) => ot.displayName).sort();
    expect(names).toEqual(['公司', '基金', '研究员', '评级报告']);
  });

  // ═══════ Phase 2: Create 5 Link Types ═══════

  // ────── FK #4: analyst-latest-report (BO prerequisite) ──────
  test('FK #4: analyst-latest-report (many-to-one)', async ({ page }) => {
    await navigateToLinkTypes(page);
    await createFkLink(page, {
      sideAName: '研究员',
      sideBName: '评级报告',
      fkProperty: 'latest_report_id',
      linkId: 'analyst-latest-report',
    });
  });

  // ────── FK #5: company-latest-report (BO prerequisite) ──────
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
    await openLtWizard(page);

    // Step 0: many-to-many + simple relationship
    await selectCardinality(page, /Many to Many|多对多/);
    await page.waitForTimeout(500);
    const simpleCard = page
      .locator('[role="button"]')
      .filter({ hasText: /Simple Relationship|简单关系/ });
    await expect(simpleCard.first()).toBeVisible({ timeout: 3000 });
    await simpleCard.first().click();
    await clickLtNext(page);

    // Step 1: Side A = 基金, Side B = 公司
    await page.waitForTimeout(500);
    const modal = page.locator('.ant-modal-content');

    await selectAntOption(page, modal.locator('.ant-select').nth(0), '基金');
    await selectAntOption(page, modal.locator('.ant-select').nth(1), '公司');

    // Select join table dataset
    await page.waitForTimeout(800);
    await selectAntOption(
      page,
      modal.locator('.ant-select').nth(2),
      'fund_company_holdings',
    );

    // Wait for column selectors
    await page.waitForTimeout(1000);

    // Column mappings: Side A (fund) → fund_id, Side B (company) → company_id
    await selectAntOption(page, modal.locator('.ant-select').nth(3), 'fund_id');
    await selectAntOption(page, modal.locator('.ant-select').nth(4), 'company_id');

    await clickLtNext(page);

    // Step 2: Set ID
    await page.waitForTimeout(500);
    const idInput = page.locator('input[placeholder*="e.g."]');
    await idInput.clear();
    await idInput.fill('fund-holding');

    await clickLtNext(page);
    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, {
      timeout: 15000,
    });
  });

  // ────── BO #3: analyst-company-via-report ──────
  test('BO #3: analyst-company-via-report (many-to-many rich)', async ({ page }) => {
    await navigateToLinkTypes(page);
    await openLtWizard(page);

    // Step 0: many-to-many + rich relationship
    await selectCardinality(page, /Many to Many|多对多/);
    await page.waitForTimeout(500);
    const richCard = page
      .locator('[role="button"]')
      .filter({ hasText: /Rich Relationship|丰富关系/ });
    await expect(richCard.first()).toBeVisible({ timeout: 3000 });
    await richCard.first().click();
    await clickLtNext(page);

    // Step 1: Side A = 研究员, Backing OT = 评级报告, Side B = 公司
    await page.waitForTimeout(500);
    const modal = page.locator('.ant-modal-content');

    // BO mode has 3 OT selects: Side A (0), Backing OT (1), Side B (2)
    await selectAntOption(page, modal.locator('.ant-select').nth(0), '研究员');
    await selectAntOption(page, modal.locator('.ant-select').nth(1), '评级报告');
    await selectAntOption(page, modal.locator('.ant-select').nth(2), '公司');

    // Wait for side link selectors to appear (may auto-select if only one option)
    await page.waitForTimeout(2000);

    // Check if side A link is auto-selected, if not select it
    const sideALinkSelect = modal.locator('.ant-select').nth(3);
    const sideALinkHasValue = await sideALinkSelect
      .locator('.ant-select-selection-item')
      .count();
    if (sideALinkHasValue === 0) {
      await selectAntOption(page, sideALinkSelect, 'analyst-latest-report');
    }

    // Check if side B link is auto-selected
    const sideBLinkSelect = modal.locator('.ant-select').nth(4);
    const sideBLinkHasValue = await sideBLinkSelect
      .locator('.ant-select-selection-item')
      .count();
    if (sideBLinkHasValue === 0) {
      await selectAntOption(page, sideBLinkSelect, 'company-latest-report');
    }

    await clickLtNext(page);

    // Step 2: Set ID and fix API names to avoid conflicts
    await page.waitForTimeout(500);
    const idInput = page.locator('input[placeholder*="e.g."]');
    await idInput.clear();
    await idInput.fill('analyst-company-via-report');

    // Change API names to avoid conflicts (gongSi/yanJiuYuan may already exist from analyst-coverage)
    const sideAApiName = page.locator('.ant-card').nth(0).locator('input').nth(1);
    await sideAApiName.clear();
    await sideAApiName.fill('boCompany');

    const sideBApiName = page.locator('.ant-card').nth(1).locator('input').nth(1);
    await sideBApiName.clear();
    await sideBApiName.fill('boAnalyst');

    await clickLtNext(page);
    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, {
      timeout: 15000,
    });
  });

  // ═══════ Final Verification ═══════

  test('verify: all 5 link types exist with correct properties', async ({ request }) => {
    const resp = await request.get(`${API}/link-types`);
    const data = await resp.json();

    const ids = data.items.map((lt: { id: string }) => lt.id).sort();
    expect(ids).toEqual([
      'analyst-company-via-report',
      'analyst-coverage',
      'analyst-latest-report',
      'company-latest-report',
      'fund-holding',
    ]);

    const byId = Object.fromEntries(
      data.items.map((lt: { id: string }) => [lt.id, lt]),
    );

    // FK links — many-to-one, foreign-key
    expect(byId['analyst-latest-report'].cardinality).toBe('many-to-one');
    expect(byId['analyst-latest-report'].joinMethod).toBe('foreign-key');

    expect(byId['company-latest-report'].cardinality).toBe('many-to-one');
    expect(byId['company-latest-report'].joinMethod).toBe('foreign-key');

    expect(byId['analyst-coverage'].cardinality).toBe('many-to-one');
    expect(byId['analyst-coverage'].joinMethod).toBe('foreign-key');

    // JT link — many-to-many, join-table
    expect(byId['fund-holding'].cardinality).toBe('many-to-many');
    expect(byId['fund-holding'].joinMethod).toBe('join-table');
    expect(byId['fund-holding'].joinTableDatasetRid).toBeTruthy();

    // BO link — many-to-many, backing-object
    expect(byId['analyst-company-via-report'].cardinality).toBe('many-to-many');
    expect(byId['analyst-company-via-report'].joinMethod).toBe('backing-object');
    expect(byId['analyst-company-via-report'].backingObjectTypeRid).toBeTruthy();
    expect(byId['analyst-company-via-report'].sideALinkTypeRid).toBeTruthy();
    expect(byId['analyst-company-via-report'].sideBLinkTypeRid).toBeTruthy();
  });
});
