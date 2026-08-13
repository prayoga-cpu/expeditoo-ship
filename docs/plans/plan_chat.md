# Implementation Plan: Chat & Messaging System

## Overview

Build a complete real-time messaging system that allows buyers and sellers to communicate about listings. The UI is already 100% complete, this plan focuses on backend implementation.

## Current Status

- ✅ **UI Complete** - Full chat interface with search, tabs, and message display
- ✅ **Types Defined** - Message, MessageTab, Conversation interfaces
- ✅ **Hooks Implemented** - useMessages, useMessageDetail
- ✅ **Backend** - Implemented
- ✅ **Real-time** - Implemented via Ably

## Prerequisites

- Database setup (PostgreSQL + Drizzle ORM) ✅
- Authentication system (better-auth) ✅ Already implemented
- Ably Real-time setup ✅

---

## Implementation Steps

### 1. Database Schema

**Files to Create:**

- `src/db/schemas/messages.ts` (Contains both conversations and messages)

**Schema Design:**

```typescript
// conversations table
- id (text, primary key)
- listingId (text, foreign key to listings)
- lastMessageAt (timestamp, nullable)
- createdAt (timestamp)
- updatedAt (timestamp)

// conversation_participants table
- id (text, primary key)
- conversationId (text, foreign key to conversations)
- userId (text, foreign key to users)
- lastReadAt (timestamp)
- joinedAt (timestamp)
- deletedAt (timestamp) // Soft delete
- lastClearedAt (timestamp) // Clear history

// messages table
- id (text, primary key)
- conversationId (text, foreign key to conversations)
- senderId (text, foreign key to users)
- content (text)
- attachments (json, nullable)
- isRead (boolean, default false)
- createdAt (timestamp)
```

**Indexes:**

- conversation_participants: (userId), (conversationId)
- messages: (conversationId, createdAt)

---

### 2. DTO Layer

**Files to Create:**

- `src/server/dto/messages.dto.ts`

**Schemas to Define:**

```typescript
// Input DTOs
- createConversationInput (listingId, recipientId)
- sendMessageInput (conversationId, content, attachments?)
- getConversationsInput (userId, tab: 'all' | 'inbox' | 'unread', search?)
- getMessagesInput (conversationId, limit, offset)
- markAsReadInput (conversationId, messageIds[])

// Output DTOs
- conversationOutput
- messageOutput
- conversationListOutput
- messageListOutput
```

---

### 3. DAL (Data Access Layer)

**Files to Create:**

- `src/server/dal/conversations.dal.ts`
- `src/server/dal/messages.dal.ts`

**Functions:**

**Conversations DAL:**

- `createConversation(data)`
- `getConversationById(id)`
- `getConversationByParticipants(buyerId, sellerId, listingId)`
- `getUserConversations(userId, filters)`
- `updateLastMessageTime(conversationId)`
- `deleteConversation(id)`

**Messages DAL:**

- `createMessage(data)`
- `getMessagesByConversation(conversationId, pagination)`
- `markMessagesAsRead(conversationId, userId)`
- `getUnreadCount(userId)`
- `deleteMessage(id)`

---

### 4. Service Layer

**Files to Create:**

- `src/server/services/conversations.service.ts`
- `src/server/services/messages.service.ts`

**Business Logic:**

**Conversations Service:**

- Validate user permissions (can only access own conversations)
- Auto-create conversation if doesn't exist
- Calculate unread counts per conversation
- Filter conversations by tab (all/inbox/unread)
- Search conversations by listing title or participant name

**Messages Service:**

- Validate sender is participant in conversation
- Validate message content (max length, no empty)
- Handle file attachments (validate type, size)
- Mark messages as read when viewed
- Emit WebSocket events for real-time delivery

---

### 5. API Routes

**Files to Create:**

- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/[id]/route.ts`
- `src/app/api/conversations/[id]/messages/route.ts`
- `src/app/api/messages/[id]/route.ts`

**Endpoints:**

```
GET    /api/conversations              # List user's conversations
POST   /api/conversations              # Create new conversation
GET    /api/conversations/:id          # Get conversation details
DELETE /api/conversations/:id          # Delete conversation

