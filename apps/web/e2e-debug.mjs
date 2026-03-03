import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  console.log('✅ Page loaded');

  // Open wizard
  await page.locator('text=New').first().click();
  await page.waitForTimeout(300);
  await page.locator('text=Create Object Type').first().click();
  await page.waitForTimeout(500);
  console.log('✅ Wizard opened');

  const modal = page.locator('.ant-modal-content');

  // Step 1: Click the first non-disabled table row to select a dataset
  const rows = modal.locator('.ant-table-row');
  const rowCount = await rows.count();
  console.log(`Dataset rows: ${rowCount}`);

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const opacity = await row.evaluate((el) => getComputedStyle(el).opacity);
    const text = await row.textContent();
    console.log(`  Row[${i}]: opacity=${opacity}, text="${text?.slice(0, 60)}"`);
    if (opacity !== '0.5') {
      await row.click();
      await page.waitForTimeout(300);
      console.log(`  ✅ Selected row ${i}`);
      break;
    }
  }

  // Click Next → Step 2
  const nextBtn = modal.locator('button:has-text("Next")');
  if (await nextBtn.isDisabled()) {
    console.log('❌ Next still disabled after selecting dataset');
    await page.screenshot({ path: 'apps/web/e2e-step1.png' });
    await browser.close();
    return;
  }

  await nextBtn.click();
  await page.waitForTimeout(500);
  console.log('✅ Step 2 (Metadata)');

  // Check step 2 fields
  const labels = await modal.locator('.ant-form-item-label label').allTextContents();
  console.log('Step 2 labels:', labels);

  // Fill display name
  const inputs = modal.locator('.ant-form-item input[type="text"]');
  const inputCount = await inputs.count();
  for (let i = 0; i < inputCount; i++) {
    const id = await inputs.nth(i).getAttribute('id');
    console.log(`  Input[${i}]: id="${id}"`);
  }
  // Find the displayName input
  const nameInput = modal.locator('#displayName');
  if (await nameInput.isVisible()) {
    await nameInput.fill('Test Aircraft');
  } else {
    // Fallback to first text input
    if (inputCount > 0) await inputs.first().fill('Test Aircraft');
  }

  // Click Next → Step 3
  await nextBtn.click();
  await page.waitForTimeout(1000);
  console.log('✅ Step 3 (Properties)');

  // Screenshot
  await page.screenshot({ path: 'apps/web/e2e-step3.png' });
  console.log('📸 e2e-step3.png saved');

  // ==========================================
  // CRITICAL: Test PK/TK Select dropdowns
  // ==========================================
  console.log('\n=== Testing PK/TK Select dropdowns ===');

  const allSelects = modal.locator('.ant-select');
  const selectCount = await allSelects.count();
  console.log(`Total Selects: ${selectCount}`);

  for (let i = 0; i < selectCount; i++) {
    const sel = allSelects.nth(i);
    const cls = await sel.getAttribute('class') || '';
    const isDisabled = cls.includes('ant-select-disabled');
    const isOpen = cls.includes('ant-select-open');
    const placeholderEl = sel.locator('.ant-select-selection-placeholder');
    const selectedEl = sel.locator('.ant-select-selection-item');
    const placeholder = await placeholderEl.textContent().catch(() => '');
    const selected = await selectedEl.textContent().catch(() => '');
    const box = await sel.boundingBox();

    console.log(`\nSelect[${i}]:`);
    console.log(`  class: ${cls.split(' ').filter(c => c.startsWith('ant-select')).join(' ')}`);
    console.log(`  disabled: ${isDisabled}, open: ${isOpen}`);
    console.log(`  placeholder: "${placeholder}", selected: "${selected}"`);
    console.log(`  box: ${JSON.stringify(box)}`);

    // Only test the first 2 selects (PK and TK)
    if (i < 2 && !isDisabled && box) {
      console.log('  → Attempting to click...');
      const selector = sel.locator('.ant-select-selector');
      await selector.click({ timeout: 5000 });
      await page.waitForTimeout(500);

      // Check for dropdown
      const visibleDropdowns = page.locator('.ant-select-dropdown');
      const ddCount = await visibleDropdowns.count();
      console.log(`  → Dropdown count: ${ddCount}`);

      for (let d = 0; d < ddCount; d++) {
        const dd = visibleDropdowns.nth(d);
        const visible = await dd.isVisible();
        const ddBox = await dd.boundingBox();
        if (visible) {
          console.log(`  → Dropdown[${d}]: visible=true, box=${JSON.stringify(ddBox)}`);
          const items = dd.locator('.ant-select-item-option');
          const itemCount = await items.count();
          console.log(`  → Items: ${itemCount}`);
          for (let j = 0; j < Math.min(itemCount, 5); j++) {
            console.log(`    Item[${j}]: "${await items.nth(j).textContent()}"`);
          }

          // Try clicking first item
          if (itemCount > 0) {
            await items.first().click();
            await page.waitForTimeout(300);
            console.log('  → Clicked first item');

            // Check if selection changed
            const newSelected = await sel.locator('.ant-select-selection-item').textContent().catch(() => 'N/A');
            console.log(`  → After click, selected: "${newSelected}"`);
          }
        }
      }

      // Take screenshot after interaction
      await page.screenshot({ path: `apps/web/e2e-select-${i}.png` });

      // Press Escape to close any open dropdown
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  }

  // Final screenshot
  await page.screenshot({ path: 'apps/web/e2e-step3-final.png' });
  console.log('\n📸 Final screenshots saved');

  await browser.close();
  console.log('Done');
}

main().catch(console.error);
