# Driver Assignment Flow - Implementation Plan

## Overview

This plan outlines the implementation of a driver assignment feature where admin users can assign available drivers to pending deliveries/shipments that are waiting to be delivered.

## Background Context

**Current State:**

- ✅ Admin dashboard exists with driver management
- ✅ Delivery types defined with statuses: pending, accepted, picked_up, in_transit, delivered, cancelled
- ✅ Driver types defined with status: active, inactive, suspended
- ✅ Mock delivery data exists in deliveries feature
- ❌ No admin view of pending deliveries
- ❌ No driver assignment functionality
- ❌ No "Deliveries" tab in admin dashboard

**User Requirements:**

- Admin needs to see all deliveries/shipments that are waiting for driver assignment
- Admin needs to assign an available driver to a pending delivery
- System should only show active drivers for assignment
- After assignment, delivery status should change appropriately

## Proposed Changes

### 1. Admin Deliveries Tab

#### [MODIFY] [Admin.tsx](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/admin/ui/Admin.tsx)

**Changes:**

- Add "Deliveries" tab to tabs array (position: 3rd, after "Drivers")
- Create deliveries table section showing pending deliveries
- Table columns:
  - Delivery ID
  - Title/Item
  - Origin → Destination
  - Status
  - Price
  - Created Date
  - Actions (Assign Driver button)

**Rationale:**

- Centralized view for admin to manage all pending deliveries
- Follows existing admin UI patterns
- Easy to scan and identify deliveries needing assignment

---

### 2. Pending Deliveries Hook

#### [NEW] [usePendingDeliveries.ts](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/admin/hooks/usePendingDeliveries.ts)

**Changes:**

- Create hook to manage pending deliveries
- Filter deliveries by status === "pending"
- Provide search functionality
- Mock data for Phase 1

**Mock Data Structure:**

```typescript
interface PendingDelivery {
  id: string;
  title: string;
  origin: string;
  destination: string;
  status: DeliveryStatus;
  price: number;
  createdDate: string;
  assignedDriver?: string; // driver ID if assigned
}
```

**Rationale:**

- Separates business logic from UI
- Reusable hook pattern
- Easy to replace with API calls later

---

### 3. Driver Assignment Dialog

#### [NEW] [AssignDriverDialog.tsx](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/admin/ui/AssignDriverDialog.tsx)

**Changes:**

- Create modal dialog for driver assignment
- Show delivery details (title, origin, destination, price)
- List available active drivers
- Driver selection with radio buttons or dropdown
- Confirm assignment button
- Cancel button

**Driver Display:**

- Avatar
- Name
- Rating
- Vehicle type
- Current active deliveries count

**Rationale:**

- Clear confirmation step before assignment
- Shows relevant driver information for decision making
- Prevents accidental assignments

---

### 4. Assignment Flow Logic

**Flow:**

```
1. Admin clicks "Assign Driver" on pending delivery
2. Dialog opens showing delivery details
3. Dialog lists all active drivers
4. Admin selects a driver
5. Admin clicks "Confirm Assignment"
6. (Phase 1) Console log + local state update
7. (Phase 2) API call to assign driver
8. Delivery status changes to "accepted"
9. Driver's active deliveries count increases
10. Dialog closes
11. Deliveries table refreshes
```

**State Management (Phase 1):**

- Local state in Admin component
- Mock assignment updates in-memory data
- Console logs for debugging

**Future (Phase 2):**

- API call: `POST /api/admin/deliveries/{id}/assign`
- Request body: `{ driverId: string }`
- Response: Updated delivery with assigned driver
- Invalidate TanStack Query cache

---

### 5. Deliveries Stats Card

#### [MODIFY] [Admin.tsx](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/admin/ui/Admin.tsx)

**Changes:**

- Add "Pending Deliveries" stats card
- Icon: `PackageSearch` from lucide-react
- Value: Count of deliveries with status === "pending"
- Position: After "Active Drivers" card

**Rationale:**

- Quick visibility of workload
- Consistent with existing stats pattern
- Helps admin prioritize work

---

## File Structure

