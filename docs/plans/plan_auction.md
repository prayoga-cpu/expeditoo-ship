# Implementation Plan: Auction System

## Overview

Build a complete auction system allowing sellers to list items for bidding and buyers to place bids. UI is already complete, this plan focuses on backend implementation.

## Current Status

- ✅ **UI Complete & Polished** - Premium design with sticky sidebar, bid card, and history
- ✅ **Types Defined** - Auction, Bid, AuctionStatus interfaces
- ✅ **Hooks Implemented** - useAuctionDetail with mock data
- ❌ **Backend** - Not implemented

## Prerequisites

- Database setup (PostgreSQL + Drizzle ORM) ✅
- Authentication system ✅
- Payment integration (Stripe) - for winner payment

---

## Implementation Steps

### 1. Database Schema

**Files to Create:**

- `src/db/schemas/auctions.ts`
- `src/db/schemas/bids.ts`

**Schema:**

```typescript
// auctions table
(-id,
  listingId(FK),
  startingBid,
  currentBid - minimumIncrease,
  buyNowPrice(nullable) - startTime,
  endTime,
  status - winnerId(nullable),
  createdAt,
  updatedAt -
    // bids table
    id,
  auctionId(FK),
  bidderId(FK) - amount,
  createdAt);
```

### 2. DTO Layer

**File:** `src/server/dto/auctions.dto.ts`

**Schemas:**

- createAuctionInput, placeBidInput
- getAuctionInput, getAuctionBidsInput
- auctionOutput, bidOutput

### 3. Service Layer

**File:** `src/server/services/auctions.service.ts`

**Business Logic:**

- Validate bid amount (must be >= currentBid + minimumIncrease)
- Auto-close auction when endTime reached
- Determine winner (highest bidder)
- Handle "Buy It Now" instant purchase
- Send notifications to outbid users
- Prevent self-bidding

### 4. API Routes

**Files:**

- `src/app/api/auctions/route.ts` - List, Create
- `src/app/api/auctions/[id]/route.ts` - Get, Update
- `src/app/api/auctions/[id]/bids/route.ts` - Place bid, Get bids

### 5. Scheduled Jobs

**Method:** External Cron Service (cron-job.org)
**Endpoint:** `src/app/api/cron/close-auctions/route.ts`
**Job:** Calls GET endpoint every minute with Bearer token authentication

### 6. Client API

**File:** `src/features/app/auction/api/auctions.api.ts`

**Functions:**

- fetchAuction, placeBid, getBids
- useAuctionQuery, usePlaceBidMutation

### 7. Update Hooks

**File:** `src/features/app/auction/hooks/useAuctionDetail.ts`

Replace mock data with TanStack Query

---

## Verification

- ✅ Can create auction with starting bid
- ✅ Can place bid higher than current bid
- ✅ Cannot bid lower than minimum increment
- ✅ Cannot bid on own auction
- ✅ Auction closes automatically at endTime
- ✅ Winner is determined correctly
- ✅ "Buy It Now" ends auction immediately

## Estimated Time: ~15 hours
