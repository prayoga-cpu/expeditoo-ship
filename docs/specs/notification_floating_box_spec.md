# Notification Floating Box Specification

**Version:** 1.0  
**Last Updated:** 2025-11-28  
**Status:** Draft

---

## 1. Overview

This specification defines the exact behavior and implementation details for the Notification Floating Box/Popover feature. The floating box appears when users click the notification bell icon in the header.

---

## 2. Functional Requirements

### 2.1 Trigger Behavior

**WHEN** user clicks the notification bell icon  
**THEN** a floating popover appears below the bell icon  
**AND** displays the 5 most recent notifications

**WHEN** user clicks outside the popover  
**THEN** the popover closes automatically

**WHEN** user clicks the bell icon while popover is open  
**THEN** the popover closes (toggle behavior)

### 2.2 Notification Display

**GIVEN** user has notifications  
**WHEN** popover opens  
**THEN** display up to 5 most recent notifications, sorted by timestamp (newest first)

**GIVEN** user has more than 5 notifications  
**WHEN** popover opens  
**THEN** show only the 5 most recent  
**AND** display "View All" button to see complete list

**GIVEN** user has 0 notifications  
**WHEN** popover opens  
**THEN** display empty state message: "No notifications yet"

### 2.3 Notification Types

The popover MUST support all notification types:

| Type       | Icon          | Example Title        | Example Description                      |
| ---------- | ------------- | -------------------- | ---------------------------------------- |
| `bid`      | TrendingUp    | "New bid"            | "You were outbid for Mixer + Vacuum lot" |
| `listing`  | AlertCircle   | "Auction ended"      | "Your auction for Mixer has ended"       |
| `message`  | MessageCircle | "New message"        | "Thomas M. sent you a message"           |
| `delivery` | Truck         | "Package in transit" | "Your package is being transported"      |
| `review`   | Star          | "New review"         | "Sophie L. left you a 5-star review"     |
| `payment`  | CreditCard    | "Payment received"   | "You received €85"                       |

### 2.4 Interaction Behavior

**WHEN** user clicks on a notification item  
**THEN** navigate to the notification's link (if exists)  
**AND** mark the notification as read  
**AND** close the popover

**WHEN** user clicks "Mark all as read" button  
**THEN** mark all notifications as read  
**AND** update unread badge to 0  
**AND** keep popover open

**WHEN** user clicks "View All" button  
**THEN** navigate to `/notifications` page  
**AND** close the popover

### 2.5 Unread Badge

**GIVEN** user has unread notifications  
**WHEN** header renders  
**THEN** display red badge with unread count on bell icon

**GIVEN** unread count is > 9  
**THEN** display "9+" instead of exact number

**GIVEN** unread count is 0  
**THEN** hide the badge completely

---

## 3. UI/UX Specifications

### 3.1 Popover Dimensions

**Desktop:**

- Width: `380px`
- Max Height: `480px`
- Position: Below bell icon, aligned to right edge
- Offset: `8px` from bell icon

**Mobile (< 768px):**

- Width: `calc(100vw - 32px)` (16px padding on each side)
- Max Height: `60vh`
- Position: Below bell icon, centered horizontally
- Offset: `8px` from bell icon

### 3.2 Popover Structure

```
┌──────────────────────────────────────┐
│  Notifications          Mark all read │  <- Header (sticky)
├──────────────────────────────────────┤
│  ┌────┐                              │
│  │ 🔔 │  New bid              5m ago │  <- Notification Item
│  └────┘  You were outbid...          │
├──────────────────────────────────────┤
│  ┌────┐                              │
│  │ 📦 │  Package in transit   30m    │
│  └────┘  Your package is...          │
├──────────────────────────────────────┤
│  ┌────┐                              │
│  │ 💬 │  New message          2h ago │
│  └────┘  Thomas M. sent...           │
├──────────────────────────────────────┤
│              View All                 │  <- Footer (sticky)
└──────────────────────────────────────┘
```

### 3.3 Notification Item Compact Design

Each notification item in the popover MUST display:

1. **Icon** (left side)
   - Size: `40px × 40px`
   - Background: `bg-primary/10` (unread) or `bg-muted` (read)
   - Icon size: `20px × 20px`
   - Icon color: `text-primary` (unread) or `text-muted-foreground` (read)
   - Border radius: `rounded-lg`

