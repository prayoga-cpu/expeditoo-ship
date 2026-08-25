import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from '../route';
import { auth } from '@/lib/auth';
import { expedionStorageService } from '@/server/services/expedion-storage.service';
import { expedionFilesDal } from '@/server/dal/expedion-files.dal';

/**
 * This route is the only thing standing between a stored bordereau — buyer's
 * name, address, phone, declared value — and anyone holding its URL, so the
 * authorisation branch is tested exhaustively and the storage layer is mocked
 * down to "was a presigned URL minted at all".
 *
 * `expedion-auth` is deliberately NOT mocked: which caller the credential
 * resolves to, and whether they are an admin, is the input the decision is
 * made on.
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

vi.mock('@/server/services/expedion-storage.service', () => ({
    expedionStorageService: {
        upload: vi.fn(),
        presignRead: vi.fn(),
        readToDataUrl: vi.fn(),
    },
}));

vi.mock('@/server/dal/expedion-files.dal', () => ({
    expedionFilesDal: {
        create: vi.fn(),
        getById: vi.fn(),
        listObjectKeys: vi.fn(),
        attachToQuote: vi.fn(),
    },
}));

const CLIENT_KEY = 'test-client-key';
const ADMIN_KEY = 'test-admin-key';
const PRESIGNED = 'https://r2.example.com/expedion/owner_1/bordereau-xyz?sig=abc';

const getSessionMock = vi.mocked(auth.api.getSession);
const getByIdMock = vi.mocked(expedionFilesDal.getById);
const presignMock = vi.mocked(expedionStorageService.presignRead);

/** A stored bordereau belonging to `owner_1`. */
const OWNED_FILE = {
    id: 'file_1',
    ownerUserId: 'owner_1',
    quoteId: null,
    kind: 'bordereau',
    objectKey: 'expedion/owner_1/bordereau-xyz',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    createdAt: new Date(),
};

function get(
    { as, admin = false }: { as?: string; admin?: boolean } = {}
) {
    const headers: Record<string, string> = {};
    if (as) {
        headers.authorization = `Bearer ${admin ? ADMIN_KEY : CLIENT_KEY}`;
        headers['x-expedion-uid'] = as;
    }

    return GET(
        new NextRequest('http://localhost/api/expedion/files/file_1', { headers }),
        { params: Promise.resolve({ id: 'file_1' }) }
    );
}

describe('GET /api/expedion/files/:id', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('EXPEDION_API_KEY', CLIENT_KEY);
        vi.stubEnv('EXPEDION_ADMIN_API_KEY', ADMIN_KEY);
        getSessionMock.mockResolvedValue(null as never);
        getByIdMock.mockResolvedValue(OWNED_FILE as never);
        presignMock.mockResolvedValue(PRESIGNED);
    });

    afterEach(() => vi.unstubAllEnvs());

    it('refuses an unauthenticated caller', async () => {
        const response = await get();

        expect(response.status).toBe(401);
        expect((await response.json()).error.code).toBe('UNAUTHORIZED');
        expect(presignMock).not.toHaveBeenCalled();
    });

    it('redirects the owner to a short-lived presigned URL', async () => {
        const response = await get({ as: 'owner_1' });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(PRESIGNED);
        // Caller-specific and expiring: a shared cache holding it would serve
        // the next reader a link that skipped this check.
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(presignMock).toHaveBeenCalledWith(OWNED_FILE.objectKey);
    });

    // The regression this whole route exists to prevent. The Firebase rule it
    // replaces authorised on a path segment; this one authorises on a row.
    it("refuses another user's object, and mints no URL doing it", async () => {
        const response = await get({ as: 'someone_else' });

        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('FILE_NOT_FOUND');
        expect(presignMock).not.toHaveBeenCalled();
    });

    it('answers a non-owner and a missing file identically', async () => {
        getByIdMock.mockResolvedValue(null as never);
        const missing = await get({ as: 'owner_1' });

        getByIdMock.mockResolvedValue(OWNED_FILE as never);
        const foreign = await get({ as: 'someone_else' });

        // Same status and same code, so a caller cannot probe for which ids
        // exist by watching the two answers diverge.
        expect(missing.status).toBe(foreign.status);
        expect((await missing.json())).toEqual(await foreign.json());
    });

    it('lets an admin read any file', async () => {
        const response = await get({ as: 'operator_9', admin: true });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(PRESIGNED);
        expect(presignMock).toHaveBeenCalledWith(OWNED_FILE.objectKey);
    });

    it('serves the admin browser off its Better Auth cookie session', async () => {
        // No bearer token at all: the admin dialog renders `<img>`/`<iframe>`
        // same-origin, and cannot attach a header to either.
        getSessionMock.mockResolvedValue({
            user: { id: 'operator_9', email: 'ops@expeditoo.com', emailVerified: true },
        } as never);
        const usersDal = await import('@/server/dal/users.dal');
        vi.mocked(usersDal.userHasRole).mockResolvedValue(true as never);

        const response = await GET(
            new NextRequest('http://localhost/api/expedion/files/file_1'),
            { params: Promise.resolve({ id: 'file_1' }) }
        );

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(PRESIGNED);
    });
});
