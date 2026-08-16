import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from '../route';
import { expedionDal } from '@/server/dal/expedion.dal';
import { auth } from '@/lib/auth';
import * as usersDal from '@/server/dal/users.dal';

/**
 * The scoping decision this route makes is the one that leaked, so it is tested
 * here rather than only at the service: the service passes through whatever it
 * is handed, and the bug was in what the route handed it.
 *
 * `expedion-auth` and `expedion.service` are deliberately NOT mocked — the real
 * guard and the real service run, so this covers the whole route → service →
 * DAL boundary and the admin/non-admin resolution with it. Only leaf
 * dependencies are stubbed, which keeps the import cheap and stops Better Auth
 * and Drizzle reaching for a database.
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
    verifyFirebaseIdToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/server/dal/expedion.dal', () => ({
    expedionDal: {
        list: vi.fn(),
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        addEvent: vi.fn(),
        listEvents: vi.fn(),
        getByAirtableRecordId: vi.fn(),
        findDueForEscalation: vi.fn(),
    },
}));

const CLIENT_KEY = 'test-client-key';
const ADMIN_KEY = 'test-admin-key';

const listMock = vi.mocked(expedionDal.list);
const getSessionMock = vi.mocked(auth.api.getSession);

/** Builds a request authenticated by the shared-key path. */
function get(query = '', { admin = false } = {}) {
    return GET(
        new NextRequest(`http://localhost/api/expedion/quotes${query}`, {
            headers: {
                authorization: `Bearer ${admin ? ADMIN_KEY : CLIENT_KEY}`,
                'x-expedion-uid': 'user_abc',
            },
        })
    );
}

/** The `owner` the route handed the service on its last call. */
function ownerPassed() {
    return listMock.mock.calls.at(-1)![0].owner;
}

describe('GET /api/expedion/quotes — owner scoping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('EXPEDION_API_KEY', CLIENT_KEY);
        vi.stubEnv('EXPEDION_ADMIN_API_KEY', ADMIN_KEY);
        // No Better Auth session: these callers authenticate by shared key.
        getSessionMock.mockResolvedValue(null as never);
        vi.mocked(usersDal.userHasRole).mockResolvedValue(false as never);
        listMock.mockResolvedValue({ rows: [], total: 0 } as never);
    });

    afterEach(() => vi.unstubAllEnvs());

    it('scopes a normal caller to their own quotes', async () => {
        await get();
        expect(ownerPassed()).toEqual({ scope: 'mine', ownerId: 'user_abc' });
    });

    // The regression. An admin opening "Mes devis" in the client app was handed
    // every row in the table, because the route read the role as permission to
    // widen.
    it('scopes an ADMIN to their own quotes when no scope is asked for', async () => {
        await get('', { admin: true });
        expect(ownerPassed()).toEqual({ scope: 'mine', ownerId: 'user_abc' });
    });

    it('lets an admin sweep the table when it asks explicitly', async () => {
        await get('?scope=all', { admin: true });
        expect(ownerPassed()).toEqual({ scope: 'all' });
    });

    it('refuses a non-admin sweep with 403 rather than downgrading it', async () => {
        const response = await get('?scope=all');

        expect(response.status).toBe(403);
        // Refused outright — the query must never have run.
        expect(listMock).not.toHaveBeenCalled();
    });

    it('rejects an unknown scope instead of guessing', async () => {
        const response = await get('?scope=everything', { admin: true });
        expect(response.status).toBe(400);
    });

    it('keeps caller scoping when other filters are present', async () => {
        await get('?bordereauNumber=B-77&page=2&limit=50', { admin: true });

        const filters = listMock.mock.calls.at(-1)![0];
        expect(filters.owner).toEqual({ scope: 'mine', ownerId: 'user_abc' });
        expect(filters).toMatchObject({
            bordereauNumber: 'B-77',
            page: 2,
            limit: 50,
        });
    });

    it('refuses a caller with no credential at all', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/expedion/quotes')
        );
        expect(response.status).toBe(401);
        expect(listMock).not.toHaveBeenCalled();
    });
});
