import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listingsService } from '../listings.service';
import { listingsDal } from '@/server/dal/listings.dal';
import { bidsDal } from '@/server/dal/bids.dal';
import { notificationsService } from '@/server/services/notifications.service';
import { emailService } from '@/server/services/email.service';
import { db } from '@/db';

// Mock dependencies
vi.mock('@/server/dal/listings.dal', () => ({
  listingsDal: {
    create: vi.fn(),
    addImages: vi.fn(),
    getBySellerId: vi.fn(),
    getById: vi.fn(),
    updateStatus: vi.fn(),
    getOwner: vi.fn(),
    update: vi.fn(),
    deleteImagesByListingId: vi.fn(),
    delete: vi.fn(),
    incrementView: vi.fn(),
    getAllPublic: vi.fn(),
  }
}));

vi.mock('@/server/dal/bids.dal', () => ({
  bidsDal: {
    getByListingId: vi.fn(),
  }
}));

vi.mock('@/server/services/notifications.service', () => ({
  notificationsService: { createNotification: vi.fn() }
}));

vi.mock('@/server/services/email.service', () => ({
  emailService: {
    sendAuctionWinEmail: vi.fn().mockResolvedValue(true),
    sendAuctionEndedSellerEmail: vi.fn().mockResolvedValue(true),
    sendAuctionLostEmail: vi.fn().mockResolvedValue(true)
  }
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'test-id',
}));

// Mock DB
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

// Mock dynamic import for ordersService
vi.mock('../orders.service', () => ({
  ordersService: {
    createFromAuctionWin: vi.fn(),
  }
}));

describe('listingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockListingInput = {
    title: 'Test Listing',
    description: 'Desc',
    categoryId: 'cat-1',
    condition: 'new' as const,
    type: 'auction' as const,
    startPrice: 1000,
    buyNowPrice: 2000,
    length: 10,
    width: 10,
    height: 10,
    weight: 1,
    location: {
        lat: 0, lng: 0, address: 'addr', city: 'city'
    },
    images: ['img1.jpg'],
    auctionDuration: '3'
  };

  describe('createListing', () => {
    it('should create listing and images', async () => {
      vi.mocked(listingsDal.create).mockResolvedValue({ id: 'test-id' } as any);

      await listingsService.createListing('user-1', mockListingInput);

      expect(listingsDal.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-id',
        sellerId: 'user-1',
        size: 'S', // 10x10x10 = 1000 -> S (XS is < 1000)
      }));

      expect(listingsDal.addImages).toHaveBeenCalledWith([{
        id: 'test-id',
        listingId: 'test-id',
        url: 'img1.jpg',
        order: 0
      }]);
    });
  });

  describe('getListingsBySeller', () => {
    it('should return listings with bid counts', async () => {
      vi.mocked(listingsDal.getBySellerId).mockResolvedValue([
        { id: 'l1' } as any,
        { id: 'l2' } as any
      ]);
      vi.mocked(bidsDal.getByListingId).mockImplementation(async (id) => {
          if (id === 'l1') return [{}, {}] as any; // 2 bids
          return [] as any; // 0 bids
      });

      const result = await listingsService.getListingsBySeller('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].bidCount).toBe(2);
      expect(result[1].bidCount).toBe(0);
    });
  });

  describe('getListingById', () => {
    it('should increment view count and return listing', async () => {
       vi.mocked(listingsDal.getById).mockResolvedValue({ id: 'l1', status: 'active' } as any);
       
       const result = await listingsService.getListingById('l1');

       expect(listingsDal.incrementView).toHaveBeenCalledWith('l1');
       expect(result?.id).toBe('l1');
    });

    it('should lazy-update status if auction ended', async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        vi.mocked(listingsDal.getById).mockResolvedValue({ 
            id: 'l1', 
            status: 'active', 
            type: 'auction',
            endsAt: pastDate
        } as any);

        // Mock with bids -> SOLD
        vi.mocked(bidsDal.getByListingId).mockResolvedValue([{} as any]); 

        const result = await listingsService.getListingById('l1');

        expect(listingsDal.updateStatus).toHaveBeenCalledWith('l1', 'sold');
        expect(result?.status).toBe('sold');
    });
  });

  describe('updateListingStatus', () => {
    it('should allow owner to end listing and handle winner logic', async () => {
        vi.mocked(listingsDal.getOwner).mockResolvedValue('user-1');
        vi.mocked(listingsDal.getById).mockResolvedValue({ title: 'Test' } as any);
        
        // Mock Bids -> Winner
        vi.mocked(bidsDal.getByListingId).mockResolvedValue([
            { bidderId: 'winner-1', amount: 5000 } as any
        ]);

        // Mock Users
        vi.mocked(db.query.user.findFirst).mockResolvedValue({ email: 'test@mail.com', name: 'Test' } as any);
        vi.mocked(db.query.user.findMany).mockResolvedValue([]);

        await listingsService.updateListingStatus('l1', 'user-1', 'ended');

        // Should update to SOLD because there was a winner
        expect(listingsDal.updateStatus).toHaveBeenCalledWith('l1', 'sold', expect.any(Date), 'winner-1');
        
        // Should trigger notifications
        expect(notificationsService.createNotification).toHaveBeenCalled();
        expect(emailService.sendAuctionWinEmail).toHaveBeenCalled();
    });

    it('should throw error if not owner', async () => {
        vi.mocked(listingsDal.getOwner).mockResolvedValue('other-user');
        
        await expect(listingsService.updateListingStatus('l1', 'user-1', 'ended'))
            .rejects.toThrow('Not authorized');
    });
  });

});
