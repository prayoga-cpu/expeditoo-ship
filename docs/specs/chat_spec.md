# Specification: Chat & Messaging System

## Overview

Real-time messaging system enabling communication between buyers and sellers about specific listings. Messages are organized into conversations, with support for search, filtering, and real-time delivery.

---

## User Stories

### As a Buyer:

- I want to message sellers about their listings so that I can ask questions before purchasing
- I want to see all my conversations in one place so that I can manage communications
- I want to search conversations so that I can find specific discussions quickly
- I want to see unread messages so that I don't miss important information
- I want real-time message delivery so that conversations feel natural

### As a Seller:

- I want to receive messages from interested buyers so that I can answer questions
- I want to see which listing each conversation is about so that I have context
- I want to mark messages as read so that I can track which conversations need attention
- I want to be notified of new messages so that I can respond promptly

---

## Functional Requirements

### Feature 1: Conversation List

**Input:**

- `userId`: string (from session, required)
- `tab`: "all" | "inbox" | "unread" (optional, default: "all")
- `search`: string (optional, for filtering by listing title or participant name)
- `limit`: number (optional, default: 20)
- `offset`: number (optional, default: 0)

**Output (Success):**

```json
{
  "conversations": [
    {
      "id": "conv-123",
      "listing": {
        "id": "listing-456",
        "title": "Vintage Bicycle",
        "image": "https://..."
      },
      "participant": {
        "id": "user-789",
        "name": "John Doe",
        "avatar": "https://..."
      },
      "lastMessage": {
        "content": "Is this still available?",
        "timestamp": "2025-11-28T10:30:00Z",
        "senderId": "user-789"
      },
      "unreadCount": 2,
      "updatedAt": "2025-11-28T10:30:00Z"
    }
  ],
  "total": 15,
  "hasMore": true
}
```

**Behavior:**

1. When tab is "all", return all conversations for user
2. When tab is "inbox", return conversations where user is recipient
3. When tab is "unread", return only conversations with unread messages
4. When search is provided, filter by listing title or participant name (case-insensitive)
5. Sort by `updatedAt` descending (most recent first)
6. Calculate unread count per conversation (messages where `isRead=false` and `senderId != userId`)

**Validation Rules:**

- User must be authenticated
- Tab must be one of: "all", "inbox", "unread"
- Limit must be between 1 and 100
- Offset must be >= 0

**Error Scenarios:**
| Scenario | Expected Error | HTTP Status |
|----------|----------------|-------------|
| Not authenticated | "Authentication required" | 401 |
| Invalid tab value | "Invalid tab parameter" | 400 |
| Limit out of range | "Limit must be between 1 and 100" | 400 |

---

### Feature 2: Create Conversation

**Input:**

```json
{
  "listingId": "listing-456",
  "recipientId": "user-789"
}
```

**Output (Success):**

```json
{
  "id": "conv-123",
  "listingId": "listing-456",
  "createdAt": "2025-11-28T10:00:00Z"
}
```

**Behavior:**

1. Check if conversation already exists between these users for this listing
2. If exists, return existing conversation
3. If not exists, create new conversation
4. Add both users as participants in `conversation_participants` table
5. Initialize lastMessageAt to null

**Validation Rules:**

- User must be authenticated
- Listing must exist
- Recipient must exist
- User cannot create conversation with themselves
- Listing must belong to recipient (seller)

**Error Scenarios:**
| Scenario | Expected Error | HTTP Status |
|----------|----------------|-------------|
| Listing not found | "Listing not found" | 404 |
| Recipient not found | "User not found" | 404 |
| Self-conversation | "Cannot message yourself" | 400 |
| Not listing owner | "Recipient is not the seller" | 400 |

---

### Feature 3: Send Message

**Input:**

```json
{
  "conversationId": "conv-123",
  "content": "Is this still available?",
  "attachments": [
    {
      "type": "image",
      "url": "https://...",
      "filename": "photo.jpg"
    }
  ]
}
```

**Output (Success):**

```json
{
  "id": "msg-456",
  "conversationId": "conv-123",
  "senderId": "user-current",
  "content": "Is this still available?",
  "attachments": [...],
  "isRead": false,
  "createdAt": "2025-11-28T10:30:00Z"
}
```

**Behavior:**

1. Validate user is participant in conversation
2. Validate message content is not empty (after trimming)
3. Create message record
4. Update conversation's lastMessageAt
5. Emit WebSocket event to recipient
6. Return created message

**Validation Rules:**

- Content must not be empty after trimming
- Content max length: 1000 characters
- Attachments max count: 5
- Each attachment max size: 10MB
- Allowed attachment types: image/\*, application/pdf

**Error Scenarios:**
| Scenario | Expected Error | HTTP Status |
|----------|----------------|-------------|
| Empty content | "Message cannot be empty" | 400 |
| Content too long | "Message exceeds 1000 characters" | 400 |
| Not participant | "Access denied" | 403 |
| Conversation not found | "Conversation not found" | 404 |
| Too many attachments | "Maximum 5 attachments allowed" | 400 |
| Invalid file type | "File type not allowed" | 400 |
| File too large | "File size exceeds 10MB" | 400 |

---

### Feature 4: Get Messages

**Input:**

- `conversationId`: string (required)
- `limit`: number (optional, default: 50)
- `before`: string (message ID, for pagination, optional)

**Output (Success):**

