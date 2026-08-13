# Shipment Events Specification

## Overview

Spesifikasi untuk sistem **Shipment Event History** yang menyimpan riwayat perubahan status pengiriman secara real-time. Sistem ini menggantikan timeline "mock" yang saat ini di-generate dengan timestamp palsu.

---

## Problem Statement

### Current State (❌ Flawed)

Saat ini, fungsi `buildTimeline()` di `shipment.service.ts` menggunakan logika palsu:

```typescript
// For simplicity, use createdAt for first, and approximate dates for others
// Real implementation should use actual event timestamps from DB
const timestamp = new Date(createdAt);
timestamp.setHours(timestamp.getHours() + i); // Add 1 hour per status as placeholder
```

**Masalah:**
1. Timestamp tidak akurat – semua status "diasumsikan" terjadi 1 jam setelah status sebelumnya
2. Tidak ada riwayat siapa yang mengubah status
3. Tidak ada catatan/notes untuk setiap perubahan
4. Tidak bisa melacak waktu sebenarnya untuk analytics

### Target State (✅ Goal)

Timeline dengan data REAL dari database, termasuk:
- Waktu perubahan status yang akurat
- Siapa yang melakukan perubahan (actor)
- Catatan opsional (notes/reason)
- Metadata tambahan (lokasi GPS, foto, dll)

---

## Database Schema

### Table: `shipment_events`

```sql
CREATE TABLE shipment_events (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- Status at this event
  previous_status TEXT, -- Status before this event
  actor_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL, -- 'system', 'driver', 'buyer', 'seller', 'admin'
  note TEXT, -- Optional note/reason
  metadata JSONB, -- Extra data (GPS coords, photo URL, etc)
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX shipment_events_shipment_idx ON shipment_events(shipment_id);
CREATE INDEX shipment_events_status_idx ON shipment_events(status);
```

### Drizzle Schema

**File:** `src/db/schema/shipments.ts` (extend existing)

```typescript
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
    metadata: jsonb("metadata"), // { lat, lng, photoUrl, etc }
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("shipment_events_shipment_idx").on(table.shipmentId),
    index("shipment_events_status_idx").on(table.status),
  ]
);
```

---

## Data Types

### ShipmentEvent Object

```typescript
interface ShipmentEvent {
  id: string;
  shipmentId: string;
  status: ShipmentStatusType;
  previousStatus: ShipmentStatusType | null;
  actorId: string | null;
  actorRole: "system" | "driver" | "buyer" | "seller" | "admin";
  note: string | null;
  metadata: {
    lat?: number;
    lng?: number;
    photoUrl?: string;
    [key: string]: unknown;
  } | null;
  createdAt: Date;
}
```

### TimelineItem (API Response)

```typescript
interface TimelineItem {
  status: ShipmentStatusType;
  timestamp: string; // ISO 8601
  description: string; // Human-readable description
  actor?: {
    id: string;
    name: string;
    image: string | null;
    role: string;
  };
  note?: string;
  metadata?: Record<string, unknown>;
}
```

---

## API Behavior

### GET /api/shipments/:id

Response `timeline` field akan berisi data REAL:

```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "status": "IN_TRANSIT",
    ...
    "timeline": [
      {
        "status": "PENDING",
        "timestamp": "2025-12-05T05:12:34Z",
        "description": "Shipment created",
        "actor": {
          "id": "user_abc",
          "name": "Jean Dupont",
          "role": "buyer"
        }
      },
      {
        "status": "ASSIGNED",
        "timestamp": "2025-12-05T14:30:00Z",
        "description": "Driver Thomas M. assigned",
        "actor": {
          "id": "admin_xyz",
          "name": "Admin",
          "role": "admin"
        },
        "note": "Proposal #5 accepted"
      },
      {
        "status": "PICKED_UP",
        "timestamp": "2025-12-10T10:45:22Z",
        "description": "Package picked up",
        "actor": {
          "id": "driver_123",
          "name": "Thomas Martin",
          "role": "driver"
        },
        "metadata": {
          "lat": 43.2965,
          "lng": 5.3698,
          "photoUrl": "https://..."
        }
      },
      {
        "status": "IN_TRANSIT",
        "timestamp": "2025-12-10T11:00:00Z",
        "description": "En route to destination",
        "actor": {
          "id": "driver_123",
          "name": "Thomas Martin",
          "role": "driver"
        }
      }
    ]
  }
}
```

---

## Event Triggers

Events MUST be created when:

