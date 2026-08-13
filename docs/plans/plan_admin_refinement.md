# Plan: Admin Dashboard Refinement & Role Management

This plan focuses on refining the Admin Dashboard user experience, specifically regarding User and Driver management workflows, and fixing data hydration issues.

**Status:** Completed
**Related Specs:** `docs/specs/admin_user_management_spec.md`

## 1. Objectives

- **Fix Role Management UX:** Move from a generic "Add Role" dialog to a context-specific "Driver Management" flow.
- **Fix Technical Debt:** Resolve hydration errors in the Admin Dashboard.
- **Standardize API:** Ensure role management API supports "Replace" operations, not just "Append".
- **Data Integrity:** Ensure User ID validation supports flexible formats (not just UUID).

## 2. Implementation Steps

### Phase 1: Backend Refinement (Completed)

- [x] **DAL Update:** Implement `replaceUserRole` in `src/server/dal/users.dal.ts` to allow atomic role switching (Delete All + Insert).
- [x] **DTO Update:** Relax `userId` validation in `src/server/dto/user.dto.ts` to support non-UUID formats used by Better Auth.
- [x] **DTO Update:** Add `replace: boolean` optional field to `AssignRoleInputSchema`.
- [x] **Service Update:** Update `user.service.ts` to handle the `replace` flag and call the appropriate DAL function.
- [x] **API Update:** `POST /api/user/roles` now supports full role replacement behavior.

### Phase 2: UX Overhaul (Completed)

- [x] **Admin Hook:** Add `handleRemoveDriver` to `useAdmin.ts` that calls the API with `replace: true` and `role: "buyer"`.
- [x] **Users Table:** Add `viewMode` prop to `UsersTable.tsx` to toggle between generic "Manage Roles" and specific "Remove as Driver" actions.
- [x] **Drivers Page:**
  - [x] Remove generic `RoleManagementDialog`.
  - [x] Implement "Remove as Driver" action button.
  - [x] Add specific confirmation dialog text for removing driver access.
  - [x] Filter user list to only show `role === 'transporter'`.

### Phase 3: Stability Fixes (Completed)

- [x] **Hydration Fix:** Implement `isMounted` pattern in `DriversPage` usage of Radix UI Tabs to prevent server/client mismatched ID errors.
- [x] **Role Display:** Fix role dropdown/badge to match standardized simplified roles (User, Driver, Admin).

## 3. Verification

- [x] **Verify API:** `POST /api/user/roles` with `{ replace: true }` correctly swaps roles.
- [x] **Verify UI:** Drivers page loads without console errors.
- [x] **Verify Flow:** Removing a driver successfully removes them from the list and demotes their role.

## 4. Validation Notes

During final verification (`pnpm type-check`), pre-existing type errors were found in:

- `src/app/(app)/(main)/notifications/page.tsx`
- `src/features/app/messages/ui/Messages.tsx`

These are unrelated to the Admin Dashboard changes and should be addressed in a separate cleanup task. The Admin module changes passed Next.js build verification.
