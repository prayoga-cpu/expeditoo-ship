import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '../auth.service';
import * as usersDAL from '@/server/dal/users.dal';

const mocks = vi.hoisted(() => {
  return {
    send: vi.fn().mockResolvedValue({ id: 'email-id' }),
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
}));

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

/** Only the name is read by these services; the rest of the row is irrelevant. */
type UserRow = Awaited<ReturnType<typeof usersDAL.getUserByEmail>>;
const namedUser = (name: string) => ({ name }) as unknown as UserRow;

describe('authService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handlePostSignup', () => {
        it('should assign default role', async () => {
            await authService.handlePostSignup('user-1', 'test@mail.com');
            expect(usersDAL.assignDefaultRole).toHaveBeenCalledWith('user-1');
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
    });
});