GET    /api/conversations/:id/messages # Get messages in conversation
POST   /api/conversations/:id/messages # Send message
PATCH  /api/conversations/:id/read     # Mark as read

PATCH  /api/messages/:id               # Edit message
DELETE /api/messages/:id               # Delete message
```

---

### 6. Real-time Integration (Ably)

**Status: ✅ Implemented**

- See `docs/plans/plan_ably_integration.md` for full details.
- Implements `message:new`, `message:read` events.

---

### 7. Client API Layer

**Files to Create:**

- `src/features/app/messages/api/conversations.api.ts`
- `src/features/app/messages/api/messages.api.ts`

**Functions:**

```typescript
// Conversations API
-fetchConversations(filters) -
  createConversation(listingId, recipientId) -
  deleteConversation(id) -
  // Messages API
  fetchMessages(conversationId, pagination) -
  sendMessage(conversationId, content, attachments) -
  markAsRead(conversationId) -
  editMessage(messageId, content) -
  deleteMessage(messageId);
```

---

### 8. Update Hooks (Replace Mock Data)

**Files to Modify:**

- `src/features/app/messages/hooks/useMessages.ts`
- `src/features/app/messages/hooks/useMessageDetail.ts`

**Changes:**

- Replace mock data with TanStack Query
- Implement real-time updates via WebSocket
- Add optimistic updates for sending messages
- Add loading and error states
- Implement infinite scroll for message history

---

### 9. File Attachments (Optional Enhancement)

**Files to Create:**

- `src/app/api/messages/upload/route.ts`

**Features:**

- Generate presigned URLs for R2/S3
- Validate file types (images, documents)
- Limit file size (e.g., 10MB)
- Store file metadata in messages table
- Display image previews in chat

---

## Verification Steps

### Backend Testing:

1. ✅ Can create conversation between buyer and seller
2. ✅ Can send messages in conversation
3. ✅ Messages appear in real-time for recipient
4. ✅ Unread counts update correctly
5. ✅ Search filters conversations properly
6. ✅ Tab filtering works (all/inbox/unread)
7. ✅ Mark as read updates status
8. ✅ Only participants can access conversation
9. ✅ Deleted messages are removed
10. ✅ File attachments upload and display

### Frontend Integration:

1. ✅ Replace mock data with API calls
2. ✅ Real-time message delivery works
3. ✅ Typing indicators appear
4. ✅ Online/offline status shows
5. ✅ Optimistic updates work smoothly
6. ✅ Error handling displays properly
7. ✅ Loading states show during fetch
8. ✅ Infinite scroll loads more messages

---

## Performance Considerations

1. **Pagination:** Load messages in chunks (20-50 per page)
2. **Indexing:** Ensure database indexes on frequently queried fields
3. **Caching:** Cache conversation list with TanStack Query
4. **WebSocket:** Use rooms to limit broadcast scope
5. **Debouncing:** Debounce typing indicators (500ms)

---

## Security Considerations

1. **Authorization:** Verify user is participant before allowing access
2. **Rate Limiting:** Limit messages per minute (e.g., 10 messages/min)
3. **Content Validation:** Sanitize message content, prevent XSS
4. **File Upload:** Validate file types, scan for malware
5. **Spam Prevention:** Implement reporting and blocking features

---

## Estimated Complexity

- **Database Schema:** 2 hours
- **DTO + DAL:** 3 hours
- **Service Layer:** 4 hours
- **API Routes:** 4 hours
- **WebSocket Setup:** 3 hours
- **Client API:** 2 hours
- **Hook Updates:** 3 hours
- **Testing:** 4 hours

**Total:** ~25 hours

---

## Dependencies

- Ably (ably.io)
- TanStack Query (already in package.json)
- R2/S3 for file storage (optional)
- Image processing library (Sharp) for attachments

---

## Notes

- UI is already production-ready, no changes needed
- Focus on backend implementation following clean architecture
- Consider using Pusher for easier real-time implementation
- File attachments can be added in Phase 2
- Implement read receipts and typing indicators after core messaging works
