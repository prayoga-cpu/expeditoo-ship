import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '../auth.service';
import * as usersDAL from '@/server/dal/users.dal';

const mocks = vi.hoisted(() => {
  return {
    send: vi.fn().mockResolvedValue({ id: 'email-id' }),
    execute: vi.fn().mockResolvedValue([]),
  }
})

// Mock dependencies
vi.mock('@/lib/email', () => ({
  // sendViaResend normally redirects outside production; the mock bypasses
  // that so this file can test authService's own subject/template logic.
  sendViaResend: mocks.send,
  EMAIL_FROM: 'test@example.com',
}));

vi.mock('@/server/dal/users.dal', () => ({
  assignDefaultRole: vi.fn(),
  getUserByEmail: vi.fn(),
  // The claim reads `emailVerified` back off the row Better Auth just wrote,
  // so the signup path needs this one too.
  getUserById: vi.fn(),
}));

// The quote claim is one raw statement rather than a DAL call, so the only
// seam is `db.execute` itself. Asserting on the SQL it is handed is the point:
// the guard that stops a claim taking a row off a live account lives in that
// text and nowhere else.
vi.mock('@/db', () => ({
  db: { execute: mocks.execute },
}));

/**
 * A drizzle template splits into `queryChunks`: StringChunks carrying the
 * literal SQL in a `value` array, interleaved with the interpolated values
 * themselves. `isLiteral` is what separates the two, and the halves are what
 * these tests assert on -- the query text for the ownership guard, the values
 * for the address it was given.
 */
const isLiteral = (chunk: unknown) =>
    Array.isArray((chunk as { value?: unknown })?.value);

const chunksOf = (statement: unknown) =>
    (statement as { queryChunks?: unknown[] })?.queryChunks ?? [];

