# Plan: Notification Floating Box

**Feature:** Notification Floating Box/Popover  
**Type:** UI Enhancement  
**Priority:** High  
**Estimated Complexity:** Medium (5/10)

---

## Overview

Transform the notification system from a page-only view to a floating box/popover that appears when clicking the notification bell icon. The `/notifications` page will remain as a "View All" destination.

---

## Current State

- ✅ Notification Bell icon in header (`NotificationBell.tsx`)
- ✅ Notification page at `/notifications`
- ✅ Notification types: bid, delivery, message, review, payment, listing
- ✅ Mock data with all required notification types
- ✅ `useNotifications` hook for business logic

**Problem:** Bell icon only links to `/notifications` page - no floating preview.

---

## Goals

1. Create a floating notification popover/dropdown
2. Show recent notifications (max 5) in the popover
3. Display unread count badge
4. Include "View All" link to `/notifications` page
5. Support all notification types (bid outbid, auction end, proposal, shipment status)
6. Responsive design for desktop and mobile
7. Auto-close on outside click
8. Mark as read on click

---

## Implementation Steps

### Step 1: Create Specification

- [ ] Document exact behavior in `docs/specs/notification_floating_box_spec.md`
- [ ] Define UI/UX requirements
- [ ] Specify interaction patterns

### Step 2: Create NotificationPopover Component

- [ ] Create `src/features/app/notifications/ui/NotificationPopover.tsx`
- [ ] Use shadcn/ui Popover component
- [ ] Display max 5 recent notifications
- [ ] Show "View All" button at bottom
- [ ] Show "Mark all as read" button
- [ ] Handle empty state

### Step 3: Update NotificationBell Component

- [ ] Modify `src/components/NotificationBell.tsx`
- [ ] Remove Link wrapper
- [ ] Integrate NotificationPopover
- [ ] Keep unread count badge
- [ ] Add click handler for popover toggle

### Step 4: Create Compact NotificationItem

- [ ] Create `NotificationItemCompact.tsx` for popover use
- [ ] Smaller, condensed version of NotificationItem
- [ ] Show icon, title, timestamp only
- [ ] Click navigates to notification link

### Step 5: Update useNotifications Hook (Optional)

- [ ] Add `getRecentNotifications()` method (returns max 5)
- [ ] Ensure `markAsRead` works for individual items

### Step 6: Keep Notifications Page

- [ ] `/notifications` page remains unchanged
- [ ] Serves as "View All" destination
- [ ] Full notification management interface

---

## Files to Create

```
src/features/app/notifications/ui/
  ├── NotificationPopover.tsx          (NEW)
  └── NotificationItemCompact.tsx      (NEW)

docs/specs/
  └── notification_floating_box_spec.md (NEW)
```

---

## Files to Modify

```
src/components/NotificationBell.tsx     (MODIFY - integrate popover)
src/features/app/notifications/hooks/useNotifications.ts (OPTIONAL - add helper methods)
```

---

## UI/UX Requirements

### Desktop

- Popover appears below bell icon
- Width: 380px
- Max height: 480px
- Scrollable if more than 5 items
- Smooth animation (fade + slide)

### Mobile

- Popover appears below bell icon
- Width: calc(100vw - 32px) - responsive
- Max height: 60vh
- Scrollable
- Backdrop overlay (optional)

### Popover Content Structure

```
┌─────────────────────────────────┐
│ Notifications            [Mark] │ <- Header
├─────────────────────────────────┤
│ [Icon] Bid outbid        5m ago │
│ [Icon] Package in transit 30m   │
│ [Icon] New message       2h ago │
│ ...                             │
├─────────────────────────────────┤
│         [View All]              │ <- Footer
└─────────────────────────────────┘
```

---

## Notification Types to Support

1. **Bid Outbid** - `type: "bid"`
   - Icon: TrendingUp
   - Example: "You were outbid for Mixer + Vacuum lot"

2. **Auction End** - `type: "listing"`
   - Icon: AlertCircle
   - Example: "Auction ended - You won!"

3. **Proposal Received** - `type: "message"`
   - Icon: MessageCircle
   - Example: "Thomas M. sent you a shipment proposal"

4. **Shipment Status Changes** - `type: "delivery"`
   - Icon: Truck
   - Example: "Your package is in transit"

---

## Edge Cases

- [ ] No notifications (empty state)
- [ ] All notifications read (show message)
- [ ] Very long notification titles (truncate)
- [ ] Rapid clicking (debounce)
- [ ] Mobile viewport (responsive width)

---

## Dependencies

- `@radix-ui/react-popover` (already installed via shadcn/ui)
- Existing `useNotifications` hook
- Existing notification types and mock data

---

## Testing Checklist

- [ ] Popover opens on bell click
- [ ] Popover closes on outside click
- [ ] Shows max 5 recent notifications
- [ ] Unread badge updates correctly
- [ ] "View All" navigates to `/notifications`
- [ ] "Mark all as read" works
- [ ] Individual notification click navigates correctly
- [ ] Responsive on mobile
- [ ] Empty state displays correctly
- [ ] All notification types render correctly

---

## Success Criteria

✅ Notification popover appears on bell icon click  
✅ Shows 5 most recent notifications  
✅ Displays all required notification types  
✅ Responsive for desktop and mobile  
✅ "View All" link works  
✅ Mark as read functionality works  
✅ Follows existing UI/UX design patterns  
✅ No breaking changes to existing `/notifications` page
