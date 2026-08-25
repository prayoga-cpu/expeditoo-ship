import { describe, it, expect, vi, afterEach } from 'vitest';

import {
    expedionFileIdFromUrl,
    expedionFileUrl,
    isExpedionFileUrl,
} from '@/lib/expedion-files';

/**
 * One predicate decides, for every stored document URL on the platform,
 * whether it is read over HTTP or out of R2. Getting it wrong in either
 * direction is silent: a misclassified Firebase URL becomes "document
 * unreadable", a misclassified ship URL becomes a 401 the reader reports as
 * the same thing.
 */
describe('expedionFileIdFromUrl', () => {
    it('recognises a file URL on this deployment', () => {
        expect(
            expedionFileIdFromUrl('http://localhost:3000/api/expedion/files/abc123')
        ).toBe('abc123');
    });

    // Why the pathname is compared and not a prefix of the whole string: a
    // preview deployment writes URLs under a hostname that is not
    // NEXT_PUBLIC_APP_URL, and must still recognise its own files.
    it('recognises a file URL on any host', () => {
        expect(
            expedionFileIdFromUrl(
                'https://expeditoo-ship-git-preview.vercel.app/api/expedion/files/abc123'
            )
        ).toBe('abc123');
    });

    it('leaves a Firebase download URL alone', () => {
        // Still live, and still read by a plain fetch: the `token` is checked
        // by the Storage service, not by the rules that changed.
        const url =
            'https://firebasestorage.googleapis.com/v0/b/expedion.appspot.com/o/users%2Fu1%2Fuploads%2Fb.pdf?alt=media&token=6f1c';
        expect(expedionFileIdFromUrl(url)).toBeNull();
        expect(isExpedionFileUrl(url)).toBe(false);
    });

    it('rejects a path that only looks like one', () => {
        // A deeper path is not a file id, and truncating to the first segment
        // would turn a foreign URL into a lookup against our own table.
        expect(
            expedionFileIdFromUrl('https://evil.example/api/expedion/files/abc/extra')
        ).toBeNull();
        expect(expedionFileIdFromUrl('https://example.com/api/expedion/quotes/1')).toBeNull();
        expect(expedionFileIdFromUrl('/api/expedion/files/')).toBeNull();
    });

    // `new URL` resolves `..` before we ever see the path, so this collapses to
    // the single segment `x` and is treated as an ordinary id. That is the
    // right answer rather than a hole: the id is only ever a parameter to a
    // primary-key lookup, so a miss is a 404 and nothing is traversed.
    it('resolves dot segments to a plain id', () => {
        expect(
            expedionFileIdFromUrl('https://expeditoo.com/api/expedion/files/abc/../x')
        ).toBe('x');
    });

    it('handles null, empty and unparseable input', () => {
        expect(expedionFileIdFromUrl(null)).toBeNull();
        expect(expedionFileIdFromUrl(undefined)).toBeNull();
        expect(expedionFileIdFromUrl('')).toBeNull();
        expect(expedionFileIdFromUrl('not a url at all')).toBeNull();
    });
});

describe('expedionFileUrl', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('round-trips through the predicate', () => {
        const url = expedionFileUrl('abc123');
        expect(expedionFileIdFromUrl(url)).toBe('abc123');
    });

    it('is absolute, because it is persisted for thirty days', () => {
        // The client stores this in a SharedPreferences draft and the server
        // stores it in `bordereau_doc_url`; `photoUrls` is validated as
        // `z.string().url()` and the admin preview matches `^https?:`.
        expect(expedionFileUrl('abc123')).toMatch(/^https?:\/\//);
    });

    it('does not double a trailing slash on the configured base', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://expeditoo.com/');
        expect(expedionFileUrl('abc123')).toBe(
            'https://expeditoo.com/api/expedion/files/abc123'
        );
    });
});
