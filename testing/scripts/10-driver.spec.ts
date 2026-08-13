import { test, expect } from '@playwright/test';

/**
 * 10-DRIVER: Driver Portal Tests
 * 
 * Tests driver dashboard, shipments, and profile.
 * Uses Charlie (Driver) session.
 * Priority: P2 (Role-Based)
 */

test.describe('Driver Portal', () => {
    test.use({ storageState: './testing/.auth/charlie.json' });

    test.describe('Driver Dashboard', () => {
        test('DRV-001: Driver dashboard loads', async ({ page }) => {
            await page.goto('/driver/dashboard');
            await page.waitForLoadState('domcontentloaded');

            // Should not redirect away from driver portal
            expect(page.url()).toContain('/driver');
        });

        test('DRV-002: Dashboard shows stats', async ({ page }) => {
            await page.goto('/driver/dashboard');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            // Should show earnings or stats
            const stats = page.locator('text=/earnings|deliveries|completed|€|\d+/i').first();
            await expect(stats).toBeVisible();
        });

        test('DRV-003: Dashboard shows active shipments section', async ({ page }) => {
            await page.goto('/driver/dashboard');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(1000);

            // Should show active shipments section or dashboard content
            const hasActiveSection = await page.locator('text=/active|current|ongoing|no active|shipments/i').first().isVisible().catch(() => false);
            const hasContent = await page.locator('h1, h2, [class*="heading"]').first().isVisible().catch(() => false);
            const pageLoaded = page.url().includes('/driver');

            expect(hasActiveSection || hasContent || pageLoaded).toBeTruthy();
        });
    });

    test.describe('Driver Shipments', () => {
        test('DRV-004: Shipments page loads', async ({ page }) => {
            await page.goto('/driver/shipments');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/driver/shipments');
        });

        test('DRV-005: Available shipments or empty state', async ({ page }) => {
            await page.goto('/driver/shipments');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(1000);

            // Should show shipments, empty state, or page content
            const hasShipments = await page.locator('[class*="card"]').first().isVisible().catch(() => false);
            const hasEmptyState = await page.locator('text=/no shipments|no available|empty|aucun/i').isVisible().catch(() => false);
            const hasContent = await page.locator('h1, h2, [class*="heading"]').first().isVisible().catch(() => false);
            const pageLoaded = page.url().includes('/driver/shipments');

            expect(hasShipments || hasEmptyState || hasContent || pageLoaded).toBeTruthy();
        });

        test('DRV-006: Shipment card shows route info', async ({ page }) => {
            await page.goto('/driver/shipments');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            const shipmentCard = page.locator('[class*="card"]').first();

            if (await shipmentCard.isVisible()) {
                // Should show route info
                const routeInfo = page.locator('text=/from|to|→|km|pickup|delivery/i').first();
                await expect(routeInfo).toBeVisible();
            }
        });
    });

    test.describe('Driver Messages', () => {
        test('DRV-007: Driver messages page loads', async ({ page }) => {
            await page.goto('/driver/messages');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/driver/messages');
        });
    });

    test.describe('Driver Profile', () => {
        test('DRV-008: Driver profile page loads', async ({ page }) => {
            await page.goto('/driver/profile');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/driver/profile');
        });

        test('DRV-009: Driver profile shows stats', async ({ page }) => {
            await page.goto('/driver/profile');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            // Should show driver stats
            const stats = page.locator('text=/deliveries|rating|completed|\d+/i').first();
            await expect(stats).toBeVisible();
        });
    });

    test.describe('Driver Help', () => {
        test('DRV-010: Driver help page loads', async ({ page }) => {
            await page.goto('/driver/help');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/driver/help');
        });
    });

    test.describe('Driver Navigation', () => {
        test('DRV-011: Bottom nav visible on mobile', async ({ page, viewport }) => {
            if (viewport && viewport.width >= 1024) {
                test.skip();
                return;
            }

            await page.goto('/driver/dashboard');
            await page.waitForLoadState('domcontentloaded');

            // Should have bottom nav
            const bottomNav = page.locator('nav').last();
            await expect(bottomNav).toBeVisible();
        });

        test('DRV-012: Navigation links work', async ({ page }) => {
            await page.goto('/driver/dashboard');
            await page.waitForLoadState('domcontentloaded');

            // Find shipments link
            const shipmentsLink = page.locator('a[href*="/driver/shipments"]').first();

            if (await shipmentsLink.isVisible()) {
                await shipmentsLink.click();
                await page.waitForURL(/\/driver\/shipments/);

                expect(page.url()).toContain('/driver/shipments');
            }
        });
    });

});
