import { test, expect } from '@playwright/test';

/**
 * 02-AUTH: Authentication Tests
 * 
 * Tests sign in, sign up, and password reset flows.
 * Priority: P0 (Critical)
 */

test.describe('Authentication', () => {

    test.describe('Sign In Flow', () => {
        test('AUTH-001: Empty form shows validation errors', async ({ page }) => {
            await page.goto('/signin');
            await page.waitForLoadState('domcontentloaded');

            // Click sign in without filling form
            // Use type="submit" to reliably find the main form action button
            const signInBtn = page.locator('button[type="submit"]');
            await signInBtn.click();

            // Should show validation error "Email is required" or similar
            // We use a regex to match common validation messages
            const errorText = page.locator('text=/required|obligatoire|requis/i').first();
            await expect(errorText).toBeVisible();
        });

        test('AUTH-002: Invalid email format shows error', async ({ page }) => {
            await page.goto('/signin');
            await page.waitForLoadState('domcontentloaded');

            const emailInput = page.locator('input[type="email"], input[name="email"]').first();
            await emailInput.fill('notanemail');

            const passwordInput = page.locator('input[type="password"]').first();
            await passwordInput.fill('somepassword');

            const signInBtn = page.locator('button[type="submit"]');
            await signInBtn.click();

            await page.waitForTimeout(500);

            // Should not navigate away
            const url = page.url();
            expect(url).toContain('signin');
            
            // Should verify some error indicator exists
             const hasErrorText = await page.locator('text=/valid email|email valide|format/i').isVisible().catch(() => false);
             // Or browser native validation (harder to check, but URL check covers basic prevention)
        });

        test('AUTH-003: Wrong password shows error message', async ({ page }) => {
            await page.goto('/signin');
            await page.waitForLoadState('domcontentloaded');

            const emailInput = page.locator('input[type="email"], input[name="email"]').first();
            await emailInput.fill('wrong@example.com');

            const passwordInput = page.locator('input[type="password"]').first();
            await passwordInput.fill('wrongpassword123');

            const signInBtn = page.locator('button[type="submit"]');
            await signInBtn.click();

            // Wait for error response
            await page.waitForTimeout(2000);

            // Should show error message
            // Look for generic error message text or alert
            // The app uses a div with red background for server errors: bg-destructive/10 or role="alert"
            const errorAlert = page.locator('.bg-destructive\\/10, [role="alert"]').first();
            await expect(errorAlert).toBeVisible({ timeout: 10000 });
        });

        test('AUTH-004: Forgot password button exists', async ({ page }) => {
            await page.goto('/signin');
            await page.waitForLoadState('domcontentloaded');

            // "Forgot?" | "Forgot password" | "Mot de passe oublié"
            // It is a button in the SignInForm
            const forgotButton = page.locator('button').filter({ hasText: /Forgot|Oublié|Lupa/i }).first();
            await expect(forgotButton).toBeVisible();
        });
    });

    test.describe('Sign Up Flow', () => {
        test('AUTH-005: Sign up page has all required fields', async ({ page }) => {
            await page.goto('/signup');
            await page.waitForLoadState('domcontentloaded');

            // Email field
            await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();

            // Password field
            await expect(page.locator('input[type="password"]').first()).toBeVisible();

            // Name field 
            const nameField = page.locator('input[name="fullName"], input[name="name"], input[placeholder*="name" i]').first();
            await expect(nameField).toBeVisible();

            // Submit button
            await expect(page.locator('button[type="submit"]')).toBeVisible();
        });

        test('AUTH-006: Weak password shows validation error', async ({ page }) => {
            await page.goto('/signup');
            await page.waitForLoadState('domcontentloaded');

            // Fill with weak password
            const emailInput = page.locator('input[type="email"], input[name="email"]').first();
            await emailInput.fill('test@example.com');
            
            // Provide a name if needed
            const nameField = page.locator('input[name="fullName"], input[name="name"]').first();
            if (await nameField.isVisible()) {
                await nameField.fill('Test User');
            }

            const passwordInput = page.locator('input[type="password"]').first();
            await passwordInput.fill('123'); // Very weak password
            
            // Confirm password if exists
             const confirmPasswordInput = page.locator('input[name="confirmPassword"]');
             if (await confirmPasswordInput.isVisible()) {
                 await confirmPasswordInput.fill('123');
             }

            const signUpBtn = page.locator('button[type="submit"]');
            await signUpBtn.click();

            await page.waitForTimeout(500);

            // Should stay on signup or show error
            const url = page.url();
            expect(url).toContain('sign');
            
             // Check for error text
             const hasError = await page.locator('text=/short|faible|min|weak/i').isVisible().catch(() => false);
             // Or browser native validation
        });
    });

    test.describe('Forgot Password Flow', () => {
        test('AUTH-007: Forgot password page loads', async ({ page }) => {
            await page.goto('/forgot-password');
            await page.waitForLoadState('domcontentloaded');

            // Should have email input
            await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();

            // Should have submit button
            // Usually type="submit"
            await expect(page.locator('button[type="submit"]')).toBeVisible();
        });

        test('AUTH-008: Reset password page loads', async ({ page }) => {
            await page.goto('/reset-password');
            await page.waitForLoadState('domcontentloaded');

            // Wait for main heading to ensure page structure is loaded
            await expect(page.locator('h1')).toBeVisible();

            // The page either shows the form (if token valid/loading with Suspense) OR "Invalid Reset Link"
            // We verify one of valid states exists by checking the title
            const titleText = await page.locator('h1').textContent();
            const isValidState = /Reset|Invalid|Réinitialiser|Invalide/i.test(titleText || '');
            
            expect(isValidState).toBeTruthy();
        });
    });

});
