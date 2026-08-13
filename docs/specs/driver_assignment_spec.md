# Driver Assignment Flow - Specification

## 1. Overview

This specification defines the exact behavior and requirements for the driver assignment feature, where admin users can assign available drivers to pending deliveries/shipments.

**Feature Goal:** Enable admin users to efficiently assign drivers to deliveries that are waiting for pickup, ensuring smooth logistics operations.

---

## 2. Deliveries Tab Specification

### 2.1 Tab Addition

**Location:** `src/features/app/admin/ui/Admin.tsx`

**Requirements:**

1. **Tab Properties:**
   - Tab ID: `"deliveries"`
   - Tab Label: `"Deliveries"`
   - Position: 3rd tab (after "Drivers", before "Reports")

2. **Tab Behavior:**
   - Clicking tab MUST set `selectedTab` state to `"deliveries"`
   - Active tab MUST have primary background and white text
   - Inactive tabs MUST have muted background

3. **Tab Styling:**
   - MUST match existing tab styles
   - Active: `bg-primary text-primary-foreground shadow-md`
   - Inactive: `bg-muted text-muted-foreground hover:bg-border`

**Edge Cases:**

- If no pending deliveries exist: Display empty state message
- Tab switching MUST preserve search query for that specific tab

---

### 2.2 Pending Deliveries Table

**Location:** `src/features/app/admin/ui/Admin.tsx`

**Requirements:**

1. **Table Structure:**
   - MUST render when `selectedTab === "deliveries"`
   - MUST be wrapped in Card component
   - MUST have horizontal scroll on mobile

2. **Table Columns (in order):**

   | Column      | Data                 | Alignment | Width |
   | ----------- | -------------------- | --------- | ----- |
   | Delivery ID | id (truncated)       | Left      | Auto  |
   | Title       | title                | Left      | Auto  |
   | Route       | origin → destination | Left      | Auto  |
   | Status      | status badge         | Left      | Auto  |
   | Price       | price (formatted)    | Left      | Auto  |
   | Created     | createdDate          | Left      | Auto  |
   | Actions     | assign button        | Right     | Fixed |

3. **Column Details:**

   **Delivery ID Column:**
   - Display first 8 characters of ID
   - Format: `#ABC12345`
   - Font: monospace
   - Color: text-muted-foreground

   **Title Column:**
   - Display delivery/item title
   - Font: font-semibold
   - Color: text-foreground
   - Max width: truncate with ellipsis if too long

   **Route Column:**
   - Format: `{origin} → {destination}`
   - Use arrow symbol (→)
   - Font: text-sm
   - Color: text-muted-foreground

   **Status Column:**
   - Badge component
   - Only show "pending" status (this table filters for pending only)
   - Color: orange/yellow (bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400)

   **Price Column:**
   - Format: `€{price}`
   - Font: font-medium
   - Color: text-foreground

   **Created Column:**
   - Format: `YYYY-MM-DD` or relative time (e.g., "2 days ago")
   - Font: text-sm
   - Color: text-muted-foreground

   **Actions Column:**
   - Button: "Assign Driver"
   - Variant: default (primary)
   - Size: sm
   - Icon: UserPlus from lucide-react (optional)

4. **Table Styling:**
   - Header: `bg-muted`
   - Header cells: `p-4 font-semibold text-sm text-foreground`
   - Body rows: `border-t border-border hover:bg-muted/50 transition-colors`
   - Body cells: `p-4`

5. **Search Functionality:**
   - Search input MUST filter deliveries by title OR origin OR destination
   - Search MUST be case-insensitive
   - Search MUST update in real-time (on input change)
   - Placeholder: "Search deliveries by title or location..."

**Edge Cases:**

- Empty state: Display message "No pending deliveries. All deliveries have been assigned!"
- No search results: Display "No deliveries match your search"
- Very long titles: Truncate with ellipsis

---

## 3. Pending Deliveries Stats Card

**Location:** `src/features/app/admin/ui/Admin.tsx` (stats grid)

**Requirements:**

1. **Card Content:**
   - Label: "Pending Deliveries"
   - Icon: `PackageSearch` from lucide-react
   - Value: Count of deliveries with status === "pending"
   - Change: Percentage change (e.g., "-5%" if decreasing)

