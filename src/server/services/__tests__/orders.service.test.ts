import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ordersService, OrderNotFoundError, OrderAccessDeniedError } from '../orders.service';
import { ordersDal } from '@/server/dal/orders.dal';
import { shipmentsDal } from '@/server/dal/shipments.dal';

// 1. Mock the dependencies
vi.mock('@/server/dal/orders.dal', () => ({
  ordersDal: {
    create: vi.fn(),
    getById: vi.fn(),
    getByListingId: vi.fn(),
    setDeliveryAddress: vi.fn(),
    linkShipment: vi.fn(),
    confirmPayment: vi.fn(),
    updateShippingPrice: vi.fn(),
  },
}));

vi.mock('@/server/dal/shipments.dal', () => ({
  shipmentsDal: {
    create: vi.fn(),
    createEvent: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

// Mock dynamic imports for circular dependencies
vi.mock('@/server/dal/bids.dal', () => ({
  bidsDal: { getByListingId: vi.fn() }
}));

vi.mock('@/server/dal/listings.dal', () => ({
  listingsDal: { updateStatus: vi.fn() }
}));

// Mock Notification Service
vi.mock('../notifications.service', () => ({
  notificationsService: { createNotification: vi.fn() }
}));

// Mock Stripe & Libs
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn() } }
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'test-order-id',
}));

// Mock DB queries
const mockFindFirstListing = vi.fn();
const mockFindFirstUser = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: {
      listings: { findFirst: (...args: any[]) => mockFindFirstListing(...args) },
      user: { findFirst: (...args: any[]) => mockFindFirstUser(...args) }
    }
  }
}));

// Mock Ably
vi.mock('@/lib/ably-server', () => ({
  ablyServer: { publishOrderStatus: vi.fn() }
}));

