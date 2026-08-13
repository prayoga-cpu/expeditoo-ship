import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auctionsService } from '../auctions.service';
import { auctionsDAL } from '@/server/dal/auctions.dal';
import { ordersService } from '@/server/services/orders.service';
import { notificationsService } from '@/server/services/notifications.service';
import { emailService } from '@/server/services/email.service';
import { db } from '@/db';

// Mock dependencies
vi.mock('@/server/dal/auctions.dal', () => ({
  auctionsDAL: {
    getAuctionDetails: vi.fn(),
    createBid: vi.fn(),
    getBidsByListingId: vi.fn(),
    getExpiredAuctions: vi.fn(),
    getHighestBid: vi.fn(),
    closeAuction: vi.fn(),
  }
}));

vi.mock('@/server/services/orders.service', () => ({
  ordersService: {
    createFromAuctionWin: vi.fn(),
  }
}));

vi.mock('@/server/services/notifications.service', () => ({
  notificationsService: {
    createNotification: vi.fn(),
  }
}));

vi.mock('@/server/services/email.service', () => ({
  emailService: {
    sendAuctionWinEmail: vi.fn().mockResolvedValue(true),
    sendAuctionEndedSellerEmail: vi.fn().mockResolvedValue(true),
    sendAuctionLostEmail: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      }
    }
  }
}));

describe('auctionsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('placeBid', () => {
        it('should execute bid and handle soft close', async () => {
            const now = new Date();
            const endsAt = new Date(now.getTime() + 60 * 1000); // Ends in 1 minute (within soft close threshold)
            
            vi.mocked(auctionsDAL.getAuctionDetails).mockResolvedValue({
                id: 'l1', type: 'auction', status: 'active',
                startPrice: 1000, currentPrice: 1000,
                endsAt: endsAt.toISOString(),
                sellerId: 'seller-1'
            } as any);

            await auctionsService.placeBid('l1', 'user-1', { amount: 1500 }); // +5 is min (500 cents?) Wait, MIN_BID_INCREMENT = 5 in file. 
            // In file MIN_BID_INCREMENT = 5;
            // 1500 > 1000 + 5.
            
            expect(auctionsDAL.createBid).toHaveBeenCalledWith(
                'l1', 'user-1', 1500, expect.any(Date) // Expect newEndsAt because of soft close
            );
        });
    });

    describe('processExpiredAuctions', () => {
        it('should close auction, create order, and notify winner', async () => {
            // Mock expired auction
            vi.mocked(auctionsDAL.getExpiredAuctions).mockResolvedValue([{
                id: 'l1', title: 'Test', sellerId: 's1'
            } as any]);

            // Mock highest bid
            vi.mocked(auctionsDAL.getHighestBid).mockResolvedValue({
                bidderId: 'winner-1', amount: 5000
            } as any);

            // Mock all bids (for losing bidders notification)
            vi.mocked(auctionsDAL.getBidsByListingId).mockResolvedValue([
                { bidder: { id: 'winner-1' }, amount: 5000 } as any,
                { bidder: { id: 'loser-1' }, amount: 4000 } as any
            ]);

            // Mock User Info
            vi.mocked(db.query.user.findFirst).mockResolvedValue({ email: 'test@mail' } as any);

            const result = await auctionsService.processExpiredAuctions();

            expect(auctionsDAL.closeAuction).toHaveBeenCalledWith('l1', 'winner-1');
            expect(ordersService.createFromAuctionWin).toHaveBeenCalled();
            expect(notificationsService.createNotification).toHaveBeenCalled(); // Winner
            expect(result.closed).toBe(1);
            expect(result.ordersCreated).toBe(1);
        });

        it('should close auction with no winner if no bids', async () => {
             // Mock expired auction
             vi.mocked(auctionsDAL.getExpiredAuctions).mockResolvedValue([{
                id: 'l1', title: 'Test', sellerId: 's1'
            } as any]);

            // Mock NO highest bid
            vi.mocked(auctionsDAL.getHighestBid).mockResolvedValue(null);
            
            // Mock User Info
            vi.mocked(db.query.user.findFirst).mockResolvedValue({ email: 'test@mail' } as any);

            const result = await auctionsService.processExpiredAuctions();

            expect(auctionsDAL.closeAuction).toHaveBeenCalledWith('l1', null);
            expect(ordersService.createFromAuctionWin).not.toHaveBeenCalled();
            expect(result.closed).toBe(1);
            expect(result.ordersCreated).toBe(0);
        });
    });
});
