# Specification: Realtime Home Cards

## Overview
The Home page (feed) displays a grid of `ListingCard` components. For auction-type listings, these cards must display the **Current Bid Price** and **Total Bid Count**. To create a dynamic and competitive user experience, these values must update in real-time as bids are placed by other users.

## Data Sources
1.  **Initial Load**: Data is passed via props from the parent `Home` component (fetched via React Query `fetchPublicListings`).
2.  **Real-time Updates**: Data is received via Ably WebSocket channel `listing:{id}:bids`.

## Behavior Rules

### 1. Subscription
- **Channel Name**: `listing:{listingId}:bids`
- **Event Name**: `bid:new`
- **Trigger**: Subscription starts immediately when the `ListingCard` mounts and stops when it unmounts.

### 2. Event Handling (`bid:new`)
- **Payload Validation**: The incoming event payload MUST be validated against the `newBidEventSchema` defined in `src/server/dto/ably-events.dto`.
- **Invalid Data**: If validation fails, the event MUST be ignored and an error logged to console.
- **State Update**:
    - **Current Price**: Update to `event.amount`. Note: `event.amount` is in **cents**. It must be converted to **Euros** (/100) before setting state for display.
    - **Bid Count**: Increment the current bid count by 1. Alternatively, if the event payload contained a total count (it currently doesn't), we would sync to that. Incrementing is acceptable logic for this iteration.

### 3. Display Logic
- **Price Format**: Display with Euro symbol and 2 decimal places (e.g., `€15.00` or auto-formatted).
- **Fallback**: If Ably is disconnected or fails, the component MUST silently degrade to showing the static initial data.

## Edge Cases
- **Rapid Bidding**: If multiple bids come in effectively simultaneously, the state updates should handle standard React batching.
- **Navigation**: If user navigates away, subscription must remain clean (unsubscribe) to prevent memory leaks.
- **Re-connection**: The Ably provider handles connection recovery; the hook should rely on the `useAblyClientContext` stability.

## UI Components
- **`ListingCard`**: The only UI component to be modified. It remains a "dumb" UI component but now consumes a "smart" hook for its specific data needs.

## Schema Reference (Ably)
```typescript
interface NewBidEvent {
  bidId: string;
  listingId: string;
  amount: number; // Cents
  createdAt: string;
  // ... other fields
}
```
