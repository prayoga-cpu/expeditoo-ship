import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as adminService from '../admin.service';
import * as adminDal from '@/server/dal/admin.dal';
import * as usersDal from '@/server/dal/users.dal';
import * as sessionsDal from '@/server/dal/sessions.dal';

// Mock DALs
vi.mock('@/server/dal/admin.dal', () => ({
    getTotalAppFees: vi.fn(),
    getActiveUsersCount: vi.fn(),
    getActiveDriversCount: vi.fn(),
    getPendingDeliveriesCount: vi.fn(),
    getMonthlyAppFees: vi.fn(),
    getMonthlyNewUsersCount: vi.fn(),
    getMonthlyNewDriversCount: vi.fn(),
    getMonthlyPendingDeliveriesCount: vi.fn(),
    getRecentUsers: vi.fn(),
    getRecentListings: vi.fn(),
    getRecentDeliveredShipments: vi.fn(),
    updateUserBannedStatus: vi.fn(),
}));

vi.mock('@/server/dal/users.dal', () => ({
    getUserById: vi.fn(),
    deleteUser: vi.fn(),
}));

vi.mock('@/server/dal/sessions.dal', () => ({
    deleteUserSessions: vi.fn(),
}));

const ADMIN = { id: 'admin', email: 'admin@expeditoo.test', roles: [{ role: 'admin' }] };
const TARGET = { id: 'target', email: 'driver@expeditoo.test', roles: [{ role: 'driver' }] };

/** getUserById is asked for the actor first, then the target. */
function mockActorAndTarget(actor: unknown = ADMIN, target: unknown = TARGET) {
    vi.mocked(usersDal.getUserById).mockImplementation(async (id: string) =>
        (id === 'admin' ? actor : target) as never
    );
}

