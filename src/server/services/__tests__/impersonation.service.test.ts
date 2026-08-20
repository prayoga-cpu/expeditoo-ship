import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as impersonationService from '../impersonation.service';
import * as usersDal from '@/server/dal/users.dal';
import * as impersonationDal from '@/server/dal/impersonation.dal';

vi.mock('@/server/dal/users.dal', () => ({
    getUserById: vi.fn(),
}));

vi.mock('@/server/dal/impersonation.dal', () => ({
    recordStart: vi.fn(),
    recordEnd: vi.fn(),
    listRecent: vi.fn(),
}));

const ADMIN = { id: 'admin', email: 'admin@expeditoo.test', roles: [{ role: 'admin' }] };
const DRIVER = { id: 'driver', email: 'driver@expeditoo.test', roles: [{ role: 'driver' }] };

function mockUsers(actor: unknown, target?: unknown) {
    vi.mocked(usersDal.getUserById).mockImplementation(async (id: string) =>
        (id === 'admin' ? actor : target) as never
    );
}

describe('impersonationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
    });

    describe('assertCanImpersonate', () => {
        it('refuses a caller without the admin role', async () => {
            mockUsers(DRIVER, DRIVER);

            await expect(impersonationService.assertCanImpersonate('admin', 'driver'))
                .rejects.toMatchObject({ code: 'NOT_ADMIN', status: 403 });
        });

        it('refuses impersonating yourself', async () => {
            mockUsers(ADMIN, ADMIN);

            await expect(impersonationService.assertCanImpersonate('admin', 'admin'))
                .rejects.toMatchObject({ code: 'CANNOT_IMPERSONATE_SELF', status: 400 });
        });

        it('refuses an unknown target', async () => {
            mockUsers(ADMIN, undefined);

            await expect(impersonationService.assertCanImpersonate('admin', 'driver'))
                .rejects.toMatchObject({ code: 'USER_NOT_FOUND', status: 404 });
        });

        it('allows another admin', async () => {
            // Deliberate: an admin has to be able to see any account. What makes
            // it accountable is the impersonation_sessions row and the one-hour
            // ceiling, not a list of accounts the menu quietly refuses.
            mockUsers(ADMIN, { id: 'driver', email: 'two@expeditoo.test', roles: [{ role: 'admin' }] });

            const result = await impersonationService.assertCanImpersonate('admin', 'driver');

            expect(result.target.id).toBe('driver');
        });

        it('allows the Expedion system account', async () => {
            vi.stubEnv('EXPEDION_SYSTEM_USER_ID', 'driver');
            mockUsers(ADMIN, DRIVER);

            const result = await impersonationService.assertCanImpersonate('admin', 'driver');

            expect(result.target.id).toBe('driver');
        });

        it('allows an admin to borrow an ordinary account', async () => {
            mockUsers(ADMIN, DRIVER);

            const result = await impersonationService.assertCanImpersonate('admin', 'driver');

            expect(result.admin.id).toBe('admin');
            expect(result.target.id).toBe('driver');
        });
    });

    describe('recordStart', () => {
        it('writes the audit row with both emails', async () => {
            const expiresAt = new Date('2026-08-19T05:00:00Z');

            await impersonationService.recordStart({
                adminId: 'admin',
                adminEmail: ADMIN.email,
                targetUserId: 'driver',
                targetEmail: DRIVER.email,
                sessionToken: 'tok',
                expiresAt,
            });

            // Both emails, so the record survives either account being deleted.
            expect(impersonationDal.recordStart).toHaveBeenCalledWith(
                expect.objectContaining({
                    adminEmail: ADMIN.email,
                    targetEmail: DRIVER.email,
                    sessionToken: 'tok',
                    expiresAt,
                })
            );
        });
    });

    describe('recordEnd', () => {
        it('does not throw when there is no open row', async () => {
            vi.mocked(impersonationDal.recordEnd).mockResolvedValue(undefined as never);

            // Stopping has to hand the admin back their own session even if the
            // audit write went missing.
            await expect(impersonationService.recordEnd('tok')).resolves.toBeUndefined();
        });
    });

    describe('listRecent', () => {
        it('is admin-only', async () => {
            mockUsers(DRIVER);

            await expect(impersonationService.listRecent('admin'))
                .rejects.toMatchObject({ code: 'NOT_ADMIN' });
        });
    });
});
