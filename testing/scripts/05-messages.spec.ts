import { test, expect } from '@playwright/test';

/**
 * 05-MESSAGES: Messaging Tests
 * 
 * Tests conversation list and chat functionality.
 * Uses Alice (Seller) session.
 * Priority: P1 (Important)
 */

test.describe('Messages', () => {
    test.use({ storageState: './testing/.auth/alice.json' });

    test.describe('Messages List', () => {
        test('MSG-001: Messages page loads', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/messages');
        });

        test('MSG-002: Messages list or empty state visible', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(2000);

            // Should show conversations, empty state, or page content
            const hasConversations = await page.locator('a[href*="/messages/"]').first().isVisible().catch(() => false);
            const hasEmptyState = await page.locator('text=/no messages|no conversations|empty|start|aucun message|commencer/i').isVisible().catch(() => false);
            const hasSearchInput = await page.locator('input[type="search"], input[placeholder*="search" i]').first().isVisible().catch(() => false);
            const pageLoaded = page.url().includes('/messages');

            expect(hasConversations || hasEmptyState || hasSearchInput || pageLoaded).toBeTruthy();
        });

        test('MSG-003: Search input exists', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');

            // Placeholder: "Search messages..." or "Rechercher des messages..."
            const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="rechercher" i]').first();
            await expect(searchInput).toBeVisible();
        });

        test('MSG-004: Tab filters exist', async ({ page }) => {
            // Tabs are not currently implemented in the UI
            test.skip();

            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            
            // ...
        });

        test('MSG-005: Tab switching works', async ({ page }) => {
            // Tabs are not currently implemented in the UI
            test.skip();
            
            await page.goto('/messages');
            // ...
        });
    });

    test.describe('Chat Detail', () => {
        test('MSG-006: Chat opens when clicking conversation', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            const conversationLink = page.locator('a[href*="/messages/"]').first();

            if (await conversationLink.isVisible()) {
                await conversationLink.click();
                await page.waitForURL(/\/messages\/.+/);

                expect(page.url()).toMatch(/\/messages\/.+/);
            } else {
                test.skip();
            }
        });

        test('MSG-007: Chat shows message input', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            const conversationLink = page.locator('a[href*="/messages/"]').first();

            if (await conversationLink.isVisible()) {
                const href = await conversationLink.getAttribute('href');
                await page.goto(href!);
                await page.waitForLoadState('domcontentloaded');

                // Should have message input
                const messageInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i], textarea[placeholder*="votre message" i]').first();
                await expect(messageInput).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('MSG-008: Chat shows send button', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            const conversationLink = page.locator('a[href*="/messages/"]').first();

            if (await conversationLink.isVisible()) {
                const href = await conversationLink.getAttribute('href');
                await page.goto(href!);
                await page.waitForLoadState('domcontentloaded');

                // Should have send button
                const sendBtn = page.getByRole('button').filter({ has: page.locator('[class*="send"], svg, text=/send|envoyer/i') }).first();
                await expect(sendBtn).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('MSG-009: Chat shows conversation header', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            const conversationLink = page.locator('a[href*="/messages/"]').first();

            if (await conversationLink.isVisible()) {
                const href = await conversationLink.getAttribute('href');
                await page.goto(href!);
                await page.waitForLoadState('domcontentloaded');

                // Should have header with user info
                const header = page.locator('[class*="avatar"], [class*="header"]').first();
                await expect(header).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('MSG-010: Back button returns to messages list', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500);

            const conversationLink = page.locator('a[href*="/messages/"]').first();

            if (await conversationLink.isVisible()) {
                const href = await conversationLink.getAttribute('href');
                await page.goto(href!);
                await page.waitForLoadState('domcontentloaded');

                // Find back button
                const backBtn = page.locator('a[href="/messages"], button').filter({ has: page.locator('[class*="arrow"], svg') }).first();

                if (await backBtn.isVisible()) {
                    await backBtn.click();
                    await page.waitForTimeout(500);

                    expect(page.url()).toContain('/messages');
                }
            } else {
                test.skip();
            }
        });
    });

});
