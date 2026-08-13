# Implementation Plan: User Profile & Settings

## Overview

Manage user profile information, addresses, payment methods, and account settings.

## Current Status

- ✅ **UI Complete** - Profile page, edit forms, address list, payment methods
- ❌ **Backend** - Not implemented

## Implementation Steps

### 1. Database Schema

**File:** `src/db/schemas/users.ts` (Update)

- Add: bio, phone, avatar, preferences
- Create `addresses` table
- Create `payment_methods` table (store Stripe tokens)

### 2. API Routes

**Files:**

- `src/app/api/profile/route.ts` - Get/Update profile
- `src/app/api/profile/addresses/route.ts`
- `src/app/api/profile/payment-methods/route.ts`

### 3. Client API

**File:** `src/features/app/profile/api/profile.api.ts`

---

# Specification: User Profile

## Functional Requirements

### Feature 1: Update Profile

**Input:**

```json
{
  "name": "John Doe",
  "bio": "Avid cyclist...",
  "phone": "+33612345678",
  "avatar": "url..."
}
```

### Feature 2: Manage Addresses

- CRUD operations for user addresses
- Set default pickup/delivery address

### Feature 3: Manage Payment Methods

- Add credit card (via Stripe Elements)
- Remove card
- Set default card

## Validation

- Phone number format
- Address validation (Google Places API)

## Security

- Users can only access/edit their own profile
- Sensitive payment data never stored in DB (only Stripe tokens)
