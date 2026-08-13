import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stripeService } from '../stripe.service';
import { db } from '@/db';
import { stripe } from '@/lib/stripe';
import { earningsService } from '@/server/services/earnings.service';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    query: {
      user: {
        findFirst: vi.fn(),
      }
    },
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  }
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: {
      create: vi.fn(),
      createLoginLink: vi.fn(),
      retrieve: vi.fn(),
    },
    customers: {
      create: vi.fn(),
    },
    accountLinks: {
      create: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
    transfers: {
      create: vi.fn(),
    },
    paymentMethods: {
      list: vi.fn(),
      retrieve: vi.fn(),
      detach: vi.fn(),
    },
    setupIntents: {
      create: vi.fn(),
    }
  }
}));

vi.mock('@/server/services/earnings.service', () => ({
  earningsService: {
    recordEarning: vi.fn(),
  }
}));

describe('stripeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createConnectAccount', () => {
        it('should return existing account id', async () => {
            vi.mocked(db.query.user.findFirst).mockResolvedValue({ 
                stripeAccountId: 'acct_123' 
            } as any);

            const result = await stripeService.createConnectAccount('user-1');
            expect(result).toBe('acct_123');
        });

        it('should create new account if none exists', async () => {
            vi.mocked(db.query.user.findFirst).mockResolvedValue({ 
                email: 'test@mail.com', stripeAccountId: null 
            } as any);
            vi.mocked(stripe.accounts.create).mockResolvedValue({ id: 'new_acct' } as any);

            const result = await stripeService.createConnectAccount('user-1');
            
            expect(result).toBe('new_acct');
            expect(stripe.accounts.create).toHaveBeenCalledWith(expect.objectContaining({
                type: 'express', email: 'test@mail.com'
            }));
            expect(db.update).toHaveBeenCalled();
        });
    });

    describe('processSplitTransfers', () => {
        it('should transfer funds to seller and driver', async () => {
            const paymentIntent = {
               id: 'pi_123',
               currency: 'eur',
               transfer_group: 'order_123',
               status: 'succeeded',
               metadata: {
                   orderId: 'order_123',
                   sellerId: 's1', driverId: 'd1',
                   sellerStripeId: 'acct_s1', driverStripeId: 'acct_d1',
                   itemAmount: '1000', shippingAmount: '500'
               }
            } as any;

            vi.mocked(stripe.transfers.create)
                .mockResolvedValueOnce({ id: 'tr_1' } as any)
                .mockResolvedValueOnce({ id: 'tr_2' } as any);

            await stripeService.processSplitTransfers(paymentIntent);

            expect(stripe.transfers.create).toHaveBeenCalledTimes(2);
            expect(earningsService.recordEarning).toHaveBeenCalledTimes(2);
        });
    });
});
