# E2E 测试文件骨架模板

## 完整 .spec.ts 模板

```typescript
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { selectAntOption, clearAntSelect, confirmPopconfirm, waitForAntMessage, clickAntTab } from './helpers/antd';
import { API, createObjectType, createProperty } from './helpers/api';
import { cleanupByPrefix } from './helpers/fixtures';

/**
 * E2E tests for <FEATURE_NAME>
 *
 * Prerequisites:
 * - Backend running on localhost:8000
 * - Frontend running on localhost:5173
 *
 * Covers:
 * - <AC-ID>: <description>
 * - <AC-ID>: <description>
 */

// Data prefix for test isolation
const PREFIX = 'e2e-<feature>-';

// Increase timeout if wizard/multi-step flows
// test.setTimeout(60_000);

test.describe.serial('<Feature Name> — E2E', () => {
  // Shared state across serial tests
  let otRid: string;

  // ──────── Setup ────────
  test('setup: create test data via API', async ({ request }) => {
    // Clean any leftover test data
    await cleanupByPrefix(request, PREFIX);

    // Create test entities
    otRid = await createObjectType(request, `${PREFIX}my-type`, 'E2E My Type');

    // Create properties if needed
    await createProperty(request, otRid, `${PREFIX}prop-a`, { apiName: 'propA' });

    // Verify setup
    const resp = await request.get(`${API}/object-types/${otRid}/properties`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.total).toBe(1);
  });

  // ──────── Test Cases ────────

  test('<AC-ID>: <test description>', async ({ page }) => {
    // Covers: AC-NN
    await page.goto('/target-page');

    // Wait for page content (prefer element visibility over networkidle)
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Interact with Ant Design components using shared helpers
    const select = page.locator('.ant-select').first();
    await selectAntOption(page, select, 'Option Text');

    // Assert results
    await expect(page.getByText('Expected Result')).toBeVisible();
  });

  test('<AC-ID>: <another test>', async ({ page, request }) => {
    // Covers: AC-NN
    await page.goto('/target-page');
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // Perform action...

    // Verify via API (for data mutations)
    const resp = await request.get(`${API}/object-types/${otRid}/properties`);
    const data = await resp.json();
    expect(data.items).toHaveLength(1);
  });

  // ──────── Cleanup ────────
  test('cleanup: delete test data', async ({ request }) => {
    // Discard any pending working state changes
    await request.delete(`${API}/ontologies/ri.ontology.ontology.default/working-state`).catch(() => {});

    // Delete test OTs (handles PK/active constraints automatically)
    await cleanupByPrefix(request, PREFIX);

    // If test created datasets, clean them up too
    // const dsResp = await request.get(`${API}/datasets`);
    // if (dsResp.ok()) {
    //   for (const ds of (await dsResp.json()).items ?? []) {
    //     if ((ds.name as string).startsWith(PREFIX)) {
    //       await request.delete(`${API}/datasets/${ds.rid}`).catch(() => {});
    //     }
    //   }
    // }

    // Discard any working state changes from cleanup itself
    await request.delete(`${API}/ontologies/ri.ontology.ontology.default/working-state`).catch(() => {});

    // Verify: only test data was removed
    const resp = await request.get(`${API}/object-types`);
    const data = await resp.json();
    const testOts = data.items.filter((ot: { id: string }) => ot.id.startsWith(PREFIX));
    expect(testOts).toHaveLength(0);
  });
});
```

## 关键结构规则

1. **test.describe.serial** — 测试按顺序执行（setup → tests → cleanup）
2. **setup 和 cleanup 是独立 test case** — 不是 beforeAll/afterAll（Playwright 推荐，可单独看到结果）
3. **每个 test 注释 `// Covers: AC-NN`** — 追溯到 spec.md 的 AC 表格
4. **PREFIX 常量** — 所有测试数据 ID 以 `e2e-<feature>-` 开头
5. **API 验证** — 数据变更操作后，通过 API 断言最终状态（不仅依赖 UI）
6. **共享 helpers** — 所有 Ant Design 交互使用 `e2e/helpers/antd.ts`，不在文件内重定义

## 导入路径

```typescript
// 从 e2e/*.spec.ts 导入 helpers
import { selectAntOption } from './helpers/antd';
import { API, createObjectType } from './helpers/api';
import { cleanupByPrefix } from './helpers/fixtures';
```

## i18n 文本匹配模式

```typescript
// 标签/按钮文本 — 用 RegExp 双语匹配
page.locator('button').filter({ hasText: /Add Property|添加属性/ })
page.getByText(/^General$|^基本信息$/)

// Tab 文本 — 用 RegExp
await clickAntTab(drawer, /Details|详细信息/);

// 表格内容 — 通常是数据不需要 i18n
await expect(page.getByText('E2E Employee').first()).toBeVisible();
```
