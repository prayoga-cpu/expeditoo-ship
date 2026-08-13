import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reviewsService } from '../reviews.service';
import { reviewsDal } from '@/server/dal/reviews.dal';
import { listingsDal } from '@/server/dal/listings.dal';
import { ordersDal } from '@/server/dal/orders.dal';
import { shipmentsDal } from '@/server/dal/shipments.dal';

// Mock dependencies
vi.mock('@/server/dal/reviews.dal', () => ({
  reviewsDal: {
    checkExists: vi.fn(),
    create: vi.fn(),
    getByTargetUser: vi.fn(),
    getByAuthor: vi.fn(),
    getStats: vi.fn(),
    getById: vi.fn(),
    delete: vi.fn(),
    getAuthorId: vi.fn(),
    getByListing: vi.fn(),
  }
}));

vi.mock('@/server/dal/listings.dal', () => ({
  listingsDal: {
    getById: vi.fn()
  }
}));

vi.mock('@/server/dal/orders.dal', () => ({
  ordersDal: {
    getByListingId: vi.fn()
  }
}));

vi.mock('@/server/dal/shipments.dal', () => ({
  shipmentsDal: {
    getById: vi.fn()
  }
}));

// We mock nanoid globally in setup or implicitly here if needed
vi.mock('nanoid', () => ({
    nanoid: () => 'nano-id'
}));

describe('reviewsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createReview', () => {
        it('should create buyer review for listing', async () => {
            vi.mocked(reviewsDal.checkExists).mockResolvedValue(false);
            vi.mocked(listingsDal.getById).mockResolvedValue({
                id: 'list-1',
                winnerId: 'buyer-1',
                sellerId: 'seller-1',
                status: 'sold'
            } as any);
            
            vi.mocked(reviewsDal.create).mockResolvedValue({ id: 'rev-1' } as any);

            const input = {
                listingId: 'list-1',
                targetUserId: 'seller-1',
                rating: 5,
                comment: 'Great!'
            };

            const result = await reviewsService.createReview('buyer-1', input);

            expect(reviewsDal.create).toHaveBeenCalledWith(expect.objectContaining({
                authorId: 'buyer-1',
                role: 'buyer'
            }));
            expect(result.id).toBe('rev-1');
        });

        it('should throw if already reviewed', async () => {
            vi.mocked(reviewsDal.checkExists).mockResolvedValue(true);
            const input = { listingId: 'list-1', targetUserId: 'seller-1', rating: 5, comment: '' };
            
            await expect(reviewsService.createReview('user-1', input))
                .rejects.toThrow('ALREADY_REVIEWED');
        });

        it('should validation transaction completion', async () => {
             vi.mocked(reviewsDal.checkExists).mockResolvedValue(false);
             vi.mocked(listingsDal.getById).mockResolvedValue({
                id: 'list-1',
                status: 'active' // Not sold
             } as any);
             vi.mocked(ordersDal.getByListingId).mockResolvedValue({ status: 'pending' } as any);

             const input = { listingId: 'list-1', targetUserId: 'seller-1', rating: 5, comment: '' };
             await expect(reviewsService.createReview('buyer-1', input))
                .rejects.toThrow('TRANSACTION_NOT_COMPLETE');
        });
    });

    describe('canReview', () => {
        it('should return false if already reviewed', async () => {
            vi.mocked(reviewsDal.checkExists).mockResolvedValue(true);
            const result = await reviewsService.canReview('user-1', { listingId: 'l1' });
            expect(result.canReview).toBe(false);
            expect(result.reason).toBe('Already reviewed');
        });
    });
});
