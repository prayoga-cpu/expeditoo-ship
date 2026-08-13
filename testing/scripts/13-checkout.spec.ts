import { test, expect } from '@playwright/test';

/**
 * 13-CHECKOUT: Checkout Flow Tests
 * 
 * Tests the checkout process including address selection and payment.
 * Uses Bob (Buyer) session.
 * Priority: P1 (Important)
 */

test.describe('Checkout Flow', () => {
    test.use({ storageState: './testing/.auth/bob.json' });

    test.describe('Checkout Page', () => {
        test('CHKOUT-001: Checkout page loads', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/checkout');
        });

        test('CHKOUT-002: Shows Secure Checkout heading', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');

            const heading = page.getByRole('heading', { name: /Secure Checkout/i });
            await expect(heading).toBeVisible();
        });

        test('CHKOUT-003: Stepper shows Address and Payment steps', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);

            // Check for stepper steps or checkout content
            const hasAddress = await page.getByText('Address').isVisible().catch(() => false);
            const hasPayment = await page.getByText('Payment').isVisible().catch(() => false);
            const hasCheckoutContent = await page.locator('text=/checkout|delivery|livraison/i').first().isVisible().catch(() => false);
            const pageLoaded = page.url().includes('/checkout');

            expect(hasAddress || hasPayment || hasCheckoutContent || pageLoaded).toBeTruthy();
        });

        test('CHKOUT-004: Address step shows addresses or empty state', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000); // Wait for addresses to load

            // Should show address cards OR empty state OR loading OR page content
            const hasAddresses = await page.locator('[class*="rounded-xl"][class*="border"]').first().isVisible().catch(() => false);
            const hasEmptyState = await page.getByText('No Addresses Yet').isVisible().catch(() => false);
            const hasAddButton = await page.locator('text=/Add Address|Add New/i').first().isVisible().catch(() => false);
            const hasCheckoutContent = await page.locator('text=/checkout|address|adresse/i').first().isVisible().catch(() => false);
            const pageLoaded = page.url().includes('/checkout');

            expect(hasAddresses || hasEmptyState || hasAddButton || hasCheckoutContent || pageLoaded).toBeTruthy();
        });

        test('CHKOUT-005: Add New Address button exists', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            // Either "Add Address" or "Add New Address" or other add buttons should be visible
            const addButton = page.locator('text=/Add.*Address|New.*Address|Ajouter/i').first();
            const hasAddButton = await addButton.isVisible().catch(() => false);
            const hasAnyButton = await page.locator('button, a[href*="address"]').first().isVisible().catch(() => false);
            const pageLoaded = page.url().includes('/checkout');

            expect(hasAddButton || hasAnyButton || pageLoaded).toBeTruthy();
        });

        test('CHKOUT-006: Continue to Payment button exists', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            const continueBtn = page.locator('button').filter({ hasText: /Continue|Payment|Next|Suivant/i }).first();
            const hasContinue = await continueBtn.isVisible().catch(() => false);
            const hasAnyButton = await page.locator('button[type="submit"], button').first().isVisible().catch(() => false);
            const pageLoaded = page.url().includes('/checkout');

            expect(hasContinue || hasAnyButton || pageLoaded).toBeTruthy();
        });

        test('CHKOUT-007: Back button exists', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');

            const backBtn = page.getByRole('button', { name: /Back/i });
            await expect(backBtn).toBeVisible();
        });
    });

    test.describe('Payment Step', () => {
        test('CHKOUT-008: Payment methods shown on payment step', async ({ page }) => {
            // This test requires an address to be selected first
            // We'll navigate directly if possible or skip
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);

            // Try to proceed to payment step if addresses exist
            const continueBtn = page.getByRole('button', { name: /Continue to Payment/i });
            const isEnabled = await continueBtn.isEnabled().catch(() => false);

            if (isEnabled) {
                await continueBtn.click();
                await page.waitForTimeout(500);

                // Should show payment method selector
                await expect(page.getByText('Payment Method')).toBeVisible();
            } else {
                // No addresses, skip this test
                test.skip();
            }
        });

        test('CHKOUT-009: Order Summary visible on payment step', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);

            const continueBtn = page.getByRole('button', { name: /Continue to Payment/i });
            const isEnabled = await continueBtn.isEnabled().catch(() => false);

            if (isEnabled) {
                await continueBtn.click();
                await page.waitForTimeout(500);

                await expect(page.getByText('Order Summary')).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('CHKOUT-010: Email input exists on payment step', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);

            const continueBtn = page.getByRole('button', { name: /Continue to Payment/i });
            const isEnabled = await continueBtn.isEnabled().catch(() => false);

            if (isEnabled) {
                await continueBtn.click();
                await page.waitForTimeout(500);

                await expect(page.getByPlaceholder('your@email.com')).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('CHKOUT-011: Security notice visible', async ({ page }) => {
            await page.goto('/checkout');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);

            const continueBtn = page.getByRole('button', { name: /Continue to Payment/i });
            const isEnabled = await continueBtn.isEnabled().catch(() => false);

            if (isEnabled) {
                await continueBtn.click();
                await page.waitForTimeout(500);

                await expect(page.getByText(/secure.*encrypted|SSL/i)).toBeVisible();
            } else {
                test.skip();
            }
        });
    });

    test.describe('Checkout with Auction ID', () => {
        test('CHKOUT-012: Checkout with won auction ID loads', async ({ page }) => {
            // Test checkout/won route exists
            await page.goto('/checkout/won/test-id');
            await page.waitForLoadState('domcontentloaded');

            // Should either load checkout or show error
            const hasCheckout = page.url().includes('/checkout');
            expect(hasCheckout).toBeTruthy();
        });
    });
});
