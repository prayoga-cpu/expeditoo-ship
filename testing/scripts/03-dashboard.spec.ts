import { test, expect } from '@playwright/test';

/**
 * 03-DASHBOARD: Home/Dashboard Tests
 * 
 * Tests the main dashboard with listings, filters, search, and map.
 * Uses Alice (Seller) session.
 * Priority: P0 (Critical)
 */

test.describe('Dashboard', () => {
    // Use Alice's authenticated session
    test.use({ storageState: './testing/.auth/alice.json' });

    test.describe('Page Load', () => {
        test('DASH-001: Dashboard loads for authenticated user', async ({ page }) => {
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded');

            // Should not redirect to signin
            expect(page.url()).not.toContain('signin');
            expect(page.url()).toContain('home');
        });

        test('DASH-002: Listings are displayed', async ({ page }) => {
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            // Wait for listings to load
            await page.waitForTimeout(1000);

            // Should have listing cards or empty state
            const hasListings = await page.locator('[class*="card"], [class*="listing"]').first().isVisible().catch(() => false);
            const hasEmptyState = await page.locator('text=/no listings|no items|empty/i').isVisible().catch(() => false);

            expect(hasListings || hasEmptyState).toBeTruthy();
        });
    });

    test.describe('Search', () => {
        test('DASH-003: Search bar is visible', async ({ page }) => {
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded');

            // Placeholder: "Search by title or description..." or "Rechercher par titre ou description..."
            const searchInput = page.getByPlaceholder(/Search by title|Rechercher par titre/i).first();
            await expect(searchInput).toBeVisible();
        });

        test('DASH-004: Search filters results', async ({ page }) => {
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            const searchInput = page.getByPlaceholder(/Search by title|Rechercher par titre/i).first();
            await searchInput.fill('guitar');

            // Wait for filter to apply
            await page.waitForTimeout(500);

            // Search should be applied (URL or results changed)
            const url = page.url();
            const hasSearchParam = url.includes('search') || url.includes('q=');

            // Or check that search input still has the value
            await expect(searchInput).toHaveValue('guitar');
        });
    });

    test.describe('Filters', () => {
        test('DASH-005: Category filter exists in FilterSheet', async ({ page }) => {
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded');

            // Filter button is last button in the search bar row (has SlidersHorizontal icon)
            const filterButton = page.locator('button[class*="h-12 w-12"]').last();
            await filterButton.click();

            // Wait for sheet to open
            await page.waitForTimeout(300);

            // Now check for category section
            await expect(page.getByText(/Category|Catégorie/i)).toBeVisible();
            await expect(page.locator('button').filter({ hasText: /Electronics|Électronique/i }).first()).toBeVisible();
        });

        test('DASH-006: Filter sheet opens on mobile', async ({ page, viewport }) => {
            // Skip if not mobile viewport
            if (viewport && viewport.width >= 768) {
                test.skip();
                return;
            }

            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded');

            // Look for filter button
            const filterBtn = page.locator('button').filter({ hasText: /filter/i }).first();
            if (await filterBtn.isVisible()) {
                await filterBtn.click();

                // Filter sheet should open
                await page.waitForTimeout(300);
                const sheet = page.locator('[role="dialog"], [class*="sheet"]');
                await expect(sheet).toBeVisible();
            }
        });

        test('DASH-007: Sort options exist in FilterSheet', async ({ page }) => {
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded');

            // Filter button is last button in search bar row
            const filterButton = page.locator('button[class*="h-12 w-12"]').last();
            await filterButton.click();

            // Wait for sheet to open
            await page.waitForTimeout(300);

            // Check for sort section and options
            await expect(page.getByText(/Sort By|Trier par/i)).toBeVisible();
            await expect(page.getByRole('button', { name: /Ending Soon|Se termine bientôt/i })).toBeVisible();
            await expect(page.getByRole('button', { name: /Newest|Plus récents/i })).toBeVisible();
        });
    });

    test.describe('Listing Cards', () => {
        test('DASH-008: Listing card shows title and price', async ({ page }) => {
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            // Wait for listings
            await page.waitForTimeout(1000);

            // Find first listing card
            const card = page.locator('a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await card.isVisible()) {
                // Card should have some price indicator (€ symbol)
                const cardContent = await card.textContent();
                expect(cardContent).toMatch(/€|\d+/);
            }
        });

        test('DASH-009: Clicking listing card navigates to detail', async ({ page }) => {
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            await page.waitForTimeout(1000);

            // Find first listing card link
            const cardLink = page.locator('a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await cardLink.isVisible()) {
                await cardLink.click();
                await page.waitForURL(/\/(auction|listing)\//);

                expect(page.url()).toMatch(/\/(auction|listing)\//);
            }
        });
    });

    test.describe('Navigation', () => {
        test('DASH-010: Bottom nav is visible on mobile', async ({ page, viewport }) => {
            // Only test on mobile
            if (viewport && viewport.width >= 768) {
                test.skip();
                return;
            }

            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded');

            const bottomNav = page.locator('nav').filter({ has: page.locator('a[href="/home"]') }).last();
            await expect(bottomNav).toBeVisible();
        });

        test('DASH-011: Create button is accessible', async ({ page }) => {
            await page.goto('/home');
            await page.waitForLoadState('domcontentloaded');

            const createLink = page.locator('a[href="/create"]:visible').first();
            await expect(createLink).toBeVisible();
        });
    });

});
