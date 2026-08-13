# Plan: Driver Onboarding & Workflow

## Goal

Implement a complete workflow for users to apply as drivers, for admins to review and approve these applications, and for approved drivers to access a dedicated Driver Panel where they can submit proposals for shipments.

## User Review Required

> [!IMPORTANT]
>
> - **Role Management**: We need to ensure the `DRIVER` role is correctly added to the `UserRole` enum in the database schema.
> - **Driver Panel Access**: Access to the Driver Panel will be strictly restricted to users with the `DRIVER` role.
> - **Proposal System**: The proposal system is a core part of the Driver Panel. This plan covers the structure, but the detailed implementation of the proposal logic (bidding on shipments) might need its own detailed spec if it becomes too complex. For now, we include it as the primary feature of the Driver Panel.

## Proposed Changes

### 1. Database Schema

#### [MODIFY] [schema.ts](file:///src/db/schema.ts)

- Add `driver_applications` table:
  - `id`: uuid (PK)
  - `user_id`: uuid (FK to users)
  - `status`: enum ('PENDING', 'APPROVED', 'REJECTED')
  - `vehicle_type`: string (e.g., 'Utilitaire', 'Camion')
  - `vehicle_plate`: string
  - `license_number`: string
  - `siret`: string (14 digits)
  - `company_name`: string (optional)
  - `proposal_rate`: string (initial rate proposal or general pricing info)
  - `created_at`: timestamp
  - `updated_at`: timestamp
- Update `users` table or `roles` enum to include `DRIVER` role if not present.

### 2. Backend API & Services

#### [NEW] [driver.service.ts](file:///src/server/services/driver.service.ts)

- `submitApplication(userId, data)`
- `getApplicationStatus(userId)`
- `getPendingApplications()` (Admin)
- `approveApplication(applicationId)` (Admin)
- `rejectApplication(applicationId)` (Admin)

#### [NEW] [driver.dto.ts](file:///src/server/dto/driver.dto.ts)

- Zod schemas for application submission and admin actions.

#### [NEW] [route.ts](file:///src/app/api/driver/apply/route.ts)

- POST endpoint for user to submit application.

#### [NEW] [route.ts](file:///src/app/api/admin/driver-applications/route.ts)

- GET endpoint for admin to list applications.

#### [NEW] [route.ts](file:///src/app/api/admin/driver-applications/[id]/route.ts)

#### [NEW] [DriverApplicationsList.tsx](file:///src/features/app/admin/ui/DriverApplicationsList.tsx)

- Table showing pending applications.

#### [NEW] [DriverApplicationDetail.tsx](file:///src/features/app/admin/ui/DriverApplicationDetail.tsx)

- Modal or page to view details and Approve/Reject.

### 5. Frontend UI - Driver Panel

#### [NEW] [DriverLayout.tsx](<file:///src/app/(app)/driver/layout.tsx>)

- Layout for driver-specific pages (Sidebar/Nav).

#### [NEW] [DriverDashboard.tsx](<file:///src/app/(app)/driver/dashboard/page.tsx>)

- Main dashboard for drivers.

#### [NEW] [ShipmentProposals.tsx](file:///src/features/app/driver/ui/ShipmentProposals.tsx)

- UI for drivers to view available shipments and submit proposals (bid).

## Verification Plan

### Manual Verification

1.  **User Flow**:
    - Register a new user.
    - Go to Profile -> Apply as Driver.
    - Fill form and submit.
    - Verify status shows "Pending".
2.  **Admin Flow**:
    - Login as Admin.
    - Go to Admin Dashboard -> Driver Applications.
    - See the new application.
    - Approve it.
3.  **Driver Flow**:
    - Log back in as the User (or refresh).
    - Verify "Driver Panel" link appears (or is accessible).
    - Access Driver Panel.
    - (Future) Verify ability to see shipments and submit proposals.
