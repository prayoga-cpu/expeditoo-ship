# Implementation Plan: Create Listing

## Overview

Multi-step wizard for creating new items for sale or auction. Includes image upload, AI-assisted description (future), and location selection.

## Current Status

- ✅ **UI Complete** - 4-step wizard (Item, Pickup, Delivery, Price)
- ✅ **Hooks Implemented** - useCreateForm
- ❌ **Backend** - Not implemented

## Implementation Steps

### 1. Database Schema

**File:** `src/db/schemas/listings.ts`

- id, sellerId, title, description, category
- dimensions (length, width, height, weight)
- pickupAddress, deliveryPreferences
- price, type (fixed/auction)
- images (array of URLs)

### 2. File Upload (R2/S3)

**File:** `src/app/api/upload/route.ts`

- Handle image uploads, resize/optimize, return URL

### 3. API Routes

**File:** `src/app/api/listings/route.ts`

- POST: Create new listing
- Validate all steps data

### 4. Client API

**File:** `src/features/app/create/api/create.api.ts`

---

# Specification: Create Listing

## Functional Requirements

### Feature 1: Image Upload

- Support multiple images (max 5)
- Max size 5MB per image
- Allowed types: jpg, png, webp

### Feature 2: Create Listing Wizard

**Input:**

```json
{
  "title": "Sofa",
  "description": "Used leather sofa...",
  "images": ["url1", "url2"],
  "dimensions": { "length": 200, "width": 90, "height": 80 },
  "weight": "50+",
  "pickup": { "address": "...", "elevator": true },
  "price": 100,
  "type": "fixed_price"
}
```

**Validation:**

- Title: min 5 chars
- Price: must be > 0
- At least 1 image required
- Address must be valid

## Edge Cases

- **Upload Fail:** Handle partial uploads
- **Draft Save:** (Future) Save progress if user drops off
