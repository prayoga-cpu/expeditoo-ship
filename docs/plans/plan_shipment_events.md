# Shipment Events Implementation Plan

**Project:** EXPEDITOO  
**Feature:** Shipment Event History (Real Timeline)  
**Created:** 2025-12-15  
**Status:** 📋 Planned  
**Specification:** [shipment_events_spec.md](../specs/shipment_events_spec.md)

---

## Overview

Implement a proper event sourcing system for shipment status changes. This replaces the current mock `buildTimeline()` function with real data from a new `shipment_events` table.

**Why This Matters:**
- Timeline timestamps are currently FAKE (1 hour per status increment)
- No audit trail for who changed what
- Cannot track delivery performance metrics
- Users see inaccurate delivery times

---

## Prerequisites (Already Done)

- [x] Database schema for `shipments` table
- [x] Shipment service with status transitions
- [x] Shipment detail API (`GET /api/shipments/:id`)
- [x] Frontend timeline UI (`src/features/app/deliveries/ui/Timeline.tsx`)

---

## Implementation Checklist

### Phase 1: Database Schema ✅

**File:** `src/db/schema/shipments.ts`

- [x] Add `shipmentEvents` table definition
- [x] Add relations to `shipmentsRelations`
- [x] Export types: `ShipmentEvent`, `InsertShipmentEvent`
- [x] Register in `src/db/schema/index.ts`

**File:** `src/db/migrations/XXXX_add_shipment_events.ts`

- [x] Generate migration: `pnpm db:generate`
- [ ] Run migration: `pnpm db:push` (User Action Required)

### Phase 2: DAL Layer ✅

**File:** `src/server/dal/shipments.dal.ts`

Add new functions:

- [x] `createEvent(data: InsertShipmentEvent)` – Insert new event
- [x] `getEventsByShipmentId(shipmentId: string)` – Get events with actor info
- [ ] Update existing functions to return events (optional join)

### Phase 3: DTO Layer ✅

**File:** `src/server/dto/shipment.dto.ts`

Add new schemas:

- [x] `createShipmentEventSchema` – Validation for event creation
- [x] `shipmentEventOutputSchema` – Response shape (integrated into timeline)
- [x] `timelineItemSchema` – Timeline item for API response
- [x] Type exports

### Phase 4: Service Layer ✅

**File:** `src/server/services/shipment.service.ts`

- [x] Add `createEvent()` private helper function
- [x] Modify `createShipment()` → create PENDING event
- [x] Modify `updateStatus()` → create event for status change
- [x] Modify `assignDriver()` → create ASSIGNED event
- [x] Modify `acceptProposal()` → create ASSIGNED event with proposal info
- [x] Modify `cancelShipment()` → create CANCELLED event with reason
- [x] Modify `uploadProofOfDelivery()` → create DELIVERED event with photo
- [x] Replace `buildTimeline()` with async version using real data
- [x] Add fallback for legacy shipments without events

### Phase 5: API Layer ✅

**File:** `src/app/api/shipments/[id]/route.ts`

- [x] Update `GET` handler to use new async `buildTimeline()` (Service update handled this)
- [x] Ensure timeline includes actor info

No new endpoints needed – timeline is embedded in shipment detail.

### Phase 6: Testing & Verification ⏳

- [ ] Create test shipment and verify events are created
- [ ] Update status via API and check new events
- [ ] Verify timeline shows real timestamps
- [ ] Check backward compatibility for old shipments
- [ ] Performance test: timeline query < 50ms

---

## File Modifications Summary

| File | Action |
|------|--------|
| `src/db/schema/shipments.ts` | ADD table, relations, types |
| `src/db/schema/index.ts` | EXPORT new table |
| `src/server/dal/shipments.dal.ts` | ADD 2 functions |
| `src/server/dto/shipment.dto.ts` | ADD 3 schemas |
| `src/server/services/shipment.service.ts` | MODIFY 7 functions |
| `src/app/api/shipments/[id]/route.ts` | MINOR update |

---

## Detailed Steps

### Step 1: Add Database Schema