2. **Positioning:**
   - Insert after "Active Drivers" card
   - Position: 3rd card in stats grid

3. **Styling:**
   - MUST match existing stat card styles
   - Icon background: `bg-primary/10`
   - Icon color: `text-primary`
   - Value: `text-2xl font-bold text-foreground`
   - Label: `text-sm text-muted-foreground`

4. **Data Calculation:**
   - Value MUST be calculated from mock delivery data
   - Count only deliveries where `status === "pending"`

**Edge Cases:**

- If no pending deliveries: Display "0"
- Change indicator: Green if decreasing (good), red if increasing (needs attention)

---

## 4. Assignment Dialog Specification

**Location:** `src/features/app/admin/ui/AssignDriverDialog.tsx`

**Requirements:**

### 4.1 Dialog Structure

1. **Dialog Properties:**
   - Component: shadcn/ui Dialog
   - Max width: `sm:max-w-[600px]`
   - Scrollable content if driver list is long

2. **Dialog Header:**
   - Title: "Assign Driver to Delivery"
   - Description: "Select an available driver for this delivery"

3. **Dialog Content Sections:**
   - Delivery Details
   - Available Drivers List
   - Action Buttons

### 4.2 Delivery Details Section

**Requirements:**

1. **Display Fields:**
   - Delivery ID (with # prefix)
   - Title/Item name
   - Route (origin → destination)
   - Price
   - Created date

2. **Styling:**
   - Wrapped in Card or muted background box
   - Compact layout
   - Label-value pairs

**Example Layout:**

```
┌─────────────────────────────────────┐
│ Delivery Details                    │
├─────────────────────────────────────┤
│ ID: #ABC12345                       │
│ Title: Vintage Armchair             │
│ Route: Paris → Lyon                 │
│ Price: €45.00                       │
│ Created: 2025-11-25                 │
└─────────────────────────────────────┘
```

### 4.3 Available Drivers List

**Requirements:**

1. **Driver Filtering:**
   - MUST only show drivers where `status === "active"`
   - MUST NOT show inactive or suspended drivers
   - Sort by: rating (highest first) or name (alphabetical)

2. **Driver Display (for each driver):**
   - Radio button or selectable card
   - Avatar (40x40px, circular)
   - Name (font-semibold)
   - Rating (⭐ X/5)
   - Vehicle type
   - Active deliveries count (e.g., "2 active deliveries")

3. **Selection Behavior:**
   - Single selection only (radio button pattern)
   - Selected driver MUST be highlighted
   - Clicking driver card MUST select that driver
   - Initial state: No driver selected

4. **Empty State:**
   - If no active drivers: Display message "No active drivers available. Please activate a driver first."
   - Disable "Confirm Assignment" button

**Example Driver Card:**

```
┌─────────────────────────────────────┐
│ ○ [Avatar] Thomas Martin           │
│            ⭐ 4.8/5                  │
│            Renault Kangoo           │
│            2 active deliveries      │
└─────────────────────────────────────┘
```

### 4.4 Action Buttons

**Requirements:**

1. **Confirm Assignment Button:**
   - Label: "Confirm Assignment"
   - Variant: default (primary)
   - Disabled if: No driver selected OR no active drivers
   - Loading state: Show spinner when processing

2. **Cancel Button:**
   - Label: "Cancel"
   - Variant: outline
   - Always enabled
   - Closes dialog without changes

3. **Button Layout:**
   - Horizontal layout
   - Cancel on left, Confirm on right
   - Gap between buttons

**Edge Cases:**

- Clicking outside dialog: Should close dialog (cancel)
- Pressing Escape key: Should close dialog (cancel)
- Clicking Confirm with no selection: Should show error toast

---

## 5. Assignment Flow Behavior

### 5.1 Opening Dialog

**Trigger:** User clicks "Assign Driver" button on a pending delivery

**Requirements:**

1. Dialog MUST open immediately
2. Delivery details MUST populate from selected delivery
3. Active drivers list MUST load
4. No driver should be pre-selected
5. Focus MUST move to dialog

### 5.2 Driver Selection

**Requirements:**

1. User clicks on a driver card or radio button
2. Previously selected driver (if any) MUST be deselected
3. Clicked driver MUST be highlighted/selected
4. "Confirm Assignment" button MUST become enabled

### 5.3 Confirming Assignment

**Trigger:** User clicks "Confirm Assignment" button

**Requirements (Phase 1 - Mock):**

1. Button MUST show loading state
2. Console log MUST output:
   ```
   Assigning driver {driverId} ({driverName}) to delivery {deliveryId} ({deliveryTitle})
   ```
3. Simulate 500ms delay
4. Update local state:
   - Remove delivery from pending list
   - Update delivery status to "accepted"
   - Assign driver to delivery
   - Increment driver's active deliveries count
5. Show success toast: "Driver assigned successfully!"
6. Close dialog
7. Refresh deliveries table

**Requirements (Phase 2 - API):**

1. Make API call: `POST /api/admin/deliveries/{deliveryId}/assign`
2. Request body: `{ driverId: string }`
3. Handle loading state
4. Handle success:
   - Show success toast
   - Invalidate queries
   - Close dialog
5. Handle errors:
   - Show error toast with message
   - Keep dialog open
   - Reset loading state

### 5.4 Canceling Assignment

**Trigger:** User clicks "Cancel" button or closes dialog

**Requirements:**

1. Dialog MUST close immediately
2. No state changes
3. No API calls
4. No toast notifications

---

## 6. Data Structures

### 6.1 PendingDelivery Interface

**Location:** `src/features/app/admin/types.ts`

```typescript
export interface PendingDelivery {
  id: string;
  title: string;
  origin: string;
  destination: string;
  status: "pending"; // Always pending for this view
  price: number;
  createdDate: string; // ISO 8601 format
  assignedDriver?: string; // driver ID if assigned (null for pending)
}
```

**Validation Rules:**

- `id`: Required, non-empty string
- `title`: Required, non-empty string, max 100 characters
- `origin`: Required, non-empty string
- `destination`: Required, non-empty string
- `status`: Required, must be "pending"
- `price`: Required, positive number
- `createdDate`: Required, valid ISO 8601 date string
- `assignedDriver`: Optional, string or null

### 6.2 Mock Pending Deliveries Data

**Location:** `src/features/app/admin/hooks/usePendingDeliveries.ts`

**Requirements:**

1. **Minimum Data:**
   - MUST include at least 5 pending deliveries
   - MUST have varied origins and destinations
   - MUST have realistic prices
   - MUST have recent created dates

2. **Sample Structure:**

```typescript
const mockPendingDeliveries: PendingDelivery[] = [
  {
    id: "del_001",
    title: "Vintage Armchair",
    origin: "Paris",
    destination: "Lyon",
    status: "pending",
    price: 45.0,
    createdDate: "2025-11-25T10:30:00Z",
  },
  // ... more deliveries
];
```

---

## 7. Hook Specification

### 7.1 usePendingDeliveries Hook

**Location:** `src/features/app/admin/hooks/usePendingDeliveries.ts`

**Requirements:**

1. **Exports:**

```typescript
export function usePendingDeliveries() {
  return {
    deliveries: PendingDelivery[];        // Filtered deliveries
    allDeliveries: PendingDelivery[];     // All pending deliveries
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    pendingCount: number;                 // Count of pending deliveries
    assignDriver: (deliveryId: string, driverId: string) => void;
  };
}
```

2. **Behavior:**
   - `deliveries`: MUST be filtered based on `searchQuery`
   - Search MUST match title OR origin OR destination (case-insensitive)
   - `pendingCount`: MUST count all pending deliveries
   - `assignDriver`: MUST update delivery status and assigned driver (Phase 1)

3. **Search Logic:**

```typescript
const filtered = allDeliveries.filter(
  (delivery) =>
    delivery.title.toLowerCase().includes(query.toLowerCase()) ||
    delivery.origin.toLowerCase().includes(query.toLowerCase()) ||
    delivery.destination.toLowerCase().includes(query.toLowerCase())
);
```

**Edge Cases:**

- Empty search query: Return all deliveries
- No matches: Return empty array
- After assignment: Remove delivery from list

---

## 8. Responsive Behavior

### 8.1 Desktop (≥1024px)

**Requirements:**

- Full deliveries table visible
- All columns visible
- No horizontal scroll needed
- Dialog width: 600px

### 8.2 Tablet (768px - 1023px)

**Requirements:**

- Deliveries table scrollable horizontally
- All columns still present
- Dialog width: 90% of screen
- Driver cards stack vertically

### 8.3 Mobile (<768px)

**Requirements:**

- Deliveries table scrollable horizontally
- Consider showing fewer columns or stacked layout
- Dialog full width with padding
- Driver cards full width
- Buttons stack vertically

---

## 9. Error Scenarios

### 9.1 No Active Drivers

**Scenario:** Admin tries to assign but no active drivers exist

- **Expected:** Dialog shows message "No active drivers available"
- **Action:** Disable "Confirm Assignment" button
- **Guidance:** "Please activate a driver in the Drivers tab first"

### 9.2 Assignment Failure (Phase 2)

**Scenario:** API call fails

- **Expected:** Show error toast with message
- **Action:** Keep dialog open, reset loading state
- **Retry:** User can try again

### 9.3 Empty Pending Deliveries

**Scenario:** No pending deliveries exist

- **Expected:** Show empty state in table
- **Message:** "No pending deliveries. All deliveries have been assigned!"
- **Icon:** CheckCircle (success icon)

---

## 10. Acceptance Criteria

### Deliveries Tab

- [ ] Deliveries tab appears in admin dashboard (3rd position)
- [ ] Clicking tab displays pending deliveries table
- [ ] Table shows all required columns
- [ ] Search filters deliveries by title/location
- [ ] Pending Deliveries stats card shows correct count

### Assignment Dialog

- [ ] "Assign Driver" button opens dialog
- [ ] Dialog shows delivery details correctly
- [ ] Dialog lists only active drivers
- [ ] Driver selection works (radio button pattern)
- [ ] Selected driver is highlighted
- [ ] Confirm button is disabled when no selection

### Assignment Flow

- [ ] Confirming assignment logs to console (Phase 1)
- [ ] Delivery disappears from pending list after assignment
- [ ] Success toast appears
- [ ] Dialog closes after successful assignment
- [ ] Cancel button closes dialog without changes

### Responsive

- [ ] Layout works on desktop (≥1024px)
- [ ] Layout works on tablet (768-1023px)
- [ ] Layout works on mobile (<768px)
- [ ] Dialog is responsive

---

## 11. Testing Checklist

### Manual Testing

1. **Deliveries Tab:**
   - [ ] Navigate to `/admin`
   - [ ] Click "Deliveries" tab
   - [ ] Verify table displays with pending deliveries
   - [ ] Verify all columns are present and correct

2. **Search:**
   - [ ] Type delivery title in search
   - [ ] Verify table filters correctly
   - [ ] Type origin city in search
   - [ ] Verify table filters correctly
   - [ ] Clear search
   - [ ] Verify all deliveries appear

3. **Assignment Dialog:**
   - [ ] Click "Assign Driver" on first delivery
   - [ ] Verify dialog opens
   - [ ] Verify delivery details are correct
   - [ ] Verify active drivers list appears
   - [ ] Verify inactive/suspended drivers NOT shown

4. **Driver Selection:**
   - [ ] Click on a driver card
   - [ ] Verify driver is selected (highlighted)
   - [ ] Click on another driver
   - [ ] Verify previous driver is deselected
   - [ ] Verify new driver is selected

5. **Assignment Confirmation:**
   - [ ] Select a driver
   - [ ] Click "Confirm Assignment"
   - [ ] Verify console log appears
   - [ ] Verify success toast shows
   - [ ] Verify dialog closes
   - [ ] Verify delivery removed from pending list

6. **Cancel:**
   - [ ] Open assignment dialog
   - [ ] Click "Cancel"
   - [ ] Verify dialog closes
   - [ ] Verify no changes made

---

This specification defines the complete expected behavior for the driver assignment feature. All implementation MUST match these specifications exactly.
