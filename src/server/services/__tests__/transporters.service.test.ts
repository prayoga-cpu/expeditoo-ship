import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transportersService } from '../transporters.service';
import { transportersDal } from '@/server/dal/transporters.dal';
import { earningsDal } from '@/server/dal/earnings.dal';

vi.mock('@/server/dal/transporters.dal', () => ({
  transportersDal: {
    getByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    getAvailable: vi.fn(),
    updateRating: vi.fn(),
    setAvailability: vi.fn(),
    incrementDeliveryStats: vi.fn(),
  }
}));

vi.mock('@/server/dal/earnings.dal', () => ({
  earningsDal: {
    getSummaryByUserId: vi.fn()
  }
}));

describe('transportersService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getProfile', () => {
        it('should return profile with user details', async () => {
            const mockProfile = { id: 't-1', user: { id: 'u-1', name: 'John' } };
            vi.mocked(transportersDal.getByUserId).mockResolvedValue(mockProfile as any);

            const result = await transportersService.getProfile('u-1');
            expect(result).toBeDefined();
            expect(result?.user?.name).toBe('John');
        });

        it('should return null if not found', async () => {
             vi.mocked(transportersDal.getByUserId).mockResolvedValue(null);
             const result = await transportersService.getProfile('u-99');
             expect(result).toBeNull();
        });
    });

    describe('getAvailableTransporters', () => {
        it('should return paginated results', async () => {
            const mockData = {
                items: [{ id: 't-1', isAvailable: true, user: { name: 'Driver' } }],
                total: 10
            };
            vi.mocked(transportersDal.getAvailable).mockResolvedValue(mockData as any);

            const result = await transportersService.getAvailableTransporters({ page: 1, limit: 10 });
            expect(result.transporters).toHaveLength(1);
            expect(result.total).toBe(10);
            expect(result.totalPages).toBe(1);
        });
    });
});