```typescript
// src/db/schema/shipments.ts - ADD after shipmentProposals

export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: text("id").primaryKey(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    status: shipmentStatusEnum("status").notNull(),
    previousStatus: shipmentStatusEnum("previous_status"),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorRole: text("actor_role").notNull(), // 'system' | 'driver' | 'buyer' | 'seller' | 'admin'
    note: text("note"),
    metadata: text("metadata"), // JSON string for flexibility
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("shipment_events_shipment_idx").on(table.shipmentId),
  ]
);

// Add relation to shipmentsRelations
export const shipmentEventsRelations = relations(shipmentEvents, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentEvents.shipmentId],
    references: [shipments.id],
  }),
  actor: one(user, {
    fields: [shipmentEvents.actorId],
    references: [user.id],
  }),
}));

// Add reverse relation to shipmentsRelations
// events: many(shipmentEvents),
```

### Step 2: Run Migration

```bash
pnpm db:generate
pnpm db:push
```

### Step 3: Add DAL Functions

```typescript
// src/server/dal/shipments.dal.ts - ADD

async createEvent(data: {
  shipmentId: string;
  status: ShipmentStatusType;
  previousStatus?: ShipmentStatusType;
  actorId?: string;
  actorRole: string;
  note?: string;
  metadata?: string; // JSON string
}) {
  const [result] = await db
    .insert(shipmentEvents)
    .values({
      id: nanoid(),
      ...data,
    })
    .returning();
  return result;
}

async getEventsByShipmentId(shipmentId: string) {
  return await db.query.shipmentEvents.findMany({
    where: eq(shipmentEvents.shipmentId, shipmentId),
    with: {
      actor: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: (events, { asc }) => [asc(events.createdAt)],
  });
}
```

### Step 4: Modify Service Functions

Each status-changing function needs to call `createEvent()`:

```typescript
// Example for updateStatus:
async updateStatus(shipmentId: string, userId: string, newStatus: ShipmentStatusType) {
  // ... existing validation ...

  const updated = await shipmentsDal.updateStatus(shipmentId, newStatus);

  // CREATE EVENT
  await shipmentsDal.createEvent({
    shipmentId,
    status: newStatus,
    previousStatus: currentStatus,
    actorId: userId,
    actorRole: isDriver ? "driver" : isAdmin ? "admin" : "buyer",
  });

  return updated;
}
```

### Step 5: Replace buildTimeline

```typescript
// BEFORE
function buildTimeline(currentStatus, createdAt) { ... } // sync, fake

// AFTER
async function buildTimelineFromEvents(shipmentId: string) {
  const events = await shipmentsDal.getEventsByShipmentId(shipmentId);
  
  if (events.length === 0) {
    // Fallback for legacy shipments
    const shipment = await shipmentsDal.getById(shipmentId);
    if (shipment) {
      return buildLegacyTimeline(shipment.status, shipment.createdAt);
    }
    return [];
  }

  return events.map(event => ({
    status: event.status,
    timestamp: event.createdAt,
    description: getStatusLabel(event.status),
    actor: event.actor ? {
      id: event.actor.id,
      name: event.actor.name,
      image: event.actor.image,
      role: event.actorRole,
    } : undefined,
    note: event.note || undefined,
  }));
}
```

---

## Verification Checklist

### API Testing

- [ ] Create shipment → Check `shipment_events` has PENDING entry
- [ ] Accept proposal → Check ASSIGNED event with proposal note
- [ ] Driver picks up → Check PICKED_UP event with driver ID
- [ ] Driver delivers → Check DELIVERED event with photo metadata
- [ ] Cancel shipment → Check CANCELLED event with reason

### Frontend Testing

- [ ] Delivery detail page shows correct timestamps
- [ ] Timeline shows actor names (e.g., "Driver Thomas M.")
- [ ] Notes are displayed when available
- [ ] Legacy shipments still work (fallback)

### Edge Cases

- [ ] Shipment with 0 events → fallback timeline works
- [ ] Actor deleted → actor shows as null, no crash
- [ ] Very long timeline (10+ events) → performance OK

---

## Estimated Time

| Phase | Duration |
|-------|----------|
| Database Schema | 15 min |
| Migration | 5 min |
| DAL Layer | 30 min |
| DTO Layer | 20 min |
| Service Layer | 1.5 hours |
| Testing | 30 min |

**Total:** ~3 hours

---

## Rollback Plan

If issues occur:
1. The `shipment_events` table is additive – no existing data modified
2. `buildTimeline()` has fallback for empty events
3. Can drop `shipment_events` table without affecting core functionality

---

## Future Enhancements

1. **Real-time Updates:** Push new events via Ably WebSocket
2. **Admin Audit Trail:** Show all events in admin dashboard
3. **Analytics:** Track average delivery times, bottlenecks
4. **Backfill Script:** Populate events for existing shipments from logs
