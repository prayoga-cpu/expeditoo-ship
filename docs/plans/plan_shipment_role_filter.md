# Plan: Shipment Role Filter (Buyer/Seller)

## Goal

- **Goal**: Ensure "Shipment" tabs show correct data for User, Seller, and Driver.
- **Problem**: Current implementation might be mixing up roles or not showing correct tabs.
- **Roles to Verify**:
  - **User (Sender)**: Should see shipments they are sending.
  - **Seller (Auctioneer)**: Should see shipments for items they sold.
  - **Driver (Transporter)**: Should see shipments they are assigned to.

## Problem Statement

The Deliveries page has two tabs:

- **Incoming** (Masuk): Shipments where user is the **Buyer** (won the auction)
- **Outgoing** (Keluar): Shipments where user is the **Seller/Auctioneer** (sold the item)

**Current Bug:** Both tabs return the same data because the API only filters by `userId` (shipment creator), not considering the user's role in the transaction.

---

## Root Cause Analysis

1. **Frontend (`shipments.api.ts`):** Maps both `incoming` and `outgoing` to `role=sender`
2. **Backend (`shipment.service.ts`):** Only has logic for `sender`, `driver`, `available`, `proposals`
3. **DAL (`shipments.dal.ts`):** No method to query by `sellerId` (from listing) or `buyerId` (winnerId from listing)

---

## Solution Overview

### Phase 1: Backend Changes

1. **DTO (`shipment.dto.ts`)**
   - Add `buyer` and `seller` to role enum in `getShipmentsQuerySchema`

2. **DAL (`shipments.dal.ts`)**
   - Add `getBySellerId()`: Query shipments where associated listing's `sellerId` = userId
   - Add `getByBuyerId()`: Query shipments where associated listing's `winnerId` = userId OR `shipments.userId` = userId

3. **Service (`shipment.service.ts`)**
   - Add handling for `role === "seller"` → call `getBySellerId()`
   - Add handling for `role === "buyer"` → call `getByBuyerId()`

### Phase 2: Frontend Changes

4. **Client API (`shipments.api.ts`)**
   - Map `type: "incoming"` → `role=buyer`
   - Map `type: "outgoing"` → `role=seller`

---

## Files to Modify

| File                                               | Change Type | Description                         |
| -------------------------------------------------- | ----------- | ----------------------------------- |
| `src/server/dto/shipment.dto.ts`                   | Modify      | Add "buyer", "seller" to role enum  |
| `src/server/dal/shipments.dal.ts`                  | Modify      | Add getBySellerId(), getByBuyerId() |
| `src/server/services/shipment.service.ts`          | Modify      | Handle buyer/seller roles           |
| `src/features/app/deliveries/api/shipments.api.ts` | Modify      | Map incoming→buyer, outgoing→seller |

---

## Implementation Order

1. DTO changes (validation)
2. DAL methods (database queries)
3. Service layer (business logic routing)
4. Frontend API mapping

---

## Testing Checklist

- [ ] Incoming tab shows shipments where user won the auction
- [ ] Outgoing tab shows shipments for items user sold
- [ ] Both tabs return different data for users with mixed roles
- [ ] API returns proper error for invalid role parameter
- [ ] Build succeeds without TypeScript errors

---

## Estimated Complexity

**Low-Medium** - Mostly routing logic, no new tables or migrations required.

---

## Status

✅ **COMPLETED** (2025-12-11)