describe('adminService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getDashboardStats', () => {
        it('should aggregate stats correctly', async () => {
            // Mock current values
            vi.mocked(adminDal.getTotalAppFees).mockResolvedValue(10000);
            vi.mocked(adminDal.getActiveUsersCount).mockResolvedValue(50);
            vi.mocked(adminDal.getActiveDriversCount).mockResolvedValue(10);
            vi.mocked(adminDal.getPendingDeliveriesCount).mockResolvedValue(5);

            // Mock historical values (simple return 0 or specific values)
            vi.mocked(adminDal.getMonthlyAppFees).mockResolvedValue(1000);
            
            const result = await adminService.getDashboardStats();

            expect(result.kpi.totalRevenue.value).toBe(10000);
            expect(result.kpi.activeUsers.value).toBe(50);
            expect(adminDal.getTotalAppFees).toHaveBeenCalled();
        });
    });

    describe('getRecentActivity', () => {
        it('should combine and sort activities', async () => {
            const now = new Date();
            const older = new Date(now.getTime() - 1000);
            const mid = new Date(now.getTime() - 500);

            vi.mocked(adminDal.getRecentUsers).mockResolvedValue([{ 
                id: 'u1', name: 'User 1', createdAt: now 
            } as any]);
            
            vi.mocked(adminDal.getRecentListings).mockResolvedValue([{ 
                id: 'l1', title: 'Item', seller: { name: 'Seller' }, createdAt: older 
            } as any]);

             vi.mocked(adminDal.getRecentDeliveredShipments).mockResolvedValue([{ 
                id: 's1', driver: { name: 'Driver' }, deliveredAt: mid, updatedAt: mid 
            } as any]);

            const result = await adminService.getRecentActivity();

            expect(result).toHaveLength(3);
            expect(result[0].id).toBe('u1'); // Newest
            expect(result[1].id).toBe('s1'); // Mid
            expect(result[2].id).toBe('l1'); // Oldest
        });
    });

    describe('updateUserStatus', () => {
        it('should refuse a caller who is not an admin', async () => {
            mockActorAndTarget({ id: 'admin', email: 'x@y.z', roles: [{ role: 'driver' }] });

            await expect(adminService.updateUserStatus('target', true, 'admin'))
                .rejects.toMatchObject({ code: 'NOT_ADMIN', status: 403 });
        });

        it('should prevent self-ban', async () => {
            mockActorAndTarget();

            await expect(adminService.updateUserStatus('admin', true, 'admin'))
                .rejects.toMatchObject({ code: 'SELF_BAN_NOT_ALLOWED', status: 400 });
        });

        it('should suspend and end every live session', async () => {
            mockActorAndTarget();
            vi.mocked(adminDal.updateUserBannedStatus).mockResolvedValue({
                id: 'target', name: 'T', email: 'driver@expeditoo.test',
                banned: true, updatedAt: new Date(),
            } as any);

            await adminService.updateUserStatus('target', true, 'admin');

            expect(adminDal.updateUserBannedStatus).toHaveBeenCalledWith('target', true);
            // Writing `banned` alone leaves the user inside the session they
            // already hold; the revocation is what makes suspension bite.
            // `keepImpersonated` scopes it to the user's own sessions, so
            // suspending an account somebody is viewing does not eject the
            // admin viewing it.
            expect(sessionsDal.deleteUserSessions).toHaveBeenCalledWith(
                'target', { keepImpersonated: true }
            );
        });

        it('should leave sessions alone when reinstating', async () => {
            mockActorAndTarget();
            vi.mocked(adminDal.updateUserBannedStatus).mockResolvedValue({
                id: 'target', name: 'T', email: 'driver@expeditoo.test',
                banned: false, updatedAt: new Date(),
            } as any);

            await adminService.updateUserStatus('target', false, 'admin');

            expect(sessionsDal.deleteUserSessions).not.toHaveBeenCalled();
        });
    });

    describe('revokeUserSessions', () => {
        it('should report how many sessions ended', async () => {
            mockActorAndTarget();
            vi.mocked(sessionsDal.deleteUserSessions).mockResolvedValue(3);

            await expect(adminService.revokeUserSessions('target', 'admin'))
                .resolves.toEqual({ revoked: 3 });
        });

        it('should sign out the user, not an admin viewing them', async () => {
            mockActorAndTarget();
            vi.mocked(sessionsDal.deleteUserSessions).mockResolvedValue(1);

            await adminService.revokeUserSessions('target', 'admin');

            // "Every device" means theirs. Killing a borrowed session would
            // drop the other admin on the sign-in screen with no explanation.
            expect(sessionsDal.deleteUserSessions).toHaveBeenCalledWith(
                'target', { keepImpersonated: true }
            );
        });
    });

    describe('deleteUserAccount', () => {
        it('should refuse to delete yourself', async () => {
            mockActorAndTarget();

            await expect(adminService.deleteUserAccount('admin', 'admin'))
                .rejects.toMatchObject({ code: 'SELF_DELETE_NOT_ALLOWED' });
        });

        it('should refuse to delete another admin', async () => {
            mockActorAndTarget(ADMIN, { id: 'target', email: 'a@b.c', roles: [{ role: 'admin' }] });

            await expect(adminService.deleteUserAccount('target', 'admin'))
                .rejects.toMatchObject({ code: 'CANNOT_DELETE_ADMIN', status: 403 });
        });

        it('should refuse to delete the Expedion system account', async () => {
            // That account owns every escalated listing, so the delete would
            // cascade the whole inlet away.
            vi.stubEnv('EXPEDION_SYSTEM_USER_ID', 'target');
            mockActorAndTarget();

            await expect(adminService.deleteUserAccount('target', 'admin'))
                .rejects.toMatchObject({ code: 'CANNOT_DELETE_SYSTEM_USER' });

            vi.unstubAllEnvs();
        });

        it('should 404 an unknown user', async () => {
            mockActorAndTarget(ADMIN, null);

            await expect(adminService.deleteUserAccount('target', 'admin'))
                .rejects.toMatchObject({ code: 'USER_NOT_FOUND', status: 404 });
        });

        it('should delete an ordinary user', async () => {
            mockActorAndTarget();

            await expect(adminService.deleteUserAccount('target', 'admin'))
                .resolves.toEqual({ id: 'target', email: 'driver@expeditoo.test' });
            expect(usersDal.deleteUser).toHaveBeenCalledWith('target');
        });
    });
});
