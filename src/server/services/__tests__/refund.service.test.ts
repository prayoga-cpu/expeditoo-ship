import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refundService } from '../refund.service';
import { stripe } from '@/lib/stripe';
import { db } from '@/db';

// Mock dependencies
vi.mock('@/lib/stripe', () => ({
  stripe: {
    refunds: {
      create: vi.fn(),
      retrieve: vi.fn(),
    }
  }
}));

vi.mock('@/db', () => ({
  db: {
    query: {
        payments: {
            findFirst: vi.fn()
        }
    },
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) })
  }
}));

describe('refundService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('processRefund', () => {
        it('should process refund successully', async () => {
            // Mock DB payment
            vi.mocked(db.query.payments.findFirst).mockResolvedValue({
                id: 'pay-1',
                stripePaymentIntentId: 'pi_123',
                status: 'succeeded'
            } as any);

            // Mock Stripe success
            vi.mocked(stripe.refunds.create).mockResolvedValue({
                id: 're_123',
                status: 'succeeded'
            } as any);

            const result = await refundService.processRefund('pay-1', 'requested_by_customer');

            expect(stripe.refunds.create).toHaveBeenCalledWith({
                payment_intent: 'pi_123',
                reason: 'requested_by_customer'
            });
            expect(db.update).toHaveBeenCalled();
            expect(result.status).toBe('succeeded');
        });

        it('should throw if payment not found', async () => {
            vi.mocked(db.query.payments.findFirst).mockResolvedValue(undefined);
            await expect(refundService.processRefund('pay-99'))
                .rejects.toThrow('Payment not found');
        });

        it('should throw if already refunded', async () => {
            vi.mocked(db.query.payments.findFirst).mockResolvedValue({
                id: 'pay-1',
                status: 'refunded',
                stripePaymentIntentId: 'pi_fake'
            } as any);
            await expect(refundService.processRefund('pay-1'))
                .rejects.toThrow('Payment is already refunded');
        });
    });
});
