import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, POST } from '../route';
import { auth } from '@/lib/auth';
import * as usersDal from '@/server/dal/users.dal';
import { verifyFirebaseIdToken } from '@/lib/firebase-token';
import { messagesService } from '@/server/services/messages.service';

/**
 * `expedion-auth` is deliberately NOT mocked, same reasoning as
 * `expedion/quotes/__tests__/route.test.ts`: the identity resolution this
 * route adds on top of it — `requireChatUser`, matching a caller to a real
 * Better Auth user — is the actual new logic, and it lives in the route file
 * itself. `messagesService` IS mocked: its own behaviour (thread fetch,
 * sending, the support-conversation lookup) has its own unit tests in
 * `messages.service.test.ts`.
 */
vi.mock('@/lib/auth', () => ({
    auth: { api: { getSession: vi.fn() } },
}));

vi.mock('@/server/dal/users.dal', () => ({
    userHasRole: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserById: vi.fn(),
}));

vi.mock('@/lib/firebase-token', () => ({
    verifyFirebaseIdToken: vi.fn(),
}));

vi.mock('@/server/services/messages.service', () => ({
    messagesService: {
        getOrCreateSupportConversation: vi.fn(),
        getThread: vi.fn(),
        sendMessage: vi.fn(),
    },
}));

const CLIENT_KEY = 'test-client-key';
const ADMIN_KEY = 'test-admin-key';

const getSessionMock = vi.mocked(auth.api.getSession);
const verifyFirebaseMock = vi.mocked(verifyFirebaseIdToken);
const getOrCreateMock = vi.mocked(messagesService.getOrCreateSupportConversation);
const getThreadMock = vi.mocked(messagesService.getThread);
const sendMessageMock = vi.mocked(messagesService.sendMessage);

function sessionReq(path = '/api/expedion/support') {
    return new NextRequest(`http://localhost${path}`);
}

function keyReq(path: string, token: string) {
    return new NextRequest(`http://localhost${path}`, {
        headers: {
            authorization: `Bearer ${token}`,
            'x-expedion-uid': 'firebase-or-shared-uid',
        },
    });
}

