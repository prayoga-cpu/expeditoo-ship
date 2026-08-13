import { test, expect } from '@playwright/test';

test.describe('Critical Flow: Register & List Item', () => {
    // Use Alice (Seller)
    test.use({ storageState: 'testing/.auth/alice.json' });

    test('should allow an authenticated seller to list an item via wizard', async ({ page }) => {
        // Increase test timeout for slow environments
        test.setTimeout(120000);

        // Enable test mode via localStorage (more reliable than URL parameter)
        await page.addInitScript(() => {
            localStorage.setItem('expeditoo_test_mode', 'true');
        });

        // 1. MOCK APIs for stability
        // Mock Upload
        await page.route('/api/upload', async route => {
            await page.waitForTimeout(500);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }
                })
            });
        });

        // Mock Geocoding (Nominatim)
        await page.route('**/nominatim.openstreetmap.org/**', async route => {
            const url = route.request().url();
            if (url.includes('search')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([{
                        place_id: 12345,
                        lat: '48.8566',
                        lon: '2.3522',
                        display_name: '123 Rue de Rivoli, 75001 Paris, France',
                        address: { road: '123 Rue de Rivoli', city: 'Paris', postcode: '75001', country: 'France', country_code: 'fr' }
                    }])
                });
            } else if (url.includes('reverse')) {
                 await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        place_id: 67890,
                        lat: '48.8566',
                        lon: '2.3522',
                        display_name: '123 Rue de Rivoli, 75001 Paris, France',
                        address: { road: '123 Rue de Rivoli', city: 'Paris', postcode: '75001', country: 'France', country_code: 'fr' }
                    })
                });
            } else {
                await route.continue();
            }
        });

        console.log('Alice: Logged in, navigating to create listing...');
        await page.goto('/create?testMode=true');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000); // Wait for page to hydrate

        // --- STEP 1: ITEM DETAILS ---
        console.log('Step 1: Item Details...');

        // Upload Photo (Try multiple methods)
        console.log('Using Test Bypass for Upload...');
        
        // Method 1: Test bypass button
        const bypassBtn = page.locator('[data-testid="test-upload-bypass"]');
        if (await bypassBtn.isVisible().catch(() => false)) {
            await bypassBtn.click({ force: true });
        } else {
            // Method 2: Direct file input
            const fileInput = page.locator('input[type="file"]').first();
            if (await fileInput.count() > 0) {
                const validImageBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
                await fileInput.setInputFiles({
                    name: 'test.gif',
                    mimeType: 'image/gif',
                    buffer: validImageBuffer
                });
            }
        }
        
        // Wait for state update (preview should appear) or continue
        await page.waitForTimeout(3000);
        const hasPreview = await page.locator('div[style*="background-image"], img[src*="data:"], .group.relative img').first().isVisible().catch(() => false);

        // Fill Fields
        const timestamp = Date.now();
        await page.locator('input[name="designation"]').fill(`E2E Listing ${timestamp}`);
        await page.locator('input[name="quantity"]').fill('1');

        // Dimensions
        await page.locator('input[name="length"]').fill('20');
        await page.locator('input[name="width"]').fill('20');
        await page.locator('input[name="height"]').fill('20');

        // Select Weight (Combobox) with more robust handling
        const weightTrigger = page.locator('button[role="combobox"]').nth(2); 
        await weightTrigger.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await weightTrigger.click({ force: true });
        await page.waitForTimeout(500);
        await page.getByRole('option').first().click();
        await page.waitForTimeout(500);

        // Close any popover by clicking neutral area
        await page.locator('text=/Estimated Size|Taille estimée/i').first().click().catch(() => {});
        await page.waitForTimeout(1000);

        // --- NAVIGATE TO STEP 2 ---
        console.log('Step 1 -> Step 2...');
        
        // Step 2 detection elements - multilingual
        const step2Indicators = [
            page.locator('text=/Address Details|Détails de l\'adresse/i').first(),
            page.locator('text=/Pickup Location|Lieu de prise en charge/i').first(),
            page.locator('input[name="departCity"]'),
            page.locator('input[name="departStreet"]'),
        ];

        // Click Next with retry
        const nextBtn = page.getByRole('button', { name: /^(Next|Suivant)$/i });
        for (let i = 0; i < 5; i++) {
            // Check if already on Step 2
            let isOnStep2 = false;
            for (const indicator of step2Indicators) {
                if (await indicator.isVisible().catch(() => false)) {
                    isOnStep2 = true;
                    break;
                }
            }
            if (isOnStep2) break;

            console.log(`  Attempt ${i + 1} to click Next...`);
            await nextBtn.evaluate((btn) => (btn as HTMLElement).click()).catch(() => {});
            await page.waitForTimeout(2000);
        }
        
        // --- STEP 2: PICKUP LOCATION ---
        console.log('Step 2: Pickup Location...');
        
        // Wait for Step 2 with extended timeout
        let step2Loaded = false;
        for (const indicator of step2Indicators) {
            if (await indicator.isVisible().catch(() => false)) {
                step2Loaded = true;
                break;
            }
        }
        
        if (!step2Loaded) {
            // Fallback: just wait and check for city input
            await page.waitForTimeout(3000);
            step2Loaded = await page.locator('input[name="departCity"]').isVisible().catch(() => false);
        }

        // Use Test Mode Bypass Button if available (fills Paris address automatically)
        const addressBypassBtn = page.locator('[data-testid="address-test-bypass"]');
        if (await addressBypassBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('  Using Address Test Bypass...');
            await addressBypassBtn.click();
            await page.waitForTimeout(1500);
        } else {
            // Fallback: Address Search (Mocked)
            const searchInput = page.locator('input[placeholder*="Search" i], input[placeholder*="Rechercher" i], input.backdrop-blur').first();
            if (await searchInput.isVisible().catch(() => false)) {
                await searchInput.fill('Paris');
                await page.waitForTimeout(1500);

                const firstResult = page.locator('div, button').filter({ hasText: '123 Rue de Rivoli' }).first();
                if (await firstResult.isVisible().catch(() => false)) {
                    await firstResult.click({ force: true });
                } else {
                    // Fallback: try first suggestion
                    await page.locator('.suggestion-item, [role="option"]').first().click({ force: true }).catch(() => {});
                }
            }
        }

        await page.waitForTimeout(1000);
        
        // --- NAVIGATE TO STEP 3 ---
        console.log('Step 2 -> Step 3...');
        
        // Step 3 detection elements
        const step3Indicators = [
            page.locator('input[name="startingBid"]'),
            page.locator('textarea[name="publicInfo"]'),
            page.locator('text=/Starting Bid|Prix de départ/i').first(),
        ];

        // Click Next to Step 3
        for (let i = 0; i < 5; i++) {
            let isOnStep3 = false;
            for (const indicator of step3Indicators) {
                if (await indicator.isVisible().catch(() => false)) {
                    isOnStep3 = true;
                    break;
                }
            }
            if (isOnStep3) break;

            await nextBtn.evaluate((btn) => (btn as HTMLElement).click()).catch(() => {});
            await page.waitForTimeout(2000);
        }

        // --- STEP 3: PRICE & SUMMARY ---
        console.log('Step 3: Price & Summary...');
        
        // Wait for Step 3
        await page.waitForTimeout(2000);
        
        const startingBidInput = page.locator('input[name="startingBid"]');
        if (await startingBidInput.isVisible().catch(() => false)) {
            await startingBidInput.fill('100');
        }
        
        const publicInfoInput = page.locator('textarea[name="publicInfo"]');
        if (await publicInfoInput.isVisible().catch(() => false)) {
            await publicInfoInput.fill('Automated E2E Test Description');
        }

        // SUBMIT
        console.log('Submitting listing...');
        await page.getByRole('button', { name: /Publish|Submit|Créer|Publier/i }).click();

        // VERIFICATION - with extended timeout and fallback
        try {
            await page.waitForURL(/\/create\/success\?id=/, { timeout: 30000 });
            console.log('Listing created successfully!');
        } catch (e) {
            // Fallback: check if we're on success page or got toast
            const isSuccess = page.url().includes('/create/success') || 
                              await page.locator('text=/successfully|succès|créé/i').isVisible().catch(() => false);
            expect(isSuccess).toBeTruthy();
            console.log('Listing created (detected via fallback)!');
        }
    });
});
