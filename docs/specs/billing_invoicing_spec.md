# Specification: Billing & Invoicing

## 1. Overview

The Billing & Invoicing system handles all financial transactions within the Expeditoo platform. It manages payments from buyers, splits funds between sellers, drivers, and the platform, and handles refunds and invoice generation.

## 2. Payment Lifecycle

Transactions follow a structured lifecycle to ensure security and fund integrity:

1.  **Payment Intent Creation**: Triggered during the checkout flow. A Stripe PaymentIntent is created with the total amount (Item Price + Shipping Price + Service Fee).
2.  **Authorization/Capture**: The buyer's payment is captured by Stripe.
3.  **Split Calculation**: Funds are mathematically divided:
    *   **Seller Share**: Original Item Price.
    *   **Driver Share**: Original Shipping Price.
    *   **Platform Share**: Service Fee (Application Fee).
4.  **Transfer Grouping**: Uses Stripe's `transfer_group` to link the capture with subsequent transfers to Connect accounts.
5.  **Status Update**: Database records are updated to `PAID` or `SUCCEEDED` upon webhook confirmation.

## 3. Split Payments (Stripe Connect)

Expeditoo uses **Stripe Connect Express** for automated payouts.

### 3.1 Participants
*   **Platform**: Initial recipient of funds, retains the `application_fee_amount`.
*   **Sellers**: Receive the item cost via `stripe.transfers.create`.
*   **Drivers**: Receive the shipping cost via `stripe.transfers.create`.

### 3.2 Requirements for Payout
*   User must have a `stripeAccountId`.
*   Account status must be `active` (onboarding completed).
*   If a participant is not onboarded, funds are held by the platform until the account is ready.

## 4. Refund Management

Refunds can be initiated by Admins for cancelled orders or disputed transactions.

*   **Logic**: Processed via `stripe.refunds.create`.
*   **Scope**: Supports full refunds.
*   **Impact**: Reverses the payment and updates the database payment status to `refunded`. If transfers were already made, they must be reversed manually or via linked refund logic (Phase 2).

## 5. Invoicing

Invoices serve as the official record of the transaction.

### 5.1 Components
*   **Order Reference**: Unique order ID.
*   **Items**: List of products/services purchased.
*   **Breakdown**:
    *   Subtotal (Price + Shipping).
    *   VAT/Taxes (if applicable).
    *   Total Amount.
*   **Format**: Currently provided as a web-based summary with a "Download PDF" placeholder.

## 6. Functional Requirements

### Feature 1: Dynamic Pricing Calculation
**Input**: Item Price, Shipping Price.
**Logic**: `Total = (Item + Shipping) * (1 + ServiceFee%)`.
**Output**: Final charge amount in Cents.

### Feature 2: Connect Onboarding
**Workflow**: 
1. Profile Page -> "Connect Stripe".
2. API creates Express Account and returns `account_link`.
3. User completes Stripe web flow.
4. Webhook updates `stripeAccountStatus` to `active`.

## 7. API Endpoints

### POST `/api/orders/[id]/payment-intent`
Creates a Stripe PaymentIntent for an order.
*   **Request**: `{ paymentMethodId?: string }`
*   **Response**: `{ clientSecret: string, paymentIntentId: string }`

### POST `/api/admin/refunds`
Processes a refund for a specific payment.
*   **Access**: Admin Only.
*   **Body**: `{ paymentId: string, reason: string }`

### GET `/api/users/me/stripe-status`
Retrieves the current user's Stripe account and payout status.

## 8. Data Models

### Payment Schema (Drizzle)
```typescript
{
  id: string;
  userId: string;
  listingId: string;
  amount: number; // In cents
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  stripePaymentIntentId: string;
  applicationFeeAmount: number;
  transferGroup: string;
}
```

## 9. Verification Checklist

- [ ] PaymentIntent matches the sum of Item + Shipping + Fee.
- [ ] Transfers only trigger for `active` Connect accounts.
- [ ] Application fee is correctly retained by the platform account.
- [ ] Refund updates DB status and reflects in Stripe dashboard.
- [ ] Buyers can see their payment status in the Success page.
