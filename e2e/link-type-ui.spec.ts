import { test, expect, type Page } from '@playwright/test';
import { selectAntOption } from './helpers/antd';
import { API } from './helpers/api';

/**
 * E2E tests for Link Type UI optimization:
 * - List page: "Relationship" column (OT-A → OT-B) + "Link Names" column
 * - Detail page: Palantir Foundry-style card layout with 6 sections
 * - Edit: Display Name, API Name, Visibility, Status
 *
 * Prerequisites:
 * - Backend running on localhost:8000
 * - Frontend running on localhost:5173
 * - At least one FK link type exists (created by create-link-type.spec.ts)
 */

test.setTimeout(45_000);

// ──────────── Helpers ────────────

/** Get column header texts from the Ant Design table */
async function getTableHeaders(page: Page): Promise<string[]> {
  const headers = page.locator('.ant-table-thead th');
  return headers.allTextContents();
}

/** Get the first link type from API for predictable testing */
async function getFirstLinkType(request: Parameters<typeof test>[1]['request']) {
  const resp = await request.get(`${API}/link-types`);
  const data = await resp.json();
  expect(data.items.length).toBeGreaterThan(0);
  return data.items[0];
}

// ──────────── List Page Tests ────────────

test.describe('Link Type List Page — UI columns', () => {
  test('table has Relationship and Link Names columns', async ({ page }) => {
    await page.goto('/link-types');
    await page.waitForLoadState('networkidle');

    const headers = await getTableHeaders(page);

    // Should have: Relationship, Link Names, Cardinality, Join Method, Status, Change State
    expect(headers.some((h) => /Relationship|关系/.test(h))).toBeTruthy();
    expect(headers.some((h) => /Link Names|链接名称/.test(h))).toBeTruthy();
    expect(headers.some((h) => /Cardinality|基数/.test(h))).toBeTruthy();
    expect(headers.some((h) => /Join Method|连接方式/.test(h))).toBeTruthy();

    // Should NOT have an ID column
    expect(headers.some((h) => h === 'ID')).toBeFalsy();
  });

  test('Relationship column shows OT tags with arrow', async ({ page }) => {
    await page.goto('/link-types');
    await page.waitForLoadState('networkidle');

    // First data row should contain two .ant-tag elements and an arrow →
    const firstRow = page.locator('.ant-table-tbody tr').first();
    await expect(firstRow).toBeVisible();

    const tags = firstRow.locator('.ant-tag');
    await expect(tags).toHaveCount(2);

    // Arrow text between tags
    const rowText = await firstRow.textContent();
    expect(rowText).toContain('→');
  });

  test('Link Names column shows sideA / sideB display names', async ({ page, request }) => {
    // Get actual link type data to verify
    const lt = await getFirstLinkType(request);

    await page.goto('/link-types');
    await page.waitForLoadState('networkidle');

    // The page should contain the display names with " / " separator
    const expectedText = `${lt.sideA.displayName} / ${lt.sideB.displayName}`;
    await expect(page.getByText(expectedText)).toBeVisible();
  });

  test('clicking a row navigates to detail page', async ({ page }) => {
    await page.goto('/link-types');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('.ant-table-tbody tr').first();
    await firstRow.click();

    await expect(page).toHaveURL(/\/link-types\/ri\.ontology\.link-type\./, { timeout: 10000 });
  });
});

// ──────────── Detail Page Tests ────────────

