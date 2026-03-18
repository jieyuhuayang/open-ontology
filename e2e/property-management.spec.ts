import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/**
 * E2E tests for Property Management — GAP 1/2/3/4
 *
 * Prerequisites:
 * - Backend running on localhost:8000
 * - Frontend running on localhost:5173
 *
 * Covers:
 * - GAP 1: /properties summary page (AC-32, AC-33, AC-34)
 * - GAP 2: Batch operations (AC-35, AC-36, AC-37, AC-38)
 * - GAP 3: Edit panel Tab structure (AC-39, AC-41)
 * - GAP 4: "Allow multiple" switch in create drawer (AC-40)
 */

const API = 'http://localhost:8000/api/v1';

// ──────────── API helpers ────────────

async function createObjectType(
  request: APIRequestContext,
  id: string,
  displayName: string,
): Promise<string> {
  const resp = await request.post(`${API}/object-types`, {
    data: {
      id,
      apiName: id.replace(/-/g, '').replace(/^(.)/, (_, c: string) => c.toUpperCase()),
      displayName,
      icon: { name: 'box', color: '#1677ff' },
    },
  });
  expect(resp.ok(), `Failed to create OT '${id}': ${resp.status()}`).toBeTruthy();
  const data = await resp.json();
  return data.rid;
}

async function createProperty(
  request: APIRequestContext,
  otRid: string,
  id: string,
  opts: {
    apiName?: string;
    baseType?: string;
    arrayInnerType?: string;
    status?: string;
  } = {},
): Promise<{ rid: string; [key: string]: unknown }> {
  const apiName = opts.apiName ?? id.replace(/-/g, '');
  const resp = await request.post(`${API}/object-types/${otRid}/properties`, {
    data: {
      id,
      apiName,
      displayName: id.charAt(0).toUpperCase() + id.slice(1),
      baseType: opts.baseType ?? 'string',
      arrayInnerType: opts.arrayInnerType ?? null,
      status: opts.status ?? 'experimental',
    },
  });
  expect(resp.ok(), `Failed to create property '${id}': ${resp.status()}`).toBeTruthy();
  return resp.json();
}

