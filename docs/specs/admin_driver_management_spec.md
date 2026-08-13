# Admin Driver Management - Specification

## 1. Overview

This specification defines the exact behavior and requirements for the admin driver management feature, including navigation enhancements and driver management UI.

**Feature Goal:** Enable admin users to manage drivers (transporters) who deliver shipments through a dedicated admin interface with easy navigation.

---

## 2. Navigation Specification

### 2.1 Admin Dashboard Link (Sidebar)

**Location:** `src/components/layouts/MainLayout.tsx`

**Requirements:**

1. **Visibility:**
   - Link MUST appear in the left sidebar navigation
   - Position: After "Profile" link
   - Label: "Admin Dashboard"
   - Icon: `Shield` from lucide-react
   - For Phase 1: Always visible (mock implementation)
   - For Phase 2: Only visible when user has ADMIN role

2. **Behavior:**
   - Clicking link MUST navigate to `/admin`
   - Link MUST use Next.js `Link` component for client-side navigation
   - Link MUST have hover state (bg-accent)
   - Active state styling (when on `/admin` page)

3. **Styling:**
   - MUST match existing navigation link styles
   - Class: `flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors`
   - Icon size: `w-5 h-5`
   - Font: `font-medium`

4. **Responsive:**
   - Desktop (lg+): Visible in sidebar
   - Mobile: Hidden in sidebar, accessible via bottom nav or direct URL

**Edge Cases:**

- If user is not admin (Phase 2): Link should not render
- If navigation fails: Standard Next.js error handling

---

### 2.2 Back to Home Button (Admin Page)

**Location:** `src/features/app/admin/ui/Admin.tsx`

**Requirements:**

1. **Visibility:**
   - Button MUST appear in admin dashboard header
   - Position: Top-right area, aligned with the title
   - Label: "Back to Home"
   - Icon: `ArrowLeft` from lucide-react

2. **Behavior:**
   - Clicking button MUST navigate to `/home`
   - Button MUST use Next.js `Link` component wrapped in Button
   - MUST have hover state

3. **Styling:**
   - Variant: `outline` or `ghost`
   - Size: `default`
   - Class: Include icon on the left side of text
   - Icon size: `w-4 h-4 mr-2`

4. **Responsive:**
   - Desktop: Full text "Back to Home"
   - Mobile: Consider icon-only or abbreviated text

**Edge Cases:**

- Navigation from admin to home MUST work even if user navigated directly to `/admin` URL

---

## 3. Driver Management UI Specification

### 3.1 Drivers Tab

**Location:** `src/features/app/admin/ui/Admin.tsx`

**Requirements:**

1. **Tab Addition:**
   - Tab ID: `"drivers"`
   - Tab Label: `"Drivers"`
   - Position: Second tab (after "Users", before "Listings")

2. **Tab Behavior:**
   - Clicking tab MUST set `selectedTab` state to `"drivers"`
   - Active tab MUST have primary background and white text
   - Inactive tabs MUST have muted background

3. **Tab Styling:**
   - MUST match existing tab styles
   - Active: `bg-primary text-primary-foreground shadow-md`
   - Inactive: `bg-muted text-muted-foreground hover:bg-border`

**Edge Cases:**

- If no drivers exist: Display empty state message
- Tab switching MUST preserve search query

---

### 3.2 Driver Statistics Card

**Location:** `src/features/app/admin/ui/Admin.tsx` (stats grid)

**Requirements:**

1. **Card Content:**
   - Label: "Active Drivers"
   - Icon: `Truck` from lucide-react
   - Value: Count of drivers with status === "active"
   - Change: Percentage change (e.g., "+12%")

2. **Positioning:**
   - Insert after "Total Users" card
   - Position: Second card in stats grid

3. **Styling:**
   - MUST match existing stat card styles
   - Icon background: `bg-primary/10`
   - Icon color: `text-primary`
   - Value: `text-2xl font-bold text-foreground`
   - Label: `text-sm text-muted-foreground`

4. **Data Calculation:**
   - Value MUST be calculated from mock driver data
   - Count only drivers where `status === "active"`

**Edge Cases:**

- If no drivers: Display "0"
- If no active drivers: Display "0" with neutral change indicator

---

### 3.3 Driver Table

**Location:** `src/features/app/admin/ui/Admin.tsx`

**Requirements:**

1. **Table Structure:**
   - MUST render when `selectedTab === "drivers"`
   - MUST be wrapped in Card component
   - MUST have horizontal scroll on mobile

2. **Table Columns (in order):**

   | Column     | Data                                   | Alignment | Width |
   | ---------- | -------------------------------------- | --------- | ----- |
   | Driver     | name, email, avatar                    | Left      | Auto  |
   | Phone      | phone                                  | Left      | Auto  |
   | Vehicle    | vehicle                                | Left      | Auto  |
   | Rating     | rating, reviews                        | Left      | Auto  |
   | Status     | status badge                           | Left      | Auto  |
   | Deliveries | activeDeliveries / completedDeliveries | Left      | Auto  |
   | Actions    | dropdown menu                          | Right     | Fixed |

