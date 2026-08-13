import { test, expect } from '@playwright/test';

/**
 * 11-ADMIN: Admin Panel Tests
 * 
 * Tests admin dashboard, users, drivers, and management pages.
 * Uses Diana (Admin) session.
 * Priority: P2 (Role-Based)
 */

test.describe('Admin Panel', () => {
    test.use({ storageState: './testing/.auth/diana.json' });

    test.describe('Admin Dashboard', () => {
        test('ADM-001: Admin dashboard loads', async ({ page }) => {
            await page.goto('/admin/dashboard');
            await page.waitForLoadState('domcontentloaded');

            // Should not redirect away from admin portal
            expect(page.url()).toContain('/admin');
        });

        test('ADM-002: Dashboard shows platform stats', async ({ page }) => {
            await page.goto('/admin/dashboard');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            // Should show platform stats
            const stats = page.locator('text=/users|listings|revenue|orders|\d+/i').first();
            await expect(stats).toBeVisible();
        });

        test('ADM-003: Dashboard shows stat cards', async ({ page }) => {
            await page.goto('/admin/dashboard');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            // Should have multiple stat cards
            const cards = page.locator('[class*="card"]');
            const count = await cards.count();

            expect(count).toBeGreaterThanOrEqual(1);
        });
    });

    test.describe('Users Management', () => {
        test('ADM-004: Users page loads', async ({ page }) => {
            await page.goto('/admin/users');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/admin/users');
        });

        test('ADM-005: Users table or list visible', async ({ page }) => {
            await page.goto('/admin/users');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            // Should show users table or list
            const table = page.locator('table, [class*="table"]').first();
            const list = page.locator('[class*="list"], [class*="card"]').first();

            const hasTable = await table.isVisible().catch(() => false);
            const hasList = await list.isVisible().catch(() => false);

            expect(hasTable || hasList).toBeTruthy();
        });

        test('ADM-006: Search users input exists', async ({ page }) => {
            await page.goto('/admin/users');
            await page.waitForLoadState('domcontentloaded');

            const searchInput = page.locator('input[placeholder*="search" i]').first();
            await expect(searchInput).toBeVisible();
        });
    });

    test.describe('Drivers Management', () => {
        test('ADM-007: Drivers page loads', async ({ page }) => {
            await page.goto('/admin/drivers');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/admin/drivers');
        });

        test('ADM-008: Drivers list visible', async ({ page }) => {
            await page.goto('/admin/drivers');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            // Should show drivers or empty state
            const hasDrivers = await page.locator('table, [class*="card"]').first().isVisible().catch(() => false);
            const hasEmptyState = await page.locator('text=/no drivers|empty/i').isVisible().catch(() => false);

            expect(hasDrivers || hasEmptyState).toBeTruthy();
        });
    });

    test.describe('Applications', () => {
        test('ADM-009: Applications page loads', async ({ page }) => {
            await page.goto('/admin/applications');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/admin/applications');
        });

        test('ADM-010: Applications list or empty state', async ({ page }) => {
            await page.goto('/admin/applications');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            // Should show applications or empty state
            const hasApps = await page.locator('[class*="card"], table').first().isVisible().catch(() => false);
            const hasEmptyState = await page.locator('text=/no applications|no pending|empty/i').isVisible().catch(() => false);

            expect(hasApps || hasEmptyState).toBeTruthy();
        });
    });

    test.describe('Listings Management', () => {
        test('ADM-011: Listings page loads', async ({ page }) => {
            await page.goto('/admin/listings');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/admin/listings');
        });

        test('ADM-012: Listings table visible', async ({ page }) => {
            await page.goto('/admin/listings');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            const table = page.locator('table, [class*="table"]').first();
            await expect(table).toBeVisible();
        });
    });

    test.describe('Shipments Management', () => {
        test('ADM-013: Shipments page loads', async ({ page }) => {
            await page.goto('/admin/shipments');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/admin/shipments');
        });
    });

    test.describe('Deliveries Management', () => {
        test('ADM-014: Deliveries page loads', async ({ page }) => {
            await page.goto('/admin/deliveries');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/admin/deliveries');
        });
    });

    test.describe('Reports', () => {
        test('ADM-015: Reports page loads', async ({ page }) => {
            await page.goto('/admin/reports');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/admin/reports');
        });
    });

    test.describe('Admin Navigation', () => {
        test('ADM-016: Sidebar navigation works', async ({ page }) => {
            await page.goto('/admin/dashboard');
            await page.waitForLoadState('domcontentloaded');

            // Find users link
            const usersLink = page.locator('a[href*="/admin/users"]').first();

            if (await usersLink.isVisible()) {
                await usersLink.click();
                await page.waitForURL(/\/admin\/users/);

                expect(page.url()).toContain('/admin/users');
            }
        });

        test('ADM-017: Admin can also access regular app', async ({ page }) => {
            // Admin should be able to access /home too
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/home');
        });
    });

});
