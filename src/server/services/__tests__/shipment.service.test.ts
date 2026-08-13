import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shipmentService, PaymentRequiredError, ShipmentAccessDeniedError, InvalidStatusTransitionError } from '@/server/services/shipment.service';
import { shipmentsDal } from '@/server/dal/shipments.dal';
import { ordersDal } from '@/server/dal/orders.dal';
import { notificationsService } from '@/server/services/notifications.service';
import { ablyServer } from '@/lib/ably-server';

// 1. Mock Dependencies
vi.mock('@/server/dal/shipments.dal', () => ({
  shipmentsDal: {
    create: vi.fn(),
    createEvent: vi.fn(),
    getShipmentOwnership: vi.fn(),
    getById: vi.fn(),
    updateStatus: vi.fn(),
    assignDriver: vi.fn(),
    getProposalById: vi.fn(),
    acceptProposal: vi.fn(),
    getProposalsByShipmentId: vi.fn(),
    cancel: vi.fn(),
  }
}));

vi.mock('@/server/dal/orders.dal', () => ({
  ordersDal: {
    getByListingId: vi.fn(),
    getByShipmentId: vi.fn(),
    updateShippingPrice: vi.fn(),
    markShipped: vi.fn(),
    markDelivered: vi.fn(),
  }
}));

vi.mock('@/server/services/notifications.service', () => ({
  notificationsService: { createNotification: vi.fn() }
}));

vi.mock('@/lib/ably-server', () => ({
  ablyServer: { publishDataUpdate: vi.fn() }
}));

vi.mock('@/server/dal/reviews.dal', () => ({
  reviewsDal: { checkExists: vi.fn() }
}));

vi.mock('@/server/dal/users.dal', () => ({
    userHasRole: vi.fn().mockResolvedValue(false)
}));


describe('shipmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Reusable Access Control Mock Data
  const mockOwnership = {
      id: 'ship-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      driverId: 'driver-1',
      status: 'ASSIGNED' // Start as ASSIGNED to allow PICKED_UP transition
  };

  describe('updateStatus', () => {
    it('should allow driver to update status to PICKED_UP if order is PAID', async () => {
       // 1. Mock valid ownership (Driver requesting)
       vi.mocked(shipmentsDal.getShipmentOwnership).mockResolvedValue(mockOwnership as any);

       // 2. Mock Order Payment Check (Paid)
       vi.mocked(ordersDal.getByShipmentId).mockResolvedValue({ id: 'o1', status: 'paid' } as any);

       // 3. Status update success
       vi.mocked(shipmentsDal.updateStatus).mockResolvedValue({ ...mockOwnership, status: 'PICKED_UP' } as any);

       // Execute
       await shipmentService.updateStatus('ship-1', 'driver-1', 'PICKED_UP');

       // Verify
       expect(ordersDal.markShipped).toHaveBeenCalledWith('o1'); // Should auto-update order
       expect(shipmentsDal.updateStatus).toHaveBeenCalledWith('ship-1', 'PICKED_UP');
    });

    it('should THROW error if driver attempts PICKUP but order is UNPAID', async () => {
       // 1. Owner is driver
       vi.mocked(shipmentsDal.getShipmentOwnership).mockResolvedValue(mockOwnership as any);

       // 2. Order is NOT paid
       vi.mocked(ordersDal.getByShipmentId).mockResolvedValue({ id: 'o1', status: 'pending_payment' } as any);

       // Execute & Expect Fail
       await expect(shipmentService.updateStatus('ship-1', 'driver-1', 'PICKED_UP'))
        .rejects.toThrow(PaymentRequiredError);
       
       // Verify no update happened
       expect(shipmentsDal.updateStatus).not.toHaveBeenCalled();
    });

    it('should prevent random user from updating status', async () => {
       vi.mocked(shipmentsDal.getShipmentOwnership).mockResolvedValue(mockOwnership as any);

       await expect(shipmentService.updateStatus('ship-1', 'stranger', 'PICKED_UP'))
        .rejects.toThrow(ShipmentAccessDeniedError);
    });

    it('should validate status transitions', async () => {
        vi.mocked(shipmentsDal.getShipmentOwnership).mockResolvedValue({ ...mockOwnership, status: 'DELIVERED' } as any);
 
        // Cannot go from DELIVERED to PENDING
        await expect(shipmentService.updateStatus('ship-1', 'driver-1', 'PENDING'))
         .rejects.toThrow(InvalidStatusTransitionError);
     });
  });

  describe('acceptProposal', () => {
    it('should orchestrate acceptance: assign driver, update order price, notify everyone', async () => {
        const mockProposal = {
            id: 'prop-1',
            shipmentId: 'ship-1',
            driverId: 'driver-1',
            price: 5000,
            estimatedDelivery: new Date(),
        };

        // 1. Get Proposal
        vi.mocked(shipmentsDal.getProposalById).mockResolvedValue(mockProposal as any);

        // 2. Check Shipment Status (MUST be PENDING)
        vi.mocked(shipmentsDal.getShipmentOwnership).mockResolvedValue({ 
            ...mockOwnership, 
            listingId: 'listing-1',
            status: 'PENDING' 
        } as any);

        // 3. Mock Order Lookup
        vi.mocked(ordersDal.getByListingId).mockResolvedValue({ id: 'order-1', status: 'pending_address' } as any);

        // 4. Mock Acceptance Return
        vi.mocked(shipmentsDal.acceptProposal).mockResolvedValue({ ...mockOwnership, listingId: 'listing-1' } as any);

        // 5. Mock Other Proposals (for rejection notification)
        vi.mocked(shipmentsDal.getProposalsByShipmentId).mockResolvedValue([
            { id: 'prop-1', driverId: 'driver-1', status: 'accepted' } as any,
            { id: 'prop-2', driverId: 'loser-1', status: 'rejected' } as any
        ]);

        // Execute (Admin Action)
        await shipmentService.acceptProposal('prop-1', 'admin-id');

        // Verifications
        expect(shipmentsDal.acceptProposal).toHaveBeenCalled();
        
        // Critical: Update Order Price
        expect(ordersDal.updateShippingPrice).toHaveBeenCalledWith('order-1', 5000);

        // Notifications Check
        expect(notificationsService.createNotification).toHaveBeenCalledTimes(4); 
        // 1->Winner, 2->Loser, 3->Buyer, 4->Seller
    });
  });

});
