# Specification: User Profile & Settings

## Overview

Central hub for users to manage their personal information, security settings, addresses, and payment methods.

---

## User Stories

### As a User:

- I want to update my personal details (name, bio, avatar)
- I want to manage my saved addresses for faster checkout
- I want to add/remove credit cards securely
- I want to view my public profile as others see it

---

## Functional Requirements

### Feature 1: Get Profile

**Input:** `userId` (optional, defaults to current user)

**Output:**

```json
{
  "id": "user-123",
  "name": "John Doe",
  "avatar": "https://...",
  "bio": "...",
  "joinedAt": "2023-01-01",
  "stats": {
    "listings": 5,
    "sales": 2,
    "rating": 4.8
  }
}
```

### Feature 2: Add Address

**Input:**

```json
{
  "label": "Home",
  "street": "123 Rue de Rivoli",
  "city": "Paris",
  "zip": "75001",
  "country": "FR",
  "isDefault": true
}
```

**Validation:**

- Required fields: street, city, zip, country
- Max addresses per user: 10

---

## Database Schema

### Table: `users` (Extension)

- bio TEXT
- phone VARCHAR(20)
- preferences JSONB

### Table: `addresses`

```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  label VARCHAR(50),
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  zip VARCHAR(20) NOT NULL,
  country VARCHAR(2) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Edge Cases

1. **Delete Default Address:** Must assign new default or warn user.
2. **Invalid Phone:** Validate format E.164.
3. **Avatar Upload:** Max 2MB, image only.

---

## Testing Checklist

- [ ] Can update bio and name
- [ ] Can add new address
- [ ] Setting default address updates previous default
- [ ] Cannot access other user's private data (addresses, payment)