describe('ordersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Reusable mock data
  const mockListing = {
    id: 'l1',
    title: 'Item',
    images: [{ url: 'img.jpg' }],
    address: 'Origin Addr',
    sellerId: 's1',
    winnerId: 'b1',
    currentPrice: 2000,
    status: 'sold'
  };

  const mockOrderRaw = {
    id: 'test-order-id',
    status: 'pending_address',
    itemPrice: 2000,
    listingId: 'l1',
    buyerId: 'b1',
    sellerId: 's1',
    listing: mockListing,
    seller: { id: 's1', name: 'Seller' },
    createdAt: new Date(),
    shipment: null,
    deliveryAddress: null,
  };

  const mockOrderDTO = expect.objectContaining({
    id: 'test-order-id',
    listing: expect.objectContaining({ id: 'l1' }),
  });

  describe('createFromAuctionWin', () => {
    it('should create order and double-fetch relations', async () => {
      vi.mocked(ordersDal.create).mockResolvedValue({ id: 'test-order-id' } as any);
      vi.mocked(ordersDal.getById).mockResolvedValue(mockOrderRaw as any);

      const result = await ordersService.createFromAuctionWin('l1', 'b1', 's1', 2000);

      expect(ordersDal.create).toHaveBeenCalledWith(expect.objectContaining({
        listingId: 'l1',
        itemPrice: 2000
      }));
      expect(ordersDal.getById).toHaveBeenCalledWith('test-order-id');
      expect(result).toEqual(mockOrderDTO);
    });
  });

  describe('getOrderByListingId', () => {
    it('should return existing order if found and user is authorized', async () => {
      // 1. ordersDal.getByListingId returns order shell
      vi.mocked(ordersDal.getByListingId).mockResolvedValue({ 
        id: 'test-order-id', 
        buyerId: 'b1', 
        sellerId: 's1' 
      } as any);
      
      // 2. ordersDal.getById returns full order
      vi.mocked(ordersDal.getById).mockResolvedValue(mockOrderRaw as any);

      const result = await ordersService.getOrderByListingId('l1', 'b1'); // Buyer requests

      expect(result).toEqual(mockOrderDTO);
    });

    it('should throw AccessDenied if user is unrelated', async () => {
      vi.mocked(ordersDal.getByListingId).mockResolvedValue({ 
        id: 'test-order-id', 
        buyerId: 'b1', 
        sellerId: 's1' 
      } as any);

      await expect(ordersService.getOrderByListingId('l1', 'stranger'))
        .rejects.toThrow(OrderAccessDeniedError);
    });

    it('should CREATE order on-the-fly if missing but user WON logic applies', async () => {
      // 1. No existing order
      vi.mocked(ordersDal.getByListingId).mockResolvedValue(null);

      // 2. Listing check: User is winner
      mockFindFirstListing.mockResolvedValue({
        ...mockListing,
        winnerId: 'b1',
        sellerId: 's1',
        currentPrice: 5000,
        status: 'sold'
      });

      // 3. Mock Setup for createFromAuctionWin internal call
      vi.mocked(ordersDal.create).mockResolvedValue({ id: 'new-id' } as any);
      vi.mocked(ordersDal.getById).mockResolvedValue({ ...mockOrderRaw, id: 'new-id' } as any);

      const result = await ordersService.getOrderByListingId('l1', 'b1');

      // Verify Creation Logic
      expect(ordersDal.create).toHaveBeenCalledWith(expect.objectContaining({
        buyerId: 'b1',
        itemPrice: 5000
      }));
      expect(result.id).toBe('new-id');
    });

    it('should throw NotFound if listing does not exist', async () => {
       vi.mocked(ordersDal.getByListingId).mockResolvedValue(null);
       mockFindFirstListing.mockResolvedValue(null);

       await expect(ordersService.getOrderByListingId('l1', 'b1'))
        .rejects.toThrow(OrderNotFoundError);
    });

    it('should throw AccessDenied if user did not win', async () => {
       vi.mocked(ordersDal.getByListingId).mockResolvedValue(null);
       mockFindFirstListing.mockResolvedValue({
         ...mockListing,
         winnerId: 'other-winner' // Different winner
       });

       await expect(ordersService.getOrderByListingId('l1', 'b1'))
        .rejects.toThrow(OrderAccessDeniedError);
    });
  });

  describe('setDeliveryAddress', () => {
    it('should update address and create shipment', async () => {
      // 1. Setup existing order
      vi.mocked(ordersDal.getById).mockResolvedValueOnce(mockOrderRaw as any); // First fetch check

      // 2. Setup shipment creation mock
      vi.mocked(shipmentsDal.create).mockResolvedValue({ id: 'ship-1' } as any);

      // 3. Setup fetch after update
      vi.mocked(ordersDal.getById).mockResolvedValueOnce({
        ...mockOrderRaw,
        status: 'pending_address', // Status might update in real DB but we mock return
        shipmentId: 'ship-1',
        shipment: { status: 'PENDING', driver: null }
      } as any);

      const result = await ordersService.setDeliveryAddress('id', 'new addr', 'b1', '10', '10');

      expect(ordersDal.setDeliveryAddress).toHaveBeenCalledWith('id', 'new addr', '10', '10');
      expect(shipmentsDal.create).toHaveBeenCalled();
      expect(ordersDal.linkShipment).toHaveBeenCalledWith('id', 'ship-1');
    });

    it('should fail if order is not pending_address', async () => {
      vi.mocked(ordersDal.getById).mockResolvedValueOnce({
        ...mockOrderRaw,
        status: 'pending_payment' // Already progressed
      } as any);

      await expect(ordersService.setDeliveryAddress('id', 'addr', 'b1'))
        .rejects.toThrow(/Invalid status|already set/i);
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment and trigger notifications', async () => {
      vi.mocked(ordersDal.getById).mockResolvedValueOnce({
        ...mockOrderRaw,
        status: 'pending_payment',
        buyerId: 'b1'
      } as any);

      vi.mocked(ordersDal.getById).mockResolvedValueOnce({
        ...mockOrderRaw,
        status: 'paid', // Update simulated
        buyerId: 'b1'
      } as any);

       mockFindFirstUser.mockResolvedValue({ email: 'test@mail.com', name: 'User' });

       await ordersService.confirmPayment('id', 'b1');

       expect(ordersDal.confirmPayment).toHaveBeenCalledWith('id');
       // Check Notification Service was called
       const { notificationsService } = await import('../notifications.service');
       expect(notificationsService.createNotification).toHaveBeenCalled();
    });
  });

});
