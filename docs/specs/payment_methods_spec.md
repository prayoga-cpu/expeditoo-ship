# Specification: Payment Methods (VIA STRIPE)

## Overview

Payment methods will be managed directly through Stripe, not stored locally.

---

## Architecture

```
User → Stripe Elements → Stripe API → Card stored in Stripe
                              ↓
                        stripeCustomerId (in users table)
```

## What We Store Locally

| Field              | Table   | Description                   |
| ------------------ | ------- | ----------------------------- |
| `stripeCustomerId` | `users` | Links user to Stripe Customer |

## What Stripe Stores

- Full card details (encrypted)
- Card brand, last4, expiry
- Payment method metadata
- Billing address

---

## API Flow (When Stripe is Integrated)

### Add Payment Method

1. Frontend uses **Stripe Elements** to collect card
2. Stripe returns `paymentMethodId`
3. Backend attaches PM to Stripe Customer
4. No card data ever touches our server ✅

### List Payment Methods

```typescript
const methods = await stripe.customers.listPaymentMethods(stripeCustomerId, {
  type: "card",
});
```

### Delete Payment Method

```typescript
await stripe.paymentMethods.detach(paymentMethodId);
```

---

## Current State

Profile page uses **mock data** until Stripe is integrated (Phase 7).

Mock data location: `src/features/app/profile/hooks/useProfile.ts`

---

## Benefits of Stripe Approach

1. **PCI Compliant** - Card data never touches our servers
2. **Secure** - Stripe handles all sensitive data
3. **Less code** - No need for local CRUD operations
4. **Better UX** - Stripe Elements handles validation
5. **Global support** - 135+ currencies, 45+ countries

---

## Implementation Checklist (Phase 7)

- [ ] Add `stripeCustomerId` to users schema
- [ ] Install Stripe SDK (`pnpm add stripe @stripe/stripe-js @stripe/react-stripe-js`)
- [ ] Create Stripe Customer on user registration
- [ ] Implement Stripe Elements component
- [ ] Add API to list payment methods from Stripe
- [ ] Add API to detach payment method
- [ ] Replace mock data in useProfile with Stripe API calls
