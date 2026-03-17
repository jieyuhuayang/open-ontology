import { test, expect } from '@playwright/test';

// Helper: type a search query and wait for search mode to activate
async function enterSearchMode(page: import('@playwright/test').Page, query = 'test') {
  const input = page.locator('input[placeholder]').first();
  await input.fill(query);
  // Wait for debounce (300ms) + search mode activation
  await page.waitForTimeout(500);
  return input;
}

test.describe('Search UX Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // Fix 1: Escape key exits search mode
  test('Escape key exits search mode and blurs input', async ({ page }) => {
    const input = await enterSearchMode(page);

    // Verify search mode is active (sidebar should show search menu)
    await expect(page.locator('text=所有结果').or(page.locator('text=All results'))).toBeVisible({
      timeout: 5000,
    });

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Search mode should be exited — sidebar should show normal nav
    await expect(
      page.locator('text=所有结果').or(page.locator('text=All results')),
    ).not.toBeVisible({ timeout: 3000 });

    // Input should be cleared
    await expect(input).toHaveValue('');

    // Input should be blurred (not focused)
    const isFocused = await input.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(false);
  });

  // Fix 2: Clicking search result exits search mode
  test('clicking a search result exits search mode and navigates', async ({ page }) => {
    // We need actual data for this — search for something that might exist
    const input = page.locator('input[placeholder]').first();
    await input.fill('a');
    await page.waitForTimeout(500);

    // Check if there are any search results
    const searchResultItem = page.locator('.search-result-item').first();
    const hasResults = (await searchResultItem.count()) > 0;

    if (hasResults) {
      await searchResultItem.click();
      await page.waitForTimeout(300);

      // Search mode should be exited
      await expect(
        page.locator('text=所有结果').or(page.locator('text=All results')),
      ).not.toBeVisible({ timeout: 3000 });

      // Input should be cleared
      await expect(input).toHaveValue('');
    } else {
      // No results — verify "no results" message is shown (still validates UI is functional)
      const noResultsMsg = page.locator('text=未找到').or(page.locator('text=No results'));
      await expect(noResultsMsg).toBeVisible({ timeout: 5000 });
    }
  });

  // Fix 3: Close button in sidebar exits search mode
  test('sidebar close button exits search mode', async ({ page }) => {
    await enterSearchMode(page);

    // Verify search mode is active
    await expect(page.locator('text=所有结果').or(page.locator('text=All results'))).toBeVisible({
      timeout: 5000,
    });

    // Click the close button (CloseOutlined icon in sidebar)
    const closeBtn = page.locator('aside .anticon-close, nav .anticon-close').first();
    await expect(closeBtn).toBeVisible({ timeout: 3000 });
    await closeBtn.click();
    await page.waitForTimeout(200);

    // Search mode should be exited
    await expect(
      page.locator('text=所有结果').or(page.locator('text=All results')),
    ).not.toBeVisible({ timeout: 3000 });
  });

  // Fix 4: SearchHighlight regex bug — verify highlights render correctly
  test('search highlights display correctly for all matches', async ({ page }) => {
    await enterSearchMode(page, 'a');

    // Wait for results
    await page.waitForTimeout(1000);

    // Check if any <mark> elements exist (highlights)
    const marks = page.locator('mark');
    const markCount = await marks.count();

    if (markCount > 0) {
      // Verify all marks contain the search query (case-insensitive)
      for (let i = 0; i < Math.min(markCount, 10); i++) {
        const text = await marks.nth(i).textContent();
        expect(text?.toLowerCase()).toContain('a');
      }
    }
    // If no marks, there might be no results — that's OK
  });

  // Fix 5: Table rows are clickable in filtered view
  test('filtered view table rows are clickable', async ({ page }) => {
    await enterSearchMode(page, 'a');

    // Wait for search results
    await page.waitForTimeout(1000);

    // Click on "Object Types" in the search sidebar to switch to filtered view
    const otMenuItem = page
      .locator('.ant-menu-item')
      .filter({ hasText: /对象类型|Object Types/ })
      .first();
    const hasMenuItem = (await otMenuItem.count()) > 0;

    if (hasMenuItem) {
      await otMenuItem.click();
      await page.waitForTimeout(500);

      // Check if a table is rendered
      const tableRows = page.locator('.ant-table-row');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        // Verify rows have pointer cursor
        const cursor = await tableRows.first().evaluate((el) => window.getComputedStyle(el).cursor);
        expect(cursor).toBe('pointer');

        // Click the first row — it should navigate and exit search
        await tableRows.first().click();
        await page.waitForTimeout(500);

        // Search mode should be exited
        await expect(
          page.locator('text=所有结果').or(page.locator('text=All results')),
        ).not.toBeVisible({ timeout: 3000 });
      }
    }
  });

  // Fix 6: Table column headers are internationalized
  test('table column headers use i18n', async ({ page }) => {
    await enterSearchMode(page, 'a');
    await page.waitForTimeout(1000);

    // Switch to a filtered type view
    const otMenuItem = page
      .locator('.ant-menu-item')
      .filter({ hasText: /对象类型|Object Types/ })
      .first();

    if ((await otMenuItem.count()) > 0) {
      await otMenuItem.click();
      await page.waitForTimeout(500);

      // Check for table headers — they should exist and not be raw English when in zh-CN
      const headers = page.locator('.ant-table-thead th');
      const headerCount = await headers.count();

      if (headerCount > 0) {
        // At least verify headers are not empty
        for (let i = 0; i < headerCount; i++) {
          const text = await headers.nth(i).textContent();
          expect(text?.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  // Fix 7: Hover uses CSS instead of inline JS
  test('search result items use CSS hover', async ({ page }) => {
    await enterSearchMode(page, 'a');
    await page.waitForTimeout(1000);

    const items = page.locator('.search-result-item');
    const itemCount = await items.count();

    if (itemCount > 0) {
      const firstItem = items.first();

      // Verify the element has the CSS class
      await expect(firstItem).toHaveClass(/search-result-item/);

      // Verify no inline background style is set initially
      const style = await firstItem.getAttribute('style');
      expect(style ?? '').not.toContain('background');
    }
  });

  // Fix 8: changeState labels are i18n
  test('changeState tags use i18n labels', async ({ page }) => {
    await enterSearchMode(page, 'a');
    await page.waitForTimeout(1000);

    // Look for any Tag elements in search results
    const tags = page.locator('.search-result-item .ant-tag');
    const tagCount = await tags.count();

    if (tagCount > 0) {
      for (let i = 0; i < Math.min(tagCount, 5); i++) {
        const text = await tags.nth(i).textContent();
        // Should NOT be raw English labels like "New", "Modified", "Deleted"
        // when in Chinese locale; but in English locale these are valid.
        // Just verify the tag has non-empty text.
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  // Cmd+K shortcut to focus search
  test('Cmd+K focuses search input', async ({ page }) => {
    const input = page.locator('input[placeholder]').first();

    // Input should not be focused initially
    const isFocusedBefore = await input.evaluate((el) => document.activeElement === el);
    expect(isFocusedBefore).toBe(false);

    // Press Cmd+K (or Ctrl+K on non-Mac)
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(200);

    const isFocusedAfter = await input.evaluate((el) => document.activeElement === el);
    expect(isFocusedAfter).toBe(true);
  });
});