/** Only delete OTs created by this test suite (id starts with "e2e-") */
async function cleanupTestData(request: APIRequestContext) {
  const resp = await request.get(`${API}/object-types`);
  if (!resp.ok()) return;
  const data = await resp.json();
  for (const ot of data.items) {
    if (!(ot.id as string).startsWith('e2e-')) continue;
    // Delete properties first — skip PK/active ones by unsetting them
    const propResp = await request.get(`${API}/object-types/${ot.rid}/properties`);
    if (propResp.ok()) {
      const propData = await propResp.json();
      for (const prop of propData.items) {
        // Unset PK if set
        if (prop.isPrimaryKey) {
          await request.put(`${API}/object-types/${ot.rid}/properties/${prop.rid}`, {
            data: { isPrimaryKey: false },
          });
        }
        // Set to deprecated if active
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

// ──────────── Ant Design helpers ────────────

async function selectAntOption(page: Page, selectLocator: ReturnType<Page['locator']>, search: string | RegExp) {
  await selectLocator.click();
  await page.waitForTimeout(200);
  const input = selectLocator.locator('input.ant-select-selection-search-input');
  const isReadonly = await input.getAttribute('readonly');
  if (isReadonly === null && typeof search === 'string') {
    await input.fill(search);
    await page.waitForTimeout(500);
  } else {
    await page.waitForTimeout(300);
  }
  const option = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: search });
  await expect(option.first()).toBeVisible({ timeout: 5000 });
  await option.first().click();
  await page.waitForTimeout(300);
}

// ──────────── Test suites ────────────

test.describe.serial('Property Management — E2E', () => {
  let otRidA: string;
  let otRidB: string;
  let propRids: string[] = [];

  // ──────── Setup ────────
  test('setup: create object types and properties', async ({ request }) => {
    // Clean any leftover test data
    await cleanupTestData(request);

    // Create two object types
    otRidA = await createObjectType(request, 'e2e-employee', 'E2E Employee');
    otRidB = await createObjectType(request, 'e2e-department', 'E2E Department');

    // Create properties on OT-A
    const p1 = await createProperty(request, otRidA, 'full-name', { apiName: 'fullName' });
    const p2 = await createProperty(request, otRidA, 'email', { apiName: 'email' });
    const p3 = await createProperty(request, otRidA, 'age', { apiName: 'age', baseType: 'integer' });
    const p4 = await createProperty(request, otRidA, 'tags', {
      apiName: 'tags',
      baseType: 'array',
      arrayInnerType: 'string',
    });

    // Create properties on OT-B
    const p5 = await createProperty(request, otRidB, 'dept-code', { apiName: 'deptCode' });
    const p6 = await createProperty(request, otRidB, 'budget', { apiName: 'budget', baseType: 'decimal' });

    propRids = [p1.rid, p2.rid, p3.rid, p4.rid, p5.rid, p6.rid] as string[];

    // Verify setup — our 2 OTs should have 6 properties total
    const aResp = await request.get(`${API}/object-types/${otRidA}/properties`);
    expect(aResp.ok()).toBeTruthy();
    const bResp = await request.get(`${API}/object-types/${otRidB}/properties`);
    expect(bResp.ok()).toBeTruthy();
    const aData = await aResp.json();
    const bData = await bResp.json();
    expect(aData.total + bData.total).toBe(6);
  });

  // ════════════════════════════════════════════════
  // GAP 1: /properties summary page (AC-32, AC-33, AC-34)
  // ════════════════════════════════════════════════

  test('AC-32: /properties shows all properties across object types', async ({ page }) => {
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');

    // Should show the page title
    const title = page.locator('h4').filter({ hasText: /Properties|属性/ });
    await expect(title).toBeVisible({ timeout: 5000 });

    // Should display properties from both object types
    await expect(page.getByText('Full-name')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Dept-code')).toBeVisible();

    // Should show object type names in the table
    await expect(page.getByText('E2E Employee').first()).toBeVisible();
    await expect(page.getByText('E2E Department').first()).toBeVisible();
  });

  test('AC-34: /properties filters work (status, baseType, objectType)', async ({ page }) => {
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Filter by object type — select "E2E Department"
    const otFilter = page.locator('.ant-select').first();
    await selectAntOption(page, otFilter, 'E2E Department');

    // Should only show department properties (2 items)
    const rows = page.locator('.ant-table-row');
    await expect(rows).toHaveCount(2, { timeout: 3000 });
    await expect(page.getByText('Dept-code')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Budget')).toBeVisible();

    // Clear OT filter
    const clearBtn = otFilter.locator('.ant-select-clear');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(300);
    }

    // Filter by OT = E2E Employee + base type = Integer
    await selectAntOption(page, otFilter, 'E2E Employee');
    await page.waitForTimeout(300);

    const baseTypeFilter = page.locator('.ant-select').nth(3);
    await selectAntOption(page, baseTypeFilter, /Integer|整数/);

    // Only 'age' property from E2E Employee should be visible
    await expect(rows).toHaveCount(1, { timeout: 3000 });
    await expect(rows.first()).toContainText('Age');
  });

  test('AC-33: clicking a property row navigates to its OT properties tab', async ({ page }) => {
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');

    // Wait for table
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Click on 'Full-name' row
    const row = page.locator('.ant-table-row').filter({ hasText: 'Full-name' });
    await row.click();

    // Should navigate to object type properties page
    await expect(page).toHaveURL(/\/object-types\/.*\/properties/, { timeout: 5000 });
  });

  // ════════════════════════════════════════════════
  // GAP 3: Edit panel Tab structure (AC-39, AC-41)
  // ════════════════════════════════════════════════

  test('AC-39: edit panel has Tab structure (General/Details/Advanced/Display/Interaction)', async ({
    page,
  }) => {
    // Navigate to OT-A properties page
    await page.goto(`/object-types/${otRidA}/properties`);
    await page.waitForLoadState('networkidle');

    // Wait for properties to load
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Click on 'Full-name' property to open edit panel
    const row = page.locator('.ant-table-row').filter({ hasText: 'Full-name' });
    await row.click();

    // Drawer should open
    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Check all 5 tabs exist
    const tabs = drawer.locator('.ant-tabs-tab');
    await expect(tabs).toHaveCount(5, { timeout: 3000 });

    // Verify tab labels
    await expect(drawer.getByText(/^General$|^基本信息$/)).toBeVisible();
    await expect(drawer.getByText(/^Details$|^详细信息$/)).toBeVisible();
    await expect(drawer.getByText(/^Advanced$|^高级$/)).toBeVisible();
    await expect(drawer.getByText(/^Display$|^显示$/)).toBeVisible();
    await expect(drawer.getByText(/^Interaction$|^交互$/)).toBeVisible();

    // General tab should be active by default — check for displayName field
    await expect(drawer.getByText(/Display Name|显示名称/)).toBeVisible();

    // Click Details tab
    const detailsTab = drawer.locator('.ant-tabs-tab').filter({ hasText: /Details|详细信息/ });
    await detailsTab.click();
    await page.waitForTimeout(300);

    // Should show base type info
    await expect(drawer.getByText(/Base Type|基础类型/)).toBeVisible();

    // Click Advanced tab
    const advancedTab = drawer.locator('.ant-tabs-tab').filter({ hasText: /Advanced|高级/ });
    await advancedTab.click();
    await page.waitForTimeout(300);

    // Should show RID
    await expect(drawer.getByText('RID')).toBeVisible();

    // Click Display tab — should show placeholder
    const displayTab = drawer.locator('.ant-tabs-tab').filter({ hasText: /^Display$|^显示$/ });
    await displayTab.click();
    await page.waitForTimeout(300);
    await expect(drawer.getByText(/Value formatting|值格式化/)).toBeVisible();

    // Click Interaction tab — should show placeholder
    const interactionTab = drawer.locator('.ant-tabs-tab').filter({ hasText: /Interaction|交互/ });
    await interactionTab.click();
    await page.waitForTimeout(300);
    await expect(drawer.getByText(/Conditional formatting|条件格式化/)).toBeVisible();
  });

  test('AC-41: array property shows "Allow multiple" label in Details tab', async ({ page }) => {
    await page.goto(`/object-types/${otRidA}/properties`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Click on 'Tags' (array property) to open edit panel
    const row = page.locator('.ant-table-row').filter({ hasText: 'Tags' });
    await row.click();

    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click Details tab
    const detailsTab = drawer.locator('.ant-tabs-tab').filter({ hasText: /Details|详细信息/ });
    await detailsTab.click();
    await page.waitForTimeout(300);

    // Should show "Allow multiple" as enabled
    await expect(
      drawer.getByText(/Allow multiple|允许多值/).first(),
    ).toBeVisible({ timeout: 3000 });

    // Should show the array tag
    await expect(
      drawer.getByText(/Multiple values enabled|已启用多值/),
    ).toBeVisible();
  });

  // ════════════════════════════════════════════════
  // GAP 4: "Allow multiple" in Create Drawer (AC-40)
  // ════════════════════════════════════════════════

  test('AC-40: create property with "Allow multiple" switch', async ({ page }) => {
    await page.goto(`/object-types/${otRidA}/properties`);
    await page.waitForLoadState('networkidle');

    // Click "Add Property" button
    const addBtn = page.locator('button').filter({ hasText: /Add Property|添加属性/ });
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();

    // Drawer should open
    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Fill in form
    await drawer.locator('#displayName').fill('Multi Values');
    await page.waitForTimeout(300);
    await drawer.locator('#id').fill('multi-values');

    // Select base type — "Array" should NOT be in the list
    const baseTypeSelect = drawer.locator('.ant-select').first();
    await baseTypeSelect.click();
    await page.waitForTimeout(300);

    // Verify "Array" option is NOT visible
    const arrayOption = page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: /^Array$|^数组$/ });
    await expect(arrayOption).toHaveCount(0);

    // Select "Integer" as base type
    const intOption = page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .filter({ hasText: /Integer|整数/ });
    await intOption.first().click();
    await page.waitForTimeout(500);

    // "Allow multiple" switch should now be visible
    const allowMultipleSwitch = drawer.locator('.ant-switch');
    await expect(allowMultipleSwitch).toBeVisible({ timeout: 3000 });

    // Toggle it ON
    await allowMultipleSwitch.click();
    await page.waitForTimeout(300);

    // Should show confirmation text
    await expect(
      drawer.getByText(/Multiple values enabled|已启用多值/),
    ).toBeVisible();

    // Submit the form
    const createBtn = drawer.locator('.ant-drawer-footer .ant-btn-primary');
    await createBtn.click();

    // Wait for success message
    await expect(page.locator('.ant-message')).toBeVisible({ timeout: 5000 });

    // Verify via API that the property was created as array type
    const resp = await page.request.get(
      `${API}/object-types/${otRidA}/properties`,
    );
    const data = await resp.json();
    const multiProp = data.items.find((p: { id: string }) => p.id === 'multi-values');
    expect(multiProp).toBeTruthy();
    expect(multiProp.baseType).toBe('array');
    expect(multiProp.arrayInnerType).toBe('integer');
  });

  test('AC-40: "Allow multiple" switch is disabled for struct type', async ({ page }) => {
    await page.goto(`/object-types/${otRidA}/properties`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button').filter({ hasText: /Add Property|添加属性/ });
    await addBtn.click();

    const drawer = page.locator('.ant-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Select "Struct" as base type
    const baseTypeSelect = drawer.locator('.ant-select').first();
    await selectAntOption(page, baseTypeSelect, /Struct|结构体/);

    // "Allow multiple" switch should NOT be visible for struct
    const allowMultipleSwitch = drawer.locator('.ant-switch');
    await expect(allowMultipleSwitch).not.toBeVisible({ timeout: 2000 });
  });

  // ════════════════════════════════════════════════
  // GAP 2: Batch operations (AC-35, AC-36, AC-37, AC-38)
  // ════════════════════════════════════════════════

  test('AC-35: selecting properties shows batch action bar', async ({ page }) => {
    await page.goto(`/object-types/${otRidA}/properties`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Batch bar should NOT be visible initially
    await expect(page.getByText(/selected|已选/)).not.toBeVisible();

    // Click checkbox on first row
    const firstCheckbox = page.locator('.ant-table-row .ant-checkbox-input').first();
    await firstCheckbox.click();
    await page.waitForTimeout(300);

    // Batch action bar should appear
    await expect(page.getByText(/1 selected|已选 1/)).toBeVisible({ timeout: 3000 });
  });

  test('AC-36: batch update status', async ({ page }) => {
    await page.goto(`/object-types/${otRidB}/properties`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Select all checkboxes via header checkbox
    const headerCheckbox = page.locator('.ant-table-thead .ant-checkbox-input');
    await headerCheckbox.click();
    await page.waitForTimeout(300);

    // Batch bar should be visible
    await expect(page.getByText(/selected|已选/)).toBeVisible({ timeout: 3000 });

    // Click "Change Status" select and pick "Active"
    const batchStatusSelect = page
      .locator('.ant-select')
      .filter({ has: page.locator(`[title*="Status"], [title*="状态"]`) })
      .first();

    // Use the batch status select in the batch bar area
    const batchBar = page.locator('[style*="e6f4ff"]');
    const statusSelect = batchBar.locator('.ant-select').first();
    await selectAntOption(page, statusSelect, /Active|活跃/);

    // Wait for success message
    await expect(page.locator('.ant-message')).toBeVisible({ timeout: 5000 });

    // Verify via API
    const resp = await page.request.get(`${API}/object-types/${otRidB}/properties`);
    const data = await resp.json();
    expect(data.items.every((p: { status: string }) => p.status === 'active')).toBeTruthy();
  });

  test('AC-37: batch update visibility', async ({ page }) => {
    await page.goto(`/object-types/${otRidA}/properties`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Select first two checkboxes
    const checkboxes = page.locator('.ant-table-row .ant-checkbox-input');
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();
    await page.waitForTimeout(300);

    // Batch bar should show
    await expect(page.getByText(/2 selected|已选 2/)).toBeVisible({ timeout: 3000 });

    // Click visibility select in batch bar and pick "Hidden"
    const batchBar = page.locator('[style*="e6f4ff"]');
    const visibilitySelect = batchBar.locator('.ant-select').nth(1);
    await selectAntOption(page, visibilitySelect, /Hidden|隐藏/);

    // Wait for success message
    await expect(page.locator('.ant-message')).toBeVisible({ timeout: 5000 });
  });

  test('AC-38: batch delete skips active and PK properties', async ({ request, page }) => {
    // Setup: set one property as PK via API
    const propsResp = await request.get(`${API}/object-types/${otRidA}/properties`);
    const propsData = await propsResp.json();
    const ageProp = propsData.items.find((p: { id: string }) => p.id === 'age');
    if (ageProp) {
      await request.put(`${API}/object-types/${otRidA}/properties/${ageProp.rid}`, {
        data: { isPrimaryKey: true },
      });
    }

    // Set one property as active
    const emailProp = propsData.items.find((p: { id: string }) => p.id === 'email');
    if (emailProp) {
      await request.put(`${API}/object-types/${otRidA}/properties/${emailProp.rid}`, {
        data: { status: 'active' },
      });
    }

    await page.goto(`/object-types/${otRidA}/properties`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Select all
    const headerCheckbox = page.locator('.ant-table-thead .ant-checkbox-input');
    await headerCheckbox.click();
    await page.waitForTimeout(300);

    // Click batch delete button
    const batchBar = page.locator('[style*="e6f4ff"]');
    const deleteBtn = batchBar.locator('button').filter({ hasText: /Delete|删除/ });
    await deleteBtn.click();

    // Confirm in popconfirm
    const confirmBtn = page.locator('.ant-popconfirm .ant-btn-primary, .ant-popover .ant-btn-dangerous');
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await confirmBtn.click();

    // Wait for messages (success + skipped warning)
    await page.waitForTimeout(1500);

    // Verify via API: active and PK properties should still exist
    const afterResp = await request.get(`${API}/object-types/${otRidA}/properties`);
    const afterData = await afterResp.json();
    const remainingIds = afterData.items.map((p: { id: string }) => p.id);

    // 'age' (PK) and 'email' (active) should survive
    expect(remainingIds).toContain('age');
    expect(remainingIds).toContain('email');
  });

  // ──────── Cleanup ────────
  test('cleanup: delete test object types', async ({ request }) => {
    await cleanupTestData(request);

    // Verify test OTs are gone
    const resp = await request.get(`${API}/object-types`);
    const data = await resp.json();
    const testOts = data.items.filter((ot: { id: string }) => (ot.id as string).startsWith('e2e-'));
    expect(testOts).toHaveLength(0);
  });
});