test.describe('Link Type Detail Page — Overview Tab', () => {
  let linkTypeRid: string;

  test.beforeEach(async ({ request }) => {
    const lt = await getFirstLinkType(request);
    linkTypeRid = lt.rid;
  });

  test('Section 1: Status + ID/RID card', async ({ page, request }) => {
    const lt = await getFirstLinkType(request);
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Status radio buttons should be visible
    const radioGroup = page.locator('.ant-radio-group');
    await expect(radioGroup).toBeVisible();

    // Should show all three status options
    await expect(page.locator('.ant-radio-button-wrapper').filter({ hasText: /Experimental|实验性/ })).toBeVisible();
    await expect(page.locator('.ant-radio-button-wrapper').filter({ hasText: /Active|活跃/ })).toBeVisible();
    await expect(page.locator('.ant-radio-button-wrapper').filter({ hasText: /Deprecated|已弃用/ })).toBeVisible();

    // ID and RID should be displayed
    await expect(page.getByText(lt.id)).toBeVisible();
    await expect(page.getByText(lt.rid)).toBeVisible();
  });

  test('Section 2: Configuration — Join Method cards + visual diagram', async ({ page, request }) => {
    const lt = await getFirstLinkType(request);
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Configuration section title
    await expect(page.getByText(/Configuration|配置/).first()).toBeVisible();

    // Join method cards should be visible (3 cards: Foreign Key, Join Table, Backing Object)
    await expect(page.getByText(/Foreign Key|外键/).first()).toBeVisible();
    await expect(page.getByText(/Join Table|关联表/).first()).toBeVisible();
    await expect(page.getByText(/Backing Object|关联对象/).first()).toBeVisible();

    // Visual diagram: two OT name cards linked by arrow
    const otNameA = lt.sideA.objectTypeDisplayName ?? lt.sideA.objectTypeRid;
    const otNameB = lt.sideB.objectTypeDisplayName ?? lt.sideB.objectTypeRid;
    // OT names should appear in the diagram area
    await expect(page.getByText(otNameA).first()).toBeVisible();
    await expect(page.getByText(otNameB).first()).toBeVisible();

    // Cardinality labels (1 or N) in the diagram
    const cardinalityText = page.getByText(/Cardinality|基数/).first();
    await expect(cardinalityText).toBeVisible();
  });

  test('Section 3 & 4: Direction A→B and B→A cards', async ({ page, request }) => {
    const lt = await getFirstLinkType(request);
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    const otNameA = lt.sideA.objectTypeDisplayName ?? lt.sideA.objectTypeRid;
    const otNameB = lt.sideB.objectTypeDisplayName ?? lt.sideB.objectTypeRid;

    // Direction titles: "OT-A → OT-B" and "OT-B → OT-A"
    await expect(page.getByRole('heading', { name: new RegExp(`${otNameA}.*→.*${otNameB}`) })).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(`${otNameB}.*→.*${otNameA}`) })).toBeVisible();

    // Natural language description (e.g., "Each X has one/many Y")
    const nlText = page.getByText(/Each .+ has (one|many) .+|每个 .+ 有(一个|多个) .+/).first();
    await expect(nlText).toBeVisible();

    // Display Name inputs should be present (2 direction sections)
    const displayNameLabel = page.getByText(/Display Name|显示名称/);
    expect(await displayNameLabel.count()).toBeGreaterThanOrEqual(2);

    // API Name should be shown
    const apiNameLabel = page.getByText(/API Name|API 名称/);
    expect(await apiNameLabel.count()).toBeGreaterThanOrEqual(2);

    // Visibility selectors (2 direction sections)
    const visibilityLabel = page.getByText(/Visibility|可见性/);
    expect(await visibilityLabel.count()).toBeGreaterThanOrEqual(2);
  });

  test('Section 6: Audit info card', async ({ page }) => {
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Audit fields
    await expect(page.getByText(/Created At|创建时间/).first()).toBeVisible();
    await expect(page.getByText(/Created By|创建者/).first()).toBeVisible();
    await expect(page.getByText(/Last Modified At|最后修改时间/).first()).toBeVisible();
    await expect(page.getByText(/Last Modified By|最后修改者/).first()).toBeVisible();
  });
});

// ──────────── Edit Functionality Tests ────────────

