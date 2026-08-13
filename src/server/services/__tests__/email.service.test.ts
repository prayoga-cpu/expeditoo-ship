import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emailService } from '../email.service';


const mocks = vi.hoisted(() => {
  return {
    send: vi.fn().mockResolvedValue({ id: 'email-id' }),
    render: vi.fn(),
  }
});

vi.mock('@/lib/email', () => ({
  resend: {
    emails: {
      send: mocks.send
    }
  },
  EMAIL_FROM: 'test@example.com'
}));

vi.mock('@react-email/components', () => ({
  render: mocks.render,
}));

// Mock email templates (they are functions components)
vi.mock('@/server/emails/WelcomeEmail', () => ({ WelcomeEmail: vi.fn() }));
vi.mock('@/server/emails/AuctionWinEmail', () => ({ AuctionWinEmail: vi.fn() }));
vi.mock('@/server/emails/AuctionEndedSellerEmail', () => ({ AuctionEndedSellerEmail: vi.fn() }));
vi.mock('@/server/emails/AuctionLostEmail', () => ({ AuctionLostEmail: vi.fn() }));
vi.mock('@/server/emails/OrderConfirmationEmail', () => ({ OrderConfirmationEmail: vi.fn() }));
vi.mock('@/server/emails/PaymentReceiptEmail', () => ({ PaymentReceiptEmail: vi.fn() }));
vi.mock('@/server/emails/ItemPaidSellerEmail', () => ({ ItemPaidSellerEmail: vi.fn() }));
vi.mock('@/server/emails/ShipmentAssignedEmail', () => ({ ShipmentAssignedEmail: vi.fn() }));
vi.mock('@/server/emails/ShipmentUpdateEmail', () => ({ ShipmentUpdateEmail: vi.fn() }));

describe('emailService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.render.mockResolvedValue('<html>email content</html>');
    });

    describe('sendEmail', () => {
        it('should send email using Resend', async () => {
             const result = await emailService.sendEmail({
                 to: 'user@test.com',
                 subject: 'Subject',
                 html: '<p>Hi</p>'
             });

             expect(result).toBe(true);
             expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
                 to: 'user@test.com',
                 subject: 'Subject'
             }));
        });

        it('should handle errors', async () => {
             mocks.send.mockResolvedValueOnce({ error: { message: 'Failed' } });

             await expect(emailService.sendEmail({
                 to: 'user@test.com', subject: 'Subject', html: ''
             })).rejects.toThrow('Failed');
        });
    });

    describe('sendWelcomeEmail', () => {
        it('should render template and send email', async () => {
            await emailService.sendWelcomeEmail('user@test.com', 'John');

            expect(mocks.render).toHaveBeenCalled();
            expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
                to: 'user@test.com',
                subject: 'Welcome to Expeditoo!'
            }));
        });
    });
});
