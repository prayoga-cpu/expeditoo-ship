# Chat API Specification

**Version:** 1.1  
**Status:** Implementation Ready  
**Last Updated:** 2025-12-06

---

## 1. Overview

This specification defines the backend implementation for the Chat & Messaging module.
Messages are **text-only** - no image or file attachments are supported.

---

## 2. Database Schema

Reference: `src/db/schema/messages.ts`

### 2.1 Tables

#### `conversations`

| Column        | Type      | Constraints              |
| ------------- | --------- | ------------------------ |
| id            | text      | PK                       |
| listingId     | text      | FK → listings (nullable) |
| lastMessageAt | timestamp | default: now()           |
| createdAt     | timestamp | not null                 |
| updatedAt     | timestamp | not null                 |

#### `conversation_participants`

| Column         | Type      | Constraints                  |
| -------------- | --------- | ---------------------------- |
| id             | text      | PK                           |
| conversationId | text      | FK → conversations, not null |
| userId         | text      | FK → users, not null         |
| lastReadAt     | timestamp | nullable                     |
| joinedAt       | timestamp | not null                     |

#### `messages`

| Column         | Type      | Constraints                  |
| -------------- | --------- | ---------------------------- |
| id             | text      | PK                           |
| conversationId | text      | FK → conversations, not null |
| senderId       | text      | FK → users, not null         |
| content        | text      | not null, 1-2000 chars       |
| createdAt      | timestamp | not null                     |
| isRead         | boolean   | default: false               |

**Note:** The `attachmentUrl` field exists in schema but is NOT used. All messages are text-only.

---

## 3. API Endpoints

### 3.1 Get Conversations (Inbox)

**Endpoint:** `GET /api/messages/conversations`

**Auth:** Required

**Query Params:**

- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 50
- `search` (optional): Search query (filters by participant name or listing title)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "conv_123",
      "participant": {
        "id": "user_456",
        "name": "John Doe",
        "image": "https://..."
      },
      "listing": {
        "id": "listing_789",
        "title": "Vintage Camera"
      },
      "lastMessage": {
        "content": "Is this still available?",
        "createdAt": "2025-12-06T10:00:00Z",
        "isOwn": false
      },
      "unreadCount": 2
    }
  ]
}
```

---

### 3.2 Get Messages (Thread)

**Endpoint:** `GET /api/messages/conversations/:id`

**Auth:** Required

**Query Params:**

- `cursor` (optional): Message ID for pagination
- `limit` (optional): Default 50, max 100

**Response:**

```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "conv_123",
      "participant": {
        "id": "user_456",
        "name": "John Doe",
        "image": "https://..."
      },
      "listing": {
        "id": "listing_789",
        "title": "Vintage Camera"
      }
    },
    "messages": [
      {
        "id": "msg_001",
        "content": "Hello, is this available?",
        "createdAt": "2025-12-06T09:00:00Z",
        "isOwn": false,
        "readByOther": false
      },
      {
        "id": "msg_002",
        "content": "Yes, it is!",
        "createdAt": "2025-12-06T09:05:00Z",
        "isOwn": true,
        "readByOther": true
      }
    ],
    "nextCursor": "msg_000"
  }
}
```

**Message Fields:**

- `isOwn`: Whether the message was sent by the current user
- `readByOther`: Read receipt - true if the other participant has read this message (only meaningful for own messages)

**Side Effect:** Calling this endpoint marks all messages as read for the current user.

---

### 3.3 Send Message

**Endpoint:** `POST /api/messages`

**Auth:** Required

**Request Body:**

```json
{
  "recipientId": "user_456", // Required if starting new conversation
  "conversationId": "conv_123", // Optional, for replies
  "content": "Hello!", // Required, 1-2000 chars
  "listingId": "listing_789" // Optional, context
}
```

**Logic:**

1. If `conversationId` is provided → reply to existing conversation
2. If `recipientId` is provided → check if conversation exists between these two users
   - If exists → use existing conversation
   - If not → create new conversation
3. Create message in conversation
4. Update `lastMessageAt` on conversation

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "msg_003",
    "conversationId": "conv_123",
    "content": "Hello!",
    "createdAt": "2025-12-06T10:00:00Z"
  }
}
```

**Errors:**

- `400 VALIDATION_ERROR`: Invalid content (empty or too long)
- `400 INVALID_RECIPIENT`: Cannot message yourself
- `403 FORBIDDEN`: Not a participant of the conversation
- `404 NOT_FOUND`: Recipient or conversation not found

---

### 3.4 Get Unread Count

**Endpoint:** `GET /api/messages/unread-count`

**Auth:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

## 4. Validation Rules (Zod)

### SendMessageSchema

```typescript
const SendMessageSchema = z
  .object({
    recipientId: z.string().optional(),
    conversationId: z.string().optional(),
    content: z.string().min(1).max(2000),
    listingId: z.string().optional(),
  })
  .refine((data) => data.recipientId || data.conversationId, {
    message: "Either recipientId or conversationId is required",
  });
```

### GetMessagesQuerySchema

```typescript
const GetMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});
```

---

## 5. Security Requirements

1. **Authentication:** All endpoints require valid session
2. **Authorization:**
   - Users can only access conversations they are participants of
   - Validate participant membership before any read/write operation
3. **Self-messaging Prevention:** Users cannot send messages to themselves
4. **Input Sanitization:** Content is stored as-is (no HTML allowed in UI)

---

## 6. Implementation Checklist

- [x] DTO: `src/server/dto/messages.dto.ts`
- [x] DAL: `src/server/dal/messages.dal.ts`
- [x] Service: `src/server/services/messages.service.ts`
- [x] API Routes:
  - [x] `src/app/api/messages/route.ts` (POST)
  - [x] `src/app/api/messages/conversations/route.ts` (GET)
  - [x] `src/app/api/messages/conversations/[id]/route.ts` (GET)
  - [x] `src/app/api/messages/unread-count/route.ts` (GET)
- [x] Client API: `src/features/app/messages/api/messages.api.ts`
- [x] TanStack Query Integration: `useMessages`, `useMessageDetail` hooks

## 7. Real-time Implementation Strategy

**Status: ✅ Implemented (Ably Real-time)**

Real-time updates are handled via **Ably**, replacing the previous polling mechanism.

- **Events**:
  - `message:new`: Instant delivery of new messages.
  - `message:read`: Real-time read receipts.
  - `badge:messages`: Instant update of unread count.
  - `conversation:update`: Refresh inbox list when new messages arrive.

- **Architecture**:
  - Fire-and-forget publishing from Backend Service.
  - Client subscribes using `useAblyChannel` hook with Zod validation.
  - See `docs/plans/plan_ably_integration.md` for full architecture.