test.describe('Link Type Detail Page — Edit Actions', () => {
  let linkTypeRid: string;

  test.beforeEach(async ({ request }) => {
    const lt = await getFirstLinkType(request);
    linkTypeRid = lt.rid;
  });

  test('change status via radio buttons', async ({ page, request }) => {
    const lt = await getFirstLinkType(request);
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Determine target status (toggle between experimental and deprecated)
    const currentStatus = lt.status;
    const targetStatus = currentStatus === 'experimental' ? 'deprecated' : 'experimental';
    const targetLabel = targetStatus === 'deprecated'
      ? /Deprecated|已弃用/
      : /Experimental|实验性/;

    // Click the target radio button
    const targetBtn = page.locator('.ant-radio-button-wrapper').filter({ hasText: targetLabel });
    await targetBtn.click();

    // Wait for API call to complete
    await page.waitForTimeout(1000);

    // Verify via API that the status changed
    const resp = await request.get(`${API}/link-types/${linkTypeRid}`);
    const updated = await resp.json();
    expect(updated.status).toBe(targetStatus);

    // Restore original status
    const restoreLabel = currentStatus === 'experimental'
      ? /Experimental|实验性/
      : currentStatus === 'active'
        ? /Active|活跃/
        : /Deprecated|已弃用/;
    await page.locator('.ant-radio-button-wrapper').filter({ hasText: restoreLabel }).click();
    await page.waitForTimeout(1000);
  });

  test('edit Display Name in direction section', async ({ page, request }) => {
    const lt = await getFirstLinkType(request);
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Find the first display name input (sideA direction section)
    const displayNameLabels = page.getByText(/Display Name|显示名称/);
    // The first occurrence is in direction A→B section
    const firstLabel = displayNameLabels.nth(0);
    await expect(firstLabel).toBeVisible();

    // Get the input near the first display name label — it's the input inside the direction card
    // The direction sections are rendered after the Configuration section
    // Each direction card has: natural lang description, Display Name input, API Name, Visibility
    const directionCards = page.locator('.ant-card .ant-card'); // nested cards = direction sections
    // Use a more reliable selector: find inputs within the overview content area
    const inputs = page.locator('main input[type="text"]');
    const firstInput = inputs.first();
    await expect(firstInput).toBeVisible();

    const originalValue = await firstInput.inputValue();
    const testValue = `${originalValue}-e2e-test`;

    // Edit the display name
    await firstInput.clear();
    await firstInput.fill(testValue);
    await firstInput.blur();

    // Wait for mutation
    await page.waitForTimeout(1500);

    // Verify via API
    const resp = await request.get(`${API}/link-types/${linkTypeRid}`);
    const updated = await resp.json();
    expect(updated.sideA.displayName).toBe(testValue);

    // Restore original value
    await firstInput.clear();
    await firstInput.fill(originalValue);
    await firstInput.blur();
    await page.waitForTimeout(1000);
  });

  test('change visibility via select dropdown', async ({ page, request }) => {
    const lt = await getFirstLinkType(request);
    await page.goto(`/link-types/${linkTypeRid}`);
    await page.waitForLoadState('networkidle');

    // Find the first visibility select in the direction section
    const visibilitySelects = page.locator('main .ant-select');
    const firstVisibilitySelect = visibilitySelects.first();
    await expect(firstVisibilitySelect).toBeVisible();

    // Determine current and target visibility
    const currentVisibility = lt.sideA.visibility;
    const targetVisibility = currentVisibility === 'normal' ? 'prominent' : 'normal';

    // Select new visibility
    await selectAntOption(page, firstVisibilitySelect, targetVisibility === 'prominent'
      ? /Prominent|突出/
      : /Normal|普通/);

    // Wait for mutation
    await page.waitForTimeout(1500);

    // Verify via API
    const resp = await request.get(`${API}/link-types/${linkTypeRid}`);
    const updated = await resp.json();
    expect(updated.sideA.visibility).toBe(targetVisibility);

    // Restore
    await selectAntOption(page, firstVisibilitySelect, currentVisibility === 'normal'
      ? /Normal|普通/
      : currentVisibility === 'prominent'
        ? /Prominent|突出/
        : /Hidden|隐藏/);
    await page.waitForTimeout(1000);
  });
});