```
src/
  features/
    app/
      admin/
        ui/
          Admin.tsx                        # [MODIFY] Add deliveries tab + stats
          AssignDriverDialog.tsx           # [NEW] Driver assignment modal
        hooks/
          useDrivers.ts                    # [EXISTS]
          usePendingDeliveries.ts          # [NEW] Pending deliveries logic
        types.ts                           # [MODIFY] Add PendingDelivery type
```

## Implementation Order

1. **Update types** (`types.ts`)
   - Add `PendingDelivery` interface
   - Export new types

2. **Create pending deliveries hook** (`usePendingDeliveries.ts`)
   - Define mock pending delivery data (minimum 5 deliveries)
   - Implement search/filter logic
   - Calculate pending count

3. **Create assignment dialog** (`AssignDriverDialog.tsx`)
   - Build dialog UI with delivery details
   - List active drivers
   - Implement driver selection
   - Handle assignment confirmation

4. **Update Admin component** (`Admin.tsx`)
   - Add "Deliveries" tab
   - Add "Pending Deliveries" stats card
   - Create deliveries table
   - Integrate assignment dialog
   - Handle assignment flow

5. **Manual testing**
   - Verify deliveries tab displays
   - Verify pending deliveries table
   - Test assignment dialog opens
   - Test driver selection
   - Test assignment confirmation
   - Verify console logs

## Verification Plan

### Manual Testing Steps

1. **Deliveries Tab Testing:**

   ```bash
   # Dev server should be running
   pnpm dev
   ```

   - Navigate to `http://localhost:3001/admin`
   - Click "Deliveries" tab (3rd tab)
   - Verify pending deliveries table displays
   - Verify columns: ID, Title, Origin→Destination, Status, Price, Date, Actions
   - Verify at least 5 pending deliveries show

2. **Stats Card Testing:**
   - Verify "Pending Deliveries" stats card appears
   - Verify count matches number of pending deliveries in table
   - Verify PackageSearch icon displays

3. **Assignment Dialog Testing:**
   - Click "Assign Driver" button on any pending delivery
   - Verify dialog opens
   - Verify delivery details display correctly
   - Verify list of active drivers appears
   - Verify only active drivers are shown (not inactive/suspended)
   - Verify driver info displays: avatar, name, rating, vehicle, active deliveries

4. **Driver Selection Testing:**
   - Select a driver from the list
   - Verify selection is highlighted
   - Click "Confirm Assignment" button
   - Verify console log shows: `Assigning driver {driverId} to delivery {deliveryId}`
   - Verify dialog closes
   - Verify delivery disappears from pending list (status changed)

5. **Search Testing:**
   - Type delivery title in search box
   - Verify table filters correctly
   - Clear search
   - Verify all pending deliveries appear again

6. **Responsive Testing:**
   - Test on desktop (≥1024px)
   - Test on tablet (768-1023px)
   - Test on mobile (<768px)
   - Verify table scrolls horizontally on small screens
   - Verify dialog is responsive

### Expected Outcomes

- ✅ Deliveries tab appears in admin dashboard
- ✅ Pending deliveries table displays with all columns
- ✅ Pending Deliveries stats card shows correct count
- ✅ Assign Driver button opens dialog
- ✅ Dialog shows delivery details and active drivers
- ✅ Driver selection works
- ✅ Assignment confirmation logs to console
- ✅ Delivery status updates locally (Phase 1)
- ✅ Search filters deliveries
- ✅ Responsive design works

## Future Enhancements (Phase 2 - Not in Scope)

- Backend API for delivery assignment
- Real-time updates via WebSocket
- Notification to driver when assigned
- Assignment history/audit log
- Bulk assignment (assign multiple deliveries to one driver)
- Auto-assignment based on driver location/availability
- Driver acceptance/rejection of assignments
- Reassignment functionality
- Unassign driver functionality

## Notes

- This implementation follows UI-First approach
- All data is mocked for Phase 1
- Backend integration will be Phase 2
- No breaking changes to existing code
- Follows existing admin UI patterns
- Reuses existing driver data from useDrivers hook
