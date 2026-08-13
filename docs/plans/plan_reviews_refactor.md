# Plan: Review System Refactor

## Context
The current review system (`src/db/schema/reviews.ts`, `reviews.service.ts`) is incomplete and buggy. It forces a `listingId` dependent relationship which crashes when `listingId` is missing, and it lacks logic for Seller->Buyer or Driver/Shipment reviews.

## Goals
1.  **Robust Database Schema**: Support reviews for both Listings (Item Sales) and Shipments (Driver Jobs).
2.  **Flexible Logic**: Enable 4-way reviews:
    *   Buyer reviews Seller (Listing)
    *   Seller reviews Buyer (Listing)
    *   User reviews Driver (Shipment)
    *   Driver reviews User (Shipment)
3.  **Strict Validation**: Ensure reviews can only happen after a transaction is **completed**.

## Implementation Steps

### 1. Database Schema Update
- [ ] Modify `src/db/schema/reviews.ts`
    - Make `listingId` nullable.
    - Add `shipmentId` (nullable, reference to `shipments`).
    - Add `role` or `type` enum to clarify context (e.g., `BUYER`, `SELLER`, `DRIVER`, `CLIENT`).
    - **Draft Migration**: Since we are in dev, we might push schema changes directly or create a migration if strict. (We will follow project norm: modify schema file directly + `drizzle-kit push` or migration).

### 2. DTO Update
- [ ] Update `src/server/dto/reviews.dto.ts`
    - Update `CreateReviewInput` to accept `shipmentId`.
    - Make `listingId` truly optional in Zod.
    - Add validation to ensure *either* `listingId` *or* `shipmentId` is present (XOR).

### 3. DAL Update
- [ ] Update `src/server/dal/reviews.dal.ts`
    - Update `create` method to handle new fields.
    - Update `checkExists` to check based on (Author + Listing) OR (Author + Shipment).
    - Update query methods given the schema changes.

### 4. Service Logic Update (The Core)
- [ ] Refactor `src/server/services/reviews.service.ts`
    - **Method `createReview`**:
        - **Scenario A (Listing/Order Review)**:
            - Verify `listingId` exists.
            - Check Order status (must be `DELIVERED` or `COMPLETED` or `PAID` depending on flow).
            - Check if Author is Buyer or Seller.
        - **Scenario B (Shipment/Driver Review)**:
            - Verify `shipmentId` exists.
            - Check Shipment status (must be `DELIVERED`).
            - Check if Author is Client (Buyer/Seller) or Driver.

### 5. API Update
- [ ] Verify `src/app/api/reviews/route.ts` handles the updated Service signature.

### 6. UI Update
- [ ] Check `src/features/app/listing/ui/ListingReviews.tsx` (ensure it passes `listingId`).
- [ ] **New UI**: Add Review Modal triggers in:
    - Order Details page (for Listing reviews).
    - Shipment Details page (for Driver reviews).

## Timeline
- **Step 1-3**: Schema & Types (1 hour)
- **Step 4**: Service Logic (2 hours)
- **Step 5-6**: Integration & UI (2 hours)
