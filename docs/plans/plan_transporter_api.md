# Transporter API Implementation Plan

**Project:** EXPEDITOO  
**Feature:** Transporter Proposal API & Proof of Delivery  
**Created:** 2025-12-05  
**Status:** ✅ Completed  
**Specification:** [api.md](../api.md) (Section 6: Shipments)

---

## Overview

Implement API endpoints for drivers/transporters following the established API spec:

1. Submit price proposal for shipments
2. User accepts proposal (assigns driver)
3. Driver updates shipment status
4. Upload proof of delivery (photo)

---

## Prerequisites (Already Done)

- [x] Database schema (`shipments`, `shipmentProposals` tables)
- [x] Shipment DTO with status validation
- [x] Shipment DAL with basic operations
- [x] Shipment Service with status state machine
- [x] Core API routes (GET/PATCH shipments)
- [x] File upload infrastructure (R2/S3)

---

## Implementation Checklist

### Phase 1: Proposal System ✅

**DTO:** `src/server/dto/shipment.dto.ts`

- [x] `createProposalSchema` - Zod validation for proposal

**DAL:** `src/server/dal/shipments.dal.ts`

- [x] `createProposal()` - Create new proposal
- [x] `getProposalsByShipmentId()` - Get proposals for shipment
- [x] `getProposalById()` - Get single proposal
- [x] `acceptProposal()` - Accept and assign driver
- [x] `rejectProposal()` - Reject a proposal
- [x] `hasExistingProposal()` - Check duplicate

**Service:** `src/server/services/shipment.service.ts`

- [x] `createProposal()` - Business logic for proposal
- [x] `getProposals()` - Get proposals with auth check
- [x] `acceptProposal()` - Accept proposal and assign driver

**API Routes:**

- [x] `POST /api/shipments/:id/proposals` - Driver submit proposal
- [x] `GET /api/shipments/:id/proposals` - Get proposals (owner only)
- [x] `POST /api/shipments/:id/proposals/:proposalId/accept` - Accept proposal

### Phase 2: Driver Status Update ✅

**Already exists:** `src/app/api/shipments/[id]/status/route.ts`

- [x] Driver can update: PICKED_UP, IN_TRANSIT, DELIVERED
- [x] Validate driver is assigned to shipment

### Phase 3: Proof of Delivery ✅

**Schema Update:** `src/db/schema/shipments.ts`

- [x] Add `proofOfDeliveryUrl` field
- [x] Add `deliveredAt` timestamp

**API Route:** `src/app/api/shipments/[id]/proof-of-delivery/route.ts`

- [x] `POST /api/shipments/:id/proof-of-delivery` - Upload POD image

---

## API Endpoints Summary (Per API Spec)

```
POST   /api/shipments/:id/proposals                    # Driver submits proposal
GET    /api/shipments/:id/proposals                    # Get proposals (owner)
POST   /api/shipments/:id/proposals/:proposalId/accept # Accept proposal
PATCH  /api/shipments/:id/status                       # Driver updates status
POST   /api/shipments/:id/proof-of-delivery            # Upload POD
```

---

## Proposal Flow

```
1. User creates shipment (status: PENDING)
2. Drivers submit proposals with price
3. User sees list of proposals
4. User accepts one proposal
   → Driver assigned to shipment
   → Status changes to ASSIGNED
   → Other proposals rejected
5. Driver updates status: PICKED_UP → IN_TRANSIT → DELIVERED
6. Driver uploads proof of delivery
```

---

## File Structure

```
src/
  db/
    schema/
      shipments.ts               # [MODIFIED] Add POD fields
  server/
    dto/
      shipment.dto.ts            # [MODIFIED] Add proposal schema
    dal/
      shipments.dal.ts           # [MODIFIED] Add proposal methods
    services/
      shipment.service.ts        # [MODIFIED] Add proposal service
  app/
    api/
      shipments/
        [id]/
          proposals/
            route.ts             # [NEW] GET/POST proposals
            [proposalId]/
              accept/
                route.ts         # [NEW] POST accept proposal
          proof-of-delivery/
            route.ts             # [EXISTING] POST upload POD
```

---

## Estimated Time

- Proposal System: 2 hours
- Proof of Delivery: 1 hour
- Testing: 30 min

**Total:** ~3.5 hours
