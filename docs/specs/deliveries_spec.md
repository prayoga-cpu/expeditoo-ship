# Specification: Deliveries (Logistics) System

## Overview

System to manage peer-to-peer shipping of items. Handles shipment creation, driver assignment, status tracking, and secure delivery confirmation.

---

## User Stories

### As a Buyer:

- I want to track my shipment status in real-time
- I want to see the estimated delivery time
- I want to receive a secure code to confirm I received the item

### As a Seller:

- I want to know when my item has been picked up
- I want to know when my item has been delivered

### As a Driver:

- I want to see available delivery jobs
- I want to update the status of a delivery (picked up, delivered)
- I want to validate the delivery code to complete the job

---

## Functional Requirements

### Feature 1: Create Delivery

**Input:**

```json
{
  "listingId": "listing-123",
  "pickupAddress": {...},
  "deliveryAddress": {...},
  "scheduledTime": "..."
}
```

**Output:**

```json
{
  "id": "del-456",
  "trackingCode": "TRK-8899",
  "status": "pending",
  "confirmationCode": "1234" (only visible to buyer)
}
```

### Feature 2: Update Status

**Input:**

```json
{
  "deliveryId": "del-456",
  "status": "picked_up",
  "location": { "lat": 48.85, "lng": 2.35 }
}
```

**Behavior:**

1. Validate transition is allowed
2. Create record in `delivery_updates`
3. Update main `deliveries` status
4. Notify relevant parties

### Feature 3: Confirm Delivery

**Input:**

```json
{
  "deliveryId": "del-456",
  "code": "1234"
}
```

**Behavior:**

1. Check if code matches `confirmationCode`
2. If match, update status to `delivered`
3. Release payment to driver/seller
4. If mismatch, return error

---

## Database Schema

### Table: `deliveries`

```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  tracking_code VARCHAR(20) UNIQUE NOT NULL,
  confirmation_code VARCHAR(6) NOT NULL,
  pickup_address JSONB NOT NULL,
  delivery_address JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Edge Cases

1. **Wrong Code:** Driver enters wrong confirmation code 3 times -> Lock for 1 hour.
2. **Driver Cancel:** Driver cancels after pickup -> Emergency alert to admin.
3. **Lost Item:** Status stuck in 'in_transit' for > 48h -> Flag for support.

---

## Testing Checklist

- [ ] Status transitions enforce order (pending -> picked_up -> delivered)
- [ ] Only buyer can see confirmation code
- [ ] Only correct code completes delivery
- [ ] Tracking code retrieves correct delivery
