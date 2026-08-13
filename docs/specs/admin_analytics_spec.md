# Specification: Admin Analytics & Moderation

## 1. Goal

Provide real-time visibility into platform performance and allow admins to manage user access.

---

## 2. Standard Response Format (from docs/api.md)

All responses MUST follow this format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  }
}
```

---

## 3. API Specifications

### 3.1 Get Dashboard Stats

**Endpoint:** `GET /api/admin/stats`  
**Access:** Admin Only (check session.user has 'admin' role)

**Success Response:**

```typescript
{
  success: true,
  data: {
    kpi: {
      totalRevenue: {
        value: number;           // GMV in cents (sum of sold listings)
        changePercentage: number; // vs last month
      };
      activeUsers: {
        value: number;
        changePercentage: number;
      };
      activeDrivers: {
        value: number;
        changePercentage: number;
      };
      pendingDeliveries: {
        value: number;
        changePercentage: number;
      };
    };
    charts: {
      revenue: Array<{
        name: string;   // Month name (e.g., "Jan")
        total: number;  // GMV for that month
      }>;
    };
  }
}
```

**Error Cases:**

- 401 Unauthorized: Not logged in
- 403 Forbidden: User is not admin

---

### 3.2 Get Recent Activity

**Endpoint:** `GET /api/admin/activity`  
**Access:** Admin Only

**Logic:**

1. Fetch last 5 created `listings` → action "listed a new item"
2. Fetch last 5 created `users` → action "joined the platform"
3. Fetch last 5 `shipments` with status 'DELIVERED' → action "completed delivery"
4. Merge all lists, sort by time desc, take top 10.

**Success Response:**

```typescript
{
  success: true,
  data: Array<{
    id: string;      // Source ID
    user: string;    // User name
    action: string;  // Description (e.g., "listed a new item")
    target: string;  // Target name (Item title, etc.)
    time: string;    // ISO Date string
    avatar: string;  // User initials (e.g., "AJ")
  }>
}
```

---

### 3.3 Update User Status (Ban/Unban)

**Endpoint:** `PATCH /api/admin/users/[id]/status`  
**Access:** Admin Only

**Request Body:**

```typescript
{
  "banned": boolean  // true = ban, false = unban
}
```

**Success Response:**

```typescript
{
  success: true,
  data: {
    id: string;
    name: string;
    email: string;
    banned: boolean;
    updatedAt: string;
  },
  message: "User status updated"
}
```

**Error Cases:**

- 400 Bad Request: Invalid body
- 401 Unauthorized: Not logged in
- 403 Forbidden: User is not admin
- 404 Not Found: User ID doesn't exist

---

## 4. Database Aggregation Logic

### 4.1 Revenue (GMV)

- **Source:** `listings` table
- **Filter:** `status = 'sold'`
- **Sum:** `currentPrice` (or `buyNowPrice` if applicable)
- **Group By:** Month of `updatedAt` (when item was sold)

### 4.2 Active Users Count

- **Source:** `user_roles` table
- **Filter:** role = 'buyer' OR role = 'seller' OR role = 'auctioneer'
- **Count:** Distinct user IDs

### 4.3 Active Drivers Count

- **Source:** `user_roles` table
- **Filter:** role = 'transporter'
- **Count:** Distinct user IDs

### 4.4 Pending Deliveries

- **Source:** `shipments` table
- **Filter:** `status` NOT IN ('DELIVERED', 'CANCELLED')
- **Count:** All matching rows

---

## 5. Edge Cases

- **No Data:** Return 0 values and empty arrays. Never crash.
- **Deleted Users:** Activity log should handle null users gracefully (display "Unknown User").
- **Date Ranges:** Charts should show at least last 6 months, even if values are 0.
- **Self-Ban:** Admin cannot ban themselves (return 400 error).

---

## 6. Security Requirements

- All `/api/admin/*` routes MUST validate session and check for 'admin' role.
- Return `{ success: false, error: { code: "FORBIDDEN", message: "Admin access required" } }` if not admin.
- Consider rate limiting on status update endpoint to prevent abuse.
