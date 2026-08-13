# User Preferences & Notification Settings Specification

## 1. Overview

This document specifies the behavior and implementation details for user preferences, focusing initially on Email Notification settings.

**Feature Goal:** Allow users to granularly control which email notifications they receive from the platform.

## 2. User Interface

The settings are located in the User Profile > Settings page (`/profile` or `/settings`).

### 2.1 Notification Toggles

| Setting Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **Auction Results** | Boolean | `true` | Receive emails when: <br> - You win an auction <br> - You are outbid <br> - Your auction ends (sold/unsold) |
| **Account & Security** | Boolean | `true` (Disabled) | Critical system emails (password reset, verification, suspicious login). **Cannot be disabled.** |

### 2.2 Behavior

- **Immediate Save**: Changes are saved automatically when the toggle is clicked (Optimistic UI recommended).
- **Toast Feedback**: "Settings updated" toast appears on success.
- **Error Handling**: Toggle reverts to previous state if update fails.

## 3. Data Model

We need to update the `users` table or create a `user_preferences` table. For simplicity and following KISS principle, we will add JSON columns or specific columns to the existing `users` table.

**Schema Update (`users` table):**

```typescript
// src/db/schema.ts

export const users = pgTable("user", {
  // ... existing fields
  preferences: jsonb("preferences").default({
    notifications: {
      email: {
        auctionResults: true,
        marketing: false
      }
    }
  }).notNull(),
});
```

*Note: Alternatively, flat columns `notify_auction_results` could be used, but JSONB allows flexibility for future preferences without schema migrations.*

## 4. Implementation Strategy

**Architecture Pattern:** [Server Actions] (as per rules.md §5 for User Preferences)

### 4.1 Server Action

**File**: `src/features/app/settings/actions.ts`

```typescript
"use server"

export async function updateNotificationSettings(
  settingKey: string, 
  value: boolean
) {
  // 1. Get current session
  // 2. Validate input
  // 3. Call Service -> DAL to update DB
  // 4. Revalidate cache
}
```

### 4.2 Security

- **Authentication**: Strict check for active session.
- **Authorization**: Users can ONLY update their own preferences.

## 5. Future Scope (Not in V1)

- SMS Notifications toggle
- Marketing email toggle
- Dark mode preference (currently local storage)
