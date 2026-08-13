# Plan: Fix All `any` Type Violations

## Overview

This plan addresses the ~42 `any` type violations found during the code audit. These violations break the `docs/rules.md` §0.4 Clean Code principle: "No `any`, no silent `catch`".

---

## Priority Groupings

### 🔴 Priority 1: Critical (Auth & Core)
**Files:** 4 files, ~10 violations
**Impact:** Core authentication and authorization

1. `src/lib/auth.ts` - 4 violations
2. `src/lib/auth-helpers.ts` - 5 violations

### 🔴 Priority 2: High (Server Layer)
**Files:** 2 files, ~11 violations
**Impact:** Backend type safety

1. `src/server/services/user.service.ts` - 3 violations
2. `src/server/dal/users.dal.ts` - 8 violations

### 🟡 Priority 3: Medium (Ably Integration)
**Files:** 5 files, ~12 violations
**Impact:** Real-time features

1. `src/components/providers/AblySubscriptions.tsx` - 4 violations
2. `src/features/app/messages/hooks/useMessageDetail.ts` - 3 violations
3. `src/features/app/checkout/hooks/useWonCheckout.ts` - 2 violations
4. `src/features/app/auction/hooks/useMyBids.ts` - 2 violations
5. `src/features/app/auction/hooks/useAuctionDetail.ts` - 1 violation

### 🟢 Priority 4: Low (UI/Misc)
**Files:** 6 files, ~9 violations
**Impact:** Frontend minor

1. `src/features/app/notifications/hooks/useNotifications.ts` - 2 violations
2. `src/features/app/listing/hooks/useListingDetail.ts` - 1 violation
3. `src/features/app/admin/ui/ShipmentProposalsDialog.tsx` - 1 violation
4. `src/features/app/admin/hooks/useAssignDriver.ts` - 1 violation
5. `src/features/app/profile/hooks/useProfile.ts` - 1 violation
6. `src/features/app/home/ui/FilterSheet.tsx` - 1 violation
7. `src/features/app/driver/hooks/useDriverShipments.ts` - 2 violations

---

## Implementation Steps

### Phase 1: Create Type Definitions

**Task 1.1: Create Ably Types**
- Create `src/types/ably.types.ts`
- Define `AblyChannel`, `AblyMessage`, `AblySubscription` interfaces
- Export for use across all Ably-related files

**Task 1.2: Create Auth Types**
- Create `src/types/auth.types.ts`
- Define `AuthUser`, `AuthRequest`, `EmailVerification` interfaces
- Based on better-auth library expectations

**Task 1.3: Create Role Types Extension**
- Update `src/db/schema/users.ts` or create `src/types/roles.types.ts`
- Ensure role enum is properly exported and usable

---

### Phase 2: Fix Priority 1 Files

**Task 2.1: Fix `src/lib/auth.ts`**
- Replace `user: any` with `AuthUser`
- Replace `request: any` with `NextRequest` or custom type
- Lines: 31, 32, 52, 53

**Task 2.2: Fix `src/lib/auth-helpers.ts`**
- Replace `role as any` with proper enum assertion
- Use `UserRole` type consistently
- Lines: 82, 104, 159, 180

---

### Phase 3: Fix Priority 2 Files

**Task 3.1: Fix `src/server/services/user.service.ts`**
- Replace `r.role as any` with proper type
- Lines: 37, 201, 290

**Task 3.2: Fix `src/server/dal/users.dal.ts`**
- Replace all `role as any` with enum type
- Lines: 134, 158, 179, 200, 271, 328, 362

---

### Phase 4: Fix Priority 3 Files (Ably)

**Task 4.1: Fix `AblySubscriptions.tsx`**
- Import Ably types
- Replace `messagesChannel: any` with `AblyChannel`
- Replace `handleMessageBadge: (message: any)` with typed handler

**Task 4.2: Fix Ably Hooks**
- `useMessageDetail.ts` - Replace `channel: any, handler: any`
- `useWonCheckout.ts` - Replace `channel: any, handler: any`
- `useMyBids.ts` - Replace `channel: any, handler: any`
- `useAuctionDetail.ts` - Replace `channel: any, handlers: any[]`

---

### Phase 5: Fix Priority 4 Files

**Task 5.1: Fix Notification/Admin Hooks**
- `useNotifications.ts` - Replace `old: any` and `n: any`
- `useAssignDriver.ts` - Replace `error: any` with `unknown`

**Task 5.2: Fix UI Component Types**
- `useListingDetail.ts` - Replace `img: any`
- `ShipmentProposalsDialog.tsx` - Replace `proposal: any`
- `useProfile.ts` - Replace `userData as any`
- `FilterSheet.tsx` - Replace `option.value as any`
- `useDriverShipments.ts` - Replace `type as any`
- `useCreateForm.tsx` - Replace `condition as any`

---

### Phase 6: Verification

**Task 6.1: Run Type Check**
```bash
pnpm tsc --noEmit
```

**Task 6.2: Run Build**
```bash
pnpm build
```

**Task 6.3: Grep Verification**
```bash
grep -r ": any" src/ --include="*.ts" --include="*.tsx"
grep -r "as any" src/ --include="*.ts" --include="*.tsx"
```
Should return 0 results.

---

## Files to Create/Modify

### New Files
1. `src/types/ably.types.ts`
2. `src/types/auth.types.ts`

### Modified Files (17 total)
1. `src/lib/auth.ts`
2. `src/lib/auth-helpers.ts`
3. `src/server/services/user.service.ts`
4. `src/server/dal/users.dal.ts`
5. `src/components/providers/AblySubscriptions.tsx`
6. `src/features/app/messages/hooks/useMessageDetail.ts`
7. `src/features/app/checkout/hooks/useWonCheckout.ts`
8. `src/features/app/auction/hooks/useMyBids.ts`
9. `src/features/app/auction/hooks/useAuctionDetail.ts`
10. `src/features/app/notifications/hooks/useNotifications.ts`
11. `src/features/app/listing/hooks/useListingDetail.ts`
12. `src/features/app/admin/ui/ShipmentProposalsDialog.tsx`
13. `src/features/app/admin/hooks/useAssignDriver.ts`
14. `src/features/app/profile/hooks/useProfile.ts`
15. `src/features/app/home/ui/FilterSheet.tsx`
16. `src/features/app/driver/hooks/useDriverShipments.ts`
17. `src/features/app/create/hooks/useCreateForm.tsx`

---

## Estimated Effort

| Phase | Files | Est. Time |
|-------|-------|-----------|
| Phase 1 (Types) | 2 new | 15 min |
| Phase 2 (Auth) | 2 files | 20 min |
| Phase 3 (Server) | 2 files | 15 min |
| Phase 4 (Ably) | 5 files | 25 min |
| Phase 5 (UI) | 6 files | 20 min |
| Phase 6 (Verify) | - | 10 min |
| **Total** | **17 files** | **~105 min** |

---

## Success Criteria

1. ✅ Zero `any` type usage
2. ✅ Zero `as any` casting
3. ✅ Build passes without errors
4. ✅ Type check passes (`tsc --noEmit`)
5. ✅ All functionality works as before

---

## Notes

- Some `as any` casts may be necessary for external library compatibility
- If unavoidable, document with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with explanation
- Prefer `unknown` over `any` when type is truly unknown
