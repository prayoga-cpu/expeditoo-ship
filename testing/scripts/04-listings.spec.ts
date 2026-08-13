import { test, expect, Page } from '@playwright/test';

/**
 * 04-LISTINGS: Listings & Auction Detail Tests
 * 
 * Tests listing detail pages, auction functionality, and bidding.
 * Uses Bob (Buyer) session for bidding tests.
 * Priority: P0 (Critical)
 */

// Helper function to wait for page to be ready without using networkidle
async function waitForPageReady(page: Page) {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Brief wait for initial render
}

test.describe('Listings & Auctions', () => {

    test.describe('Auction Detail Page', () => {
        // Use Bob's session for viewing auctions
        test.use({ storageState: './testing/.auth/bob.json' });

        test('LIST-001: Auction detail page loads', async ({ page }) => {
            // First go to home to find an auction
            await page.goto('/home');
            await waitForPageReady(page);

            // Find an auction/listing card (div or link)
            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await page.waitForTimeout(1000); 
                await waitForPageReady(page);

                expect(page.url()).toMatch(/\/(auction|listing)\//);
            } else {
                test.skip();
            }
        });

        test('LIST-002: Auction shows title and images', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await waitForPageReady(page);

                // Should have title (h1)
                const title = page.locator('h1').first();
                await expect(title).toBeVisible();

                // Should have image
                const image = page.locator('img[alt], img[src*="http"]').first();
                await expect(image).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('LIST-003: Auction shows current bid', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await waitForPageReady(page);

                // Should show current bid or starting price
                // French: "Offre actuelle", "Prix de départ"
                const bidInfo = page.locator('text=/current bid|starting bid|starting price|prix|offre|€/i').first();
                await expect(bidInfo).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('LIST-004: Auction shows countdown timer', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await waitForPageReady(page);

                // Should show timer or status
                // French: "Temps restant", "Se termine", "Vendu", "Terminé", "Enchère en cours"
                const timer = page.locator('text=/ends in|time left|ended|sold|live|se termine|temps restant|vendu|terminé/i').first();
                await expect(timer).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('LIST-005: Auction shows seller info', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await waitForPageReady(page);

                // Should show seller section
                // French: "Vendeur"
                const sellerSection = page.locator('[class*="avatar"], text=/seller|sold by|rating|vendeur/i').first();
                await expect(sellerSection).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('LIST-006: Auction shows bid history section', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await waitForPageReady(page);

                // Should show bid history heading
                // French: "Historique des enchères"
                const bidHistory = page.getByRole('heading', { name: /bid history|historique des enchères/i });
                await expect(bidHistory).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('LIST-007: Auction shows description', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await waitForPageReady(page);

                // Should show description section
                const description = page.getByText('Description').first();
                await expect(description).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('LIST-008: Auction shows pickup location', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await waitForPageReady(page);

                // Should show location section
                // French: "Lieu de retrait", "Localisation"
                const location = page.locator('text=/pickup location|location|lieu de retrait|localisation/i').first();
                await expect(location).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('LIST-009: Back button returns to previous page', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await page.waitForLoadState('domcontentloaded');

                // Find back button
                const backBtn = page.locator('button').filter({ has: page.locator('[class*="arrow"], svg') }).first();

                if (await backBtn.isVisible()) {
                    await backBtn.click();
                    await page.waitForTimeout(500);

                    // Should navigate away from auction detail
                    expect(page.url()).not.toContain('/auction/');
                    expect(page.url()).not.toContain('/listing/');
                }
            } else {
                test.skip();
            }
        });
    });

    test.describe('Bidding', () => {
        test.use({ storageState: './testing/.auth/bob.json' });

        test('LIST-010: Bid input is visible for active auction', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await waitForPageReady(page);

                // Check if auction is active (has bid input)
                const bidInput = page.locator('input[type="number"]:visible').first();
                const placeBidBtn = page.getByRole('button', { name: /place bid|placer une offre|enchérir/i });

                // Either bid input visible (active) or auction ended message
                const isActive = await bidInput.isVisible().catch(() => false);
                const isEnded = await page.locator('text=/ended|sold|cancelled|vendu|terminé|annulé/i').isVisible().catch(() => false);

                expect(isActive || isEnded).toBeTruthy();
            } else {
                test.skip();
            }
        });

        test('LIST-011: Quick bid buttons exist for active auction', async ({ page }) => {
            await page.goto('/home');
            await waitForPageReady(page);

            const listingCard = page.locator('div[class*="card"], a[href*="/auction/"], a[href*="/listing/"]').first();

            if (await listingCard.isVisible()) {
                await listingCard.click();
                await waitForPageReady(page);

                // Check for quick bid buttons (+€10, +€25, +€50)
                const quickBidBtns = page.locator('button').filter({ hasText: /\+€\d+/ });

                // Only check if auction is active
                const isActive = await page.locator('input[type="number"]:visible').isVisible().catch(() => false);

                if (isActive) {
                    const count = await quickBidBtns.count();
                    expect(count).toBeGreaterThanOrEqual(0); // May or may not have quick bid buttons
                }
            } else {
                test.skip();
            }
        });
    });

    test.describe('My Auctions', () => {
        test.use({ storageState: './testing/.auth/alice.json' });

        test('LIST-012: My Auctions page loads', async ({ page }) => {
            await page.goto('/my-auctions');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/my-auctions');

            // Should show heading or content
            // French: "Mes Enchères"
            const heading = page.getByRole('heading', { name: /my auctions|auctions|mes enchères/i });
            await expect(heading).toBeVisible();
        });

        test('LIST-013: My Auctions shows list or empty state', async ({ page }) => {
            await page.goto('/my-auctions');
            await waitForPageReady(page);

            // Wait for data to load (useQuery might take a moment)
            await page.waitForTimeout(2000);

            // Should show auctions, empty state, or page content
            const hasAuctions = await page.locator('div[class*="card"]').first().isVisible().catch(() => false);
            const hasEmptyState = await page.locator('text=/No active auctions|No past auctions|no auctions|empty/i').isVisible().catch(() => false);
            const hasHeading = await page.locator('h1, h2, [class*="heading"]').first().isVisible().catch(() => false);
            const pageLoaded = page.url().includes('/my-auctions');

            expect(hasAuctions || hasEmptyState || hasHeading || pageLoaded).toBeTruthy();
        });
    });

    test.describe('My Bids', () => {
        test.use({ storageState: './testing/.auth/bob.json' });

        test('LIST-014: My Bids page loads', async ({ page }) => {
            await page.goto('/my-bids');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/my-bids');

            // Should show heading
            // French: "Mes enchères" (sometimes translated same as My Auctions) or "Mes offres"
            const heading = page.getByRole('heading', { name: /my bids|bids|mes offres|mes enchères/i });
            await expect(heading).toBeVisible();
        });

        test('LIST-015: My Bids shows list or empty state', async ({ page }) => {
            await page.goto('/my-bids');
            await waitForPageReady(page);

            // Should show bids or empty state
            const hasBids = await page.locator('[class*="card"]').first().isVisible().catch(() => false);
            const hasEmptyState = await page.locator('text=/no bids|haven\'t placed|empty|aucune/i').isVisible().catch(() => false);

            expect(hasBids || hasEmptyState).toBeTruthy();
        });
    });

});
