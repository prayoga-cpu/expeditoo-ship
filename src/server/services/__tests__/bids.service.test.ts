import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bidsService } from '../bids.service';
import { bidsDal } from '@/server/dal/bids.dal';
import { listingsDal } from '@/server/dal/listings.dal';
import { ablyServer } from '@/lib/ably-server';
import { notificationsService } from '@/server/services/notifications.service';
import { db } from '@/db';

// Mock dependencies
vi.mock('@/server/dal/bids.dal', () => ({
  bidsDal: {
    create: vi.fn(),
    getHighestBid: vi.fn(),
    getByListingId: vi.fn(),
    getByBidderId: vi.fn(),
  }
}));

vi.mock('@/server/dal/listings.dal', () => ({
  listingsDal: {
    getById: vi.fn(),
  }
}));

vi.mock('@/server/dal/users.dal', () => ({
  getUserById: vi.fn(),
}));

vi.mock('@/lib/ably-server', () => ({
  ablyServer: {
    publishBid: vi.fn(),
    publishOutbid: vi.fn(),
  }
}));

vi.mock('@/server/services/notifications.service', () => ({
  notificationsService: {
    createNotification: vi.fn(),
  }
}));

vi.mock('@/db', () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  }
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'bid-id',
}));

describe('bidsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('placeBid', () => {
    it('should place a valid bid and notify previous bidder', async () => {
        // Setup
        vi.mocked(listingsDal.getById).mockResolvedValue({
            id: 'l1',
            status: 'active',
            type: 'auction',
            startPrice: 1000,
            currentPrice: 1000,
            title: 'Test Item',
            sellerId: 'seller-1'
        } as any);

        vi.mocked(bidsDal.getHighestBid).mockResolvedValue(1000);
        vi.mocked(bidsDal.getByListingId).mockResolvedValue([
            { bidderId: 'prev-bidder', amount: 1000 } as any
        ]);

        vi.mocked(bidsDal.create).mockResolvedValue({
            id: 'bid-id',
            createdAt: new Date()
        } as any);

        // Execute
        await bidsService.placeBid('user-1', 'l1', { amount: 1600 });

        // Verify
        expect(bidsDal.create).toHaveBeenCalledWith(expect.objectContaining({
            amount: 1600,
            listingId: 'l1',
            bidderId: 'user-1'
        }));

        expect(ablyServer.publishBid).toHaveBeenCalled();
        expect(ablyServer.publishOutbid).toHaveBeenCalledWith('prev-bidder', expect.any(Object));
        expect(notificationsService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'prev-bidder',
            type: 'AUCTION',
            title: "You've been outbid!"
        }));
    });

    it('should throw error if bid is too low', async () => {
        vi.mocked(listingsDal.getById).mockResolvedValue({
            status: 'active', type: 'auction', startPrice: 1000, sellerId: 's1'
        } as any);
        vi.mocked(bidsDal.getHighestBid).mockResolvedValue(1000);

        // Min bid = 1000 + 500 = 1500
        await expect(bidsService.placeBid('u1', 'l1', { amount: 1400 }))
            .rejects.toThrow('Bid must be at least');
    });

    it('should throw error if bidding on own listing', async () => {
        vi.mocked(listingsDal.getById).mockResolvedValue({
            status: 'active', type: 'auction', sellerId: 'me'
        } as any);

        await expect(bidsService.placeBid('me', 'l1', { amount: 9000 }))
            .rejects.toThrow('You cannot bid on your own listing');
    });
  });
});
