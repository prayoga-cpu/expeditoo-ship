# Plan: Notification Floating Box & Realtime

## 1. Overview

This plan details the implementation of the Notification Floating Box (Popover) and its integration with the backend and real-time system (Ably). The UI allows users to quickly view, interact with, and manage their latest notifications without leaving the current page.

## 2. Current Status

- ✅ **UI Component**: `NotificationPopover` and `NotificationItemCompact` are fully implemented (Responsive & Accessible).
- ✅ **Backend API**: `/api/notifications` endpoints are live.
- ✅ **Real-time**: Ably integration (`notification:new` event) is active.
- ✅ **State Management**: `useNotifications` hook manages state via TanStack Query.

## 3. Architecture

### 3.1 Components

- **Truncated List**: Displays the 5 most recent notifications.
- **Real-time Badge**: The bell icon shows a red badge with the unread count, updated instantly via Ably.
- **Interactions**:
  - **Mark as Read**: Clicking a notification marks it as read via API (`PATCH /api/notifications/:id/read`).
  - **Mark All Read**: Button to clear all unread statuses (`POST /api/notifications/read-all`).
  - **View All**: Link to the full `/notifications` dashboard.

### 3.2 Data Flow

1. **Initial Load**:
   - `useNotifications` fetches latest data from `GET /api/notifications`.
   - `useUnreadCount` fetches the badge count from `GET /api/notifications/unread-count`.

2. **Real-time Update (Ably)**:
   - Client subscribes to channel `user:{userId}:notifications`.
   - On event `notification:new`:
     - Toast appears (Global).
     - Query Cache for notifications is invalidated (`refetch`).
     - Badge count increments.

3. **User Action**:
   - User clicks Bell -> Popover opens.
   - User clicks Item -> `markAsReadMutation` fires -> Navigation to link.

## 4. Implementation Details

### 4.1 UI Components (Located in `src/features/app/notifications/ui/`)

- `NotificationPopover.tsx`: The main container using Radix UI Popover.
- `NotificationItemCompact.tsx`: Individual item optimized for small width.
- `NotificationBell.tsx`: The trigger button with the unread badge.

### 4.2 Hook Logic (`src/features/app/notifications/hooks/useNotifications.ts`)

- Uses `useQuery` for fetching.
- Uses `useMutation` for read status updates.
- Uses `useAblyChannel` for listening to real-time events.

### 4.3 API Endpoints

- `GET /api/notifications`: Returns paginated list.
- `GET /api/notifications/unread-count`: Returns raw count number.
- `PATCH /api/notifications/:id/read`: Updates single status.
- `POST /api/notifications/read-all`: Bulk update.

## 5. Future Enhancements (Post-MVP)

- [ ] **Infinite Scroll**: Allow scrolling more than 5 items inside the popover.
- [ ] **Grouped Notifications**: Group similar notifications (e.g., "5 people liked your item").
- [ ] **Action Buttons**: Quick actions (e.g., "Reply" or "Pay") directly inside the popover.
