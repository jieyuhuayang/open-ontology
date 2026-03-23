import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { selectAntOption } from './helpers/antd';
import { API, createObjectType, createProperty } from './helpers/api';

/**
 * E2E tests for Link Type UI optimization:
 * - List page: "Relationship" column (OT-A → OT-B) + "Link Names" column
 * - Detail page: Palantir Foundry-style card layout with 6 sections
 * - Edit: Display Name, API Name, Visibility, Status
 *
 * Self-contained: creates its own test data (2 OTs + 1 FK link type)
 * and cleans up after.
 */

test.setTimeout(45_000);

const TEST_PREFIX = 'e2e-lt-ui';
const OT_A_ID = `${TEST_PREFIX}-company`;
const OT_B_ID = `${TEST_PREFIX}-analyst`;
const LINK_ID = `${TEST_PREFIX}-coverage`;

let otARid: string;
let otBRid: string;
let linkTypeRid: string;

// ──────────── Helpers ────────────

async function createFkLinkType(request: APIRequestContext, opts: {
  id: string;
  sideAOtRid: string;
  sideBOtRid: string;
  fkPropertyId: string;
}): Promise<string> {
  const resp = await request.post(`${API}/link-types`, {
    data: {
      id: opts.id,
      sideA: {
        objectTypeRid: opts.sideAOtRid,
        displayName: 'Coverage',
        apiName: 'coverage',
        visibility: 'normal',
        foreignKeyPropertyId: opts.fkPropertyId,
      },
      sideB: {
        objectTypeRid: opts.sideBOtRid,
        displayName: 'Analysts',
        apiName: 'analysts',
        visibility: 'normal',
      },
      cardinality: 'many-to-one',
    },
  });
  expect(resp.ok(), `Failed to create link type: ${resp.status()}`).toBeTruthy();
  const data = await resp.json();
  return data.rid;
}

// ──────────── Setup & Teardown ────────────

