# Stripe Connect Integration & Split Payments

## Goal Description

Implement Stripe Connect to enable split payments between Sellers (Item Cost), Drivers (Delivery Cost), and the Platform (Service Fee). Fix the current cost calculation logic where admin revenue is misidentified.

## User Review Required

> [!IMPORTANT]
> **Stripe Connect Workflow**: Users (Sellers and Drivers) must onboard with Stripe Connect to receive payouts. **This is mandatory**.
> **Currency Handling**: All monetary values in the database will be standardized to **CENTS** (integers) to ensure compatibility with Stripe and avoid floating-point errors.
>
> - Current: €5.00 stored as `5` (potentially).
> - New: €5.00 stored as `500`.
>   **Dependency**: Need to install `stripe` and `@stripe/stripe-js`.

> [!WARNING]
> **Database Schema Changes**:
>
> - Adding `stripeAccountId` to `users` table.
> - Updating `payments` table for split tracking.
> - **Migration Note**: Ensure existing price data is converted to cents if necessary (assuming clean slate or manual migration for V1).

## Proposed Changes

### Database Layer

#### [MODIFY] [users.ts](file:///src/db/schema/users.ts)

- Add `stripeAccountId` (text, nullable) to `user` table.
- Add `stripeAccountStatus` (enum: pending, active, restricted) to track onboarding.

#### [MODIFY] [payments.ts](file:///src/db/schema/payments.ts)

- Add fields to track splits:
  - `applicationFeeAmount` (integer)
  - `transferGroup` (text) - useful for separate transfers

### Infrastructure / Lib

#### [NEW] [stripe/index.ts](file:///src/lib/stripe/index.ts)

- Initialize Stripe instance.
- Helper functions: `createConnectAccount`, `createAccountLink`, `createPaymentIntent`.

### Service Layer

#### [NEW] [stripe.service.ts](file:///src/server/services/stripe.service.ts)

- Handle Connect Onboarding flow.
- Handle Webhooks.

#### [MODIFY] [orders.service.ts](file:///src/server/services/orders.service.ts)

- Update `confirmPayment` to create a **Payment Intent**.
- Calculate splits: `Total` = (`Item` + `Shipping`) + `ServiceFee`.
- Use "Separate Charges and Transfers" flow with `transfer_group`.

### UI Layer

#### [NEW] [app/api/stripe/connect/route.ts]

- API to start onboarding.

#### [NEW] [app/api/stripe/webhook/route.ts]

- Webhook handler.

#### [MODIFY] [features/payment/ui/PaymentForm.tsx]

- Integrate Stripe Elements.

#### [MODIFY] [features/user/ui/Profile.tsx]

- Add "Connect Stripe" button for Sellers/Drivers.

## Verification Plan

### Manual Verification

1. **Onboarding**:
   - User clicks "Connect Stripe".
   - Completes onboarding (Test Mode).
   - DB updated.
2. **Payment Flow**:
   - Buyer pays `Total`.
   - Stripe Dashboard shows:
     - 1 Charge (Total).
     - 2 Transfers (Seller + Driver).
     - Application Fee retained.
