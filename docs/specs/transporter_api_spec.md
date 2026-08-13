# Transporter Proposal API Specification

## Overview

API untuk driver/transporter mengajukan proposal harga dan user menerima proposal. Mengikuti spesifikasi dari `docs/api.md` Section 6.

---

## 1. POST /api/shipments/:id/proposals

**Description:** Driver mengajukan proposal harga untuk shipment.

**Request Body:**

```json
{
  "price": 50000,
  "estimatedPickup": "2025-12-10T10:00:00Z",
  "estimatedDelivery": "2025-12-11T14:00:00Z",
  "message": "Saya bisa pickup hari ini"
}
```

| Field             | Type   | Required | Description                    |
| ----------------- | ------ | -------- | ------------------------------ |
| price             | number | Yes      | Harga dalam cents (€50 = 5000) |
| estimatedPickup   | date   | No       | Estimasi waktu pickup          |
| estimatedDelivery | date   | No       | Estimasi waktu pengiriman      |
| message           | string | No       | Pesan dari driver (max 500)    |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "prop_abc123",
    "shipmentId": "ship_xyz",
    "driverId": "user_driver",
    "price": 50000,
    "estimatedPickup": "2025-12-10T10:00:00Z",
    "estimatedDelivery": "2025-12-11T14:00:00Z",
    "message": "Saya bisa pickup hari ini",
    "status": "pending",
    "createdAt": "2025-12-05T08:00:00Z"
  }
}
```

**Error (409) - Already Submitted:**

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "You have already submitted a proposal for this shipment"
  }
}
```

**Authorization:** Authenticated driver only.

**Business Rules:**

- Hanya bisa submit untuk shipment dengan status PENDING
- Satu driver hanya bisa submit satu proposal per shipment
- Price harus positive integer (dalam cents)

---

## 2. GET /api/shipments/:id/proposals

**Description:** Mendapatkan daftar proposal untuk shipment.

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "prop_abc123",
      "shipmentId": "ship_xyz",
      "driverId": "user_driver",
      "price": 50000,
      "estimatedPickup": "2025-12-10T10:00:00Z",
      "estimatedDelivery": "2025-12-11T14:00:00Z",
      "message": "Saya bisa pickup hari ini",
      "status": "pending",
      "createdAt": "2025-12-05T08:00:00Z",
      "driver": {
        "id": "user_driver",
        "name": "Thomas Martin",
        "image": "https://..."
      }
    }
  ]
}
```

**Authorization:** Hanya shipment owner (buyer/seller) yang bisa melihat.

---

## 3. POST /api/shipments/:id/proposals/:proposalId/accept

**Description:** User menerima proposal dari driver.

**Request Body:** Empty

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "ship_xyz",
    "status": "ASSIGNED",
    "driverId": "user_driver",
    "price": 50000,
    ...
  }
}
```

**Side Effects:**

- Proposal yang diterima: status → "accepted"
- Proposal lain di shipment: status → "rejected"
- Shipment: status → "ASSIGNED", driverId di-set

**Authorization:** Hanya shipment owner.

---

## 4. POST /api/shipments/:id/proof-of-delivery

**Description:** Upload bukti pengiriman (foto).

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|--------------|------|----------|------------------------------------|
| file | File | Yes | Image file (JPEG, PNG, WebP) |
| markDelivered| text | No | "true"/"false" (default: true) |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "ship_xyz",
    "status": "DELIVERED",
    "proofOfDeliveryUrl": "https://cdn.example.com/pod/abc123.webp",
    "deliveredAt": "2025-12-11T14:30:00Z"
  }
}
```

**Authorization:** Hanya assigned driver.

**Business Rules:**

- Hanya bisa upload jika status PICKED_UP, IN_TRANSIT, atau DELIVERED
- Gambar dikompresi ke WebP
- Max file size: 10MB
- Jika markDelivered=true, status otomatis jadi DELIVERED

---

## Proposal Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User creates shipment                                     │
│    Status: PENDING                                           │
├─────────────────────────────────────────────────────────────┤
│ 2. Drivers submit proposals                                  │
│    POST /api/shipments/:id/proposals                         │
├─────────────────────────────────────────────────────────────┤
│ 3. User views proposals                                      │
│    GET /api/shipments/:id/proposals                          │
├─────────────────────────────────────────────────────────────┤
│ 4. User accepts one proposal                                 │
│    POST /api/shipments/:id/proposals/:proposalId/accept      │
│    → Shipment status: ASSIGNED                               │
│    → Driver assigned                                         │
├─────────────────────────────────────────────────────────────┤
│ 5. Driver updates status                                     │
│    PATCH /api/shipments/:id/status                           │
│    ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED             │
├─────────────────────────────────────────────────────────────┤
│ 6. Driver uploads proof of delivery                          │
│    POST /api/shipments/:id/proof-of-delivery                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Codes

| HTTP Code | Error Code       | Description                          |
| --------- | ---------------- | ------------------------------------ |
| 400       | VALIDATION_ERROR | Invalid request body                 |
| 400       | INVALID_STATUS   | Cannot perform action at this status |
| 401       | UNAUTHORIZED     | Not authenticated                    |
| 403       | FORBIDDEN        | Not authorized to access             |
| 404       | NOT_FOUND        | Shipment/Proposal not found          |
| 409       | ALREADY_EXISTS   | Driver already submitted proposal    |
| 500       | INTERNAL_ERROR   | Server error                         |
