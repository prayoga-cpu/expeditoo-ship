# Specification: Driver Onboarding & Workflow

## 1. Overview

This feature allows users to apply to become drivers (Transporters). Admins review these applications and approve or reject them. Upon approval, users gain the `DRIVER` role and access to the Driver Panel, where they can bid on shipments.

## 2. Data Models

### 2.1 Driver Application (`driver_applications`)

| Field            | Type      | Required | Description                                                                                            |
| ---------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `id`             | UUID      | Yes      | Primary Key                                                                                            |
| `user_id`        | UUID      | Yes      | Foreign Key to `users.id`                                                                              |
| `status`         | Enum      | Yes      | `PENDING`, `APPROVED`, `REJECTED`                                                                      |
| `vehicle_type`   | String    | Yes      | e.g., "Voiture", "Utilitaire (6-12m³)", "Fourgon (12-20m³)", "Camion (>20m³)", "Vélo Cargo", "Scooter" |
| `vehicle_plate`  | String    | Yes      | License plate number (Immatriculation)                                                                 |
| `license_number` | String    | Yes      | Driver's license number (Permis de conduire)                                                           |
| `siret`          | String    | Yes      | Business Registration Number (14 digits)                                                               |
| `company_name`   | String    | No       | Company Name (if applicable)                                                                           |
| `proposal_rate`  | String    | No       | Initial pricing proposal or notes                                                                      |
| `created_at`     | Timestamp | Yes      | Creation time                                                                                          |
| `updated_at`     | Timestamp | Yes      | Last update time                                                                                       |

### 2.2 User Role Updates

- The `users` table or `roles` enum must support the `DRIVER` role.

## 3. API Endpoints

### 3.1 Submit Application

- **Endpoint**: `POST /api/driver/apply`
- **Auth**: Authenticated User
- **Body**:
  ```json
  {
    "vehicle_type": "Utilitaire (6-12m³)",
    "vehicle_plate": "AA-123-BB",
    "license_number": "123456789012",
    "siret": "12345678901234",
    "company_name": "Transport Express SAS",
    "proposal_rate": "Tarif standard"
  }
  ```
- **Response**: `201 Created` with application object.
- **Validation**: All fields required except `proposal_rate` and `company_name`. `siret` must be 14 digits (Luhn algorithm check recommended).

### 3.2 Get Application Status

- **Endpoint**: `GET /api/driver/application/status`
- **Auth**: Authenticated User
- **Response**: `200 OK` with application object or `404 Not Found`.

### 3.3 List Applications (Admin)

- **Endpoint**: `GET /api/admin/driver-applications`
- **Auth**: Admin Only
- **Query Params**: `status` (optional filter)
- **Response**: `200 OK` with list of applications.

### 3.4 Approve/Reject Application (Admin)

- **Endpoint**: `PATCH /api/admin/driver-applications/:id`
- **Auth**: Admin Only
- **Body**:
  ```json
  {
    "status": "APPROVED" | "REJECTED"
  }
  ```
- **Side Effects**:
  - If `APPROVED`: Update user's role to `DRIVER`.
  - Send notification to user (email/in-app).

## 4. UI/UX Flows

### 4.1 User: Apply as Driver

1.  User navigates to **Profile**.
2.  Clicks **"Devenir Chauffeur"** (Apply as Driver).
3.  If no application exists: Shows **Formulaire d'inscription Chauffeur**.
4.  User fills form (SIRET, Vehicle, etc.) and submits.
5.  UI updates to show **"Candidature en attente"** banner.
6.  If application exists (Pending): Shows status and details (read-only).
7.  If application exists (Approved): Shows link to **Espace Chauffeur** (Driver Panel).

### 4.2 Admin: Review Applications

1.  Admin navigates to **Admin Dashboard**.
2.  Clicks **"Candidatures Chauffeurs"** tab.
3.  Table shows list of pending applications (User Name, Vehicle, SIRET, Date).
4.  Clicking a row opens **Application Detail** modal/view.
5.  Admin clicks **"Valider"** (Approve) or **"Refuser"** (Reject).
6.  List refreshes.

### 4.3 Driver: Driver Panel

1.  User with `DRIVER` role sees **"Espace Chauffeur"** in navigation.
2.  **Driver Dashboard** shows:
    - Active Shipments
    - Earnings
    - **"Trouver des missions"** (Find Shipments) button.
3.  **Find Shipments** page:
    - Map/List view of available shipments.
    - **"Faire une offre"** (Submit Proposal) action on shipment detail.

## 5. Validation Rules

- `vehicle_plate`: Standard French format (e.g., AA-123-BB or 1234 AB 56).
- `license_number`: French/EU format.
- `siret`: Must be exactly 14 numeric digits.
- User cannot submit multiple pending applications.

## 6. Edge Cases

- **User is already a driver**: Hide application form, show Driver Panel link.
- **Application Rejected**: Allow user to re-apply (maybe after a cooldown or with edit capability).
- **Concurrent Approval**: Handle case where two admins try to approve same application (optimistic locking or simple last-write-wins).
