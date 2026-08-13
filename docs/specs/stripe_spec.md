# Stripe Connect Specification

## 1. Overview

Enable 3-way split payments:

- **Seller**: Receives `Item Price`.
- **Driver**: Receives `Shipping Price`.
- **Platform**: Receives `Service Fee` (Revenue).

## 2. Database Schema

### Users Table

- `stripeAccountId` (text): Connect Account ID (e.g., `acct_123`).
- `stripeAccountStatus` (enum): `pending`, `active`, `restricted`.
- `stripeAccountType` (enum): `standard` or `express` (Recommended: `express` for better platform control).

### Payments Table

- `stripePaymentIntentId` (text)
- `amount` (int): Total amount charged (cents).
- `applicationFeeAmount` (int): Platform revenue (cents).
- `transferGroup` (text): Unique ID to group transfers (e.g., `order_{ID}`).

## 3. Flows

### 3.1 Onboarding (Connect)

1. **User Action**: Click "Connect Wallet" on Profile/Settings.
2. **API**: `POST /api/stripe/connect`.
3. **Backend**:
   - Create Account (if null).
   - Create Account Link (onboarding).
   - Return URL.
4. **Frontend**: Redirect user.
5. **Return**: Update DB status on return or via webhook.

### 3.2 Payment (Checkout)

1. **Trigger**: Buyer confirms order (has item + driver selected).
2. **Calculation**:
   - `Item Price` = 100 EUR
   - `Shipping` = 20 EUR
   - `Service Fee` (10%) = 12 EUR (10% of 120? Or added on top? Config says `serviceFeePercent: 10`. Usually logic is `Total = (Item + Shipping) * 1.10`).
   - Let's assume Fee is **added** on top for now based on config logic.
   - `Total` = 132 EUR.
3. **Payment Intent**:
   - Amount: 13200 (cents).
   - Currency: eur.
   - Transfer Group: `order_{id}`.
   - Metadata: `orderId`, `buyerId`.
4. **Post-Payment (Webhook)**:
   - Event: `payment_intent.succeeded`.
   - Action:
     - Transfer `Item Price` to Seller (`stripeAccountId`).
     - Transfer `Shipping` to Driver (`stripeAccountId`).
     - Remainder remains in Platform.

## 4. Edge Cases

- **No Driver**: Flow shouldn't start until Driver selected (for Shipping orders).
- **Seller Not Onboarded**: Cannot list item? Or funds held in Platform until onboarded? (Better: Funds held).
- **Driver Not Onboarded**: Funds held.

## 5. Security

- Webhook signature verification.
- User can only onboard their own account.
