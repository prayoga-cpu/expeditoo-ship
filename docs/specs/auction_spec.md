# Specification: Auction System

## Overview

A bidding system allowing sellers to list items for auction and buyers to place bids. The system handles real-time bid updates, automatic closing, and winner determination.

---

## User Stories

### As a Seller:

- I want to list an item for auction with a starting price and duration
- I want to set a "Buy Now" price for instant sale
- I want to see the current highest bid on my item
- I want to be notified when my auction ends and who won

### As a Buyer:

- I want to place a bid on an item
- I want to know the minimum bid amount required
- I want to be notified if I am outbid
- I want to win the item immediately if I pay the "Buy Now" price

---

## Functional Requirements

### Feature 1: Place Bid

**Input:**

```json
{
  "auctionId": "auction-123",
  "amount": 150.0
}
```

**Output (Success):**

```json
{
  "id": "bid-456",
  "auctionId": "auction-123",
  "bidderId": "user-789",
  "amount": 150.0,
  "createdAt": "2025-11-28T10:30:00Z"
}
```

**Behavior:**

1. Validate auction is active and not expired
2. Validate bid amount >= currentBid + minimumIncrease
3. Create bid record
4. Update auction's currentBid
5. Extend auction end time if bid placed in last 5 minutes (Sniping protection - optional)
6. Notify previous highest bidder

**Validation Rules:**

- Auction must be active
- Bidder cannot be the seller
- Amount must be valid number > 0
- Amount must be higher than current highest bid + increment

**Error Scenarios:**
| Scenario | Expected Error | HTTP Status |
|----------|----------------|-------------|
| Auction ended | "Auction has ended" | 400 |
| Bid too low | "Bid must be at least X" | 400 |
| Self-bidding | "Cannot bid on own item" | 400 |

---

### Feature 2: Get Auction Details

**Input:** `auctionId`

**Output:**

```json
{
  "id": "auction-123",
  "currentBid": 150.0,
  "bidCount": 5,
  "endTime": "2025-11-29T10:00:00Z",
  "status": "active",
  "winnerId": null,
  "bids": [
    { "amount": 150, "bidder": "User A", "time": "..." },
    { "amount": 140, "bidder": "User B", "time": "..." }
  ]
}
```

---

## Database Schema

### Table: `auctions`

```sql
CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  starting_bid DECIMAL(10, 2) NOT NULL,
  current_bid DECIMAL(10, 2) NOT NULL,
  minimum_increase DECIMAL(10, 2) DEFAULT 5.00,
  buy_now_price DECIMAL(10, 2),
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- active, ended, cancelled
  winner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `bids`

```sql
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id),
  bidder_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Edge Cases

1. **Simultaneous Bids:** Two users bid same amount at same time. First one processed wins, second gets error "Bid too low".
2. **Last Second Bid:** If bid placed < 5 mins before end, extend time by 5 mins (Soft Close).
3. **Buy Now:** If user pays Buy Now price, auction ends immediately, all other bids cancelled/ignored.
4. **No Bids:** Auction ends with status 'ended' and no winner.

---

## Testing Checklist

- [ ] Bid lower than current + increment fails
- [ ] Bid on expired auction fails
- [ ] Seller cannot bid
- [ ] Highest bidder updates correctly
- [ ] Auction status changes to 'ended' after time expires
