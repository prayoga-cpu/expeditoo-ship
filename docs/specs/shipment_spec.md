# Shipment API Specification

## Overview

Spesifikasi API untuk modul Shipment & Logistics di EXPEDITOO. Modul ini mengelola proses pengiriman dari pembuatan, tracking, hingga selesai.

---

## Status Lifecycle

```
PENDING → PRICE_PROPOSED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
                                ↘
                              CANCELLED
```

### Status Transitions

| Current Status | Allowed Next Status       | Who Can Change |
| -------------- | ------------------------- | -------------- |
| PENDING        | PRICE_PROPOSED, CANCELLED | System/Admin   |
| PRICE_PROPOSED | ASSIGNED, CANCELLED       | User/Admin     |
| ASSIGNED       | PICKED_UP, CANCELLED      | Driver         |
| PICKED_UP      | IN_TRANSIT, CANCELLED     | Driver         |
| IN_TRANSIT     | DELIVERED                 | Driver         |
| DELIVERED      | -                         | -              |
| CANCELLED      | -                         | -              |

---

## API Endpoints

### 1. GET /api/shipments

**Description:** Get shipments for current user (incoming/outgoing).

**Query Parameters:**
| Param | Type | Required | Description |
|--------|--------|----------|-------------------------------------|
| type | string | No | `incoming` (buyer), `outgoing` (seller) |
| status | string | No | Filter by status |
| limit | number | No | Pagination limit (default: 20) |
| offset | number | No | Pagination offset (default: 0) |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "clx123...",
      "status": "PENDING",
      "originAddress": "Aubagne (13400)",
      "destinationAddress": "Paris (75011)",
      "scheduledDate": "2025-12-10T10:00:00Z",
      "price": 4600,
      "listing": {
        "id": "...",
        "title": "Mixeur, Aspirateur +1 objet",
        "image": "https://..."
      },
      "driver": null,
      "createdAt": "2025-12-05T05:00:00Z"
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 20,
    "offset": 0
  }
}
```

**Authorization:** Authenticated user only. Returns only shipments where user is buyer or seller.

---

### 2. GET /api/shipments/:id

**Description:** Get single shipment detail with timeline.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "status": "PICKED_UP",
    "originLat": 43.2965,
    "originLng": 5.3698,
    "originAddress": "Aubagne (13400)",
    "destinationLat": 48.8566,
    "destinationLng": 2.3522,
    "destinationAddress": "Paris (75011)",
    "packageWeight": 5.5,
    "packageDimensions": "50x40x30",
    "packageDescription": "Mixeur, Aspirateur +1 objet",
    "scheduledDate": "2025-12-10T10:00:00Z",
    "price": 4600,
    "listing": {
      "id": "...",
      "title": "Mixeur, Aspirateur +1 objet",
      "images": ["https://..."]
    },
    "user": {
      "id": "...",
      "name": "Jean Dupont",
      "image": "https://..."
    },
    "driver": {
      "id": "...",
      "name": "Thomas Martin",
      "image": "https://...",
      "phone": "+33 6 12 34 56 78"
    },
    "timeline": [
      {
        "status": "PENDING",
        "timestamp": "2025-12-05T05:00:00Z",
        "description": "Shipment created"
      },
      {
        "status": "PRICE_PROPOSED",
        "timestamp": "2025-12-05T06:00:00Z",
        "description": "Price proposed: €46"
      },
      {
        "status": "ASSIGNED",
        "timestamp": "2025-12-05T07:00:00Z",
        "description": "Driver Thomas M. assigned"
      },
      {
        "status": "PICKED_UP",
        "timestamp": "2025-12-10T10:30:00Z",
        "description": "Package picked up"
      }
    ],
    "createdAt": "2025-12-05T05:00:00Z",
    "updatedAt": "2025-12-10T10:30:00Z"
  }
}
```

**Error (404):**