3. **Column Details:**

   **Driver Column:**
   - Display avatar (circular, 40x40px)
   - Display name (font-semibold, text-foreground)
   - Display email below name (text-sm, text-muted-foreground)

   **Phone Column:**
   - Display phone number
   - Format: As provided in data

   **Vehicle Column:**
   - Display vehicle type/model
   - Text: text-sm

   **Rating Column:**
   - Display: "⭐ {rating}/5 - {reviews} reviews"
   - Format: "⭐ 4.8/5 - 156 reviews"

   **Status Column:**
   - Badge component
   - Colors:
     - "active": green (bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400)
     - "inactive": gray (bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400)
     - "suspended": red (bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400)

   **Deliveries Column:**
   - Display: "{activeDeliveries} active / {completedDeliveries} completed"
   - Format: "2 active / 45 completed"
   - Text: text-sm

4. **Table Styling:**
   - Header: `bg-muted`
   - Header cells: `p-4 font-semibold text-sm text-foreground`
   - Body rows: `border-t border-border hover:bg-muted/50 transition-colors`
   - Body cells: `p-4`

5. **Search Functionality:**
   - Search input MUST filter drivers by name OR email
   - Search MUST be case-insensitive
   - Search MUST update in real-time (on input change)
   - Placeholder: "Search drivers by name or email..."

**Edge Cases:**

- Empty state: Display message "No drivers found" in table
- No search results: Display "No drivers match your search"
- Long vehicle names: Allow text wrapping

---

### 3.4 Driver Actions Dropdown

**Location:** Driver table Actions column

**Requirements:**

1. **Trigger:**
   - Icon: `MoreVertical` (w-4 h-4)
   - Button variant: `ghost`
   - Button size: `icon` (h-8 w-8)

2. **Menu Items (in order):**

   | Action            | Icon        | Color   | Behavior                              |
   | ----------------- | ----------- | ------- | ------------------------------------- |
   | View Profile      | Eye         | Default | Navigate to driver profile (future)   |
   | View Deliveries   | Package     | Default | Show driver's deliveries (future)     |
   | Activate Driver   | CheckCircle | Green   | Change status to "active" (future)    |
   | Deactivate Driver | XCircle     | Orange  | Change status to "inactive" (future)  |
   | Suspend Driver    | Ban         | Orange  | Change status to "suspended" (future) |
   | Delete Driver     | Trash2      | Red     | Delete driver (future)                |

3. **Menu Styling:**
   - Align: `end`
   - Width: `w-48`
   - Items: Icon on left (w-4 h-4 mr-2), text on right

4. **Conditional Items:**
   - If driver status is "active": Show "Deactivate Driver", hide "Activate Driver"
   - If driver status is "inactive" or "suspended": Show "Activate Driver", hide "Deactivate Driver"

**Edge Cases:**

- Clicking action (Phase 1): Log to console, show toast notification
- Menu MUST close after action is clicked
- Menu MUST close when clicking outside

---

## 4. Data Structures

### 4.1 AdminDriver Interface

**Location:** `src/features/app/admin/types.ts`

```typescript
export type DriverStatus = "active" | "inactive" | "suspended";

export interface AdminDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  rating: number;
  reviews: number;
  status: DriverStatus;
  joinDate: string;
  activeDeliveries: number;
  completedDeliveries: number;
  avatar: string;
}
```

**Validation Rules:**

- `id`: Required, non-empty string
- `name`: Required, non-empty string
- `email`: Required, valid email format
- `phone`: Required, non-empty string
- `vehicle`: Required, non-empty string
- `rating`: Required, number between 0 and 5
- `reviews`: Required, non-negative integer
- `status`: Required, one of: "active" | "inactive" | "suspended"
- `joinDate`: Required, valid date string (YYYY-MM-DD)
- `activeDeliveries`: Required, non-negative integer
- `completedDeliveries`: Required, non-negative integer
- `avatar`: Required, valid URL or placeholder string

---

### 4.2 Mock Driver Data

**Location:** `src/features/app/admin/hooks/useDrivers.ts` or `Admin.tsx`

**Requirements:**

1. **Minimum Data:**
   - MUST include at least 5 mock drivers
   - MUST include drivers with different statuses (active, inactive, suspended)
   - MUST include realistic data (French names, realistic ratings, etc.)

2. **Sample Structure:**

```typescript
const mockDrivers: AdminDriver[] = [
  {
    id: "d1",
    name: "Thomas Martin",
    email: "thomas.m@expeditoo.fr",
    phone: "+33 6 12 34 56 78",
    vehicle: "Renault Kangoo",
    rating: 4.8,
    reviews: 156,
    status: "active",
    joinDate: "2024-01-15",
    activeDeliveries: 3,
    completedDeliveries: 145,
    avatar: "/placeholder.svg?key=driver1",
  },
  // ... more drivers
];
```