2. **Content** (middle)
   - **Title**: `font-semibold text-sm` (max 1 line, truncate)
   - **Description**: `text-xs text-muted-foreground` (max 2 lines, truncate)
   - Line height: `leading-tight`

3. **Timestamp** (right side, top)
   - Format: "Just now", "5m ago", "2h ago", "Yesterday", "2 days ago"
   - Style: `text-xs text-muted-foreground`

4. **Unread Indicator**
   - Blue dot (`w-2 h-2 rounded-full bg-primary`) on top-right corner if unread

5. **Hover State**
   - Background: `hover:bg-accent`
   - Cursor: `cursor-pointer`
   - Transition: `transition-colors duration-200`

### 3.4 Header Section

- Height: `56px`
- Padding: `px-4 py-3`
- Border bottom: `border-b`
- Background: `bg-background` (sticky)

**Content:**

- Left: "Notifications" (text-base font-semibold)
- Right: "Mark all read" button (text-xs, only if unreadCount > 0)

### 3.5 Footer Section

- Height: `48px`
- Padding: `p-3`
- Border top: `border-t`
- Background: `bg-background` (sticky)

**Content:**

- "View All" button (full width, variant="ghost", text-sm font-medium)

### 3.6 Empty State

**WHEN** no notifications exist:

```
┌──────────────────────────────────────┐
│  Notifications                        │
├──────────────────────────────────────┤
│                                       │
│           ┌────────┐                 │
│           │   🔔   │                 │
│           └────────┘                 │
│                                       │
│      No notifications yet             │
│                                       │
│   We'll notify you when something     │
│   important happens.                  │
│                                       │
└──────────────────────────────────────┘
```

- Icon: Bell (muted, size 48px)
- Title: "No notifications yet" (text-base font-semibold)
- Description: "We'll notify you when something important happens." (text-sm text-muted-foreground)
- Padding: `py-12`

### 3.7 Scrolling Behavior

**GIVEN** notifications exceed popover height  
**THEN** content area becomes scrollable  
**AND** header and footer remain sticky  
**AND** use custom scrollbar styling (thin, minimal)

---

## 4. Animation Specifications

### 4.1 Popover Open Animation

- Duration: `200ms`
- Easing: `ease-out`
- Transform: `scale(0.95)` → `scale(1)`
- Opacity: `0` → `1`
- Transform origin: `top right` (desktop) or `top center` (mobile)

### 4.2 Popover Close Animation

- Duration: `150ms`
- Easing: `ease-in`
- Transform: `scale(1)` → `scale(0.95)`
- Opacity: `1` → `0`

### 4.3 Notification Item Hover

- Duration: `200ms`
- Easing: `ease-out`
- Background transition only

---

## 5. Data Requirements

### 5.1 Input Data

The popover receives data from `useNotifications` hook:

```typescript
{
  notifications: Notification[],      // All notifications
  unreadCount: number,                // Total unread count
  markAsRead: (id: string) => void,   // Mark single as read
  markAllAsRead: () => void,          // Mark all as read
}
```

### 5.2 Notification Object Structure

```typescript
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  icon: React.ElementType;
  link?: string;
  action?: NotificationAction;
}
```

### 5.3 Data Filtering

**For Popover Display:**

- Sort by timestamp (newest first)
- Take first 5 items only
- No filtering by read/unread status

**For Full Page (`/notifications`):**

- Show all notifications
- Support tab filtering (All, Unread, Messages)

---

## 6. Edge Cases & Error Handling

### 6.1 Edge Case: Rapid Clicking

**GIVEN** user clicks bell icon rapidly  
**THEN** debounce clicks (100ms)  
**AND** prevent multiple popovers from opening

### 6.2 Edge Case: Long Titles

**GIVEN** notification title exceeds 1 line  
**THEN** truncate with ellipsis (`truncate` class)

### 6.3 Edge Case: Long Descriptions

**GIVEN** notification description exceeds 2 lines  
**THEN** truncate with ellipsis (`line-clamp-2` class)

### 6.4 Edge Case: No Link

**GIVEN** notification has no `link` property  
**THEN** item is still clickable  
**AND** only marks as read (no navigation)

### 6.5 Edge Case: Mobile Viewport

**GIVEN** viewport width < 380px  
**THEN** popover width adjusts to `calc(100vw - 32px)`  
**AND** maintains 16px margin on both sides

### 6.6 Edge Case: Notification Arrives While Popover Open

**GIVEN** popover is open  
**WHEN** new notification arrives (future real-time feature)  
**THEN** popover content updates automatically  
**AND** unread badge updates

