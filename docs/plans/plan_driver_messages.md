# Plan: Driver Messages Feature

## Goal Description

Add a "Messages" feature to the Driver Panel (`/driver/messages`) to allow drivers to communicate with users (buyers/sellers). This will mirror the functionality of the existing `/messages` page but scoped to the driver's context.

## User Review Required

> [!NOTE]
> We will be reusing the existing UI components from `features/app/messages/ui`.
> Data will be mocked for now, as the backend is not yet implemented.

## Proposed Changes

### Driver Feature

#### [MODIFY] [DriverLayout.tsx](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/driver/ui/DriverLayout.tsx)

- Add "Messages" item to `sidebarItems`.

#### [NEW] [useDriverMessages.ts](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/driver/hooks/useDriverMessages.ts)

- Create a hook to manage driver-specific message list (mock data).

#### [NEW] [useDriverMessageDetail.ts](file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/features/app/driver/hooks/useDriverMessageDetail.ts)

- Create a hook to manage driver-specific message details (mock data).

### App Pages

#### [NEW] [page.tsx](<file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/app/(app)/driver/messages/page.tsx>)

- Implement the main messages list page for drivers.
- Reuse `Messages` component from `features/app/messages/ui`.

#### [NEW] [page.tsx](<file:///c:/Users/thoriq/Documents/dev/work/freelance/expeditoo/src/app/(app)/driver/messages/[id]/page.tsx>)

- Implement the individual chat page for drivers.
- Reuse `MessageDetail` component from `features/app/messages/ui`.

## Verification Plan

### Manual Verification

1.  **Navigation**:
    - Go to `/driver/dashboard`.
    - Verify "Messages" link appears in the sidebar.
    - Click "Messages" and verify navigation to `/driver/messages`.
2.  **Message List**:
    - Verify a list of mock conversations is displayed.
    - Verify tabs (All, Inbox, Unread) work (filtering mock data).
    - Verify search works.
3.  **Message Detail**:
    - Click on a conversation.
    - Verify navigation to `/driver/messages/[id]`.
    - Verify chat history is displayed.
    - Verify sending a message updates the UI (optimistically).
