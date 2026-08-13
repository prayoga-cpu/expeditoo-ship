# Plan: Notification System Backend

**Feature:** Notification System Backend & Integration
**Type:** Backend + Integration
**Priority:** High
**Estimated Complexity:** Medium (6/10)

---

## Overview

Implement the backend infrastructure for the notification system to replace the current mock data. This includes the database schema, service layer, API endpoints, and integration with the existing UI.

This plan follows the strict **UI First -> Backend Integration** philosophy. The UI is already specified in `docs/specs/notification_floating_box_spec.md`.

---

## Goals

1.  Create `notifications` database table.
2.  Implement DTOs, DAL, and Service layer for notifications.
3.  Create REST API endpoints for fetching and managing notifications.
4.  Integrate the frontend (`useNotifications` hook) with the real API using TanStack Query.
5.  Ensure all notification types (`bid`, `listing`, `message`, `delivery`, `review`, `payment`) are supported.

---

## Architecture Layers

Following `docs/rules.md`:

```
UI (NotificationPopover/Page)
  ↓
Hooks (useNotifications)
  ↓
Client API (features/app/notifications/api)
  ↓
REST API (/api/notifications)
  ↓
Service (server/services/notifications.service.ts)
  ↓
DAL (server/dal/notifications.dal.ts)
  ↓
DB (notifications table)
```

docs/specs/notification_backend_spec.md
src/db/schemas/notifications.ts
src/server/dto/notifications.dto.ts
src/server/dal/notifications.dal.ts
src/server/services/notifications.service.ts
src/app/api/notifications/route.ts
src/app/api/notifications/unread-count/route.ts
src/app/api/notifications/[id]/read/route.ts
src/app/api/notifications/read-all/route.ts
src/features/app/notifications/api/index.ts

```

## Files to Modify

```

src/db/schemas/index.ts
src/features/app/notifications/hooks/useNotifications.ts

```

```
