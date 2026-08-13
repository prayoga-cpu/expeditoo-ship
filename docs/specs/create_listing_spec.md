# Specification: Create Listing

## Overview

A multi-step process for sellers to list items on the marketplace. Supports both fixed-price sales and auctions, with detailed item specifications and shipping preferences.

---

## User Stories

### As a Seller:

- I want to upload photos of my item
- I want to describe my item's condition and dimensions
- I want to set a price or start an auction
- I want to specify where the item can be picked up

---

## Functional Requirements

### Feature 1: Create Listing

**Input:**

```json
{
  "title": "Vintage Leather Sofa",
  "description": "Beautiful 3-seater sofa...",
  "category": "furniture",
  "condition": "good",
  "images": ["https://...", "https://..."],
  "quantity": 1,
  "dimensions": {
    "length": 200,
    "width": 90,
    "height": 85,
    "unit": "cm"
  },
  "weight": "50+",
  "pickupLocation": {
    "address": "123 Main St",
    "city": "Paris",
    "zip": "75001",
    "country": "FR"
  },
  "pricing": {
    "type": "fixed", // or "auction"
    "price": 250.0,
    "currency": "EUR"
  }
}
```

**Output (Success):**

```json
{
  "id": "listing-789",
  "status": "active",
  "createdAt": "2025-11-28T10:00:00Z",
  "slug": "vintage-leather-sofa-listing-789"
}
```

**Validation Rules:**

- **Images:** Minimum 1, Maximum 10. Max size 5MB.
- **Title:** Min 5 chars, Max 100 chars.
- **Description:** Min 20 chars, Max 2000 chars.
- **Price:** Must be > 0.
- **Location:** Must have valid address and city.

---

## Database Schema

### Table: `listings`

```sql
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  condition VARCHAR(20) NOT NULL,
  images JSONB NOT NULL DEFAULT '[]',
  price DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'EUR',
  type VARCHAR(20) NOT NULL, -- fixed, auction
  status VARCHAR(20) DEFAULT 'active',
  pickup_location JSONB NOT NULL,
  dimensions JSONB,
  views INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Edge Cases

1. **Inappropriate Content:** (Future) AI moderation for images/text.
2. **Currency:** Currently only EUR supported.
3. **Drafts:** If user leaves step 3, save as draft (Future).

---

## Testing Checklist

- [ ] Valid listing creation returns 201
- [ ] Missing required fields returns 400
- [ ] Invalid image format returns 400
- [ ] Zero or negative price returns 400