```json
{
  "success": false,
  "error": "Shipment not found"
}
```

**Authorization:** Only shipment owner (buyer/seller) or assigned driver can view.

---

### 3. POST /api/shipments

**Description:** Create a new shipment (usually auto-created after auction win or purchase).

**Request Body:**

```json
{
  "listingId": "clx123...",
  "originLat": 43.2965,
  "originLng": 5.3698,
  "originAddress": "10 Rue Example, Aubagne (13400)",
  "destinationLat": 48.8566,
  "destinationLng": 2.3522,
  "destinationAddress": "25 Rue Paris, Paris (75011)",
  "packageWeight": 5.5,
  "packageDimensions": "50x40x30",
  "packageDescription": "Mixeur, Aspirateur +1 objet",
  "scheduledDate": "2025-12-10T10:00:00Z"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "status": "PENDING",
    ...
  }
}
```

**Validation:**

- `originAddress` and `destinationAddress` are required
- `originLat`, `originLng`, `destinationLat`, `destinationLng` must be valid coordinates
- `listingId` must reference existing listing (optional)

**Authorization:** Authenticated user only.

---

### 4. PATCH /api/shipments/:id/status

**Description:** Update shipment status (for drivers and admin).

**Request Body:**

```json
{
  "status": "PICKED_UP",
  "note": "Package collected from sender"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "status": "PICKED_UP",
    ...
  }
}
```

**Error (400):**

```json
{
  "success": false,
  "error": "Invalid status transition: PENDING → DELIVERED"
}
```

**Authorization:**

- Driver can update: PICKED_UP, IN_TRANSIT, DELIVERED
- Admin can update: any status

---

### 5. PATCH /api/shipments/:id/assign

**Description:** Assign a driver to shipment (admin only or accept proposal).

**Request Body:**

```json
{
  "driverId": "clx456...",
  "price": 4600
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "status": "ASSIGNED",
    "driverId": "clx456...",
    ...
  }
}
```

**Authorization:** Admin or system only.

---

### 6. POST /api/shipments/:id/cancel

**Description:** Cancel a shipment (before pickup only).

**Request Body:**

```json
{
  "reason": "Buyer requested cancellation"
}
```

**Note:** The `reason` field is mandatory and must be between 5 and 500 characters.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "status": "CANCELLED",
    ...
  }
}
```

**Error (400):**

```json
{
  "success": false,
  "error": "Cannot cancel shipment: already picked up"
}
```

**Authorization:** Owner or Admin. Cannot cancel if status is PICKED_UP, IN_TRANSIT, or DELIVERED.

---

## Data Types

### ShipmentStatus Enum

```typescript
type ShipmentStatus =
  | "PENDING"
  | "PRICE_PROPOSED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";
```

### Shipment Object

```typescript
interface Shipment {
  id: string;
  userId: string;
  listingId: string | null;
  driverId: string | null;
  status: ShipmentStatus;
  originLat: number;
  originLng: number;
  originAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress: string;
  packageWeight: number | null;
  packageDimensions: string | null;
  packageDescription: string | null;
  scheduledDate: Date | null;
  price: number | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Error Codes

| HTTP Code | Error Type                | Description                  |
| --------- | ------------------------- | ---------------------------- |
| 400       | VALIDATION_ERROR          | Invalid request body         |
| 400       | INVALID_STATUS_TRANSITION | Status cannot transition     |
| 401       | UNAUTHORIZED              | Not authenticated            |
| 403       | FORBIDDEN                 | Not allowed to access/modify |
| 404       | NOT_FOUND                 | Shipment not found           |
| 500       | INTERNAL_ERROR            | Server error                 |

---

## Notes

1. **Price is in cents** - €46.00 is stored as 4600
2. **Timeline** is computed from shipment history/events (future enhancement)
3. **Notifications** should be sent on status changes (future enhancement)
4. **Real-time updates** via WebSocket (future enhancement)
