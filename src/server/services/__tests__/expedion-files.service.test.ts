import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    attachUploadedFilesToQuote,
    bordereauDataUrl,
} from '@/server/services/expedion-files.service';
import { expedionFilesDal } from '@/server/dal/expedion-files.dal';
import { expedionStorageService } from '@/server/services/expedion-storage.service';
import { imageUrlToBase64DataUrl } from '@/lib/ai/openai';

/**
 * The branch every server-side reader now goes through. It exists because the
 * two shapes `bordereau_doc_url` holds cannot be read the same way: a Firebase
 * URL carries its own token and answers a bare fetch, while a ship file URL is
 * owner-gated and would 401 the deployment's own internal request — a failure
 * that surfaces as "the document is unreadable", i.e. as nothing at all.
 *
 * It is also the second place the owner check happens. The column is written
 * from a request body, so without the check a file id would be a bearer token
 * here even though it is not one on the route.
 */
vi.mock('@/server/dal/expedion-files.dal', () => ({
    expedionFilesDal: {
        create: vi.fn(),
        getById: vi.fn(),
        listObjectKeys: vi.fn(),
        attachToQuote: vi.fn(),
    },
}));

vi.mock('@/server/services/expedion-storage.service', () => ({
    expedionStorageService: {
        upload: vi.fn(),
        presignRead: vi.fn(),
        readToDataUrl: vi.fn(),
    },
}));

vi.mock('@/lib/ai/openai', () => ({
    imageUrlToBase64DataUrl: vi.fn(),
}));

const getByIdMock = vi.mocked(expedionFilesDal.getById);
const attachMock = vi.mocked(expedionFilesDal.attachToQuote);
const readToDataUrlMock = vi.mocked(expedionStorageService.readToDataUrl);
const fetchDataUrlMock = vi.mocked(imageUrlToBase64DataUrl);

const FIREBASE_URL =
    'https://firebasestorage.googleapis.com/v0/b/expedion.appspot.com/o/users%2Fu1%2Fuploads%2Fb.pdf?alt=media&token=6f1c';

describe('bordereauDataUrl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        readToDataUrlMock.mockResolvedValue('data:application/pdf;base64,RlJPTVIy');
        fetchDataUrlMock.mockResolvedValue('data:application/pdf;base64,RlJPTUZC');
        getByIdMock.mockResolvedValue({
            id: 'file_1',
            ownerUserId: 'owner_1',
            quoteId: null,
            kind: 'bordereau',
            objectKey: 'expedion/owner_1/bordereau-xyz',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            createdAt: new Date(),
        } as never);
    });

    it('reads a ship file straight out of R2, never over HTTP', async () => {
        const result = await bordereauDataUrl(
            'https://expeditoo.com/api/expedion/files/file_1',
            'owner_1'
        );

        expect(result).toBe('data:application/pdf;base64,RlJPTVIy');
        expect(readToDataUrlMock).toHaveBeenCalledWith('expedion/owner_1/bordereau-xyz');
        // No presign either: a 300-second URL handed to a 120-second vision
        // call is a race, and it puts an unauthenticated link on the wire.
        expect(fetchDataUrlMock).not.toHaveBeenCalled();
        expect(expedionStorageService.presignRead).not.toHaveBeenCalled();
    });

    /*
     * The one that matters. `bordereau_doc_url` is written from the request
     * body and `createQuote` re-extracts automatically — so without this, a
     * quote naming somebody else's file id would have the model read that
     * document and write the buyer's name, address and declared value onto a
     * quote the caller owns and can fetch straight back.
     */
    it("refuses a file that belongs to someone other than the quote's owner", async () => {
        const result = await bordereauDataUrl(
            'https://expeditoo.com/api/expedion/files/file_1',
            'someone_else'
        );

        expect(result).toBeNull();
        expect(readToDataUrlMock).not.toHaveBeenCalled();
        // And no fallback to fetching it either, which would only be the same
        // read over HTTP against a route that would refuse it anyway.
        expect(fetchDataUrlMock).not.toHaveBeenCalled();
    });

    it('still fetches a pre-migration Firebase URL', async () => {
        const result = await bordereauDataUrl(FIREBASE_URL, 'owner_1');

        expect(result).toBe('data:application/pdf;base64,RlJPTUZC');
        expect(fetchDataUrlMock).toHaveBeenCalledWith(FIREBASE_URL);
        expect(getByIdMock).not.toHaveBeenCalled();
    });

    it('returns null for a file URL with no row behind it', async () => {
        getByIdMock.mockResolvedValue(null as never);

        expect(
            await bordereauDataUrl(
                'https://expeditoo.com/api/expedion/files/gone',
                'owner_1'
            )
        ).toBeNull();
        // Notably it does NOT fall back to fetching the URL, which would just
        // 401 and cost a request to find that out.
        expect(fetchDataUrlMock).not.toHaveBeenCalled();
    });

    it('returns null for a missing column rather than fetching nothing', async () => {
        expect(await bordereauDataUrl(null, 'owner_1')).toBeNull();
        expect(fetchDataUrlMock).not.toHaveBeenCalled();
    });
});

describe('attachUploadedFilesToQuote', () => {
    beforeEach(() => vi.clearAllMocks());

    /*
     * Same body-supplied ids, same reason to scope them: an unscoped update
     * would repoint a stranger's row at this quote, and detach it from the one
     * it actually belongs to.
     */
    it('scopes the update to the quote owner', async () => {
        await attachUploadedFilesToQuote('quote_1', 'owner_1', [
            'https://expeditoo.com/api/expedion/files/file_1',
            'https://expeditoo.com/api/expedion/files/file_2',
        ]);

        expect(attachMock).toHaveBeenCalledWith(
            ['file_1', 'file_2'],
            'quote_1',
            'owner_1'
        );
    });

    it('ignores URLs that are not ship files, and writes nothing when none are', async () => {
        await attachUploadedFilesToQuote('quote_1', 'owner_1', [
            FIREBASE_URL,
            null,
            undefined,
        ]);

        expect(attachMock).not.toHaveBeenCalled();
    });

    it('never lets a failed attach reach the caller', async () => {
        attachMock.mockRejectedValue(new Error('db down'));

        // `createQuote` calls this without awaiting, so a rejection would
        // become an unhandled rejection rather than a failed quote — a worse
        // outcome than the provenance column it was trying to write.
        await expect(
            attachUploadedFilesToQuote('quote_1', 'owner_1', [
                'https://expeditoo.com/api/expedion/files/file_1',
            ])
        ).resolves.toBeUndefined();
    });
});
