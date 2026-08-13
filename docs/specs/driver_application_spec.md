# Driver Application Specification

## Overview

Spesifikasi untuk proses pendaftaran dan persetujuan driver. User biasa dapat mengajukan diri menjadi driver, dan admin dapat menyetujui atau menolak aplikasi tersebut.

---

## 1. POST /api/driver/apply

**Description:** User mengajukan permohonan untuk menjadi driver.

**Request Body:**

```json
{
  "vehicleType": "van",
  "vehiclePlate": "B 1234 CD",
  "licenseNumber": "SIM-12345678",
  "experienceYears": 2,
  "documents": {
    "idCard": "url_to_ktp",
    "license": "url_to_sim",
    "vehicleRegistration": "url_to_stnk"
  }
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "app_123",
    "userId": "user_abc",
    "status": "pending",
    "vehicleType": "van",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

**Validation:**

- User harus login.
- User belum memiliki aplikasi yang `pending`.
- Data kendaraan dan dokumen wajib diisi.

---

## 2. GET /api/driver/apply

**Description:** Mendapatkan status aplikasi driver user saat ini.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "app_123",
    "status": "pending", // pending, approved, rejected
    "rejectionReason": null,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

**Response (404):** Jika user belum pernah mengajukan aplikasi.

---

## 3. GET /api/admin/driver-applications

**Description:** Admin melihat daftar semua aplikasi driver.

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "app_123",
      "user": {
        "id": "user_abc",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "status": "pending",
      "vehicleType": "van",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Authorization:** Admin only.

---

## 4. PATCH /api/admin/driver-applications/:id

**Description:** Admin menyetujui atau menolak aplikasi driver.

**Request Body:**

```json
{
  "status": "approved", // or "rejected"
  "rejectionReason": "Dokumen SIM tidak jelas" // Required if rejected
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "app_123",
    "status": "approved",
    "updatedAt": "2025-01-02T00:00:00Z"
  }
}
```

**Side Effects:**

- Jika `approved`: User otomatis mendapatkan role `transporter`.
- Jika `rejected`: Status aplikasi berubah jadi rejected, user bisa apply lagi (tergantung kebijakan, saat ini implementasi membolehkan re-apply atau edit).

**Authorization:** Admin only.

---

## 5. Data Types

### DriverApplicationStatus

`"pending" | "approved" | "rejected"`

### CreateDriverApplicationInput

Schema Zod: `createDriverApplicationSchema`

### UpdateDriverApplicationStatusInput

Schema Zod: `updateDriverApplicationStatusSchema`
