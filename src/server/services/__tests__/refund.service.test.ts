import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refundService } from '../refund.service';
import { stripe } from '@/lib/stripe';
import { db } from '@/db';
import { paymentsService } from '@/server/services/payments.service';

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

// The row is no longer written here. Refunding is a transition, and it is the
// transition that raises the credit note correcting the invoice the client was
// already sent (docs/specs/invoice_at_payment_spec.md §5).
vi.mock('@/server/services/payments.service', () => ({
  paymentsService: { markRefunded: vi.fn().mockResolvedValue({ status: 'refunded' }) },
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
            expect(paymentsService.markRefunded).toHaveBeenCalledWith('pay-1');
            expect(db.update).not.toHaveBeenCalled();
            expect(result.status).toBe('succeeded');
        });

        it('leaves the row alone when Stripe declines the refund', async () => {
            vi.mocked(db.query.payments.findFirst).mockResolvedValue({
                id: 'pay-1',
                stripePaymentIntentId: 'pi_123',
                status: 'captured',
            } as never);
            vi.mocked(stripe.refunds.create).mockResolvedValue({
                id: 're_123',
                status: 'failed',
            } as never);

            await refundService.processRefund('pay-1');

            // No money went back, so there is nothing to correct.
            expect(paymentsService.markRefunded).not.toHaveBeenCalled();
        });

        it('should throw if payment not found', async () => {
            vi.mocked(db.query.payments.findFirst).mockResolvedValue(undefined);
            await expect(refundService.processRefund('pay-99'))
                .rejects.toThrow('Payment not found');
        });

        // docs/specs/payment_at_booking_spec.md §6. An escalated job was charged
        // in the Expedion app, into Expedion's Stripe account. This platform
        // holds a record of that money, not the money, so an operator must not
        // be able to issue a refund here that would never reach the client.
        it('refuses a payment that Expedion took', async () => {
            vi.mocked(db.query.payments.findFirst).mockResolvedValue({
                id: 'pay-1',
                status: 'captured',
                source: 'expedion',
                stripePaymentIntentId: null
            } as any);

            await expect(refundService.processRefund('pay-1'))
                .rejects.toThrow('Refund not local');
            expect(stripe.refunds.create).not.toHaveBeenCalled();
        });

        it('refuses a payment that was taken in Expedion', async () => {
            // An escalated job was charged into Expedion's own Stripe account
            // (docs/specs/payment_at_booking_spec.md §6). This platform holds a
            // record of that money, not the money, so an operator must not be
            // able to issue a refund here that would never reach the client.
            vi.mocked(db.query.payments.findFirst).mockResolvedValue({
                id: 'pay-1',
                status: 'captured',
                source: 'expedion',
                stripePaymentIntentId: null,
            } as never);

            await expect(refundService.processRefund('pay-1'))
                .rejects.toThrow('Refund not local');
            expect(stripe.refunds.create).not.toHaveBeenCalled();
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