**Edge Cases:**

- Driver with 0 reviews: Display "No reviews yet"
- Driver with 0 active deliveries: Display "0 active / X completed"
- Driver with very long name: Allow text wrapping

---

## 5. Hook Specification (Optional)

### 5.1 useDrivers Hook

**Location:** `src/features/app/admin/hooks/useDrivers.ts`

**Requirements:**

1. **Exports:**

```typescript
export function useDrivers() {
  // Returns:
  return {
    drivers: AdminDriver[];        // Filtered drivers
    allDrivers: AdminDriver[];     // All drivers (for stats)
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    activeDriverCount: number;     // Count of active drivers
  };
}
```

2. **Behavior:**
   - `drivers`: MUST be filtered based on `searchQuery`
   - Search MUST match name OR email (case-insensitive)
   - `activeDriverCount`: MUST count drivers where status === "active"
   - State MUST use React useState

3. **Search Logic:**

```typescript
const filtered = allDrivers.filter(
  (driver) =>
    driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    driver.email.toLowerCase().includes(searchQuery.toLowerCase())
);
```

**Edge Cases:**

- Empty search query: Return all drivers
- No matches: Return empty array
- Search with special characters: Handle gracefully

---

## 6. Responsive Behavior

### 6.1 Desktop (≥1024px)

**Requirements:**

- Admin link visible in sidebar
- Full driver table visible
- All columns visible
- No horizontal scroll needed

### 6.2 Tablet (768px - 1023px)

**Requirements:**

- Admin link hidden (sidebar collapsed)
- Driver table scrollable horizontally
- All columns still present
- Search bar full width

### 6.3 Mobile (<768px)

**Requirements:**

- Admin link not in sidebar (access via direct URL or future bottom nav)
- Driver table scrollable horizontally
- Back to Home button visible
- Tabs scrollable horizontally
- Stats grid: 1 column layout

---

## 7. Error Scenarios

### 7.1 Navigation Errors

**Scenario:** User clicks admin link but navigation fails

- **Expected:** Display Next.js error page
- **Fallback:** Browser back button still works

### 7.2 Empty State

**Scenario:** No drivers in system

- **Expected:** Display empty state message in table
- **Message:** "No drivers found. Drivers will appear here once they register."

### 7.3 Search No Results

**Scenario:** Search query returns no matches

- **Expected:** Display message in table
- **Message:** "No drivers match your search query."

---

## 8. Future Enhancements (Out of Scope)

The following are NOT required for Phase 1:

- Real authentication/authorization checks
- Backend API integration
- Actual driver CRUD operations
- Driver profile pages
- Driver assignment to deliveries
- Real-time driver status updates
- Driver performance analytics
- Email/SMS notifications to drivers
- Driver earnings/payouts

---

## 9. Acceptance Criteria

### Navigation

- [ ] Admin Dashboard link appears in sidebar
- [ ] Clicking admin link navigates to `/admin`
- [ ] Back to Home button appears in admin header
- [ ] Clicking back button navigates to `/home`

### Driver Management

- [ ] Drivers tab appears in admin dashboard
- [ ] Clicking Drivers tab displays driver table
- [ ] Active Drivers stat card displays correct count
- [ ] Driver table shows all required columns
- [ ] Search filters drivers by name or email
- [ ] Actions dropdown shows all menu items
- [ ] Status badges display correct colors

### Responsive

- [ ] Layout works on desktop (≥1024px)
- [ ] Layout works on tablet (768-1023px)
- [ ] Layout works on mobile (<768px)
- [ ] Tables scroll horizontally on small screens

### Data

- [ ] Mock driver data includes at least 5 drivers
- [ ] Mock data includes all required fields
- [ ] Stats calculate correctly from mock data

---

## 10. Testing Checklist

### Manual Testing

1. **Navigation Flow:**
   - [ ] Start at `/home`
   - [ ] Click "Admin Dashboard" in sidebar
   - [ ] Verify navigation to `/admin`
   - [ ] Click "Back to Home"
   - [ ] Verify navigation to `/home`

2. **Driver Tab:**
   - [ ] Navigate to `/admin`
   - [ ] Click "Drivers" tab
   - [ ] Verify driver table appears
   - [ ] Verify all columns are present

3. **Search:**
   - [ ] Type driver name in search
   - [ ] Verify table filters correctly
   - [ ] Type driver email in search
   - [ ] Verify table filters correctly
   - [ ] Clear search
   - [ ] Verify all drivers appear

4. **Actions:**
   - [ ] Click actions dropdown on a driver
   - [ ] Verify all menu items appear
   - [ ] Click an action
   - [ ] Verify console log appears (Phase 1)

5. **Responsive:**
   - [ ] Test on desktop viewport
   - [ ] Test on tablet viewport (768px)
   - [ ] Test on mobile viewport (375px)
   - [ ] Verify horizontal scroll works on small screens

---

This specification defines the complete expected behavior for the admin driver management feature. All implementation MUST match these specifications exactly.
