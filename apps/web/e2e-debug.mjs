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

  const modal = page.locator('.ant-modal');

  // Step 1 → Step 2: Click Next (skip dataset selection for now)
  const nextBtn = modal.locator('button:has-text("Next")');
  // Next button might be disabled if no dataset is selected — let's check
  const isNextDisabled = await nextBtn.isDisabled();
  console.log(`Next button disabled: ${isNextDisabled}`);

  if (isNextDisabled) {
    // Try to select the first available (non-in-use) dataset
    // Or try the "Use This Dataset" button that's enabled
    const useButtons = modal.locator('button:has-text("Use This Dataset")');
    const count = await useButtons.count();
    console.log(`"Use This Dataset" buttons found: ${count}`);
    for (let i = 0; i < count; i++) {
      const btn = useButtons.nth(i);
      const disabled = await btn.isDisabled();
      console.log(`  Button ${i}: disabled=${disabled}`);
      if (!disabled) {
        await btn.click();
        await page.waitForTimeout(300);
        console.log('✅ Selected dataset');
        break;
      }
    }
  }

  // Click Next to step 2
  if (!(await nextBtn.isDisabled())) {
    await nextBtn.click();
    await page.waitForTimeout(300);
    console.log('✅ Step 2 (Metadata)');

    // Check step 2 fields
    const labels = await modal.locator('.ant-form-item-label').allTextContents();
    console.log('Step 2 form labels:', labels);

    // Fill name
    const nameInput = modal.locator('#displayName, input[id="displayName"]');
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Test Aircraft');
    } else {
      // Try finding input by label
      const inputs = modal.locator('.ant-form-item input[type="text"]');
      const inputCount = await inputs.count();
      console.log(`  Text inputs found: ${inputCount}`);
      if (inputCount > 0) {
        await inputs.first().fill('Test Aircraft');
      }
    }

    // Click Next to step 3
    await nextBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ Step 3 (Properties)');

    // Screenshot step 3
    await page.screenshot({ path: '/Users/lilu/Projects/OpenOntology/apps/web/e2e-step3.png', fullPage: true });
    console.log('📸 Screenshot saved to apps/web/e2e-step3.png');

    // Analyze step 3 content
    const step3Text = await modal.textContent();
    console.log('\nStep 3 text (first 500 chars):');
    console.log(step3Text?.slice(0, 500));

    // Check for Add All button
    const hasAddAll = await modal.locator('text=Add All').isVisible().catch(() => false);
    console.log(`\nHas "Add All" button: ${hasAddAll}`);

    // Count selects
    const selects = modal.locator('.ant-select');
    const selectCount = await selects.count();
    console.log(`Total Selects in step 3: ${selectCount}`);

    // Try to interact with each select
    for (let i = 0; i < selectCount; i++) {
      const sel = selects.nth(i);
      const box = await sel.boundingBox();
      const className = await sel.getAttribute('class') || '';
      const isOpen = className.includes('ant-select-open');
      const isDisabled = className.includes('ant-select-disabled');
      const selectorText = await sel.locator('.ant-select-selection-item, .ant-select-selection-placeholder').textContent().catch(() => 'N/A');
      console.log(`\n  Select[${i}]: text="${selectorText}", disabled=${isDisabled}, open=${isOpen}, box=${JSON.stringify(box)}`);

      if (!isDisabled && box) {
        try {
          // Click on the selector
          await sel.locator('.ant-select-selector').click({ timeout: 3000 });
          await page.waitForTimeout(500);

          // Check if dropdown appeared
          const dropdowns = page.locator('.ant-select-dropdown:visible');
          const dropdownCount = await dropdowns.count();
          console.log(`    Visible dropdowns after click: ${dropdownCount}`);

          if (dropdownCount > 0) {
            const dd = dropdowns.first();
            const items = dd.locator('.ant-select-item');
            const itemCount = await items.count();
            console.log(`    Dropdown items: ${itemCount}`);
            for (let j = 0; j < Math.min(itemCount, 5); j++) {
              const itemText = await items.nth(j).textContent();
              console.log(`      Item[${j}]: "${itemText}"`);
            }
          }

          // Close by pressing Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
        } catch (err) {
          console.log(`    Error: ${err.message?.slice(0, 100)}`);
        }
      }
    }

    // Take final screenshot
    await page.screenshot({ path: '/Users/lilu/Projects/OpenOntology/apps/web/e2e-step3-final.png' });
  } else {
    console.log('❌ Cannot proceed: Next button still disabled (no dataset selected)');
    await page.screenshot({ path: '/Users/lilu/Projects/OpenOntology/apps/web/e2e-step1.png' });
  }

  await browser.close();
  console.log('\nDone');
}

main().catch(console.error);