test.describe.serial('Link Type UI — List + Detail + Edit', () => {

  test('setup: create test OTs and FK link type', async ({ request }) => {
    // Clean up any leftover data from previous runs
    const ltResp = await request.get(`${API}/link-types`);
    const ltData = await ltResp.json();
    for (const lt of ltData.items) {
      if (lt.id === LINK_ID) {
        await request.delete(`${API}/link-types/${lt.rid}`);
      }
    }
    const otResp = await request.get(`${API}/object-types`);
    const otData = await otResp.json();
    for (const ot of otData.items) {
      if (ot.id === OT_A_ID || ot.id === OT_B_ID) {
        await request.delete(`${API}/object-types/${ot.rid}`);
      }
    }
    // Discard working state to finalize cleanup
    await request.delete(`${API}/ontologies/ri.ontology.ontology.default/working-state`);

    // Create two object types
    otARid = await createObjectType(request, OT_A_ID, 'Company');
    otBRid = await createObjectType(request, OT_B_ID, 'Analyst');

    // Create a FK property on OT-A
    await createProperty(request, otARid, `${TEST_PREFIX}-analyst-id`, {
      apiName: 'analystId',
      baseType: 'string',
    });

    // Create FK link type: Company → Analyst (many-to-one)
    linkTypeRid = await createFkLinkType(request, {
      id: LINK_ID,
      sideAOtRid: otARid,
      sideBOtRid: otBRid,
      fkPropertyId: `${TEST_PREFIX}-analyst-id`,
    });
  });

  // ──────────── List Page Tests ────────────

  test('list: table has Relationship and Link Names columns', async ({ page }) => {
    await page.goto('/link-types');
    await page.waitForLoadState('networkidle');
    // Wait for table to render
    await expect(page.locator('.ant-table-thead')).toBeVisible({ timeout: 10000 });

    const headers = page.locator('.ant-table-thead th');
    const headerTexts = await headers.allTextContents();

    // Should have: Relationship, Link Names, Cardinality, Join Method, Status, Change State
    expect(headerTexts.some((h) => /Relationship|关系/.test(h))).toBeTruthy();
    expect(headerTexts.some((h) => /Link Names|链接名称/.test(h))).toBeTruthy();
    expect(headerTexts.some((h) => /Cardinality|基数/.test(h))).toBeTruthy();
    expect(headerTexts.some((h) => /Join Method|连接方式/.test(h))).toBeTruthy();

    // Should NOT have a standalone ID column header
    expect(headerTexts.some((h) => h.trim() === 'ID')).toBeFalsy();
  });

  test('list: Relationship column shows OT tags with arrow', async ({ page }) => {
    await page.goto('/link-types');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-table-thead')).toBeVisible({ timeout: 10000 });

    // Find first data row
    const row = page.locator('.ant-table-tbody tr').first();
    await expect(row).toBeVisible();

    // First cell (Relationship column) should contain two .ant-tag elements
    const firstCell = row.locator('td').first();
    const tags = firstCell.locator('.ant-tag');
    await expect(tags).toHaveCount(2);

    // Should contain OT display names
    await expect(tags.nth(0)).toContainText('Company');
    await expect(tags.nth(1)).toContainText('Analyst');

    // Arrow between tags
    const cellText = await firstCell.textContent();
    expect(cellText).toContain('→');
  });

  test('list: Link Names column shows sideA / sideB display names', async ({ page }) => {
    await page.goto('/link-types');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-table-thead')).toBeVisible({ timeout: 10000 });

    // Should show "Coverage / Analysts" in the Link Names column
    await expect(page.getByText('Coverage / Analysts')).toBeVisible();
  });

  test('list: clicking a row navigates to detail page', async ({ page }) => {
    await page.goto('/link-types');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-table-thead')).toBeVisible({ timeout: 10000 });

    const row = page.locator('.ant-table-tbody tr').filter({ hasText: 'Company' });
    await row.first().click();

    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 10000 });
  });

  // ──────────── Detail Page Tests ────────────

  test('detail: Section 1 — Status + ID/RID card', async ({ page }) => {
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Status radio buttons
    const radioGroup = page.locator('.ant-radio-group');
    await expect(radioGroup).toBeVisible();

    await expect(page.locator('.ant-radio-button-wrapper').filter({ hasText: /Experimental|实验性/ })).toBeVisible();
    await expect(page.locator('.ant-radio-button-wrapper').filter({ hasText: /Active|活跃/ })).toBeVisible();
    await expect(page.locator('.ant-radio-button-wrapper').filter({ hasText: /Deprecated|已弃用/ })).toBeVisible();

    // ID and RID
    await expect(page.getByText(LINK_ID)).toBeVisible();
    await expect(page.getByText(linkTypeRid)).toBeVisible();
  });

  test('detail: Section 2 — Configuration card with join method + diagram', async ({ page }) => {
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Configuration title
    await expect(page.getByText(/Configuration|配置/).first()).toBeVisible();

    // Three join method cards (all visible, Foreign Key highlighted)
    await expect(page.getByText(/Foreign Key|外键/).first()).toBeVisible();
    await expect(page.getByText(/Join Table|关联表/).first()).toBeVisible();
    await expect(page.getByText(/Backing Object|关联对象/).first()).toBeVisible();

    // Visual diagram: OT names visible
    await expect(page.getByText('Company').first()).toBeVisible();
    await expect(page.getByText('Analyst').first()).toBeVisible();

    // Cardinality label
    await expect(page.getByText(/Cardinality|基数/).first()).toBeVisible();
  });

  test('detail: Section 3 & 4 — Direction A→B and B→A cards', async ({ page }) => {
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Direction titles
    await expect(page.getByRole('heading', { name: /Company.*→.*Analyst/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Analyst.*→.*Company/ })).toBeVisible();

    // Natural language description
    const nlText = page.getByText(/Each .+ has (one|many) .+|每个 .+ 有(一个|多个) .+/).first();
    await expect(nlText).toBeVisible();

    // Each direction has: Display Name, API Name, Visibility labels
    const displayNameLabels = page.getByText(/Display Name|显示名称/);
    expect(await displayNameLabels.count()).toBeGreaterThanOrEqual(2);

    const apiNameLabels = page.getByText(/API Name|API 名称/);
    expect(await apiNameLabels.count()).toBeGreaterThanOrEqual(2);

    const visibilityLabels = page.getByText(/Visibility|可见性/);
    expect(await visibilityLabels.count()).toBeGreaterThanOrEqual(2);

    // FK property should be shown for the FK side
    await expect(page.getByText(`${TEST_PREFIX}-analyst-id`)).toBeVisible();
  });

  test('detail: Section 6 — Audit info card', async ({ page }) => {
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Created At|创建时间/).first()).toBeVisible();
    await expect(page.getByText(/Created By|创建者/).first()).toBeVisible();
    await expect(page.getByText(/Last Modified At|最后修改时间/).first()).toBeVisible();
    await expect(page.getByText(/Last Modified By|最后修改者/).first()).toBeVisible();
  });

  // ──────────── Edit Tests ────────────

  test('edit: change status via radio buttons', async ({ page, request }) => {
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Default status is experimental; switch to deprecated
    const deprecatedBtn = page.locator('.ant-radio-button-wrapper').filter({ hasText: /Deprecated|已弃用/ });
    await deprecatedBtn.click();
    await page.waitForTimeout(1500);

    // Verify via API
    const resp = await request.get(`${API}/link-types/${linkTypeRid}`);
    const updated = await resp.json();
    expect(updated.status).toBe('deprecated');

    // Restore to experimental
    const experimentalBtn = page.locator('.ant-radio-button-wrapper').filter({ hasText: /Experimental|实验性/ });
    await experimentalBtn.click();
    await page.waitForTimeout(1000);
  });

  test('edit: change Display Name in direction section', async ({ page, request }) => {
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // The first text input in main content area is the sideA Display Name
    const inputs = page.locator('main input.ant-input');
    const firstInput = inputs.first();
    await expect(firstInput).toBeVisible();

    const originalValue = await firstInput.inputValue();
    const testValue = `${originalValue}-test`;

    await firstInput.clear();
    await firstInput.fill(testValue);
    await firstInput.blur();
    await page.waitForTimeout(1500);

    // Verify via API
    const resp = await request.get(`${API}/link-types/${linkTypeRid}`);
    const updated = await resp.json();
    expect(updated.sideA.displayName).toBe(testValue);

    // Restore
    await firstInput.clear();
    await firstInput.fill(originalValue);
    await firstInput.blur();
    await page.waitForTimeout(1000);
  });

  test('edit: change visibility via select dropdown', async ({ page, request }) => {
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Find visibility selects in the direction sections
    const visibilitySelects = page.locator('main .ant-select');
    const firstSelect = visibilitySelects.first();
    await expect(firstSelect).toBeVisible();

    // Change from normal to prominent
    await selectAntOption(page, firstSelect, /Prominent|突出/);
    await page.waitForTimeout(1500);

    // Verify via API
    const resp = await request.get(`${API}/link-types/${linkTypeRid}`);
    const updated = await resp.json();
    expect(updated.sideA.visibility).toBe('prominent');

    // Restore to normal
    await selectAntOption(page, firstSelect, /Normal|普通/);
    await page.waitForTimeout(1000);
  });

  // ──────────── Cleanup ────────────

  test('cleanup: delete test link type and OTs', async ({ request }) => {
    // Delete link type
    if (linkTypeRid) {
      await request.delete(`${API}/link-types/${linkTypeRid}`);
    }
    // Delete OTs
    if (otARid) {
      await request.delete(`${API}/object-types/${otARid}`);
    }
    if (otBRid) {
      await request.delete(`${API}/object-types/${otBRid}`);
    }
    // Discard working state to clean up
    await request.delete(`${API}/ontologies/ri.ontology.ontology.default/working-state`);
  });
});
