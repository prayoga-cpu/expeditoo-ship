# Plan: Realtime Home Cards

## Objective
Enable real-time updates for "current bid" and "bid count" on the listing cards in the Home (Feed) page. This ensures that users see the most up-to-date auction activity without refreshing the page, increasing engagement and the "live" feel of the marketplace.

## Implementation Approach
We will use Ably (our existing WebSocket provider) to subscribe to listing-specific channels directly from the `ListingCard` component (via a custom hook).

### 1. New Hook: `useRealtimeListing`
Create a new hook `src/features/app/home/hooks/useRealtimeListing.ts`.
- **Input**: `listingId`, `initialData` (currentBid, bidCount)
- **Logic**:
    - Initialize state with `initialData`.
    - Subscribe to Ably channel `listing:{id}:bids`.
    - Listen for `bid:new` events.
    - On event, validate data with Zod (`newBidEventSchema`).
    - Update state (convert cents to Euros for display).
- **Return**: `{ currentBid, bidCount }`.

### 2. Update Component: `ListingCard`
Modify `src/features/app/home/ui/ListingCard.tsx`.
- Integrate `useRealtimeListing`.
- Replace static props usage for price and bid count with the values returned from the hook.

## Files to Create/Modify
- `src/features/app/home/hooks/useRealtimeListing.ts` (New)
- `src/features/app/home/ui/ListingCard.tsx` (Modify)

## Complexity Estimate
- Complexity: Low (1/10) - Leverages existing Ably infrastructure and event schemas.

## Step-by-Step Implementation
1.  Define the `useRealtimeListing` hook with strict typing and Zod validation.
2.  Integrate the hook into `ListingCard`.
3.  Verify that initial props are used until a real-time event is received.
