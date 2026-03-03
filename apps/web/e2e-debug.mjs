import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to the app
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  console.log('✅ Page loaded');

  // Click "New" button to open dropdown menu
  const newBtn = page.locator('text=New').first();
  if (await newBtn.isVisible()) {
    await newBtn.click();
    await page.waitForTimeout(500);

    // Click "Create Object Type"
    const createOT = page.locator('text=Create Object Type').first();
    if (await createOT.isVisible()) {
      await createOT.click();
      await page.waitForTimeout(500);
      console.log('✅ Create Object Type wizard opened');
    }
  }

  // Check if the wizard modal is visible
  const modal = page.locator('.ant-modal');
  const isModalVisible = await modal.isVisible();
  console.log(`Modal visible: ${isModalVisible}`);

  if (!isModalVisible) {
    console.log('❌ Modal not visible, trying alternate approach');
    await browser.close();
    return;
  }

  // We need to get to step 3 (Properties)
  // First, we need to select a datasource (step 1) or skip
  // Check current step
  const stepContent = await modal.textContent();
  console.log('Current modal content preview:', stepContent?.slice(0, 200));

  // Select a dataset if available
  const datasetBtn = modal.locator('text=Use This Dataset').first();
  if (await datasetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await datasetBtn.click();
    await page.waitForTimeout(300);
    console.log('✅ Selected dataset');
  }

  // Click Next to go to step 2 (Metadata)
  const nextBtn = modal.locator('button:has-text("Next")');
  if (await nextBtn.isVisible()) {
    await nextBtn.click();
    await page.waitForTimeout(300);
    console.log('✅ Step 2 (Metadata)');

    // Check what fields are in step 2
    const step2Content = await modal.textContent();
    const hasPlural = step2Content?.includes('Plural');
    const hasID = step2Content?.includes('e.g. my-object-type');
    const hasApiName = step2Content?.includes('e.g. MyObjectType');
    console.log(`  Has Plural Name: ${hasPlural}`);
    console.log(`  Has ID field: ${hasID}`);
    console.log(`  Has API Name: ${hasApiName}`);

    // Fill in name
    const nameInput = modal.locator('input').nth(1); // first input after icon selector
    await nameInput.fill('Test Aircraft');
    await page.waitForTimeout(200);

    // Click Next to go to step 3 (Properties)
    await nextBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ Step 3 (Properties)');

    // Check step 3 content
    const step3Content = await modal.textContent();
    console.log('Step 3 content preview:', step3Content?.slice(0, 300));

    // Check for "Add All" button (should NOT exist)
    const addAllBtn = modal.locator('text=Add All');
    const hasAddAll = await addAllBtn.isVisible().catch(() => false);
    console.log(`  Has "Add All" button: ${hasAddAll}`);

    // Check for "Add Property" button
    const addPropBtn = modal.locator('text=Add Property');
    const hasAddProp = await addPropBtn.isVisible().catch(() => false);
    console.log(`  Has "Add Property" button: ${hasAddProp}`);

    // Check for PK/TK labels
    const hasPK = step3Content?.includes('Primary Key');
    const hasTK = step3Content?.includes('Title');
    console.log(`  Has Primary Key selector: ${hasPK}`);
    console.log(`  Has Title Key selector: ${hasTK}`);

    // Try to find and interact with PK Select
    const allSelects = modal.locator('.ant-select');
    const selectCount = await allSelects.count();
    console.log(`  Total Select components: ${selectCount}`);

    // Try each select to see if it opens
    for (let i = 0; i < Math.min(selectCount, 4); i++) {
      const sel = allSelects.nth(i);
      const selText = await sel.textContent();
      const selClass = await sel.getAttribute('class');
      const isDisabled = selClass?.includes('ant-select-disabled');
      console.log(`  Select[${i}]: text="${selText?.trim()}", disabled=${isDisabled}`);

      // Try to open it
      try {
        await sel.locator('.ant-select-selector').click();
        await page.waitForTimeout(500);

        // Check if dropdown appeared
        const dropdown = page.locator('.ant-select-dropdown');
        const dropdownVisible = await dropdown.isVisible().catch(() => false);
        console.log(`    Dropdown opened: ${dropdownVisible}`);

        if (dropdownVisible) {
          const options = dropdown.locator('.ant-select-item-option');
          const optCount = await options.count();
          console.log(`    Options count: ${optCount}`);
          for (let j = 0; j < Math.min(optCount, 5); j++) {
            const optText = await options.nth(j).textContent();
            console.log(`      Option[${j}]: "${optText}"`);
          }
        }

        // Click elsewhere to close
        await modal.locator('.ant-steps').click();
        await page.waitForTimeout(300);
      } catch (err) {
        console.log(`    Error interacting: ${err.message}`);
      }
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: '/Users/lilu/Projects/OpenOntology/apps/web/e2e-debug-step3.png' });
    console.log('📸 Screenshot saved to e2e-debug-step3.png');
  }

  await browser.close();
  console.log('Done');
}

main().catch(console.error);