describe('/api/expedion/support', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // No Better Auth session by default; individual tests opt in.
        getSessionMock.mockResolvedValue(null as never);
        verifyFirebaseMock.mockResolvedValue(null);
    });

    describe('requireChatUser', () => {
        it('refuses a shared client-key caller with no identity to attribute a message to', async () => {
            vi.stubEnv('EXPEDION_API_KEY', CLIENT_KEY);
            vi.stubEnv('EXPEDION_ADMIN_API_KEY', ADMIN_KEY);

            const response = await GET(keyReq('/api/expedion/support', CLIENT_KEY));

            expect(response.status).toBe(403);
            const body = await response.json();
            expect(body.error.code).toBe('CHAT_IDENTITY_REQUIRED');
            expect(getOrCreateMock).not.toHaveBeenCalled();

            vi.unstubAllEnvs();
        });

        it('refuses the admin shared-key path the same way — a key is the app, not a person', async () => {
            vi.stubEnv('EXPEDION_API_KEY', CLIENT_KEY);
            vi.stubEnv('EXPEDION_ADMIN_API_KEY', ADMIN_KEY);

            const response = await GET(keyReq('/api/expedion/support', ADMIN_KEY));

            expect(response.status).toBe(403);
            vi.unstubAllEnvs();
        });

        it('uses the Better Auth session user directly when that id is a known account', async () => {
            getSessionMock.mockResolvedValue({
                user: { id: 'u1', email: 'a@b.com', emailVerified: true },
            } as never);
            vi.mocked(usersDal.userHasRole).mockResolvedValue(false);
            vi.mocked(usersDal.getUserById).mockResolvedValue({
                id: 'u1',
                name: 'Ada',
                image: null,
            } as never);
            getOrCreateMock.mockResolvedValue({ conversationId: 'conv-1', created: true });

            const response = await GET(sessionReq());
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(getOrCreateMock).toHaveBeenCalledWith('u1');
            expect(body.data.conversationId).toBe('conv-1');
        });

        it('falls back to a verified-email match when a Firebase caller has no Better Auth row under its own uid', async () => {
            verifyFirebaseMock.mockResolvedValue({
                uid: 'firebase-uid-xyz',
                email: 'linked@example.com',
                emailVerified: true,
            });
            vi.mocked(usersDal.userHasRole).mockResolvedValue(false);
            // The route's own lookup: no row under the Firebase uid itself...
            vi.mocked(usersDal.getUserById).mockResolvedValue(undefined as never);
            // ...but the linked account is found by verified email — called
            // twice for the same reason (once inside `requireExpedionCaller`
            // to resolve `isAdmin`, once inside `requireChatUser` to find the
            // chat identity), and the mock answers both the same way.
            vi.mocked(usersDal.getUserByEmail).mockResolvedValue({
                id: 'linked-user',
                name: 'Linked',
                image: null,
                emailVerified: true,
            } as never);
            getOrCreateMock.mockResolvedValue({ conversationId: 'conv-2', created: false });
            getThreadMock.mockResolvedValue({ messages: [], page: 1, limit: 50 } as never);

            const response = await GET(keyReq('/api/expedion/support', CLIENT_KEY));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(getOrCreateMock).toHaveBeenCalledWith('linked-user');
            expect(body.data.conversationId).toBe('conv-2');
        });

        it('refuses with 409 (not 401) when the identity is real but has no Expeditoo account', async () => {
            getSessionMock.mockResolvedValue({
                user: { id: 'ghost', email: 'ghost@example.com', emailVerified: false },
            } as never);
            vi.mocked(usersDal.userHasRole).mockResolvedValue(false);
            vi.mocked(usersDal.getUserById).mockResolvedValue(undefined as never);

            const response = await GET(sessionReq());

            expect(response.status).toBe(409);
            const body = await response.json();
            expect(body.error.code).toBe('CHAT_ACCOUNT_REQUIRED');
            expect(getOrCreateMock).not.toHaveBeenCalled();
        });
    });

    describe('GET', () => {
        beforeEach(() => {
            getSessionMock.mockResolvedValue({
                user: { id: 'u1', email: 'a@b.com', emailVerified: true },
            } as never);
            vi.mocked(usersDal.userHasRole).mockResolvedValue(false);
            vi.mocked(usersDal.getUserById).mockResolvedValue({
                id: 'u1',
                name: 'Ada',
                image: null,
            } as never);
        });

        it('skips fetching a thread for a brand-new conversation', async () => {
            getOrCreateMock.mockResolvedValue({ conversationId: 'conv-new', created: true });

            const response = await GET(sessionReq());
            const body = await response.json();

            expect(body.data.messages).toEqual([]);
            expect(getThreadMock).not.toHaveBeenCalled();
        });

        it('shapes an existing thread down to what the chat UI draws', async () => {
            getOrCreateMock.mockResolvedValue({ conversationId: 'conv-old', created: false });
            getThreadMock.mockResolvedValue({
                messages: [
                    {
                        id: 'm1',
                        content: 'hi',
                        createdAt: new Date('2026-01-01T00:00:00.000Z'),
                        isOwn: true,
                        readByOther: true,
                        sender: { id: 'u1', name: 'Ada', image: null },
                        // Fields `getThread` also returns that must not leak.
                        conversation: { participants: [] },
                    },
                ],
                page: 1,
                limit: 50,
            } as never);

            const response = await GET(sessionReq());
            const body = await response.json();

            expect(body.data.messages).toEqual([
                {
                    id: 'm1',
                    content: 'hi',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    isOwn: true,
                    readByOther: true,
                    senderName: 'Ada',
                    senderImage: null,
                },
            ]);
        });
    });

    describe('POST', () => {
        it('sends through the shared message service and attaches the sender by hand', async () => {
            getSessionMock.mockResolvedValue({
                user: { id: 'u1', email: 'a@b.com', emailVerified: true },
            } as never);
            vi.mocked(usersDal.userHasRole).mockResolvedValue(false);
            vi.mocked(usersDal.getUserById).mockResolvedValue({
                id: 'u1',
                name: 'Ada',
                image: null,
            } as never);
            getOrCreateMock.mockResolvedValue({ conversationId: 'conv-1', created: false });
            sendMessageMock.mockResolvedValue({
                message: { id: 'm2', content: 'hello', createdAt: new Date('2026-01-02T00:00:00.000Z') },
            } as never);

            const response = await POST(
                new NextRequest('http://localhost/api/expedion/support', {
                    method: 'POST',
                    body: JSON.stringify({ content: 'hello' }),
                })
            );
            const body = await response.json();

            expect(sendMessageMock).toHaveBeenCalledWith(
                'u1',
                { conversationId: 'conv-1', content: 'hello' },
                { name: 'Ada', image: null }
            );
            expect(body.data.message).toEqual({
                id: 'm2',
                content: 'hello',
                createdAt: '2026-01-02T00:00:00.000Z',
                isOwn: true,
                readByOther: false,
                senderName: 'Ada',
                senderImage: null,
            });
        });

        it('rejects an empty message before it ever reaches the service', async () => {
            getSessionMock.mockResolvedValue({
                user: { id: 'u1', email: 'a@b.com', emailVerified: true },
            } as never);
            vi.mocked(usersDal.userHasRole).mockResolvedValue(false);
            vi.mocked(usersDal.getUserById).mockResolvedValue({
                id: 'u1',
                name: 'Ada',
                image: null,
            } as never);

            const response = await POST(
                new NextRequest('http://localhost/api/expedion/support', {
                    method: 'POST',
                    body: JSON.stringify({ content: '' }),
                })
            );

            expect(response.status).toBe(400);
            expect(sendMessageMock).not.toHaveBeenCalled();
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });
});
