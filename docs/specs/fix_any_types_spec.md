# Specification: Fix All `any` Type Violations

## Overview

This specification defines the exact types and interfaces needed to eliminate all `any` type usage in the Expeditoo codebase, ensuring 100% compliance with `docs/rules.md` §0.4.

---

## 1. Ably Types (`src/types/ably.types.ts`)

### 1.1 AblyChannel Interface

```typescript
import type Ably from "ably";

export interface AblyRealtimeChannel {
  name: string;
  subscribe: (
    eventOrCallback: string | ((message: AblyMessage) => void),
    callback?: (message: AblyMessage) => void
  ) => void;
  unsubscribe: (
    eventOrCallback?: string | ((message: AblyMessage) => void),
    callback?: (message: AblyMessage) => void
  ) => void;
  publish: (event: string, data: unknown) => Promise<void>;
  presence: Ably.RealtimePresence;
}
```

### 1.2 AblyMessage Interface

```typescript
export interface AblyMessage<T = unknown> {
  id: string;
  name: string;
  data: T;
  timestamp: number;
  clientId?: string;
  connectionId?: string;
  encoding?: string;
}
```

### 1.3 Subscription Ref Type

```typescript
export interface AblySubscriptionRef {
  channel: AblyRealtimeChannel;
  handler: (message: AblyMessage) => void;
}

export interface AblyMultiSubscriptionRef {
  channel: AblyRealtimeChannel;
  handlers: Array<(message: AblyMessage) => void>;
}
```

### 1.4 Specific Message Data Types

```typescript
// For messages feature
export interface NewMessageData {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

// For notifications
export interface NewNotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
}

// For auction outbid
export interface OutbidData {
  listingId: string;
  newAmount: number;
  bidderId: string;
}

// For order status
export interface OrderStatusData {
  orderId: string;
  status: string;
  shipmentId?: string;
}
```

---

## 2. Auth Types (`src/types/auth.types.ts`)

### 2.1 Email Callback Types

```typescript
export interface EmailVerificationUser {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}

export interface EmailCallbackParams {
  user: EmailVerificationUser;
  url: string;
  token?: string;
}
```

### 2.2 Request Type

```typescript
import type { NextRequest } from "next/server";

// For email callbacks, request may be undefined or NextRequest
export type EmailCallbackRequest = NextRequest | undefined;
```

---

## 3. Role Type Fixes

### 3.1 UserRole Type (Already exists in schema)

```typescript
// From src/db/schema/users.ts
export const userRoleEnum = pgEnum("user_role", [
  "USER",
  "SELLER", 
  "DRIVER",
  "ADMIN",
  "OPERATOR",
]);

export type UserRole = "USER" | "SELLER" | "DRIVER" | "ADMIN" | "OPERATOR";
```

### 3.2 Role Assertion Helper

```typescript
// src/types/roles.types.ts
import type { UserRole } from "@/db/schema/users";

export function isValidRole(role: string): role is UserRole {
  return ["USER", "SELLER", "DRIVER", "ADMIN", "OPERATOR"].includes(role);
}

export function assertRole(role: string): UserRole {
  if (!isValidRole(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  return role;
}
```

---

## 4. Fix Patterns by File

### 4.1 `src/lib/auth.ts`

**Before:**
```typescript
{ user, url, token }: { user: any; url: string; token: string },
request: any
```

**After:**
```typescript
import { EmailCallbackParams, EmailCallbackRequest } from "@/types/auth.types";

{ user, url, token }: EmailCallbackParams & { token: string },
request: EmailCallbackRequest
```

---

### 4.2 `src/lib/auth-helpers.ts`

**Before:**
```typescript
const hasAllRoles = roles.every((role) => userRoles.includes(role as any));
```

**After:**
```typescript
import type { UserRole } from "@/db/schema/users";

const hasAllRoles = roles.every((role) => 
  userRoles.includes(role as UserRole)
);
```

---

### 4.3 `src/server/dal/users.dal.ts`

**Before:**
```typescript
.where(and(eq(userRoles.userId, userId), eq(userRoles.role, role as any)));
```

**After:**
```typescript
import { userRoleEnum, type UserRole } from "@/db/schema/users";

// Option 1: Direct enum value
.where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))

// Option 2: If role is string, cast properly
.where(and(
  eq(userRoles.userId, userId), 
  eq(userRoles.role, role as (typeof userRoleEnum.enumValues)[number])
))
```

---

### 4.4 Ably Subscription Hooks

**Before:**
```typescript
const subscriptionRef = useRef<{ channel: any; handler: any } | null>(null);

const handleNewMessage = (message: any) => {
  // ...
};
```

**After:**
```typescript
import type { AblySubscriptionRef, AblyMessage, NewMessageData } from "@/types/ably.types";

const subscriptionRef = useRef<AblySubscriptionRef | null>(null);

const handleNewMessage = (message: AblyMessage<NewMessageData>) => {
  const data = message.data;
  // data is now typed as NewMessageData
};
```

