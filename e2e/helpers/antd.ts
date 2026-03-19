import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Select an option from an Ant Design Select dropdown.
 *
 * @param page - Playwright page
 * @param selectLocator - Locator pointing to the .ant-select element
 * @param search - String to type-to-search (fill requires string), or RegExp for hasText matching only
 */
export async function selectAntOption(
  page: Page,
  selectLocator: Locator,
  search: string | RegExp,
): Promise<void> {
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

/**
 * Clear an Ant Design Select by clicking its clear button.
 */
export async function clearAntSelect(
  page: Page,
  selectLocator: Locator,
): Promise<void> {
  const clearBtn = selectLocator.locator('.ant-select-clear');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Confirm an Ant Design Popconfirm by clicking its primary/dangerous button.
 */
export async function confirmPopconfirm(page: Page): Promise<void> {
  const confirmBtn = page.locator(
    '.ant-popconfirm .ant-btn-primary, .ant-popover .ant-btn-dangerous',
  );
  await expect(confirmBtn).toBeVisible({ timeout: 3000 });
  await confirmBtn.click();
}

/**
 * Wait for an Ant Design message to appear.
 */
export async function waitForAntMessage(
  page: Page,
  timeout = 5000,
): Promise<void> {
  await expect(page.locator('.ant-message')).toBeVisible({ timeout });
}

/**
 * Click an Ant Design tab within a container, matched by text.
 */
export async function clickAntTab(
  container: Locator,
  tabText: string | RegExp,
): Promise<void> {
  const tab = container.locator('.ant-tabs-tab').filter({ hasText: tabText });
  await tab.click();
  await container.page().waitForTimeout(300);
}
