# Spec — Admin user management

**Plan:** `docs/plans/plan_admin_user_management.md`
**Surface:** `/admin/users`
**Roles:** `admin` only. `operator` and `support` do not reach this page.

Supersedes the v1 version of this file, which described `buyer` / `seller` /
`transporter` and a goods marketplace that no longer exists.

---

## 1. The table

| Column | Source | Empty value |
|---|---|---|
| Name + email + app | `user.name`, `user.email`, `user.origin` | — |
| Status | derived, §1.1 | — |
| Last login | `user.lastLoginAt` | `Never` |
| Join date | `user.createdAt` | — |
| Role | highest-precedence role in `user_roles` | `User` |

### 1.1 Status

Derived, in this order — the first match wins:

| Condition | Status | Badge |
|---|---|---|
| `banned === true` | `suspended` | orange |
| `emailVerified === false` | `pending` | grey |
| otherwise | `active` | green |

`banned` is checked **before** `emailVerified`. The previous derivation read
`emailVerified ? "active" : "inactive"`, so a suspended user showed as active.

### 1.2 Which app the account belongs to

EXPEDITOO and Expedion share this Better Auth instance and this `user` table,
so the list mixed drivers and Expedion clients with nothing to tell them apart.
A badge beside the name now says which.

`user.origin` (`expeditoo` | `expedion`) is written **at signup** from the
request's Origin, matched against `EXPEDION_APP_ORIGINS` — the same variable
proxy.ts uses for CORS. An absent Origin reads as `expeditoo`, because that is
what every same-origin and server-side call looks like; guessing `expedion`
there would mislabel far more rows than it caught.

**Owning an Expedion quote is not used, and must not be.** It reads like the
obvious signal and is worse than nothing:

- `expedion_quotes.user_id` has exactly one writer — `claimImportedExpedionQuotes`,
  which runs on *every* signup from either product and claims historical
  Airtable rows by email match. A non-null `user_id` therefore means "someone
  signed up here with an address that appears on an imported quote", which is
  an EXPEDITOO signup, not an Expedion one.
- The column that actually identifies the client is `firebase_uid`, and
  4,588 of 4,593 quotes carry an `airtable:` key or a Firebase uid matching no
  user row.
- Backfilling from it labelled exactly one account, and that account was an
  **EXPEDITOO admin** whose email matched five imported quotes.

**What the label does not claim.** It is where the account was *created*,
nothing more. Rows older than the column all read `expeditoo`, because the
database holds no evidence either way — not because they are known to be
EXPEDITOO users.

**Who is missing entirely.** 28 distinct Firebase uids own quotes with no
`user` row behind them: Expedion's older accounts live in Firebase Auth
(`src/lib/expedion-auth.ts`), so those clients have no account in this app and
cannot appear in this list at all. An Expedion client absent from
`/admin/users` is expected, not a bug.

**Configuration.** `EXPEDION_APP_ORIGINS` must name the Expedion app's
origin(s) or the Origin signal never fires and every new signup reads
`expeditoo`. It is unset in `.env.local` today.

### 1.3 Last login

`user.lastLoginAt` is stamped in the `session.create.after` database hook, on
every session **except** an impersonation session (`impersonatedBy` set) —
an admin looking at an account is not that person signing in.

Rendered relative ("3 hours ago"), with the absolute timestamp in the
`title` attribute. Null renders as `Never`, which is the true state for an
account that has only ever been created.

---

## 2. Actions

All are admin-only and all are enforced in the service layer, never in the
route handler (`docs/rules.md` §3).

| Action | Guarded against | Result |
|---|---|---|
| Manage roles | — | existing role dialog |
| View profile | — | renders `PublicProfile` inline |
| Log in as user | self, admins, system account, nesting | §3 |
| Send password reset | — | Better Auth reset email to the user's address |
| Sign out everywhere | — | deletes every `session` row for that user |
| Suspend | self | `banned = true` **and** all sessions deleted |
| Activate | — | `banned = false` |
| Delete account | self, admins, system account | hard delete, cascades |
| Copy user ID | — | clipboard, client-only |

### 2.1 Session revocation spares a borrowed view

Both actions that delete sessions -- suspension and "sign out everywhere" --
scope the delete to the user's **own** sessions (`impersonated_by IS NULL`).

An admin viewing the account is not one of the user's devices. Deleting that
row does not return the admin to their own session; it leaves their browser
holding a cookie for a token that no longer exists, which lands them on the
sign-in screen with no explanation. The borrowed session is capped at an hour
of its own and is recorded in `impersonation_sessions`, so nothing outlives
the ceiling.

`deleteUserSessions(userId, { keepImpersonated })` defaults to `false`, so the
user-initiated paths (a password reset invalidating sessions) still clear
everything.

### 2.2 Suspension is now enforced

Setting `banned` used to be inert. Three things now read it:

1. `session.create.before` throws `FORBIDDEN` / `BANNED_USER` when the user is
   banned, so sign-in fails — for email/password and Google alike.
2. Suspending deletes live sessions, so an already-signed-in user is out at
   once rather than at the end of their 7-day session.
