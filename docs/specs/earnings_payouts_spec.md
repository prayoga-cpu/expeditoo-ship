# Specification: Earnings & Payouts (Driver/Seller)

## 1. Overview

The Earnings system tracks the movement of funds from successfully completed transactions to the individual's withdrawable balance. It provides transparency for Sellers and Drivers regarding their gross income, platform fees, and net payouts.

## 2. Earnings Calculation

Earnings are recorded after a successful payment capture or shipment delivery (depending on the escrow logic).

### 2.1 Seller Earnings
*   **Source**: Item Price.
*   **Calculation**: `Gross = Sold Price`.
*   **Platform Fee**: Deducted from the buyer's side or seller's side (Current: Platform fee added on top for buyer).
*   **Net**: Usually equal to the item price if the buyer pays the service fee.

### 2.2 Driver Earnings
*   **Source**: Shipping Price from the accepted proposal.
*   **Calculation**: `Gross = Shipping Price`.
*   **Logic**: Earnings are "Pending" until the shipment status is `DELIVERED`.

## 3. Payout Logic (Stripe Connect)

Payouts are managed via **Stripe Connect Split Transfers**.

### 3.1 Automated Transfers
*   Triggered via Stripe Webhook (`payment_intent.succeeded`).
*   The `stripeService.processSplitTransfers` function extracts metadata (SellerStripeId, DriverStripeId) and initiates the transfer.
*   Funds are moved from the Platform's Stripe balance to the User's Connected Account.

### 3.2 Withdrawal
*   Users manage their actual bank withdrawal via the **Stripe Express Dashboard**.
*   Expeditoo provides a "Manage Payouts" button that generates a temporary login link to the Stripe Dashboard.

## 4. API Endpoints

### GET `/api/earnings/summary`
Returns a summary of the user's financial performance.
*   **Response**: `{ totalEarned: number, pendingBalance: number, currency: "EUR" }`

### GET `/api/earnings`
Returns a paginated list of all earning events.
*   **Data**: `{ balance_id, date, amount, type (item/shipping), status }`

### POST `/api/stripe/connect/dashboard`
Generates a login link for the user's Stripe Express Dashboard.

## 5. Metadata & Reconciliation

To ensure all transfers can be traced back to an order:
*   Every `transfer` includes metadata `orderId`.
*   Every `payment_intent` includes `transfer_group` matching the order reference.
