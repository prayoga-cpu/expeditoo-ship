# Specification: Driver Messages

## Overview

The Driver Messages feature allows drivers to communicate directly with users (buyers/sellers) regarding shipments, proposals, or general inquiries. It mirrors the main user messaging system but is accessed via the Driver Panel.

## User Stories

- As a **Driver**, I want to view a list of my active conversations so I can manage my communications.
- As a **Driver**, I want to filter messages by "All", "Inbox", and "Unread" to prioritize my responses.
- As a **Driver**, I want to search for specific contacts or keywords to find relevant information.
- As a **Driver**, I want to click on a conversation to view the full chat history and send new messages.

## UI Requirements

### 1. Messages List Page (`/driver/messages`)

- **Layout**: Standard Driver Panel layout.
- **Header**: Title "Messages", Search bar.
- **Tabs**: "All", "Inbox", "Unread" (with badge).
- **List**:
  - Display list of conversations.
  - Each row shows: Avatar, Name, Last Message preview, Timestamp, Unread indicator.
  - Empty state: "No messages found".

### 2. Message Detail Page (`/driver/messages/[id]`)

- **Layout**: Standard Driver Panel layout.
- **Header**: Contact Name, Status (Online/Offline - mocked).
- **Chat Area**:
  - Scrollable list of messages.
  - Bubbles: Right (Me/Driver), Left (User).
  - Timestamp for each message.
- **Input Area**:
  - Text input field.
  - Send button.
  - Attachment button (UI only).

## Data Model (Mock)

### Message

```typescript
interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: Date;
  read: boolean;
  type: "text" | "image";
  listingId?: string; // Optional context
}
```

### Conversation (Derived)

- Grouped by `otherUserId`.
- Includes `lastMessage`, `unreadCount`.

## Interaction Rules

- **Clicking a row**: Navigates to `/driver/messages/[conversationId]`.
- **Sending a message**:
  - Optimistically adds message to the list.
  - Clears input field.
  - Scrolls to bottom.

## Edge Cases

- **No messages**: Show friendly empty state.
- **Long message**: Truncate in list view.
- **Network error**: (Not applicable for mock data, but UI should handle gracefully in future).
