# Shipment Backend Implementation Plan

**Project:** EXPEDITOO  
**Feature:** Shipment & Logistics Backend  
**Created:** 2025-11-26  
**Updated:** 2025-12-05  
**Status:** ✅ Completed  
**Specification:** [shipment_spec.md](../specs/shipment_spec.md)

---

## Overview

Implement complete backend for Shipment & Logistics module. The UI is already complete (`src/features/app/deliveries/`), database schema exists (`src/db/schema/shipments.ts`). This plan focuses on DTO, DAL, Service, and API layers.

---

## Prerequisites (Already Done)

- [x] Database schema (`shipments`, `shipmentProposals` tables)
- [x] UI Components (DeliveriesList, DeliveryDetail, Timeline)
- [x] Type definitions (`src/features/app/deliveries/types.ts`)
- [x] Authentication system (better-auth)

---

## Implementation Checklist

### Phase 1: DTO Layer ✅ COMPLETED

**File:** `src/server/dto/shipment.dto.ts`

- [x] `createShipmentSchema` - Zod validation for creating shipment
- [x] `updateShipmentStatusSchema` - Zod validation for status update
- [x] `getShipmentsQuerySchema` - Query params validation
- [x] `shipmentOutputSchema` - Response format
- [x] Type exports (`CreateShipmentInput`, `UpdateStatusInput`, etc.)

### Phase 2: DAL Layer ✅ COMPLETED

**File:** `src/server/dal/shipments.dal.ts`

- [x] `create(data)` - Insert new shipment
- [x] `getById(id)` - Get shipment with relations
- [x] `getByUserId(userId, type, filters)` - Get user's shipments (incoming/outgoing)
- [x] `getByDriverId(driverId)` - Get driver's assigned shipments
- [x] `updateStatus(id, status)` - Update shipment status
- [x] `assignDriver(id, driverId, price)` - Assign driver to shipment
- [x] `cancel(id)` - Cancel shipment

### Phase 3: Service Layer ✅ COMPLETED

**File:** `src/server/services/shipment.service.ts`

- [x] `createShipment(userId, data)` - Create with validation
- [x] `getShipmentDetail(shipmentId, userId)` - Get with auth check
- [x] `getUserShipments(userId, type, filters)` - List with pagination
- [x] `updateStatus(shipmentId, userId, status)` - Status transition validation
- [x] `assignDriver(shipmentId, driverId, price)` - Assignment logic
- [x] `cancelShipment(shipmentId, userId, reason)` - Cancellation logic
- [x] Helper: `validateStatusTransition(current, next)` - State machine
- [ ] Helper: `generateTrackingId()` - Generate human-readable ID (Future)

### Phase 4: API Routes ✅ COMPLETED

#### `src/app/api/shipments/route.ts`

- [x] `GET /api/shipments` - List user's shipments
- [x] `POST /api/shipments` - Create new shipment

#### `src/app/api/shipments/[id]/route.ts`

- [x] `GET /api/shipments/:id` - Get shipment detail

#### `src/app/api/shipments/[id]/status/route.ts`

- [x] `PATCH /api/shipments/:id/status` - Update status

#### `src/app/api/shipments/[id]/assign/route.ts`

- [x] `PATCH /api/shipments/:id/assign` - Assign driver

#### `src/app/api/shipments/[id]/cancel/route.ts`

- [x] `POST /api/shipments/:id/cancel` - Cancel shipment

### Phase 5: Frontend Integration ✅ COMPLETED

**Files Modified:**

- `src/features/app/deliveries/hooks/useDeliveries.ts`
- `src/features/app/deliveries/hooks/useDeliveryDetail.ts`

**Files Created:**

- `src/features/app/deliveries/api/shipments.api.ts`
- `src/features/app/deliveries/api/index.ts`

- [x] Replace mock data with actual API call
- [x] Add loading and error states
- [x] Implement TanStack Query
- [x] Create client API layer for shipments

---

## Status Lifecycle (State Machine)

```
PENDING → PRICE_PROPOSED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
                                ↘
                              CANCELLED
```

### Valid Transitions

```typescript
const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ["PRICE_PROPOSED", "CANCELLED"],
  PRICE_PROPOSED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
```

---

## File Structure

```
src/
  server/
    dto/
      shipment.dto.ts          # NEW
    dal/
      shipments.dal.ts         # NEW
    services/
      shipment.service.ts      # NEW
  app/
    api/
      shipments/
        route.ts               # NEW - GET, POST
        [id]/
          route.ts             # NEW - GET
          status/
            route.ts           # NEW - PATCH
          assign/
            route.ts           # NEW - PATCH
          cancel/
            route.ts           # NEW - POST
```

---

## Verification Steps

1. **API Testing with curl/Postman:**
   - [x] GET /api/shipments returns user's shipments
   - [x] POST /api/shipments creates new shipment
   - [x] GET /api/shipments/:id returns detail
   - [x] PATCH /api/shipments/:id/status updates correctly
   - [x] Invalid transitions return 400 error

2. **Frontend Integration:**
   - [x] Deliveries page loads real data
   - [x] Incoming tab shows purchases
   - [x] Outgoing tab shows sales
   - [x] Detail page shows correct info

3. **Edge Cases:**
   - [x] Cannot access other user's shipment (403)
   - [x] Cannot cancel after pickup (400)
   - [x] Invalid status transition rejected (400)

---

## Estimated Time

- DTO Layer: 30 min
- DAL Layer: 1 hour
- Service Layer: 1.5 hours
- API Routes: 1.5 hours
- Frontend Integration: 1 hour
- Testing: 1 hour

**Total:** ~6.5 hours
