import { describe, it, expect, vi, beforeEach } from 'vitest';
import { earningsService } from '../earnings.service';
import { earningsDal } from '@/server/dal/earnings.dal';

// Mock dependencies
vi.mock('@/server/dal/earnings.dal', () => ({
  earningsDal: {
    create: vi.fn(),
    getByUserId: vi.fn(),
    getSummaryByUserId: vi.fn(),
    getAppFeesSummary: vi.fn(),
  }
}));

describe('earningsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('recordEarning', () => {
        it('should record new earning', async () => {
             vi.mocked(earningsDal.create).mockResolvedValue({ id: 'earn-1' } as any);
             const input = {
                 userId: 'user-1',
                 amount: 1000,
                 source: 'payment' as const
             };

             const result = await earningsService.recordEarning(input);
             expect(earningsDal.create).toHaveBeenCalledWith(expect.objectContaining({
                 userId: 'user-1',
                 amount: 1000,
                 status: 'completed'
             }));
             expect(result.id).toBe('earn-1');
        });
    });

    describe('getEarningsSummary', () => {
        it('should return summary', async () => {
            const mockSummary = { totalEarnings: 5000 };
            vi.mocked(earningsDal.getSummaryByUserId).mockResolvedValue(mockSummary as any);

            const result = await earningsService.getEarningsSummary('user-1');
            expect(result).toEqual(mockSummary);
        });
    });
});
