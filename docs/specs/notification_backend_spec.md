# Notification Backend Specification

**Version:** 1.0
**Status:** Draft
**Related UI Spec:** `docs/specs/notification_floating_box_spec.md`

---

## 1. Database Schema

### Table: `notifications`

Stores all user notifications.

| Column          | Type      | Constraints                              | Description                                                        |
| :-------------- | :-------- | :--------------------------------------- | :----------------------------------------------------------------- |
| `id`            | UUID      | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique identifier                                                  |
| `user_id`       | UUID      | NOT NULL, REFERENCES `users(id)`         | Recipient of the notification                                      |
| `type`          | VARCHAR   | NOT NULL                                 | Enum: `bid`, `listing`, `message`, `delivery`, `review`, `payment` |
| `title`         | VARCHAR   | NOT NULL                                 | Short title (e.g., "New Bid")                                      |
| `description`   | TEXT      | NOT NULL                                 | Detailed message                                                   |
| `resource_id`   | UUID      | NULL                                     | ID of related entity (ListingID, ShipmentID, etc.)                 |
| `resource_type` | VARCHAR   | NULL                                     | Type of related entity (e.g., `listing`, `shipment`)               |
| `is_read`       | BOOLEAN   | DEFAULT `false`                          | Read status                                                        |
| `created_at`    | TIMESTAMP | DEFAULT `now()`                          | Creation timestamp                                                 |

**Indexes:**

- `idx_notifications_user_created` ON `(user_id, created_at DESC)`
- `idx_notifications_user_unread` ON `(user_id, is_read)` WHERE `is_read = false`

---

## 2. DTOs (Data Transfer Objects)

### `NotificationResponse` (Output)

```typescript
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["bid", "listing", "message", "delivery", "review", "payment"]),
  title: z.string(),
  description: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(), // ISO string
  resourceId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  // Note: 'icon' and 'action' are handled on the frontend based on 'type'
});
```

### `CreateNotificationInput` (Internal Service Input)

```typescript
export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(["bid", "listing", "message", "delivery", "review", "payment"]),
  title: z.string(),
  description: z.string(),
  resourceId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
});
```

---

## 3. API Endpoints

### 3.1 Get Notifications

**Endpoint:** `GET /api/notifications`
**Auth:** Required

**Query Params:**

- `limit`: number (default 10, max 50)
- `offset`: number (default 0)
- `filter`: "all" | "unread" (default "all")

**Response:**

```json
{
  "data": [
    {
      "id": "...",
      "type": "bid",
      "title": "New Bid",
      "description": "...",
      "isRead": false,
      "createdAt": "2025-12-05T10:00:00Z"
    }
  ],
  "meta": {
    "total": 100,
    "unreadCount": 5
  }
}
```

### 3.2 Get Unread Count

**Endpoint:** `GET /api/notifications/unread-count`
**Auth:** Required

**Response:**

```json
{
  "count": 5
}
```

### 3.3 Mark as Read

**Endpoint:** `PATCH /api/notifications/:id/read`
**Auth:** Required

**Response:**

```json
{
  "success": true
}
```

### 3.4 Mark All as Read

**Endpoint:** `POST /api/notifications/read-all`
**Auth:** Required

**Response:**

```json
{
  "success": true,
  "updatedCount": 5
}
```

---

## 4. Service Layer Logic

### `NotificationsService`

- **`create(data)`**:
  - Validates input using `CreateNotificationSchema`.
  - Inserts into DB via DAL.
  - Triggers Ably event `notification:new` (Fire-and-forget).
- **`getUserNotifications(userId, options)`**:
  - Calls DAL to fetch paginated results.
  - Returns DTOs.
- **`markAsRead(id, userId)`**:
  - Verifies ownership (notification belongs to user).
  - Calls DAL to update `is_read = true`.
- **`markAllAsRead(userId)`**:
  - Calls DAL to update all unread for user.

---

## 5. Integration Notes

- **Frontend Mapping**: The frontend `Notification` type includes `icon` (React Element). The API returns raw data. The frontend must map `type` -> `Icon` component in the UI layer (e.g., in `NotificationItem` component), NOT in the API response.
- **Mock Data**: Once implemented, remove the mock data from `useNotifications.ts` and replace with `useQuery`.