```json
{
  "messages": [
    {
      "id": "msg-456",
      "senderId": "user-789",
      "content": "Is this still available?",
      "attachments": [],
      "isRead": true,
      "createdAt": "2025-11-28T10:30:00Z"
    }
  ],
  "hasMore": true
}
```

**Behavior:**

1. Validate user is participant in conversation
2. If `before` is provided, get messages created before that message
3. Sort by createdAt descending (newest first)
4. Limit results to specified limit
5. Return hasMore flag if more messages exist

**Validation Rules:**

- User must be participant in conversation
- Limit must be between 1 and 100

**Error Scenarios:**
| Scenario | Expected Error | HTTP Status |
|----------|----------------|-------------|
| Not participant | "Access denied" | 403 |
| Conversation not found | "Conversation not found" | 404 |
| Invalid limit | "Limit must be between 1 and 100" | 400 |

---

### Feature 5: Mark as Read

**Input:**

```json
{
  "conversationId": "conv-123"
}
```

**Output (Success):**

```json
{
  "updatedCount": 3
}
```

**Behavior:**

1. Validate user is participant in conversation
2. Mark all unread messages in conversation as read (where senderId != current user)
3. Return count of updated messages
4. Emit WebSocket event to sender (read receipt)

**Validation Rules:**

- User must be participant in conversation

**Error Scenarios:**
| Scenario | Expected Error | HTTP Status |
|----------|----------------|-------------|
| Not participant | "Access denied" | 403 |
| Conversation not found | "Conversation not found" | 404 |

---

## Real-Time Events (WebSocket)

### Event: `message:new`

**Payload:**

```json
{
  "conversationId": "conv-123",
  "message": {
    "id": "msg-456",
    "senderId": "user-789",
    "content": "Hello!",
    "createdAt": "2025-11-28T10:30:00Z"
  }
}
```

**Trigger:** When a new message is sent
**Recipients:** All participants in the conversation

---

### Event: `message:read`

**Payload:**

```json
{
  "conversationId": "conv-123",
  "messageIds": ["msg-456", "msg-457"],
  "readBy": "user-current"
}
```

**Trigger:** When messages are marked as read
**Recipients:** Message senders

---

### Event: `typing:start`

**Payload:**

```json
{
  "conversationId": "conv-123",
  "userId": "user-789"
}
```

**Trigger:** When user starts typing (debounced 500ms)
**Recipients:** Other participants in conversation

---

### Event: `typing:stop`

**Payload:**

```json
{
  "conversationId": "conv-123",
  "userId": "user-789"
}
```

**Trigger:** When user stops typing (after 3s of inactivity)
**Recipients:** Other participants in conversation

---

## Database Schema

### Table: `conversations`

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_listing ON conversations(listing_id);
```

### Table: `conversation_participants`

```sql
CREATE TABLE conversation_participants (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP, -- Soft delete (hides conversation from list)
  last_cleared_at TIMESTAMP, -- Hides messages before this date (clear history)
  
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);
```

### Table: `messages`

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;
```

---

## Edge Cases

### Case 1: User tries to message themselves

**Expected:** Return 400 error "Cannot message yourself"

### Case 2: Conversation already exists

**Expected:** Return existing conversation, don't create duplicate

### Case 3: Listing is deleted

**Expected:** Conversation is cascade deleted, messages are also deleted

### Case 4: User is blocked

**Expected:** (Future) Return 403 error "User has blocked you"

### Case 5: Rapid message sending (spam)

**Expected:** Rate limit to 10 messages per minute, return 429 error

### Case 6: Very long message

**Expected:** Truncate at 1000 characters or return 400 error

### Case 7: WebSocket disconnection

**Expected:** Messages queued on server, delivered when reconnected

### Case 8: Offline recipient

**Expected:** Message saved, push notification sent (if enabled)

---

## Testing Checklist

- [ ] Can create conversation between buyer and seller
- [ ] Cannot create conversation with self
- [ ] Duplicate conversation returns existing one
- [ ] Can send text message
- [ ] Can send message with image attachment
- [ ] Cannot send empty message
- [ ] Cannot send message longer than 1000 chars
- [ ] Messages appear in real-time for recipient
- [ ] Unread count updates correctly
- [ ] Mark as read updates all unread messages
- [ ] Search filters conversations by listing title
- [ ] Search filters conversations by participant name
- [ ] Tab "all" shows all conversations
- [ ] Tab "unread" shows only unread conversations
- [ ] Pagination works correctly
- [ ] Only participants can access conversation
- [ ] Deleted conversation removes all messages
- [ ] Typing indicator appears and disappears
- [ ] Rate limiting prevents spam
- [ ] File upload validates type and size

---

## Performance Requirements

- Message delivery latency: < 500ms
- Conversation list load time: < 1s
- Message history load time: < 1s
- Support 1000+ concurrent WebSocket connections
- Database queries < 100ms (with proper indexing)

---

## Security Requirements

- All API endpoints require authentication
- Users can only access their own conversations
- Message content is sanitized to prevent XSS
- File uploads are scanned for malware
- Rate limiting prevents abuse
- WebSocket connections are authenticated

---

## Notes

- Consider implementing message encryption for privacy
- Add support for message reactions (emoji) in future
- Add support for voice messages in future
- Consider adding "delete for everyone" feature
- Implement message search within conversation
- Add support for group conversations (future)
