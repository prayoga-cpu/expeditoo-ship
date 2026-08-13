# Plan: Admin Dashboard Implementation

## 1. Overview

**Feature:** Admin Dashboard Real-Time Data & Moderation
**Goal:** Replace hardcoded mock data in Admin Dashboard with real database aggregations and implement functional user moderation actions (suspend/activate).
**Status:** Planned

---

## 2. Requirements

### 2.1 Dashboard Analytics (Read-Only)

- **KPI Cards:**
  - Total Revenue (Sum of completed shipments/auctions * platform fee). *Note: Since we don't have real payments yet, we will sum 'sold' listing prices or shipment costs as 'Gross Merchandise Value' (GMV).\*
  - Active Users (Count of users with role='user').
  - Active Drivers (Count of users with role='driver').
  - Pending Deliveries (Count of shipments with status != 'delivered').
- **Charts:**
  - Revenue/GMV History (Area Chart): Group filtered data by month.
  - Recent Activity: Latest 5 events (New User, New Listing, New Bid, Delivery Completed).

### 2.2 User Management (Write)

- **Suspend User:** API to update user status to `banned` field.
- **Activate User:** API to update user status (unban).

---

## 3. Rules Compliance (from docs/rules.md & docs/api.md)

### 3.1 Response Format (MANDATORY)

All API responses MUST follow standard format:

```json
// Success
{ "success": true, "data": { ... }, "message": "..." }

// Error
{ "success": false, "error": { "code": "...", "message": "...", "details": {...} } }
```

### 3.2 Layer Architecture (MANDATORY)

```
UI → Hooks → Client API → REST API → Service → DAL → DB
```

- API routes MUST NOT call DAL directly.
- Services contain ALL business logic.
- DAL contains ONLY database queries.

### 3.3 DTO Layer (MANDATORY)

All request/response schemas MUST be defined in `src/server/dto/` using Zod.

### 3.4 OpenAPI Registration (MANDATORY)

Each new API endpoint MUST be registered in OpenAPI registry (if registry exists).

### 3.5 TanStack Query (MANDATORY for Frontend)

All GET requests in frontend MUST use TanStack Query (`useQuery`).

---

## 4. Implementation Steps

### Step 1: Create DTO Schemas

- **File:** `src/server/dto/admin.dto.ts`
  - `DashboardStatsResponseSchema` - KPI & chart data shape
  - `ActivityItemSchema` - Single activity item
  - `ActivityResponseSchema` - Array of activity items
  - `UpdateUserStatusInputSchema` - Request body for status update
  - `UpdateUserStatusResponseSchema` - Response for status update

### Step 2: Create DAL (Data Access Layer)

- **File:** `src/server/dal/admin.dal.ts`
  - `getActiveUsersCount()` → Count users
  - `getActiveDriversCount()` → Count drivers
  - `getPendingDeliveriesCount()` → Count shipments not delivered
  - `getSoldListingsGMV()` → Sum of sold listings prices
  - `getMonthlyGMV()` → Grouped by month
  - `getRecentUsers()` → Last 5 users
  - `getRecentListings()` → Last 5 listings
  - `getRecentDeliveries()` → Last 5 delivered shipments

### Step 3: Create Service Layer

- **File:** `src/server/services/admin.service.ts`
  - `getDashboardStats()` → Calls DAL, formats for response
  - `getRecentActivity()` → Merges, sorts, formats activity
  - `updateUserStatus(userId, status)` → Validates & updates

### Step 4: Create API Routes

- **File:** `src/app/api/admin/stats/route.ts`
  - `GET`: Auth check (admin only) → Call service → Return standard response
- **File:** `src/app/api/admin/activity/route.ts`
  - `GET`: Auth check → Call service → Return standard response
- **File:** `src/app/api/admin/users/[id]/status/route.ts`
  - `PATCH`: Auth check → Validate body with DTO → Call service → Return standard response

### Step 5: Create Frontend Hooks

- **File:** `src/features/app/admin/hooks/useAdminAnalytics.ts`
  - `useAdminStats()` → `useQuery` to fetch `/api/admin/stats`
  - `useAdminActivity()` → `useQuery` to fetch `/api/admin/activity`
- **File:** `src/features/app/admin/hooks/useUserModeration.ts`
  - `useUpdateUserStatus()` → `useMutation` to PATCH status

### Step 6: Update UI Components

- **File:** `src/features/app/admin/ui/Dashboard.tsx`
  - Replace hardcoded `data` array with `useAdminStats()` hook data
  - Replace `recentActivity` with `useAdminActivity()` hook data
  - Add loading/error states
- **File:** `src/features/app/admin/ui/UsersTable.tsx`
  - Connect "Suspend" button to `useUpdateUserStatus` mutation
  - Add confirmation dialog before suspend

### Step 7: Update Documentation

- **File:** `docs/api.md`
  - Add Section "9. Admin" with new endpoint documentation

---

## 5. Work Checklist

### Backend

- [x] Create `src/server/dto/admin.dto.ts`
- [x] Create `src/server/dal/admin.dal.ts`
- [x] Create `src/server/services/admin.service.ts`
- [x] Create `src/app/api/admin/stats/route.ts`
- [x] Create `src/app/api/admin/activity/route.ts`
- [x] Create `src/app/api/admin/users/[id]/status/route.ts`

### Frontend

- [x] Create `src/features/app/admin/hooks/useAdminAnalytics.ts`
- [x] Create `src/features/app/admin/hooks/useUserModeration.ts`
- [x] Update `src/features/app/admin/ui/Dashboard.tsx`
- [x] Update `src/features/app/admin/ui/UsersTable.tsx`

### Documentation

- [x] Update `docs/api.md` with Admin section

---

## 6. Dependencies

- ✅ `shipments`, `listings`, `users` tables (Already exist)
- ✅ `better-auth` for permission checking (Already exists)
- ✅ TanStack Query (Already configured)

---

## 7. Database Changes Required

- **Add `banned` column to `user` table:**

  ```sql
  ALTER TABLE "user" ADD COLUMN "banned" BOOLEAN DEFAULT FALSE NOT NULL;
  ```

  - Or use existing mechanism if present.

---

## 8. Security Considerations

- All `/api/admin/*` routes MUST check for `admin` role in session.
- Return 403 Forbidden if user lacks admin role.
- Log all moderation actions for audit trail (future).