/** The literal SQL of a drizzle template, whitespace collapsed. */
function sqlTextOf(statement: unknown): string {
    return chunksOf(statement)
        .filter(isLiteral)
        .map((chunk) => ((chunk as { value: unknown[] }).value ?? []).join(''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
}

/** The interpolated values of a drizzle template, in order. */
function sqlParamsOf(statement: unknown): unknown[] {
    return chunksOf(statement).filter((chunk) => !isLiteral(chunk));
}

/**
 * The services hand Resend a rendered React Email element, so assertions read
 * the strings that element actually carries (hrefs and text) rather than
 * component props - `Template({...})` returns the tree, not a `<Template>` node.
 */
function textOf(node: unknown, out: string[] = []): string[] {
    if (node == null) return out;
    if (typeof node === 'string') {
        out.push(node);
        return out;
    }
    if (Array.isArray(node)) {
        node.forEach((child) => textOf(child, out));
        return out;
    }
    if (typeof node !== 'object' || !('props' in node)) return out;

    const props = (node as { props?: Record<string, unknown> }).props ?? {};
    for (const [key, value] of Object.entries(props)) {
        if (key === 'children') textOf(value, out);
        else if (typeof value === 'string') out.push(value);
    }
    return out;
}

const sentEmail = () => mocks.send.mock.calls[0][0];

/** Only the name and the origin are read here; the rest of the row is irrelevant. */
type UserRow = Awaited<ReturnType<typeof usersDAL.getUserByEmail>>;
const namedUser = (name: string, origin: 'expeditoo' | 'expedion' = 'expeditoo') =>
    ({ name, origin }) as unknown as UserRow;

/** A row for the signup path, which only reads `emailVerified`. */
const verifiedUser = (emailVerified: boolean) =>
    ({ emailVerified }) as unknown as UserRow;

/**
 * The Expedion app's base URL is read from EXPEDION_APP_ORIGINS at call time,
 * so every test states what that variable holds rather than inheriting it.
 */
const EXPEDION_ORIGIN = 'https://expedion.test';

describe('authService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.EXPEDION_APP_ORIGINS;
        vi.mocked(usersDAL.getUserById).mockResolvedValue(verifiedUser(false));
        mocks.execute.mockResolvedValue([]);
    });

    describe('handlePostSignup', () => {
        it('should assign default role', async () => {
            await authService.handlePostSignup('user-1', 'test@mail.com');
            expect(usersDAL.assignDefaultRole).toHaveBeenCalledWith('user-1');
        });

        // Under `requireEmailVerification` this is the ordinary signup: the
        // address is still just a claim, so nothing may be handed over on it.
        it('should claim nothing for a signup whose address is unverified', async () => {
            vi.mocked(usersDAL.getUserById).mockResolvedValue(verifiedUser(false));

            await authService.handlePostSignup('user-1', 'test@mail.com');

            expect(mocks.execute).not.toHaveBeenCalled();
        });

        // A Google signup arrives verified because Google vouched for the
        // address, so there is nothing left to wait for.
        it('should claim quotes for a signup that arrives already verified', async () => {
            vi.mocked(usersDAL.getUserById).mockResolvedValue(verifiedUser(true));

            await authService.handlePostSignup('user-1', 'Test@Mail.com ');

            expect(mocks.execute).toHaveBeenCalledTimes(1);
            expect(sqlParamsOf(mocks.execute.mock.calls[0][0])).toContain(
                'test@mail.com'
            );
        });
    });

    describe('claimExpedionQuotesForUser', () => {
        it('should refuse to match on an unverified address', async () => {
            const claimed = await authService.claimExpedionQuotesForUser(
                'user-1',
                'test@mail.com',
                false
            );

            expect(claimed).toBe(0);
            expect(mocks.execute).not.toHaveBeenCalled();
        });

        it('should not run at all without an address to match', async () => {
            const claimed = await authService.claimExpedionQuotesForUser(
                'user-1',
                '   ',
                true
            );

            expect(claimed).toBe(0);
            expect(mocks.execute).not.toHaveBeenCalled();
        });

        // The whole safety of widening past `airtable:%` rests on this clause:
        // a row already owned by a live Better Auth account is out of reach
        // whatever address it carries.
        it('should skip rows whose owner is already a Better Auth user', async () => {
            await authService.claimExpedionQuotesForUser(
                'user-1',
                'test@mail.com',
                true
            );

            const text = sqlTextOf(mocks.execute.mock.calls[0][0]);
            expect(text).toContain(
                'not exists ( select 1 from "user" where "user".id = expedion_quotes.firebase_uid )'
            );
            // Both columns move together, so the forward-looking `user_id` is
            // never left pointing at the previous owner.
            expect(text).toContain('set firebase_uid =');
            expect(text).toContain('user_id =');
        });

        it('should report how many quotes changed hands', async () => {
            mocks.execute.mockResolvedValue([{ id: 'q1' }, { id: 'q2' }]);

            const claimed = await authService.claimExpedionQuotesForUser(
                'user-1',
                'test@mail.com',
                true
            );

            expect(claimed).toBe(2);
        });

        // It now runs on every session creation, so a failure here would break
        // sign-in rather than merely lose a nicety.
        it('should swallow a database failure and report nothing claimed', async () => {
            mocks.execute.mockRejectedValue(new Error('connection lost'));

            await expect(
                authService.claimExpedionQuotesForUser('user-1', 'test@mail.com', true)
            ).resolves.toBe(0);
        });
    });

    describe('sendVerificationEmail', () => {
        it('should send email using Resend', async () => {
            vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(namedUser('Test User'));

            await authService.sendVerificationEmail('test@mail.com');

            expect(usersDAL.getUserByEmail).toHaveBeenCalledWith('test@mail.com');
            expect(mocks.send).toHaveBeenCalled();
        });

        it('should point the callback at signin, so a verified user lands there', async () => {
            vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(namedUser('Test User'));

            await authService.sendVerificationEmail(
                'test@mail.com',
                'https://app.test/api/auth/verify-email?token=abc&callbackURL=%2Fdashboard'
            );

            const sent = sentEmail();
            expect(sent.subject).toBe('Verify your EXPEDITOO account');
            expect(textOf(sent.react).join(' ')).toContain(
                'callbackURL=%2Fsignin%3Fverified%3Dtrue'
            );
        });

        // An Expedion buyer who verifies must not land on a carrier login form
        // for a product they have no account relationship with.
        it('should send an Expedion signup back to the Expedion app', async () => {
            process.env.EXPEDION_APP_ORIGINS = `${EXPEDION_ORIGIN},https://preview.test`;
            vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(
                namedUser('Test User', 'expedion')
            );

            await authService.sendVerificationEmail(
                'test@mail.com',
                'https://app.test/api/auth/verify-email?token=abc&callbackURL=%2Fdashboard'
            );

            const sent = sentEmail();
            expect(sent.subject).toBe('Verify your Expedion account');
            const body = textOf(sent.react).join(' ');
            expect(body).toContain(
                `callbackURL=${encodeURIComponent(`${EXPEDION_ORIGIN}/seConnecter?verified=true`)}`
            );
            expect(body).toContain('Expedion');
            expect(body).not.toContain('EXPEDITOO');
        });

        // Without the variable there is no Expedion app to send anyone to, so
        // the mail must read exactly as it did before the branch existed.
        it('should fall back to EXPEDITOO when no Expedion origin is configured', async () => {
            vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(
                namedUser('Test User', 'expedion')
            );

            await authService.sendVerificationEmail(
                'test@mail.com',
                'https://app.test/api/auth/verify-email?token=abc'
            );

            const sent = sentEmail();
            expect(sent.subject).toBe('Verify your EXPEDITOO account');
            expect(textOf(sent.react).join(' ')).toContain(
                'callbackURL=%2Fsignin%3Fverified%3Dtrue'
            );
        });
    });

    describe('sendPasswordResetEmail', () => {
        // The reset link must survive untouched: rewriting its callbackURL (as
        // the verification path does) strands the user on a page with no token.
        const resetUrl =
            'https://app.test/api/auth/reset-password/tok-1?callbackURL=%2Freset-password';

        it('should send the reset template with its own subject', async () => {
            vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(namedUser('Test User'));

            await authService.sendPasswordResetEmail('test@mail.com', resetUrl);

            const sent = sentEmail();
            expect(sent.subject).toBe('Reset your EXPEDITOO password');
            expect(textOf(sent.react)).toContain('Test');
            expect(textOf(sent.react).join(' ')).not.toContain('verify');
        });

        it('should keep the reset URL verbatim, callbackURL included', async () => {
            vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(namedUser('Test User'));

            await authService.sendPasswordResetEmail('test@mail.com', resetUrl);

            const strings = textOf(sentEmail().react);
            expect(strings).toContain(resetUrl);
            expect(strings.join(' ')).not.toContain('signin');
        });

        // Only the branding moves for Expedion. The link keeps both its base
        // and its destination on this app: the token endpoint is mounted here
        // and so is the reset form, which Expedion's own client asks for by
        // name because its router has no reset screen to land on.
        it('should brand an Expedion reset without moving the link', async () => {
            process.env.EXPEDION_APP_ORIGINS = EXPEDION_ORIGIN;
            vi.mocked(usersDAL.getUserByEmail).mockResolvedValue(
                namedUser('Test User', 'expedion')
            );

            await authService.sendPasswordResetEmail('test@mail.com', resetUrl);

            const sent = sentEmail();
            expect(sent.subject).toBe('Reset your Expedion password');
            const strings = textOf(sent.react);
            expect(strings).toContain(resetUrl);
            expect(strings.join(' ')).not.toContain('EXPEDITOO');
        });
    });
});

