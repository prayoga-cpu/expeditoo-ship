# Implementation Plan: Deliveries (Logistics) System

## Overview

Manage the shipment lifecycle from creation to delivery confirmation. This includes tracking status, assigning drivers (for peer-to-peer shipping), and handling delivery confirmation codes.

## Current Status

- ✅ **UI Complete** - Delivery list, detail view, tracking timeline
- ✅ **Hooks Implemented** - useDeliveries with mock data
- ❌ **Backend** - Not implemented

## Prerequisites

- Database setup
- Authentication
- Map integration (Mapbox) for route visualization

---

## Implementation Steps

### 1. Database Schema

**Files to Create:**

- `src/db/schemas/deliveries.ts`
- `src/db/schemas/delivery_updates.ts`

**Schema:**

```typescript
// deliveries table
(-id,
  listingId(FK),
  buyerId(FK),
  sellerId(FK),
  driverId(FK, nullable) - pickupAddress,
  deliveryAddress,
  pickupTime,
  deliveryTime -
    status(pending, assigned, picked_up, in_transit, delivered, cancelled) -
    trackingCode,
  confirmationCode - price,
  distance,
  weight,
  size -
    // delivery_updates table (for timeline)
    id,
  deliveryId(FK) - status,
  description,
  location(lat, lng) - timestamp);
```

### 2. DTO Layer

**File:** `src/server/dto/deliveries.dto.ts`

**Schemas:**

- createDeliveryInput
- updateDeliveryStatusInput
- assignDriverInput
- deliveryOutput

### 3. Service Layer

**File:** `src/server/services/deliveries.service.ts`

**Business Logic:**

- Generate unique tracking codes
- Validate status transitions (e.g., cannot go from 'pending' to 'delivered')
- Verify confirmation code upon delivery
- Calculate shipping costs based on distance/weight

### 4. API Routes

**Files:**

- `src/app/api/deliveries/route.ts`
- `src/app/api/deliveries/[id]/route.ts`
- `src/app/api/deliveries/[id]/track/route.ts`

### 5. Client API

**File:** `src/features/app/deliveries/api/deliveries.api.ts`

### 6. Update Hooks

**File:** `src/features/app/deliveries/hooks/useDeliveries.ts`

---

## Verification

- ✅ Can create delivery request
- ✅ Driver can accept/be assigned delivery
- ✅ Status updates reflect in timeline
- ✅ Delivery cannot be confirmed without valid code
- ✅ Tracking page shows correct status

## Estimated Time: ~20 hours
