# Admin Driver Management - Implementation Plan

## Overview

This plan outlines the implementation of driver management functionality in the admin dashboard, along with navigation improvements to allow admins to easily switch between the admin page and the main home page.

## Background Context

**Current State:**

- ✅ Admin page exists at `/admin` with basic user management UI
- ✅ Driver interface defined in `src/features/app/deliveries/types.ts`
- ✅ MainLayout component provides navigation sidebar
- ❌ No admin-specific navigation (button to access admin page)
- ❌ No driver management tab in admin dashboard
- ❌ No way to return to home from admin page

**User Requirements:**

- Admin users need a button/link to access the admin page from the main app
- Admin page should have a way to navigate back to home
- Primary admin function needed: **Driver Management** (manage drivers who will deliver shipments)

## Proposed Changes

### 1. Navigation Enhancements

#### [MODIFY] [MainLayout.tsx](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/components/layouts/MainLayout.tsx)

**Changes:**

- Add conditional "Admin Dashboard" link in sidebar navigation (only visible for admin users)
- Position: After "Profile" link, before the bottom of the nav section
- Icon: `Shield` from lucide-react
- For now, use mock check (will be replaced with real auth check later)

**Rationale:**

- Follows existing navigation pattern
- Keeps admin access visible but not intrusive
- Uses Shield icon to indicate elevated permissions

---

#### [MODIFY] [Admin.tsx](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/admin/ui/Admin.tsx)

**Changes:**

- Add "Back to Home" button in the header section
- Position: Top-right of the admin dashboard header, next to the title
- Icon: `ArrowLeft` from lucide-react
- Style: Secondary button with icon

**Rationale:**

- Provides clear exit path from admin area
- Follows common admin panel UX patterns
- Non-intrusive placement

---

### 2. Driver Management Feature

#### [MODIFY] [Admin.tsx](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/admin/ui/Admin.tsx)

**Changes:**

1. **Add "Drivers" tab** to existing tabs array:

   ```typescript
   const tabs = [
     { id: "users", label: "Users" },
     { id: "drivers", label: "Drivers" }, // NEW
     { id: "listings", label: "Listings" },
     { id: "reports", label: "Reports" },
     { id: "analytics", label: "Analytics" },
   ];
   ```

2. **Create driver table section** (similar to users table):
   - Display driver information: name, email, phone, vehicle, rating, status
   - Show number of active/completed deliveries
   - Status badges: "active", "inactive", "suspended"
   - Actions dropdown with:
     - View Profile
     - View Deliveries
     - Activate/Deactivate Driver
     - Suspend Driver
     - Delete Driver

3. **Add driver stats card** to stats grid:
   - Label: "Active Drivers"
   - Icon: `Truck` from lucide-react
   - Value: Count of active drivers
   - Change percentage

**Mock Data Structure:**

```typescript
interface AdminDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  rating: number;
  reviews: number;
  status: "active" | "inactive" | "suspended";
  joinDate: string;
  activeDeliveries: number;
  completedDeliveries: number;
  avatar: string;
}
```

**Rationale:**

- Reuses existing admin UI patterns for consistency
- Provides essential driver management capabilities
- Follows YAGNI principle - only implements what's needed now
- Mock data approach aligns with UI-First development philosophy

---

### 3. Type Definitions

#### [NEW] [types.ts](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/admin/types.ts)

**Changes:**

- Create new types file for admin-specific types
- Define `AdminDriver` interface
- Define `DriverStatus` type
- Export all types

**Rationale:**

- Follows SOLID principle - centralized type definitions
- Separates admin driver view from delivery driver view
- Allows for different data structures in admin context

---

### 4. Hooks (Optional for Phase 1)

#### [NEW] [useDrivers.ts](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/admin/hooks/useDrivers.ts)

**Changes:**

- Create hook for driver management logic
- Manage driver list state
- Handle search/filter functionality
- Mock data for now (will be replaced with API calls later)

**Rationale:**

- Separates business logic from UI
- Follows feature hooks pattern
- Easier to replace with real API later

---

## File Structure

```
src/
  components/
    layouts/
      MainLayout.tsx              # [MODIFY] Add admin nav link

  features/
    app/
      admin/
        ui/
          Admin.tsx                # [MODIFY] Add drivers tab + back button
        hooks/
          useDrivers.ts            # [NEW] Driver management logic
        types.ts                   # [NEW] Admin-specific types
```

## Implementation Order

1. **Create types file** (`types.ts`)
   - Define AdminDriver interface
   - Define DriverStatus type

2. **Create driver hook** (`useDrivers.ts`)
   - Mock driver data
   - Search/filter logic

3. **Update Admin component** (`Admin.tsx`)
   - Add "Back to Home" button in header
   - Add "Drivers" tab
   - Add driver stats card
   - Create drivers table UI
   - Implement driver actions dropdown

4. **Update MainLayout** (`MainLayout.tsx`)
   - Add conditional "Admin Dashboard" link
   - Use mock admin check for now

5. **Manual testing**
   - Verify navigation flow: Home → Admin → Home
   - Verify drivers tab displays correctly
   - Verify search/filter works
   - Verify responsive design on mobile

## Verification Plan

### Manual Testing Steps

1. **Navigation Testing:**

   ```bash
   # Start dev server
   pnpm dev
   ```

   - Open browser to `http://localhost:3000/home`
   - Verify "Admin Dashboard" link appears in sidebar (mock: always visible for now)
   - Click "Admin Dashboard" → should navigate to `/admin`
   - Verify "Back to Home" button appears in admin header
   - Click "Back to Home" → should navigate to `/home`

2. **Driver Management Testing:**
   - Navigate to `/admin`
   - Click "Drivers" tab
   - Verify driver table displays with mock data
   - Verify columns: Name, Email, Phone, Vehicle, Rating, Status, Deliveries, Actions
   - Test search functionality by typing driver name
   - Click actions dropdown on a driver
   - Verify all action items appear (View Profile, View Deliveries, etc.)

3. **Responsive Testing:**
   - Test on mobile viewport (375px width)
   - Verify table is scrollable horizontally
   - Verify tabs are scrollable horizontally
   - Verify "Back to Home" button is visible on mobile

4. **Stats Card Testing:**
   - Verify "Active Drivers" stat card appears in stats grid
   - Verify it shows correct count and icon

### Expected Outcomes

- ✅ Admin navigation link visible in sidebar
- ✅ Clicking admin link navigates to `/admin`
- ✅ "Back to Home" button visible in admin header
- ✅ Clicking back button returns to `/home`
- ✅ "Drivers" tab appears in admin dashboard
- ✅ Driver table displays with all columns
- ✅ Search filters drivers by name/email
- ✅ Actions dropdown shows all options
- ✅ Active Drivers stat card displays
- ✅ Responsive design works on mobile

## Future Enhancements (Not in Scope)

- Real authentication check for admin role
- Backend API integration for driver CRUD operations
- Real-time driver location tracking
- Driver performance analytics
- Driver assignment to deliveries
- Driver earnings/payouts management

## Notes

- This implementation follows the UI-First approach
- All data is mocked for now
- Backend integration will be done in Phase 2
- Follows existing admin UI patterns for consistency
- No breaking changes to existing code