| Trigger | Status | Actor Role | Note |
|---------|--------|------------|------|
| Shipment created | `PENDING` | `system` or `buyer` | Auto-generated |
| Proposal accepted | `ASSIGNED` | `buyer` or `seller` or `admin` | Include proposal ID |
| Driver picks up | `PICKED_UP` | `driver` | Optional GPS + photo |
| Driver starts transit | `IN_TRANSIT` | `driver` | Optional GPS |
| Driver delivers | `DELIVERED` | `driver` | Required: proof of delivery photo |
| Any party cancels | `CANCELLED` | `buyer` / `seller` / `admin` | Required: reason |

---

## Service Layer Changes

### File: `src/server/services/shipment.service.ts`

**New Function:**

```typescript
async createEvent(data: {
  shipmentId: string;
  status: ShipmentStatusType;
  previousStatus?: ShipmentStatusType;
  actorId?: string;
  actorRole: "system" | "driver" | "buyer" | "seller" | "admin";
  note?: string;
  metadata?: Record<string, unknown>;
}): Promise<ShipmentEvent>
```

**Modified Functions:**

All status-changing functions MUST call `createEvent()`:

1. `createShipment()` → create PENDING event
2. `updateStatus()` → create event for new status
3. `assignDriver()` → create ASSIGNED event
4. `cancelShipment()` → create CANCELLED event with reason
5. `acceptProposal()` → create ASSIGNED event with proposal info
6. `uploadProofOfDelivery()` → create DELIVERED event with photo URL

---

## DAL Layer Changes

### File: `src/server/dal/shipments.dal.ts`

**New Functions:**

```typescript
// Create new event
async createEvent(data: InsertShipmentEvent): Promise<ShipmentEvent>

// Get all events for a shipment (ordered by createdAt ASC)
async getEventsByShipmentId(shipmentId: string): Promise<ShipmentEvent[]>
```

---

## Timeline Builder (Revised)

### File: `src/server/services/shipment.service.ts`

Current `buildTimeline()` function will be replaced:

```typescript
// BEFORE (mock):
function buildTimeline(currentStatus: ShipmentStatusType, createdAt: Date) {
  // ... fake timestamp logic
}

// AFTER (real):
async function buildTimeline(shipmentId: string): Promise<TimelineItem[]> {
  const events = await shipmentsDal.getEventsByShipmentId(shipmentId);
  
  return events.map(event => ({
    status: event.status,
    timestamp: event.createdAt.toISOString(),
    description: getStatusDescription(event.status, event.actor, event.note),
    actor: event.actor ? {
      id: event.actor.id,
      name: event.actor.name,
      image: event.actor.image,
      role: event.actorRole,
    } : undefined,
    note: event.note || undefined,
    metadata: event.metadata || undefined,
  }));
}
```

---

## Edge Cases

### 1. No Events Yet (Backward Compatibility)
For existing shipments without events, fallback to current mock logic until events are populated.

```typescript
if (events.length === 0) {
  // Fallback to mock timeline for legacy shipments
  return buildMockTimeline(shipment.status, shipment.createdAt);
}
```

### 2. System-Initiated Events
When status changes happen automatically (e.g., cron job closes expired auctions), use `actorRole: "system"` with `actorId: null`.

### 3. Event Ordering
Events MUST always be returned in chronological order (`ORDER BY created_at ASC`).

---

## Migration Strategy

1. **Create Table:** Run migration to add `shipment_events` table
2. **Backfill Events:** Optional script to create events for existing shipments:
   - Create single event with current status and `createdAt` timestamp
   - Mark as `actorRole: "system"` with note "Backfilled from existing data"
3. **Deploy Code:** Update service layer to create events on status changes
4. **Verify:** Check that new shipments have proper event history

---

## Validation Rules

1. `status` must be valid ShipmentStatusType
2. `actorRole` must be one of: `system`, `driver`, `buyer`, `seller`, `admin`
3. `note` is required when status is `CANCELLED`
4. `metadata.photoUrl` is required when status is `DELIVERED`

---

## Success Criteria

1. ✅ Timeline shows REAL timestamps from database
2. ✅ Each event shows who made the change
3. ✅ Driver pickup/delivery events include GPS coordinates
4. ✅ Cancellation events include reason
5. ✅ Legacy shipments still display (with fallback)
6. ✅ Performance: Timeline query < 50ms for typical shipment

---

## Notes

1. **Price is in cents** – Consistent with existing convention
2. **Timezone:** All timestamps stored in UTC
3. **Future:** Consider WebSocket push for real-time timeline updates
4. **Future:** Add `shipment_events` to admin dashboard for audit trail
