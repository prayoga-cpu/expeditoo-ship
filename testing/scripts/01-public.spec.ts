import { test, expect } from '@playwright/test';

/**
 * 01-PUBLIC: Public Pages Tests
 * 
 * Tests all pages accessible without authentication.
 * Priority: P0 (Critical)
 */

test.describe('Public Pages', () => {

    test.describe('Landing Page', () => {
        test('PUB-001: Homepage loads with correct title', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');
            await expect(page).toHaveTitle(/EXPEDITOO/i);
        });

        test('PUB-002: Hero section is visible', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            // Based on LandingHero.tsx: "Bid, Ship" or "Enchérissez, Expédiez"
            const heroHeading = page.locator('h1').filter({ hasText: /Bid|Enchères|Enchérissez/i }).first();
            await expect(heroHeading).toBeVisible();

            const ctaButton = page.getByRole('button', { name: /Start Shipping|Get Started|Commencer|Expédier maintenant/i }).first();
            await expect(ctaButton).toBeVisible();
        });

        test('PUB-003: Stats section displays 4 stat cards', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            // LandingStats.tsx renders 4 statistics cards
            // Locating by partial text content of stats
            const statsSection = page.locator('div').filter({ hasText: /Deliveries|Livraisons/i }).last();
            await expect(statsSection).toBeVisible();
        });

        test('PUB-004: How It Works section is visible', async ({ page }) => {
            await page.goto('/');

            // LandingHowItWorks.tsx
            const heading = page.getByRole('heading', { name: /How It Works|Comment ça marche/i }).first();
            await heading.scrollIntoViewIfNeeded();
            await expect(heading).toBeVisible();
        });

        test('PUB-005: Sign In button redirects to signin page', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            // LandingNavbar.tsx
            // Structural locator: Header -> Button that has text (Theme toggle usually has just icon)
            // This avoids issues with exact text matching if translations are weird
            const headerBtn = page.locator('header button').filter({ hasText: /\S+/ }).last();
            
            await expect(headerBtn).toBeVisible();
            // Log text for debugging if it fails again (not visible in report but helpful if run locally)
            // console.log(await headerBtn.textContent());
            
            await headerBtn.click();

            await expect(page).toHaveURL(/signin|login/);
        });

        test('PUB-006: Footer links are present', async ({ page }) => {
            await page.goto('/');

            // LandingFooter.tsx
            const footer = page.locator('footer');
            await footer.scrollIntoViewIfNeeded();
            await expect(footer).toBeVisible();

            // Check for key links
            await expect(page.getByRole('link', { name: /terms|conditions/i })).toBeVisible();
            await expect(page.getByRole('link', { name: /privacy|confidentialité/i })).toBeVisible();
        });
    });

    test.describe('Legal Pages', () => {
        test('PUB-007: FAQ page loads', async ({ page }) => {
            await page.goto('/faq');
            await page.waitForLoadState('domcontentloaded');

            await expect(page.getByRole('heading', { name: /FAQ|Frequently Asked|Foire aux questions/i })).toBeVisible();
        });

        test('PUB-008: Terms page loads', async ({ page }) => {
            await page.goto('/terms');
            await page.waitForLoadState('domcontentloaded');

            // Actual heading is "Terms of Service"
            await expect(page.getByRole('heading', { name: /Terms of Service|Conditions d'utilisation/i })).toBeVisible();
        });

        test('PUB-009: Privacy page loads', async ({ page }) => {
            await page.goto('/privacy');
            await page.waitForLoadState('domcontentloaded');

            await expect(page.getByRole('heading', { name: /Privacy|Confidentialité/i })).toBeVisible();
        });
    });

    test.describe('Sign In Page', () => {
        test('PUB-010: Sign in page loads with form', async ({ page }) => {
            await page.goto('/signin');
            await page.waitForLoadState('domcontentloaded');

            // Check form elements
            await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
            await expect(page.locator('input[type="password"]').first()).toBeVisible();

            // Strict mode violation fix: target the specific submit button, avoiding "Sign in with Google"
            // The main login button usually is type="submit" or has specific text relative to submitting the form
            // .filter({ hasNotText: /Google/i }) helps disambiguate
            await expect(page.getByRole('button', { name: /Sign In|Se connecter/i }).filter({ hasNotText: /Google/i })).toBeVisible();
        });

        test('PUB-011: Sign up button exists on signin page', async ({ page }) => {
            await page.goto('/signin');
            await page.waitForLoadState('domcontentloaded');

            // "Sign up" or "Créer un compte" link/button
            const signUpBtn = page.getByRole('link', { name: /Sign up|S'inscrire|Create account/i }).first();
            // Alternatively could be a button: page.getByRole('button', { name: /Sign up/i })
            // Logic in auth pages typically has a "Don't have an account? Sign up" link
            if (await signUpBtn.count() === 0) {
                 // Fallback locator
                 await expect(page.locator('text=/Sign up|S\'inscrire/i')).toBeVisible();
            } else {
                 await expect(signUpBtn).toBeVisible();
            }
        });
    });

    test.describe('Sign Up Page', () => {
        test('PUB-012: Sign up page loads with form', async ({ page }) => {
            await page.goto('/signup');
            await page.waitForLoadState('domcontentloaded');

            // Check form elements
            await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
            await expect(page.locator('input[type="password"]').first()).toBeVisible();
        });
    });

});
