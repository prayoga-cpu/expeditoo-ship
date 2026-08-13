# Plan: Admin Dashboard Refactor

**Goal**: Transform the current Admin Dashboard into a production-grade, highly consistent, and feature-rich interface that matches the standards of the main Expeditoo application.

## 1. Analysis & Approach

The current admin panel suffers from "MVP syndrome": inconsistent spacing, hardcoded limits, lack of pagination, and minor display bugs (currency). We will address this by:

1.  **Harmonizing UI**: Aligning `AdminLayout` with the main App Layout structure.
2.  **Abstractions**: Creating a reusable `DataTable` component based on TanStack Table to handle sorting, filtering, and pagination consistently across all admin pages.
3.  **State Management**: Moving transient state (page, sort, query) from React state to URL params for shareability and better UX.

## 2. Implementation Steps

### Step 1: Layout & Core UI Refactor

- **Objective**: Fix padding, navigation, and visual consistency.
- **Charts**: Update `Recharts` configuration to use Primary Blue color tokens and custom Tooltip components.
- **Files**:
  - `src/features/app/admin/ui/AdminLayout.tsx`
  - `src/features/app/admin/ui/Dashboard.tsx` (Cleanup)

### Step 2: TanStack Table Architecture

- **Objective**: Build the core data table components.
- **New Files**:
  - `src/features/app/admin/ui/data-table/data-table.tsx`
  - `src/features/app/admin/ui/data-table/data-table-pagination.tsx`
  - `src/features/app/admin/ui/data-table/data-table-toolbar.tsx`
  - `src/features/app/admin/ui/data-table/data-table-column-header.tsx`

### Step 3: Feature Implementation (Users, Listings, Shipments)

- **Objective**: Migrate existing pages to use the new Table architecture.
- **Modifications**:
  - `src/features/app/admin/ui/UsersTable.tsx` -> Use `DataTable`
  - `src/features/app/admin/ui/ListingsTable.tsx` -> Use `DataTable`
  - `src/features/app/admin/ui/DeliveriesTable.tsx` -> Use `DataTable`
- **Hooks Update**:
  - Update `useAdmin.ts` etc. to accept pagination params and sync with `useSearchParams`.

### Step 4: Admin Profile & Polishing

- **Objective**: Add missing pages and fix localization.
- **New Page**: `src/app/(app)/(main)/admin/profile/page.tsx`
- **Logic**: Reuse `ProfileForm` but wrap in Admin Layout.
- **Localization**: Update `messages/en.json` with missing keys.

## 3. Complexity Estimation

- **Complexity**: Medium (Refactoring existing code + new components)
- **Risk**: Low (Admin features are isolated from public user flows)

## 4. Dependencies

- `@tanstack/react-table` (Already installed in typical Next.js stacks, verify)
- `lucide-react` (Icons)
- `shadcn/ui` components (Table, Button, Input, Dropdown)
