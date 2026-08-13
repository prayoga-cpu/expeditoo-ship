# Plan: Auction Lifecycle Implementation

## Status: ✅ COMPLETED

## Goal

Mengimplementasikan mekanisme penutupan otomatis lelang dan penentuan pemenang saat waktu lelang berakhir.

## Context

- **Current State**:
  - ✅ Backend bidding (`placeBid`) sudah berfungsi
  - ✅ Soft Close (perpanjangan waktu 2 menit) sudah diterapkan
  - ✅ Schema `listings` memiliki `status` (active/sold/ended/cancelled) dan `endsAt`
  - ✅ Mekanisme otomatis untuk menutup lelang saat `endsAt` tercapai
  - ✅ Penentuan pemenang (`winnerId` sudah ada di schema)

- **Schema Notes**:
  - Berbeda dengan `auction_spec.md`, implementasi aktual tidak menggunakan tabel `auctions` terpisah
  - Semua data lelang disimpan di tabel `listings` dengan `type='auction'`
  - `winnerId` sudah ditambahkan ke tabel `listings`

## Completed Steps

### 1. Database Schema Update ✅

**File:** `src/db/schema/listings.ts`

Added:

```typescript
winnerId: text("winner_id").references(() => user.id),
```

**Migration:** Applied successfully

---

### 2. DAL Layer ✅

**File:** `src/server/dal/auctions.dal.ts`

Added functions:

- `getExpiredActiveAuctions()` - Get all expired but still active auctions
- `getHighestBid(listingId)` - Get the highest bid for a listing
- `closeAuction(listingId, winnerId)` - Close auction and set winner
- `getAuctionWithWinner(listingId)` - Get auction with winner info

---

### 3. Service Layer ✅

**File:** `src/server/services/auctions.service.ts`

Added functions:

- `processExpiredAuctions()` - Main function called by cron job
- `getAuctionWinner(listingId)` - Get the winner of an auction

---

### 4. Cron Endpoint ✅

**File:** `src/app/api/cron/close-auctions/route.ts`

- Protected by `CRON_SECRET` environment variable
- Returns processed/closed auction counts
- Development mode allows access without secret

---

### 5. Cron-Job.org Configuration ✅

**External Service:** https://cron-job.org

Setup:

1. Create account at cron-job.org
2. Add new cron job:
   - **URL:** `https://your-domain.com/api/cron/close-auctions`
   - **Schedule:** Every 1 minute
   - **HTTP Method:** GET
   - **Headers:** `Authorization: Bearer YOUR_CRON_SECRET`
3. Enable the job

---

### 6. Listing API Update ✅

**File:** `src/server/dal/listings.dal.ts`

- `getById()` now includes winner info (id, name, image) when auction has ended

---

## Files Modified/Created

| File                                       | Action | Status |
| ------------------------------------------ | ------ | ------ |
| `src/db/schema/listings.ts`                | Modify | ✅     |
| `src/server/dal/auctions.dal.ts`           | Modify | ✅     |
| `src/server/dal/listings.dal.ts`           | Modify | ✅     |
| `src/server/services/auctions.service.ts`  | Modify | ✅     |
| `src/app/api/cron/close-auctions/route.ts` | Create | ✅     |

---

## Environment Variables

```env
# Secret for protecting cron endpoint (required in production)
CRON_SECRET=your-random-secret-here
```

---

## Verification Checklist

- [x] Schema migration applied successfully
- [x] Expired auctions are detected correctly (via `getExpiredActiveAuctions`)
- [x] Winner is determined (highest bidder via `getHighestBid`)
- [x] Auction with no bids marked as ended with winnerId = null
- [x] Status changes to 'ended' after processing
- [x] Cron job configured to run every minute
- [x] Cron endpoint is protected by secret
- [x] API returns winner info for ended auctions
- [ ] UI shows winner for ended auctions (Optional - future enhancement)

---

## Future Enhancements (Out of Scope)

- [ ] Send notification to winner (email/in-app)
- [ ] Send notification to seller
- [ ] Send notification to outbid users
- [ ] Payment flow for winner
- [ ] "Buy It Now" instant purchase
- [ ] Admin dashboard to monitor auction closures
- [ ] UI winner display

---

## Testing

To test the cron endpoint locally:

```bash
# Without auth (dev mode)
curl http://localhost:3000/api/cron/close-auctions

# With auth (production mode)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/close-auctions
```
