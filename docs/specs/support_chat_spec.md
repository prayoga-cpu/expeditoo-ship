# Support Chat Feature Specification

## Overview
Enable users to chat directly with admin support team from the Help page. Support chats are distinguished from regular listing-related chats and are accessible to all admins.

## User Stories

### As a User
- I can click "Chat with Support" button on Help page
- I can send messages to admin support team
- I can see my support chat in Messages page with a special badge
- I have one persistent support chat room (not multiple)

### As an Admin
- I can see all support chat requests in a dedicated "Support Chats" tab
- I can reply to any support chat
- I can see which support chats have unread messages
- All admins can access and reply to support chats

## Technical Specification

### 1. Database Schema Changes

**chatRooms table** - Add new field:
```typescript
type: "SUPPORT" | "LISTING"  // New enum field to distinguish chat types
```

**Migration:**
- Add `type` column to `chatRooms` table
- Default existing chats to "LISTING"
- New support chats will be "SUPPORT"

### 2. Chat Room Creation Rules

**Support Chat:**
- Type: `SUPPORT`
- Participants: User + Admin (adminId can be null initially)
- listingId: `null` (no associated listing)
- One per user (check if exists before creating)

**Listing Chat:**
- Type: `LISTING`
- Participants: Buyer + Seller
- listingId: Required
- Multiple allowed (one per listing)

### 3. API Endpoints

#### Create/Get Support Chat
```
POST /api/chat/support
Body: { userId: string }
Response: { chatRoomId: string, exists: boolean }

Logic:
1. Check if user already has a support chat room
2. If exists, return existing chatRoomId
3. If not, create new chat room with type="SUPPORT"
4. Return chatRoomId
```

#### Get Support Chats (Admin Only)
```
GET /api/admin/support-chats
Query: ?status=all|unread
Response: { chats: ChatRoom[] }

Logic:
1. Verify user is admin
2. Fetch all chat rooms where type="SUPPORT"
3. Include participant info, last message, unread count
4. Sort by last message timestamp (newest first)
```

### 4. Frontend Components

#### Help Page Button
**Location:** `/help` page
**Component:** Update existing "Chat with Support" button

**Behavior:**
1. onClick: Call `POST /api/chat/support`
2. Get chatRoomId from response
3. Navigate to `/messages/${chatRoomId}`

#### Messages Page
**Location:** `/messages`
**Component:** Update MessageList

**Changes:**
1. Add badge for support chats (e.g., "Support" badge)
2. Support chats appear in "All" and "Inbox" tabs
3. Visual distinction (icon, color, or badge)

**Badge Design:**
- Text: "Support" or "Help"
- Color: Blue or distinct from listing chats
- Icon: Headset or LifeBuoy icon

#### Admin Dashboard
**Location:** `/admin/dashboard`
**Component:** New "Support Chats" tab

**Features:**
1. List all support chats
2. Show user info (name, email, avatar)
3. Show last message preview
4. Show unread count
5. Click to open chat in Messages page
6. Filter: All / Unread

**Layout:**
```
┌─────────────────────────────────────┐
│ Support Chats                  [🔍] │
├─────────────────────────────────────┤
│ 👤 John Doe              [2 unread] │
│    "I need help with..."            │
│    2 hours ago                      │
├─────────────────────────────────────┤
│ 👤 Jane Smith            [0 unread] │
│    "Thank you for the help!"        │
│    1 day ago                        │
└─────────────────────────────────────┘
```

### 5. Validation Rules

**Support Chat Creation:**
- User must be authenticated
- Only one support chat per user
- Cannot create support chat for another user

**Admin Access:**
- Only users with role "ADMIN" can access support chats tab
- All admins can see all support chats
- Admins can reply to any support chat

### 6. Edge Cases

**Case 1: User tries to create multiple support chats**
- System returns existing chat room
- No duplicate support chats created

**Case 2: Admin deletes support chat**
- User can recreate support chat
- Previous messages are lost (soft delete recommended)

**Case 3: User sends message before admin replies**
- Messages queue normally
- Admin sees all messages when they open chat

**Case 4: Multiple admins reply simultaneously**
- Standard chat behavior (last message wins)
- No special locking needed

### 7. UI/UX Specifications

**Support Chat Badge:**
- Position: Next to chat name in list
- Style: Small pill badge
- Text: "Support"
- Color: Blue (#3B82F6)
- Icon: Optional headset icon

**Admin Tab:**
- Tab name: "Support Chats"
- Icon: Headset or MessageCircle
- Badge: Total unread count across all support chats
- Empty state: "No support requests yet"

### 8. Notifications

**User Side:**
- Receive notification when admin replies
- Same notification system as regular chats

**Admin Side:**
- Receive notification for new support chat messages
- Badge on "Support Chats" tab shows total unread

### 9. Translations

Add to `messages/{lang}.json`:
```json
{
  "supportChat": {
    "title": "Support Chat",
    "badge": "Support",
    "startChat": "Chat with Support",
    "adminTab": "Support Chats",
    "emptyState": "No support requests yet",
    "description": "Get help from our support team"
  }
}
```

### 10. Testing Scenarios

**Scenario 1: User creates support chat**
1. User clicks "Chat with Support"
2. System creates chat room with type="SUPPORT"
3. User is redirected to chat page
4. User can send messages

**Scenario 2: User tries to create second support chat**
1. User clicks "Chat with Support" again
2. System returns existing chat room
3. User is redirected to same chat page
4. No duplicate created

**Scenario 3: Admin views support chats**
1. Admin navigates to Admin Dashboard
2. Admin clicks "Support Chats" tab
3. Admin sees list of all support chats
4. Admin can click to open and reply

**Scenario 4: Support chat appears in Messages**
1. User opens Messages page
2. Support chat appears with "Support" badge
3. User can access support chat from Messages
4. Badge distinguishes it from listing chats

## Success Criteria

✅ User can create support chat from Help page
✅ Only one support chat per user
✅ Support chat appears in user's Messages with badge
✅ Admin can see all support chats in dedicated tab
✅ All admins can reply to support chats
✅ Support chats are visually distinct from listing chats
✅ Notifications work for both user and admin
✅ No duplicate support chats can be created

## Implementation Order

1. Update database schema (add `type` field)
2. Create backend API endpoints
3. Update Help page button
4. Update Messages page to show badge
5. Create Admin Support Chats tab
6. Add translations
7. Test all scenarios
