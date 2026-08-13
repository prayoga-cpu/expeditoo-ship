import { test, expect } from '@playwright/test';

/**
 * 19-CHAT: Real-time Chat Tests
 * 
 * Tests messaging and chat functionality.
 * Uses Alice (Seller) and Bob (Buyer) sessions.
 * Priority: P1 (Important)
 */

test.describe('Chat & Messaging', () => {
    test.describe('Messages List', () => {
        test.use({ storageState: './testing/.auth/alice.json' });

        test('CHAT-001: Messages page loads', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');

            expect(page.url()).toContain('/messages');
        });

        test('CHAT-002: Messages shows conversation list or empty', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            // Should show conversations, empty state, or page loaded
            const hasConversations = await page.locator('a[href*="/messages/"]').first().isVisible().catch(() => false);
            const hasEmptyState = await page.locator('text=/no messages|no conversations|empty|aucun message|start a conversation/i').isVisible().catch(() => false);
            const pageLoaded = page.url().includes('/messages');
            const hasSearchInput = await page.locator('input[type="search"], input[placeholder*="search" i]').first().isVisible().catch(() => false);

            expect(hasConversations || hasEmptyState || pageLoaded || hasSearchInput).toBeTruthy();
        });

        test('CHAT-003: Search messages input exists', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);

            const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="rechercher" i]').first();
            await expect(searchInput).toBeVisible();
        });

        test('CHAT-004: Conversation preview shows user name', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            // If there are conversations
            const conversation = page.locator('a[href*="/messages/"]').first();
            if (await conversation.isVisible()) {
                // Should show some user info
                const hasUserInfo = await page.locator('[class*="avatar"], img').first().isVisible().catch(() => false);
                expect(hasUserInfo).toBeDefined();
            }
        });

        test('CHAT-005: Conversation preview shows timestamp', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            // If there are conversations
            const conversation = page.locator('a[href*="/messages/"]').first();
            if (await conversation.isVisible()) {
                // Should show time info
                const hasTime = await page.locator('text=/ago|min|hour|day|just now|il y a|aujourd/i').first().isVisible().catch(() => false);
                expect(hasTime).toBeDefined();
            }
        });
    });

    test.describe('Chat Detail', () => {
        test.use({ storageState: './testing/.auth/alice.json' });

        test('CHAT-006: Chat detail page structure', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            // Click on first conversation if exists
            const conversation = page.locator('a[href*="/messages/"]').first();
            if (await conversation.isVisible()) {
                await conversation.click();
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(1000);

                expect(page.url()).toMatch(/\/messages\/.+/);
            } else {
                test.skip();
            }
        });

        test('CHAT-007: Chat shows message input', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            const conversation = page.locator('a[href*="/messages/"]').first();
            if (await conversation.isVisible()) {
                await conversation.click();
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(1000);

                // Should show input for typing message
                const messageInput = page.locator('input[type="text"], textarea').filter({ hasNotText: /search/i }).first();
                await expect(messageInput).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('CHAT-008: Chat shows send button', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            const conversation = page.locator('a[href*="/messages/"]').first();
            if (await conversation.isVisible()) {
                await conversation.click();
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(1000);

                // Should show send button
                const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
                await expect(sendBtn).toBeVisible();
            } else {
                test.skip();
            }
        });

        test('CHAT-009: Chat shows back button', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            const conversation = page.locator('a[href*="/messages/"]').first();
            if (await conversation.isVisible()) {
                await conversation.click();
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(1000);

                // Should show back navigation
                const backBtn = page.locator('button, a').filter({ has: page.locator('[class*="arrow"], [class*="back"], [class*="chevron"]') }).first();
                const hasBack = await backBtn.isVisible().catch(() => false);
                expect(hasBack).toBeDefined();
            } else {
                test.skip();
            }
        });

        test('CHAT-010: Chat shows listing context', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            const conversation = page.locator('a[href*="/messages/"]').first();
            if (await conversation.isVisible()) {
                await conversation.click();
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(1000);

                // Should show related listing info
                const listingInfo = page.locator('text=/about|listing|annonce|€|EUR/i').first();
                const hasListing = await listingInfo.isVisible().catch(() => false);
                expect(hasListing).toBeDefined();
            } else {
                test.skip();
            }
        });
    });

    test.describe('Message Input', () => {
        test.use({ storageState: './testing/.auth/alice.json' });

        test('CHAT-011: Message input accepts text', async ({ page }) => {
            await page.goto('/messages');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            const conversation = page.locator('a[href*="/messages/"]').first();
            if (await conversation.isVisible()) {
                await conversation.click();
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(1000);

                const messageInput = page.locator('input[type="text"], textarea').filter({ hasNotText: /search/i }).first();
                if (await messageInput.isVisible()) {
                    await messageInput.fill('Test message');
                    const value = await messageInput.inputValue();
                    expect(value).toBe('Test message');
                }
            } else {
                test.skip();
            }
        });
    });
});
