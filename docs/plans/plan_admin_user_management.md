# Plan — Admin user management (`/admin/users`)

**Spec:** `docs/specs/admin_user_management_spec.md`
**Roadmap ref:** `ROADMAP.md` §8 Phase A — operator/admin tooling
**Status:** in progress

The users table shows name, status, join date and role, and offers four
actions: manage roles, view profile, suspend/activate, delete. Three of those
are broken or hollow:

- **View profile** renders a menu item wired to nothing — `/admin/users`
  never passes `onViewProfile`, while `/admin/drivers` does.
- **Delete** has no `onClick` at all and no endpoint behind it.
- **Suspend** writes `user.banned = true` and nothing anywhere reads that
  column, so a suspended user keeps their session and can sign in again.

And the admin cannot answer the two questions user testing actually raises:
*when did this person last get in*, and *what does their screen look like*.

---

## Work packages

### WP1 — Schema
- `user.last_login_at` — stamped on every real (non-impersonated) session.
- `session.impersonated_by` — marks a session an admin opened as someone else.
- `impersonation_sessions` — the audit trail: who, as whom, from where, how
  long. Admin and target emails are denormalised so the record survives the
  deletion of either account.
- Hand-written migration `0003`, following `0002`: `drizzle-kit generate`
  would diff against `0001`'s snapshot (0002 was hand-written and left none)
  and re-emit the whole realignment.

### WP2 — Make suspension mean something
- `session.create.before` hook rejects a banned user, so sign-in fails.
- Suspending deletes the user's live sessions, so they are out immediately.
- `session.cookieCache.maxAge` drops from 7 days to 5 minutes. The cached
  session cookie is trusted without touching the database until it expires, so
  at 7 days a ban, a session revocation and a role change were all invisible
  for a week on the browser that held it.

### WP3 — Impersonation ("Log in as")
- Better Auth plugin (`src/lib/auth-impersonation.ts`) with two endpoints,
  modelled on the library's own admin plugin but permissioned off `user_roles`
  rather than a second `user.role` column.
- 60-minute session, admin's own session parked in a signed `admin_session`
  cookie and restored on stop.
- Refuses: self, another admin, the Expedion system account, and nesting.
- Every start and stop writes to `impersonation_sessions`.
- A banner is visible on every surface while impersonating, with the time left
  and a stop button. The admin panel needs no guard of its own — the borrowed
  session carries the target's roles, and the existing role checks reject it.
- The borrowed session is exempt from exactly one thing: the email-verification
  wall in `proxy.ts`. An admin cannot click a link in someone else's inbox, so
  without it every unverified account was unviewable. Nothing else is exempted —
  a pending KYC screen is what the user sees, so it is what the admin sees.
- Getting back out is not left to chance: session revocation skips borrowed
  sessions, `stop-impersonating` falls back to the parked cookie when the
  borrowed session has already expired, and the banner stops itself at zero.

### WP4 — The rest of the actions
| Action | Endpoint | Notes |
|---|---|---|
| Last login column | — | read from `user.lastLoginAt` |
| View profile | — | reuse `PublicProfile`, as `/admin/drivers` does |
| Log in as user | `POST /api/auth/impersonate-user` | WP3 |
| Send password reset | `POST /api/admin/users/:id/password-reset` | Better Auth `forgetPassword` |
| Sign out everywhere | `DELETE /api/admin/users/:id/sessions` | |
| Delete account | `DELETE /api/admin/users/:id` | type-the-email confirmation |
| Copy user ID | — | client only |

### WP5 — Client
- One shared API-user mapper; `useAdmin` and `useAdminDrivers` each had their
  own copy, and both derived status from `emailVerified` alone — a banned user
  read as "active".
- `useAdmin` moves onto TanStack Query under `["admin", "users"]`, the key the
  moderation mutations already invalidate. Today they invalidate nothing that
  exists, so the table never refreshed after an action.

### WP6 — i18n, tests, gates
- EN + FR parity, verified by key diff.
- Unit tests for the impersonation guards, the ban revocation and the delete
  guards.
- `npx tsc --noEmit`, `pnpm lint`, `pnpm test`.

---

## Files

**New**
```
src/lib/auth-impersonation.ts
src/server/dal/impersonation.dal.ts
src/server/services/impersonation.service.ts
src/server/dto/admin-users.dto.ts
src/app/api/admin/users/[id]/route.ts
src/app/api/admin/users/[id]/sessions/route.ts
src/app/api/admin/users/[id]/password-reset/route.ts
src/features/app/admin/api/users.api.ts
src/features/app/admin/lib/map-api-user.ts
src/features/app/admin/ui/DeleteUserDialog.tsx
src/components/ImpersonationBanner.tsx
src/db/migrations/0003_admin_user_management.sql
src/server/services/__tests__/impersonation.service.test.ts
```

**Changed**
```
src/db/schema/users.ts
src/lib/auth.ts
src/lib/api-response.ts
src/server/dal/users.dal.ts
src/server/dto/user.dto.ts
src/server/services/admin.service.ts
src/server/services/user.service.ts
src/features/app/admin/types.ts
src/features/app/admin/hooks/useAdmin.ts
src/features/app/admin/hooks/useAdminDrivers.ts
src/features/app/admin/hooks/useUserModeration.ts
src/features/app/admin/ui/UsersTable.tsx
src/app/(app)/admin/users/page.tsx
src/components/providers/Providers.tsx
messages/en.json, messages/fr.json
```