---

## 7. Accessibility Requirements

### 7.1 Keyboard Navigation

- **Tab**: Focus on bell icon
- **Enter/Space**: Toggle popover
- **Escape**: Close popover
- **Tab (inside popover)**: Navigate through items
- **Enter (on item)**: Activate notification

### 7.2 ARIA Attributes

```html
<button
  aria-label="Notifications"
  aria-expanded="{isOpen}"
  aria-haspopup="dialog"
>
  <Bell />
  {unreadCount > 0 && (
  <span aria-label="{`${unreadCount}" unread notifications`}>
    {unreadCount}
  </span>
  )}
</button>
```

### 7.3 Screen Reader Support

- Announce unread count on bell icon
- Announce "Notifications popover opened" when opened
- Each notification item has descriptive aria-label

---

## 8. Performance Requirements

### 8.1 Rendering Performance

- Popover MUST render within 100ms of click
- No layout shift when opening/closing
- Smooth 60fps animations

### 8.2 Data Optimization

- Only fetch/display 5 most recent notifications
- Use `useMemo` for filtered/sorted data
- Lazy load full list only on "View All" click

---

## 9. Integration Points

### 9.1 NotificationBell Component

**Current Behavior:**

```tsx
<Link href="/notifications">
  <Bell />
  {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
</Link>
```

**New Behavior:**

```tsx
<Popover>
  <PopoverTrigger>
    <Bell />
    {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
  </PopoverTrigger>
  <PopoverContent>
    <NotificationPopover />
  </PopoverContent>
</Popover>
```

### 9.2 Notifications Page

**MUST remain unchanged:**

- Full notification list
- Tab filtering (All, Unread, Messages)
- Mark all as read
- Dismiss notifications
- Pagination (future)

---

## 10. Testing Scenarios

### 10.1 Functional Tests

- [ ] Popover opens on bell click
- [ ] Popover closes on outside click
- [ ] Popover closes on bell re-click
- [ ] Shows exactly 5 notifications (if available)
- [ ] Sorts by newest first
- [ ] Unread badge displays correct count
- [ ] "Mark all as read" updates badge
- [ ] Individual notification click navigates correctly
- [ ] Individual notification click marks as read
- [ ] "View All" navigates to `/notifications`
- [ ] Empty state displays when no notifications

### 10.2 UI/UX Tests

- [ ] Popover width correct on desktop (380px)
- [ ] Popover width correct on mobile (responsive)
- [ ] Animations smooth (60fps)
- [ ] Scrolling works when > 5 items
- [ ] Header and footer sticky
- [ ] Hover states work correctly
- [ ] Unread indicator visible on unread items
- [ ] Icons render correctly for all types

### 10.3 Responsive Tests

- [ ] Desktop (>= 1024px): 380px width
- [ ] Tablet (768px - 1023px): 380px width
- [ ] Mobile (< 768px): calc(100vw - 32px) width
- [ ] Very small mobile (< 360px): still readable

### 10.4 Accessibility Tests

- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Focus management correct
- [ ] ARIA attributes present
- [ ] Color contrast meets WCAG AA

---

## 11. Success Criteria

✅ **MUST HAVE:**

1. Popover appears on bell click
2. Shows 5 most recent notifications
3. All notification types render correctly
4. Unread badge updates correctly
5. "View All" navigates to `/notifications`
6. "Mark all as read" works
7. Individual notification click works
8. Responsive on mobile and desktop
9. Empty state displays correctly
10. Follows existing design system

✅ **SHOULD HAVE:**

1. Smooth animations
2. Keyboard navigation
3. ARIA attributes
4. Hover states
5. Sticky header/footer

✅ **NICE TO HAVE:**

1. Debounced clicking
2. Custom scrollbar
3. Loading states (future)
4. Real-time updates (future)

---

## 12. Out of Scope

❌ The following are NOT part of this specification:

- Real-time notification updates (WebSocket)
- Notification preferences/settings
- Push notifications
- Email notifications
- Notification grouping
- Notification actions (approve/reject)
- Notification search
- Backend API integration (using mock data)

---

## 13. Future Enhancements

🔮 Potential future improvements:

- Real-time updates via WebSocket
- Notification categories/grouping
- Notification preferences
- Notification sounds
- Desktop push notifications
- Notification actions (quick reply, approve, etc.)
- Infinite scroll in popover
- Notification search in popover

---

**End of Specification**