3. `session.cookieCache.maxAge` is 5 minutes, bounding how long a browser may
   keep serving a cached copy of a session that the database has revoked.

The ban check is skipped for impersonation sessions, so an admin can still
look at a suspended account — which is usually exactly when they need to.

### 2.3 Delete

Hard delete of the `user` row. Every foreign key into `user` is
`ON DELETE CASCADE` or `SET NULL`, so listings, offers, shipments, payments,
messages, reviews, addresses, carrier profile and documents go with it.

**Irreversible, and it is refused for:**

| Target | Code | Status |
|---|---|---|
| The acting admin | `SELF_DELETE_NOT_ALLOWED` | 400 |
| Any user holding `admin` | `CANNOT_DELETE_ADMIN` | 403 |
| `EXPEDION_SYSTEM_USER_ID` | `CANNOT_DELETE_SYSTEM_USER` | 403 |

The system account owns every escalated listing; deleting it would cascade the
entire Expedion inlet away.

The dialog requires the admin to type the target's **email** before the
confirm button enables.

---

## 3. Impersonation

### 3.1 Endpoints

Both are Better Auth plugin endpoints, so they sit under `/api/auth`. They
have to: only the auth layer can mint a session and sign its cookie.

```
POST /api/auth/impersonate-user   { userId }
POST /api/auth/stop-impersonating
```

### 3.2 Starting

1. Caller's session is resolved. No session → 401.
2. Caller must hold `admin` in `user_roles` → else 403 `NOT_ADMIN`.
3. Refusals, all 403 unless noted:

| Case | Code |
|---|---|
| Caller is already impersonating | `ALREADY_IMPERSONATING` |
| `userId === caller.id` | `CANNOT_IMPERSONATE_SELF` (400) |
| Target holds `admin` | `CANNOT_IMPERSONATE_ADMIN` |
| Target is `EXPEDION_SYSTEM_USER_ID` | `CANNOT_IMPERSONATE_SYSTEM_USER` |
| Target does not exist | `USER_NOT_FOUND` (404) |

4. A session is created for the target with `impersonatedBy = caller.id` and
   `expiresAt = now + 60 min`.
5. The caller's own session token is parked in a signed `admin_session`
   cookie. The session row itself is left intact, so stopping restores it.
6. The session cookie is replaced with the target's.
7. An `impersonation_sessions` row is written: admin id + email, target id +
   email, session token, IP, user agent, start and expiry.

The admin's session is **not** revoked, so a lost `admin_session` cookie costs
the admin nothing worse than a fresh sign-in.

### 3.3 Stopping

Reads `admin_session`, verifies the parked session still exists and belongs to
the user named by `impersonatedBy`, deletes the impersonation session, restores
the admin's session cookie, clears `admin_session`, and stamps `endedAt` on the
audit row.

**It also works when the borrowed session is already gone.** That session
expires by itself after an hour, and without a fallback the admin's next click
lands on the sign-in screen even though their own session is still alive. When
no current session resolves, the signed, http-only `admin_session` cookie is
the credential -- exactly as strong as the session cookie it replaces, and it
can only ever restore the one token that was parked. The audit row is left
open in that case; its `expiresAt` is what records that the impersonation ran
to its ceiling rather than being stopped.

If somebody else is signed in normally on a browser still carrying a parked
cookie, the cookie is dropped rather than honoured -- restoring it would hand
them the admin's session.

The banner watches the same clock and stops automatically as it reaches zero,
so the admin is returned rather than stranded.

Errors: 400 `NOT_IMPERSONATING`, 500 `ADMIN_SESSION_LOST` when the parked
session itself is gone (the admin signs in again).

### 3.4 What the borrowed session is exempt from

Exactly one thing: **the email-verification wall** (`src/proxy.ts`).

An unverified account is redirected to `/verify-email` on every protected
route, and an admin cannot click a link in somebody else's inbox — so before
this exemption, every unverified account was simply unviewable, which is
precisely the population most worth looking at during user testing. The
exemption is keyed on `session.impersonatedBy`, so a real sign-in by that same
user still hits the wall unchanged.

Nothing else is exempted, on purpose. A driver with a pending KYC application
sees "application pending" and so does the admin viewing them: that is the
point of the feature, and exempting it would show the admin a screen no user
has ever seen.

The suspension check in the session-create hook is a separate case (§2.1): it
is skipped for impersonation because the session has to exist at all before
anything can be looked at.

### 3.5 Looking must not write

A deliberate click an admin makes inside somebody's account is that user's
action, and the audit row is what makes that accountable. A write that fires
from a `useEffect` on page load is nobody's decision — the admin never chose
it, and the user's data changes merely because it was looked at.

Every automatic write reachable from a page load is therefore suppressed for a
borrowed session:

| Path | What it did | Now |
|---|---|---|
| `POST /api/messages/mark-seen` | fires on `/messages` mount, clearing the user's whole unread state | no-op, returns `updatedCount: 0` |
| `GET /api/messages/conversations/:id` | marked page 1 read, which the other party sees as a **read receipt** | `markRead: false` |
| `GET /api/stripe/payment-methods` | `getOrCreateCustomer` created a real Stripe customer and stamped `stripeCustomerId` | reads only; no customer means no cards |
| `POST /api/stripe/setup-intent` | fires on the add-card screen's mount, opening an off-session SetupIntent | 403 |
| `GET /api/stripe/connect/refresh` | a bare GET that provisions an Express account | redirects, provisions nothing |
| `GET /api/stripe/connect/return` | overwrote `stripeAccountStatus` | skipped |

The Stripe payment-methods change is not impersonation-specific: a GET should
never have created a customer for anyone. The rest are keyed on
`isImpersonated(session)` (`src/lib/impersonation-guard.ts`) and leave the
user's own requests exactly as they were.

### 3.6 Getting back out

Three ways the admin could previously be stranded, all closed:

| Situation | Before | Now |
|---|---|---|
| The hour runs out | next click lands on `/signin`, own session unreachable | the banner stops itself at zero |
| Another admin suspends or signs out the user | borrowed session deleted, admin anonymous | revocation skips borrowed sessions (§2.1) |
| Admin clicks "Log out" on the target's profile | session destroyed, `admin_session` orphaned | it stops the impersonation instead |

`stop-impersonating` also falls back to the parked cookie when the borrowed
session is already gone (§3.3), and clears the `dont_remember` flag the
borrowed session set, which would otherwise ride back into the admin's own
session and stop it renewing.

### 3.7 While impersonating

- A banner is pinned to the bottom of every page — above the mobile bottom nav,
  at the foot of the viewport from `xl` up: who is being viewed, the time
  remaining, and a stop button. It sits there rather than at the top because
  the app's header is `sticky top-0`, and covering it would hide the one piece
  of chrome an admin needs to get back out.
- `/admin` needs no special guard. The borrowed session carries the target's
  roles, so the existing admin checks reject it like any other non-admin.
- **Deliberate actions taken while impersonating are that user's actions** —
  offers, shipments and payments behave exactly as they do for that user, which
  is why the audit row exists. The only code that knows it is impersonated is
  the small set of automatic writes in §3.5 and the exemption in §3.4.
- The session expires on its own after 60 minutes, and the banner hands the
  admin back when it does.

---

## 4. API

| Method | Path | Body | 200 |
|---|---|---|---|
| `GET` | `/api/admin/users` | — | `{ users, total, page, pageSize, totalPages }`, each user carrying `lastLoginAt` |
| `PATCH` | `/api/admin/users/:id/status` | `{ banned }` | updated user |
| `DELETE` | `/api/admin/users/:id` | — | `{ id, email }` |
| `DELETE` | `/api/admin/users/:id/sessions` | — | `{ revoked: number }` |
| `POST` | `/api/admin/users/:id/password-reset` | — | `{ email }` |
| `POST` | `/api/auth/impersonate-user` | `{ userId }` | `{ user }` |
| `POST` | `/api/auth/stop-impersonating` | — | `{ user }` |

Errors follow `src/lib/api-response.ts`: `{ success: false, error: { code, message } }`.

`AdminError` carries the code and status; `handleError` translates it.

Common codes: `UNAUTHENTICATED` 401, `NOT_ADMIN` 403, `USER_NOT_FOUND` 404,
plus the per-action codes in §2.3 and §3.2.

---

## 5. Data

```sql
user.last_login_at            timestamp null
session.impersonated_by       text null references user(id) on delete cascade

impersonation_sessions (
  id, admin_id (set null), admin_email, target_user_id (set null),
  target_email, session_token, started_at, expires_at, ended_at,
  ip_address, user_agent
)
```

The two emails are stored on the audit row on purpose: the record has to
outlive the accounts it names, and deleting a user is one of the actions on
this very page.

---

## 6. Test coverage required

**Impersonation service**
- non-admin caller → `NOT_ADMIN`
- target is admin → `CANNOT_IMPERSONATE_ADMIN`
- target is self → `CANNOT_IMPERSONATE_SELF`
- target is the Expedion system account → `CANNOT_IMPERSONATE_SYSTEM_USER`
- unknown target → `USER_NOT_FOUND`
- happy path → returns the target and writes an audit row
- stop with no matching audit row still restores (does not throw)

**Admin service**
- suspend → `banned = true` **and** the user's own sessions deleted
- suspend / sign-out-everywhere → a borrowed session survives both
- activate → `banned = false`, sessions untouched
- suspend self → `SELF_BAN_NOT_ALLOWED`
- delete self / admin / system account → refused with the codes in §2.3
- delete ordinary user → DAL delete called once

**Impersonation must not write**
- `getThread` with `markRead: false` → no read receipt; default → receipt sent
- `listPaymentMethods` with no customer → `[]`, and no customer created

**Proxy**
- unauthenticated → `/signin`
- unverified user → `/verify-email`
- unverified user **while impersonated** → through
- borrowed session on `/admin/*` → `/home`

**UI**
- status derivation: banned beats unverified beats active
- `Never` for a null last login
