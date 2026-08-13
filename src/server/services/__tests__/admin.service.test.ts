import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as adminService from '../admin.service';
import * as adminDal from '@/server/dal/admin.dal';
import * as usersDal from '@/server/dal/users.dal';

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
}));

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
        it('should prevent self-ban', async () => {
            await expect(adminService.updateUserStatus('me', true, 'me'))
                .rejects.toThrow('SELF_BAN_NOT_ALLOWED');
        });

        it('should update status if valid', async () => {
            vi.mocked(usersDal.getUserById).mockResolvedValue({ id: 'target' } as any);
            vi.mocked(adminDal.updateUserBannedStatus).mockResolvedValue({ 
                id: 'target', updatedAt: new Date() 
            } as any);

            await adminService.updateUserStatus('target', true, 'admin');

            expect(adminDal.updateUserBannedStatus).toHaveBeenCalledWith('target', true);
        });
    });
});
