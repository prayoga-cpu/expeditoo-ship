import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../route';
import { auth } from '@/lib/auth';
import { expedionStorageService } from '@/server/services/expedion-storage.service';
import { expedionFilesDal } from '@/server/dal/expedion-files.dal';

/**
 * The route's whole job is the three refusals and one namespacing decision it
 * makes before anything is stored, so those are what is tested here.
 *
 * `expedion-auth` is deliberately NOT mocked, same reasoning as
 * `expedion/quotes/__tests__/route.test.ts`: the guard is the feature. R2 and
 * the database are — a unit test must not need either, and what matters about
 * the upload is the arguments it hands the storage service, not what R2 does
 * with them.
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
const UID = 'user_abc';

const getSessionMock = vi.mocked(auth.api.getSession);
const uploadMock = vi.mocked(expedionStorageService.upload);
const createMock = vi.mocked(expedionFilesDal.create);

/** A base64 payload of `size` bytes, as the client would send it. */
function base64Of(size: number) {
    return Buffer.alloc(size, 0x41).toString('base64');
}

function post(
    body: unknown,
    { authenticated = true }: { authenticated?: boolean } = {}
) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (authenticated) {
        headers.authorization = `Bearer ${CLIENT_KEY}`;
        headers['x-expedion-uid'] = UID;
    }

    return POST(
        new NextRequest('http://localhost/api/expedion/upload', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        })
    );
}

describe('POST /api/expedion/upload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('EXPEDION_API_KEY', CLIENT_KEY);
        vi.stubEnv('EXPEDION_ADMIN_API_KEY', ADMIN_KEY);
        // No Better Auth session: this caller authenticates by shared key.
        getSessionMock.mockResolvedValue(null as never);
        uploadMock.mockResolvedValue('expedion/user_abc/bordereau-generated');
        createMock.mockImplementation(
            async (data) => ({ ...data, createdAt: new Date() }) as never
        );
    });

    afterEach(() => vi.unstubAllEnvs());

    it('refuses an unauthenticated caller before reading the body', async () => {
        const response = await post(
            { data: base64Of(16), mimeType: 'application/pdf' },
            { authenticated: false }
        );

        expect(response.status).toBe(401);
        expect((await response.json()).error.code).toBe('UNAUTHORIZED');
        // Nothing reached storage. The point of checking this rather than only
        // the status: a 401 that had already written the object would still be
        // an anonymous write.
        expect(uploadMock).not.toHaveBeenCalled();
        expect(createMock).not.toHaveBeenCalled();
    });

    it('refuses a MIME type outside the allow-list', async () => {
        const response = await post({
            data: base64Of(16),
            mimeType: 'application/zip',
            filename: 'bordereau.zip',
        });

        expect(response.status).toBe(415);
        expect((await response.json()).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
        expect(uploadMock).not.toHaveBeenCalled();
    });

    it('refuses a payload over the 3 MB cap, measured on the decoded bytes', async () => {
        const response = await post({
            data: base64Of(3 * 1024 * 1024 + 1),
            mimeType: 'application/pdf',
        });

        expect(response.status).toBe(413);
        expect((await response.json()).error.code).toBe('FILE_TOO_LARGE');
        expect(uploadMock).not.toHaveBeenCalled();
    });

    it('accepts a `data:` prefix and a charset-suffixed MIME type', async () => {
        const response = await post({
            data: `data:image/jpeg;base64,${base64Of(64)}`,
            mimeType: 'image/JPEG; charset=binary',
            kind: 'photo',
        });

        expect(response.status).toBe(200);
        // Normalised before it is stored, so the admin preview and the vision
        // model are not handed `image/JPEG; charset=binary`.
        expect(uploadMock.mock.calls[0][3]).toBe('image/jpeg');
        // The prefix is stripped rather than decoded as part of the payload.
        expect(uploadMock.mock.calls[0][2].length).toBe(64);
    });

    it('namespaces the object by the caller, and returns a URL rather than the key', async () => {
        uploadMock.mockResolvedValue('expedion/user_abc/bordereau-xyz');

        const response = await post({
            data: base64Of(128),
            mimeType: 'application/pdf',
            filename: 'bordereau.pdf',
        });

        expect(response.status).toBe(200);
        const [ownerUserId, kind, buffer, mimeType] = uploadMock.mock.calls[0];
        expect(ownerUserId).toBe(UID);
        expect(kind).toBe('bordereau');
        expect(buffer.length).toBe(128);
        expect(mimeType).toBe('application/pdf');

        // The row records the owner the read route will authorise against.
        expect(createMock.mock.calls[0][0]).toMatchObject({
            ownerUserId: UID,
            kind: 'bordereau',
            objectKey: 'expedion/user_abc/bordereau-xyz',
            sizeBytes: 128,
            quoteId: null,
        });

        const body = await response.json();
        expect(body.data.url).toBe(
            `http://localhost:3000/api/expedion/files/${body.data.fileId}`
        );
        // The object key must never reach the client: it is persisted into a
        // quote column and into a thirty-day client-side draft, and anything
        // holding it could be presigned against.
        expect(JSON.stringify(body)).not.toContain('expedion/user_abc');
    });
});
