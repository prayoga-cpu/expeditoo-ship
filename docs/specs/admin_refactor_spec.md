# Spec: Admin Dashboard Refactor

## 1. Overview

The Admin Dashboard will be restructured from a single page with tabs to a multi-page application with its own persistent sidebar. Access to the admin area will be moved from the main application sidebar to the User Profile page.

## 2. Navigation Structure

### 2.1 Main Application Sidebar

- **Requirement**: The "Admin Dashboard" link MUST be removed from the main sidebar in `MainLayout`.

### 2.2 Profile Page

- **Requirement**: A new button or link labeled "Admin Dashboard" (or similar) MUST be added to the Profile page.
- **Behavior**: Clicking this link navigates the user to `/admin/dashboard`.
- **Visibility**: Ideally visible only to users with `ADMIN` or `OPERATOR` roles (can be mocked for now if role check is complex).

### 2.3 Admin Sidebar

- **Requirement**: A new sidebar specific to the Admin section.
- **Links**:
  - **Dashboard**: `/admin/dashboard`
  - **Users**: `/admin/users`
  - **Drivers**: `/admin/drivers` (or part of users, but distinct in current UI)
  - **Deliveries**: `/admin/deliveries`
  - **Listings**: `/admin/listings`
  - **Reports**: `/admin/reports`
  - **Back to App**: Link to return to `/home` or `/profile`.

## 3. Page Behaviors

### 3.1 Dashboard (`/admin/dashboard`)

- **Display**: Key statistics (Total Users, Active Drivers, Pending Deliveries, Active Listings, Reports, Revenue).
- **Components**: Reuses the stats grid from the original `Admin` component.

### 3.2 Users (`/admin/users`)

- **Display**: Table of users with search and filtering.
- **Actions**: Manage roles (open dialog), View Profile, Verify, Suspend, Delete.

### 3.3 Deliveries (`/admin/deliveries`)

- **Display**: Table of pending deliveries.
- **Actions**: Assign driver.

### 3.4 Other Pages

- **Listings** and **Reports**: Placeholder pages for future implementation.

## 4. Edge Cases

- **Direct Access**: Accessing `/admin` should redirect to `/admin/dashboard`.
- **Mobile**: The admin sidebar should be responsive (collapsible or bottom nav equivalent) similar to the main layout.
