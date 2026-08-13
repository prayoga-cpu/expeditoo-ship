# Plan: Auction Backend Implementation

## Goal

Implement the backend logic for the Auction system, enabling users to place bids on listings and view auction details.

## Context

- **Schema**:
  - `listings` table contains auction details (`startPrice`, `currentPrice`, `endsAt`, `type='auction'`).
  - `bids` table contains individual bids, referencing `listings`.
- **Spec**: `docs/specs/auction_spec.md` (Note: Schema in spec differs slightly from actual code; we will follow the actual code structure where `listings` acts as the auction record).

## Steps

### 1. Data Transfer Objects (DTO)

Create `src/server/dto/auctions.dto.ts`:

- `PlaceBidSchema`: Validate `amount` (number, positive).
- `AuctionResponseSchema`: Output format for auction details.

### 2. Data Access Layer (DAL)

Create `src/server/dal/auctions.dal.ts`:

- `createBid(listingId, userId, amount, newEndTime?)`:
  - Transactional operation:
    1. Insert into `bids`.
    2. Update `listings` (`currentPrice`, `endsAt` if extended).
- `getBidsByListingId(listingId)`: Fetch bid history.
- `getAuctionDetails(listingId)`: Fetch listing with specific auction fields.

### 3. Service Layer

Create `src/server/services/auctions.service.ts`:

- `placeBid(listingId, userId, amount)`:
  - **Validation**:
    - Listing exists and is type 'auction'.
    - Auction is active (`endsAt` > now).
    - User is not the seller.
    - Amount > `currentPrice` + `minimumIncrement` (default 5?).
  - **Logic**:
    - Calculate `minimumIncrement` (e.g., 5% or fixed amount).
    - **Soft Close**: If `now` is within 2 mins of `endsAt`, extend `endsAt` by 2 mins.
    - Call DAL to execute transaction.
- `getAuction(listingId)`:
  - Fetch listing and bids.
  - Determine status (active/ended).

### 4. API Routes

- `POST /api/listings/[id]/bid`:
  - Protected route (auth required).
  - Body: `{ amount: number }`.
  - Calls `auctionsService.placeBid`.
- `GET /api/listings/[id]/bids`:
  - Public route.
  - Returns bid history.

## Files to Create

1. `src/server/dto/auctions.dto.ts`
2. `src/server/dal/auctions.dal.ts`
3. `src/server/services/auctions.service.ts`
4. `src/app/api/listings/[id]/bid/route.ts`
5. `src/app/api/listings/[id]/bids/route.ts`

## Verification

- Test placing a valid bid.
- Test placing a low bid (should fail).
- Test placing a bid on expired auction (should fail).
- Test soft close extension.