---

### 4.5 `AblySubscriptions.tsx`

**Before:**
```typescript
interface AblyContextType {
  messagesChannel: any;
  notificationsChannel: any;
  handleMessageBadge: (message: any) => void;
}
```

**After:**
```typescript
import type { AblyRealtimeChannel, AblyMessage, NewMessageData } from "@/types/ably.types";

interface AblyContextType {
  messagesChannel: AblyRealtimeChannel | null;
  notificationsChannel: AblyRealtimeChannel | null;
  handleMessageBadge: (message: AblyMessage<NewMessageData>) => void;
}
```

---

### 4.6 `useNotifications.ts`

**Before:**
```typescript
(old: any) => {
  notifications: old.notifications.filter((n: any) => n.id !== id),
}
```

**After:**
```typescript
interface NotificationsQueryData {
  notifications: Notification[];
  hasMore: boolean;
}

(old: NotificationsQueryData | undefined) => {
  if (!old) return old;
  return {
    ...old,
    notifications: old.notifications.filter((n) => n.id !== id),
  };
}
```

---

### 4.7 `useListingDetail.ts`

**Before:**
```typescript
images: item.images?.map((img: any) => img.url) || ["/image-not-found.svg"]
```

**After:**
```typescript
interface ListingImage {
  id: string;
  url: string;
  order: number;
}

images: item.images?.map((img: ListingImage) => img.url) || ["/image-not-found.svg"]
```

---

### 4.8 `ShipmentProposalsDialog.tsx`

**Before:**
```typescript
{proposals.map((proposal: any) => (
```

**After:**
```typescript
import type { ShipmentProposal } from "@/types/shipment.types"; // or define inline

{proposals.map((proposal: ShipmentProposal) => (
```

---

### 4.9 `useAssignDriver.ts`

**Before:**
```typescript
} catch (error: any) {
```

**After:**
```typescript
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "An error occurred";
```

---

### 4.10 `useProfile.ts`

**Before:**
```typescript
isVerified: (userData as any)?.isVerified ?? false,
```

**After:**
```typescript
interface UserData {
  id: string;
  name: string;
  email: string;
  image?: string;
  isVerified?: boolean;
  // ... other fields
}

isVerified: userData?.isVerified ?? false,
```

---

### 4.11 `FilterSheet.tsx`

**Before:**
```typescript
sortBy: option.value as any,
```

**After:**
```typescript
import type { SortOption } from "@/features/app/home/types";

sortBy: option.value as SortOption,
// Or if SortOption is already the correct type, just:
sortBy: option.value,
```

---

### 4.12 `useDriverShipments.ts`

**Before:**
```typescript
queryFn: () => fetchShipments({ type: "available" as any }),
```

**After:**
```typescript
import type { ShipmentQueryType } from "@/features/app/deliveries/api";

// Update the fetchShipments function to accept the new type
queryFn: () => fetchShipments({ type: "available" as ShipmentQueryType }),

// OR better: update the type definition in deliveries/api to include these values
```

---

### 4.13 `useCreateForm.tsx`

**Before:**
```typescript
condition: data.condition as any,
```

**After:**
```typescript
import type { ItemCondition } from "@/server/dto/listings.dto";

condition: data.condition as ItemCondition,
// Or ensure form schema matches DTO type exactly
```

---

## 5. Edge Cases

### 5.1 When `any` is Truly Necessary

In rare cases where external library types are unavailable:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Ably SDK type limitation
const channel = ably.channels.get(channelName) as any;
```

**Allowed scenarios:**
- External library with missing types
- JSON.parse results before validation
- Legacy code migration (with tracked issue)

---

## 6. Verification Checklist

After implementation, verify:

- [ ] `grep -r ": any" src/ --include="*.ts" --include="*.tsx"` returns 0 results
- [ ] `grep -r "as any" src/ --include="*.ts" --include="*.tsx"` returns 0 results (except documented exceptions)
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm build` succeeds
- [ ] All tests pass (when implemented)
- [ ] Manual testing of affected features:
  - [ ] Authentication flow
  - [ ] Real-time messaging
  - [ ] Notifications
  - [ ] Auction bidding
  - [ ] Driver shipments

---

## 7. Files Created/Modified Summary

### New Files (2)
1. `src/types/ably.types.ts`
2. `src/types/auth.types.ts`

### Modified Files (17)
See plan document for full list.

---

## 8. Acceptance Criteria

1. **Zero `any` violations** - No `: any` or `as any` in codebase
2. **Type safety** - All types properly inferred
3. **No functionality regression** - All features work as before
4. **Build success** - Production build passes
5. **Documentation** - Any unavoidable exceptions documented
