# Specification: Admin Dashboard Refactor

**Version:** 1.0.0
**Status:** DRAFT

## 1. Overview

The Admin Dashboard is the control center for the platform. This refactor aims to professionalize the interface, ensuring it handles large datasets efficiently (pagination) and provides a consistent user experience.

## 2. UI/UX Requirements

### 2.1 Layout

- **Container**: Max-width and padding must match the Main App (`/home`) layout standard strictly.
- **Sidebar**: Fixed sidebar on desktop, collapsible bottom/drawer on mobile.
- **Typography**: Use standard `shadcn/ui` typography tokens.
- **Theme**: Full support for Dark/Light mode.

### 2.2 Dashboard Overview (`/admin/dashboard`)

- **KPI Cards**:
  - Revenue: Display in **Euro (€)**.
    - _Input_: Cents (integer).
    - _Display_: `€400.00` (Divide input by 100).
  - Trends: Show percentage change vs last month.
- **Revenue Chart**:
  - **Styling**: Must use brand primary color (Blue) for lines and gradients.
  - **Tooltip**: Custom styled tooltip (glassmorphism/standard popover style) with clear labels and values. Avoid default Recharts styling.
  - **Y-Axis**: Formatted as Euro.
- **Activity Feed**:
  - Time: Relative time (e.g., "2 hours ago") must be localized.
  - Actions: All action strings must use `t("admin.activity.{action}")`.

## 3. Data Tables Specification

All admin lists (Users, Listings, Shipments, Drivers) MUST use the **Server-Side Pagination** pattern.

### 3.1 Functionality

- **Pagination**:
  - Page size: Default 10, Options [10, 20, 50, 100].
  - Navigation: Next, Previous, First, Last, Specific Page.
  - State: Synced to URL `?page=X&pageSize=Y`.
- **Sorting**:
  - Clickable column headers.
  - State: Synced to URL `?sort=field.desc`.
- **Filtering**:
  - Global Search: Text input with debounce (300ms).
  - State: Synced to URL `?q=search_term`.
- **Tab Selection**:
  - When switching tabs (e.g., "Users" to "Admins"), use `router.replace({ scroll: false })` to update URL without history pollution.

### 3.2 Columns & Data

#### Users Table

- **Columns**: Name, Email, Role (Badge), Status (Active/Inactive), Join Date, Actions.
- **Actions**:
  - Edit Role (Dialog).
  - Ban/Unban (Dialog).
  - View Profile.

#### Listings Table

- **Columns**: Title, Seller (Email), Price (€), Status (Badge), Created At, Views, Actions.
- **Formatting**: Price must be `/ 100` if stored in cents.
- **Actions**:
  - View Details (Modal or new page).
  - Delete (Destructive Alert).

#### Shipments Table

- **Columns**: ID, Route (From -> To), Customer, Driver (if assigned), Status (Badge), Price, Actions.
- **Actions**:
  - View details.
  - Reassign Driver.

## 4. Admin Profile (`/admin/profile`)

- **Requirement**: Admins must be able to edit their own details.
- **Components**:
  - Reuse the existing `ProfileForm` component.
  - Wrap in `AdminLayout`.
  - Disable "Apply for Driver" button for Admins (if applicable).

## 5. Technical Requirements

- **Framework**: TanStack Table v8.
- **Routing**: Next.js App Router (`useSearchParams`, `useRouter`, `usePathname`).
- **I18n**: All text MUST be wrapped in `useTranslations`.
- **Performance**:
  - Debounce search inputs.
  - Use `Suspense` for table loading states.
  - **No** client-side filtering for large datasets (defer to API).

## 6. Edge Cases

- **Empty States**: Display illustration/text when no data found.
- **API Errors**: Display toast notification on failure.
- **Invalid Page**: If `?page=999` returns no data, UI should show empty state or redirect to last valid page (API handled).
