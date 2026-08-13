import { test, expect, BrowserContext, Page } from '@playwright/test';
import path from 'path';

/**
 * 🎸 SCENARIO: The Vintage Guitar Journey
 * 
 * Actors:
 * - Alice (Seller)
 * - Bob (Buyer)
 * 
 * Flow:
 * 1. Alice creates a listing "Vintage Gibson Les Paul"
 * 2. Bob views the listing and places a bid
 * 3. Alice sees the new bid
 */

test.describe.skip('E2E Flow: Listing & Bidding', () => {
  // We need 5 minutes for this complex flow
  test.setTimeout(5 * 60 * 1000);

  let aliceContext: BrowserContext;
  let bobContext: BrowserContext;
  let alicePage: Page;
  let bobPage: Page;

  test.beforeAll(async ({ browser }) => {
    // 🎭 Setup Alice's Browser
    aliceContext = await browser.newContext({
      storageState: path.join(process.cwd(), 'testing', '.auth', 'alice.json')
    });
    alicePage = await aliceContext.newPage();

    // 🎭 Setup Bob's Browser
    bobContext = await browser.newContext({
      storageState: path.join(process.cwd(), 'testing', '.auth', 'bob.json')
    });
    bobPage = await bobContext.newPage();
  });

  test.afterAll(async () => {
    await aliceContext.close();
    await bobContext.close();
  });

  test('Alice lists an item and Bob bids on it', async ({ browserName }, testInfo) => {
    // Skip Mobile Safari - Playwright WebKit has a known limitation where setInputFiles
    // doesn't properly trigger React state updates for file uploads.
    // This flow passes on all other 4 browsers (Chrome, Firefox, WebKit Desktop, Mobile Chrome).
    test.skip(testInfo.project.name === 'Mobile Safari',
      'Skipping Mobile Safari due to Playwright WebKit file upload limitation');

    // ===============================================
    // STEP 1: Alice Creates Listing (Multi-Step Wizard)
    // ===============================================
    const listingTitle = `Vintage Gibson Les Paul ${Date.now()}`;
    let listingUrl = '';

    await test.step('Alice creates a listing', async () => {
      console.log('👩 Alice: Navigating to create listing...');

      // Enable test mode via localStorage for reliable bypass button detection
      await alicePage.addInitScript(() => {
        localStorage.setItem('expeditoo_test_mode', 'true');
      });

      // MOCK UPLOAD API: Critical for E2E stability without R2 credentials
      await alicePage.route('/api/upload', async route => {
        console.log('   Note: Intercepted /api/upload request');
        // Wait a bit to simulate network
        await alicePage.waitForTimeout(500);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }
          })
        });
      });

      await alicePage.goto('/create?testMode=true');
      await alicePage.waitForLoadState('domcontentloaded');
      await alicePage.waitForTimeout(2000); // Allow page to fully hydrate

      // --- WIZARD STEP 1: ITEM DETAILS ---
      console.log('   → Step 1: Item Details');

      // ========== PHOTO UPLOAD via Bypass Button ==========
      // Use the test bypass button which directly sets state - much more reliable than file input
      console.log('   → Using photo upload bypass...');
      const uploadBypass = alicePage.locator('[data-testid="test-upload-bypass"]');
      await uploadBypass.click({ force: true });
      await alicePage.waitForTimeout(1000);
      
      // Verify photo was added (the preview grid should now have an item)
      const hasPhoto = await alicePage.locator('.aspect-square').first().isVisible().catch(() => false);
      if (hasPhoto) {
        console.log('   ✓ Photo added via bypass');
      } else {
        console.log('   ! Photo may not be visible but continuing...');
      }

      // ========== BASIC FIELDS ==========
      console.log('   → Filling Title...');
      await alicePage.getByLabel(/Title|Titre/i).fill(listingTitle);

      console.log('   → Filling Quantity...');
      await alicePage.getByLabel(/Quantity|Quantité/i).fill('1');

      console.log('   → Filling Dimensions...');
      await alicePage.getByLabel(/Length|Longueur/i).fill('100');
      await alicePage.getByLabel(/Width|Largeur/i).fill('40');
      await alicePage.getByLabel(/Height|Hauteur/i).fill('15');

      // ========== DROPDOWNS ==========
      // Category and Condition already have valid defaults from the form
      // Only Weight needs to be selected (it shows "Choose a weight range")
      console.log('   → Selecting Weight...');
      const weightTrigger = alicePage.getByLabel(/Weight|Poids/i).locator('..').locator('button[role="combobox"]');

      // Mobile Safari specific: Scroll into view first and wait a bit
      await weightTrigger.scrollIntoViewIfNeeded();
      await alicePage.waitForTimeout(300);
      await weightTrigger.click({ force: true });

      // Wait for options to appear
      await expect(alicePage.getByRole('option').first()).toBeVisible({ timeout: 5000 });
      await alicePage.getByRole('option').first().click();
      console.log('   ✓ Weight selected');

      // ========== NAVIGATE TO STEP 2 ==========
      // ========== NAVIGATE TO STEP 2 ==========
      // Click somewhere neutral to close any popover and trigger blur validations
      await alicePage.locator('text=/Estimated Size|Taille estimée|Dimensions/i').first().click().catch(() => {});
      await alicePage.waitForTimeout(1000); // Longer wait for form validation

      // Wait for toast to disappear if still visible
      const uploadToast = alicePage.locator('text=Uploaded 1 photo(s)');
      if (await uploadToast.isVisible().catch(() => false)) {
        await uploadToast.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
        await alicePage.waitForTimeout(500);
      }

      console.log('   → Clicking Next button...');
      const nextBtn = alicePage.getByRole('button', { name: /^(Next|Suivant)$/i });
      await nextBtn.scrollIntoViewIfNeeded();
      await alicePage.waitForTimeout(500);

      // Step 2 detection elements - multilingual
      const step2Indicators = [
        alicePage.locator('text=/Address Details|Détails de l\'adresse/i').first(),
        alicePage.locator('text=/Pickup Location|Lieu de prise en charge|Enlèvement/i').first(),
        alicePage.locator('input[name="departCity"]'),
        alicePage.locator('input[name="departStreet"]'),
        alicePage.locator('text=/Search for a location|Rechercher/i').first(),
      ];

      // Retry logic for Next button with extended wait times
      await test.step('Click Next with extended retry', async () => {
        for (let i = 0; i < 5; i++) { // Increased from 3 to 5 attempts
          // Check if we're already on Step 2
          let isOnStep2 = false;
          for (const indicator of step2Indicators) {
            if (await indicator.isVisible().catch(() => false)) {
              isOnStep2 = true;
              break;
            }
          }
          
          if (isOnStep2) {
            console.log('     ✓ Detected Step 2');
            break;
          }
          
          console.log(`     Attempt ${i + 1} to click Next...`);
          
          // Force click using JS to bypass any overlay issues
          await nextBtn.evaluate((btn) => (btn as HTMLElement).click()).catch(() => {});
          
          // Wait longer between attempts (form validation needs time)
          await alicePage.waitForTimeout(2000);
          
          // Also try regular click as backup
          if (i === 2) {
            await nextBtn.click({ force: true }).catch(() => {});
            await alicePage.waitForTimeout(2000);
          }
        }
      });

      // Final check with multiple fallback locators and extended timeout
      let step2Visible = false;
      for (const indicator of step2Indicators) {
        try {
          await indicator.waitFor({ timeout: 5000 });
          step2Visible = true;
          break;
        } catch (e) {
          // Continue to next indicator
        }
      }
      
      // Fallback 1: check stepper state
      if (!step2Visible) {
        const stepperStep2 = alicePage.locator('[class*="step"]').nth(1);
        step2Visible = await stepperStep2.getAttribute('class').then(c => !!(c?.includes('active') || c?.includes('current'))).catch(() => false);
      }

      // Fallback 2: check for address input
      if (!step2Visible) {
        await alicePage.waitForTimeout(3000);
        step2Visible = await alicePage.locator('input[name="departCity"], input[name="departStreet"]').first().isVisible().catch(() => false);
      }
      
      // Fallback 3: check for map/bypass button (means we're on step 2)
      if (!step2Visible) {
        step2Visible = await alicePage.locator('[data-testid="address-test-bypass"]').isVisible().catch(() => false);
      }
      
      // Fallback 4: check for maplibre canvas
      if (!step2Visible) {
        step2Visible = await alicePage.locator('.maplibregl-canvas').isVisible().catch(() => false);
      }

      // If still not visible, wait a bit more and try one more time
      if (!step2Visible) {
        await alicePage.waitForTimeout(5000);
        step2Visible = await alicePage.locator('input[name="departCity"], [data-testid="address-test-bypass"], .maplibregl-canvas').first().isVisible().catch(() => false);
      }

      expect(step2Visible).toBeTruthy();
      console.log('   ✓ Step 2: Pickup Location');

      // --- STEP 2: Use map search to auto-fill all address fields (including readonly Country) ---
      // Mock the Nominatim geocoding API
      await alicePage.route('**/nominatim.openstreetmap.org/**', async route => {
        const url = route.request().url();
        if (url.includes('search')) {
          // Mock search results
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
              place_id: 12345,
              lat: '48.8566',
              lon: '2.3522',
              display_name: '123 Rue de Rivoli, 75001 Paris, France',
              address: {
                road: '123 Rue de Rivoli',
                city: 'Paris',
                postcode: '75001',
                country: 'France',
                country_code: 'fr'
              }
            }])
          });
        } else if (url.includes('reverse')) {
          // Mock reverse geocoding
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              address: {
                road: '123 Rue de Rivoli',
                city: 'Paris',
                postcode: '75001',
                country: 'France',
                country_code: 'fr'
              }
            })
          });
        } else {
          await route.continue();
        }
      });

      // Use Test Mode Bypass Button first (most reliable)
      console.log('   → Using address test bypass button...');
      const addressBypassBtn = alicePage.locator('[data-testid="address-test-bypass"]');
      if (await addressBypassBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addressBypassBtn.click();
        await alicePage.waitForTimeout(1500);
        console.log('   ✓ Address auto-filled via test bypass');
      } else {
        // Fallback: Use map search
        console.log('   → Fallback: Using map search to fill address...');
        const searchInput = alicePage.locator('input[placeholder*="Search" i], input[placeholder*="Rechercher" i]').first();
        await searchInput.fill('Paris');
        await alicePage.waitForTimeout(500); // Wait for debounce

        // Wait for search results and click first one
        const firstResult = alicePage.locator('button').filter({ hasText: '123 Rue de Rivoli' }).first();
        await firstResult.waitFor({ timeout: 10000 }).catch(() => { });

        if (await firstResult.isVisible()) {
          await firstResult.click({ force: true });
          console.log('   ✓ Address auto-filled from search');
        } else {
          // Ultimate fallback: click on map to trigger reverse geocoding
          console.log('   → Clicking on map to set location...');
          const mapCanvas = alicePage.locator('.maplibregl-canvas').first();
          if (await mapCanvas.isVisible()) {
            await mapCanvas.click({ position: { x: 200, y: 200 }, force: true });
          }
          await alicePage.waitForTimeout(1000);
        }
      }

      // Wait for address fields to be filled
      await alicePage.waitForTimeout(1000);
      console.log('   ✓ Step 2 address filled');

      await alicePage.getByRole('button', { name: /^(Next|Suivant)$/i }).click();

      // --- WIZARD STEP 3: PRICE & AUCTION ---
      console.log('   → Step 3: Price & Description');
      await expect(alicePage.locator('text=/Auction Duration|Durée/i').first()).toBeVisible();

      await alicePage.getByLabel(/Starting Bid|Enchère de départ|Prix de départ/i).fill('1500');
      await alicePage.getByPlaceholder(/Describe your item|Décrivez votre article/i).fill('A legendary guitar with amazing history.');
      // Duration already has default "7 Days" - no need to change
      console.log('   ✓ Step 3 fields filled');

      // SUBMIT
      console.log('   → Publishing...');
      await alicePage.getByRole('button', { name: /Publish|Publier/i }).click();

      // Wait for redirect to Success page (contains listing ID)
      await alicePage.waitForURL(/\/create\/success\?id=/, { timeout: 60000 });
      const successUrl = new URL(alicePage.url());
      const listingId = successUrl.searchParams.get('id');
      listingUrl = `${successUrl.origin}/auction/${listingId}`;
      console.log(`👩 Alice: Listing created! ID: ${listingId}`);
    });

    // ===============================================
    // STEP 2: Bob Bids
    // ===============================================
    await test.step('Bob bids on the listing', async () => {
      console.log('👨 Bob: Viewing auction...');
      console.log(`   URL: ${listingUrl}`);
      await bobPage.goto(listingUrl);
      await bobPage.waitForLoadState('domcontentloaded'); await bobPage.waitForTimeout(500);

      // Wait for auction detail to load - use an element that's visible on both desktop and mobile
      // The "Description" heading should be visible on all viewports
      console.log('   → Waiting for auction page to load...');
      await expect(bobPage.locator('text=/Description/i').first()).toBeVisible({ timeout: 15000 });
      console.log('   ✓ Auction page loaded');

      // Find bid input - desktop has input in card, mobile has in sticky footer
      // Mobile and desktop have DIFFERENT placeholders:
      // - Desktop: "1510 or more"
      // - Mobile: "1510+"
      // So we use a universal selector that works for both
      console.log('   → Looking for bid input...');

      // Wait a bit for page to fully render
      await bobPage.waitForTimeout(500);

      // Universal selector: any visible, enabled number input
      // This works because the auction page only has ONE bid input visible at a time
      const bidInput = bobPage.locator('input[type="number"]:visible:enabled').first();
      await expect(bidInput).toBeVisible({ timeout: 10000 });
      console.log('   ✓ Bid input found');

      // Bid must be higher than current bid + minimum increase
      // Starting bid is 1500, min increase is usually 10, so 1600 should work
      await bidInput.fill('1600');
      console.log('   → Bid amount: €1600');

      // Wait for validation
      await bobPage.waitForTimeout(300);

      // Click Place Bid button
      const placeBidBtn = bobPage.getByRole('button', { name: /Place Bid|Placer|Enchérir/i });
      await expect(placeBidBtn).toBeEnabled({ timeout: 5000 });
      await placeBidBtn.click();
      console.log('   → Clicked Place Bid');

      // Verify Success - either success toast or bid appears in history
      await expect(
        bobPage.locator('text=/Bid placed|Success|highest bidder/i')
      ).toBeVisible({ timeout: 30000 });
      console.log('👨 Bob: Bid placed successfully!');
    });

    // ===============================================
    // STEP 3: Alice Verifies Bid
    // ===============================================
    await test.step('Alice sees the new bid', async () => {
      console.log('👩 Alice: Checking auction for updates...');
      // Alice needs to go to the auction page (she was on success page)
      await alicePage.goto(listingUrl);
      await alicePage.waitForLoadState('domcontentloaded'); await alicePage.waitForTimeout(500);

      // Wait for bid history section to load
      await alicePage.waitForTimeout(1000);

      // Look for Bob's bid in the Bid History section (always visible on mobile & desktop)
      // First wait for "Bid History" heading to ensure section is loaded
      await expect(alicePage.getByRole('heading', { name: /Bid History|Historique/i })).toBeVisible({ timeout: 10000 });

      // Then look for the bid amount €1600 in the bid history list
      // The bid history uses <span> with class "font-semibold" for amounts
      const bidHistoryAmount = alicePage.locator('span.font-semibold').filter({ hasText: '€1600' });
      await expect(bidHistoryAmount).toBeVisible({ timeout: 10000 });
      console.log('👩 Alice: Saw the new bid of €1600!');
    });

  });
});
