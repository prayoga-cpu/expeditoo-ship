# Admin User & Driver Management Specification

This specification defines the behavior, API structure, and UI flows for managing users and drivers within the Admin Dashboard.

## 1. Overview

Admins need the ability to:

- View lists of users and drivers.
- Manage user roles (specifically "Assign" and "Remove" driver status).
- Moderate users (Suspend/Activate).
- All actions must be auditable and strictly controlled.

## 2. User Roles

The system recognizes the following high-level role groups for the Admin UI:

| Role Groups | Database Roles | Description                            |
| :---------- | :------------- | :------------------------------------- |
| **User**    | `buyer`        | Standard platform user. Can buy items. |
| **Driver**  | `transporter`  | Verified driver. Can accept shipments. |
| **Admin**   | `admin`        | System administrator. Full access.     |

_Note: The database supports other roles (seller, auctioneer, operator), but for current Admin UI simplification, we group them or focus on these three primary buckets._

## 3. UI Requirements

### 3.1 Drivers Management Page (`/admin/drivers`)

**Display Logic:**

- Show only users who currently have the `transporter` (driver) role.
- Exclude regular users.

**Actions:**

- **Remove as Driver:**
  - **Action:** Changes user role from `transporter` back to `buyer`.
  - **Confirmation:** Must prompt "Are you sure you want to remove driver access?".
  - **Feedback:** Toast notification on success.
  - **Result:** User is immediately removed from the Drivers list.

### 3.2 User Management Page (`/admin/users`)

**Display Logic:**

- Show **ALL** registered users (paginated).
- Show their current primary role badge.
- Show status (Active, Suspended, Inactive).

**Actions:**

- **Suspend User:** Sets status to `suspended` (banned).
- **Activate User:** Sets status to `active` (unbanned).

## 4. API Specification

### 4.1 Update User Role

**Endpoint:** `POST /api/user/roles`

**Access:** Admin Only

**Request Body:**

```json
{
  "userId": "string (any format)",
  "role": "buyer" | "transporter" | "admin" | "seller" | "auctioneer" | "operator",
  "replace": boolean // Optional. If true, removes all existing roles and sets this one.
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "User role updated to 'buyer' successfully"
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Not logged in.
- `403 Forbidden`: Not an admin.
- `400 Bad Request`: Invalid role or user ID.

### 4.2 Update User Status (Moderation)

**Endpoint:** `POST /api/admin/users/:id/status`

**Access:** Admin Only

**Request Body:**

```json
{
  "banned": boolean
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "User status updated successfully"
}
```

## 5. Database Operations (DAL)

### 5.1 `replaceUserRole(userId, role, assignedBy)`

- **Behavior:**
  1. Starts a transaction.
  2. DELETES all entries in `user_roles` for the given `userId`.
  3. INSERTS the new `role`.
  4. Returns the new role record.
- **Safety:** Prevents duplicate primary roles and ensures atomic switching.

## 6. Validation Rules

- **User ID:** Must be a non-empty string (supports UUID, NanoID, Cuid, etc).
- **Roles:** Must match the defined enum list.
- **Self-Modification:** Admin SHOULD NOT be able to remove their own Admin role (logic to be enforced in frontend/service).
