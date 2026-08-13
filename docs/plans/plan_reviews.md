# Implementation Plan: Rating & Review System

## Overview

Build a complete review and rating system that allows users to rate each other after completed transactions (auction wins or shipment deliveries).

## Current Status

- ✅ **Database Schema** - `src/db/schema/reviews.ts` already exists with complete table definition
- ✅ **UI Complete** - ReviewCard, Reviews, ListingReviews components
- ✅ **Types Defined** - Review, ReviewStats, ReviewTab interfaces in `features/app/profile/types.ts`
- ✅ **Hooks Implemented** - useReviews, useListingReviews with mock data
- ❌ **Backend** - Not implemented (this plan)

## Prerequisites

- Database setup (PostgreSQL + Drizzle ORM) ✅
- Authentication system (better-auth) ✅

---

## Implementation Steps

### 1. DTO Layer (Zod Validation)

**File:** `src/server/dto/reviews.dto.ts`

**Schemas:**

```typescript
// Input DTOs
- createReviewInput (targetUserId, listingId, rating: 1-5)
- getUserReviewsInput (userId, pagination, tab filter)
- getListingReviewsInput (listingId)

// Query DTOs
- reviewsQuerySchema (page, limit, type filter)
```

### 2. DAL (Data Access Layer)

**File:** `src/server/dal/reviews.dal.ts`

**Functions:**

- `create(data)` - Create a review
- `getById(id)` - Get single review
- `getByTargetUser(userId, filters)` - Get reviews received by user
- `getByAuthor(userId)` - Get reviews written by user
- `getByListing(listingId)` - Get reviews for a listing
- `getStats(userId)` - Calculate average rating and distribution
- `checkExists(authorId, listingId)` - Prevent duplicate reviews
- `delete(id, authorId)` - Delete own review

### 3. Service Layer

**File:** `src/server/services/reviews.service.ts`

**Business Logic:**

- Validate user can review (must be buyer of listing winner)
- Prevent duplicate reviews (one review per listing per user)
- Calculate rating statistics
- Validate rating value (1-5)
- Update user's overall rating after new review

### 4. API Routes

**Files:**

- `src/app/api/reviews/route.ts` - Create review, get all
- `src/app/api/reviews/[id]/route.ts` - Get, delete single review
- `src/app/api/users/[id]/reviews/route.ts` - Get user's received reviews
- `src/app/api/users/[id]/stats/route.ts` - Get user's rating stats

**Endpoints:**

```
POST   /api/reviews               # Create review
GET    /api/reviews               # Get my reviews (as author)

GET    /api/reviews/:id           # Get single review
DELETE /api/reviews/:id           # Delete own review

GET    /api/users/:id/reviews     # Get reviews for a user
GET    /api/users/:id/stats       # Get user rating stats
```

---

## Verification Steps

### Backend Testing:

1. ✅ Can create review for completed transaction
2. ✅ Cannot review without being buyer/winner
3. ✅ Cannot review same listing twice
4. ✅ Rating must be 1-5
5. ✅ Statistics calculated correctly
6. ✅ Can delete own review
7. ✅ Cannot delete others' reviews

### Security:

- Authorization: Only transaction participants can review
- Rate limiting: Prevent spam reviews
- Validation: Sanitize all inputs

---

## Estimated Time

- **DTO Layer:** 30 minutes
- **DAL:** 1 hour
- **Service:** 1.5 hours
- **API Routes:** 1 hour
- **Testing:** 1 hour

**Total:** ~5 hours

---

## Notes

- Schema already has `listingId` as proof of transaction
- No comment field in schema (rating only per requirements)
- UI shows helpful count, but not in schema - can be added later
- Review `type` in UI is derived from transaction role (buyer/seller)
