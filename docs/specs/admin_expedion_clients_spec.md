# Admin — Expedion clients

`/admin/expedion-clients` · `GET /api/admin/expedion/clients` ·
`GET /api/admin/expedion/clients/[ownerId]`

Related: [`admin_user_management_spec.md`](./admin_user_management_spec.md)
§1.2, which this extends rather than contradicts.

---

## 1. The problem

An admin looking for Expedion's customers in `/admin/users` finds none. Two
separate causes, and fixing either alone leaves the screen empty.

### 1.1 The origin label never fires

`user.origin` is written at signup from the request's `Origin`, matched against
`EXPEDION_APP_ORIGINS` (`src/lib/app-origins.ts`). **That variable is unset**,
in `.env.local` and in the deployment, so `originOfRequest` matches nothing and
every account — all 28 of them — reads `expeditoo`.

This is configuration, not code. Setting the variable makes the label correct
**from that moment forward**; it back-fills nothing, and deliberately so
(`admin_user_management_spec.md` §1.2).

### 1.2 Most Expedion clients have no account here at all

The deeper reason, and the one no amount of configuration fixes. Expedion's
clients are rows on `expedion_quotes`, keyed by `firebase_uid`. Of 4,592
distinct owners in the development database, **none** has a matching `user`
row. `/admin/users` reads the `user` table; a client who never created an
account there cannot appear in it, and never will.

So the Expedion client book needs its own surface, sourced from where the
clients actually live.

---

## 2. What the screen shows

One row per **owner**, grouped by `expedion_quotes.firebase_uid`.

`firebase_uid` is the grouping key rather than email because it is the key the
rest of the system already owns a client by: `expedionDal.list` scopes a
client's own quotes with `{ scope: "mine", ownerId }` against this exact
column. Grouping by anything else would make "this client" mean one thing on
this screen and another everywhere else. Its name predates Better Auth and now
means *owner* — see the note on `ExpedionCaller.userId` in
`src/lib/expedion-auth.ts`.

| Column | Source |
|---|---|
| Client | Most recent non-null `first_name` / `last_name` on their quotes |
| Email | Most recent non-null `email` |
| Phone | Most recent non-null `phone` |
| City | Most recent non-null `client_city` |
| Quotes | `count(*)` |
| Paid | `count(*) filter (where payment_status = 'paid')` |
| Value | `sum(accepted_price_cents) filter (where payment_status = 'paid')` |
| Last seen | `max(created_at)` |
| Account | The `user` row whose `id` equals the owner key, if any |

"Most recent non-null" rather than `max()`: `max()` on a text column returns
the alphabetically largest value, which for a client who has corrected their
surname returns whichever spelling sorts later, not the one they last gave.

### 2.1 The account link, and what it does not claim

The `Account` column joins `user` on `user.id = expedion_quotes.firebase_uid`.
That join means something specific: the Better Auth path in `expedion-auth.ts`
stores the caller's **Better Auth user id** in this column, so a match is proof
that this Expedion client authenticated with an account in this database.

`expedion_quotes.user_id` is **not** used, for the reason
`admin_user_management_spec.md` §1.2 gives: its only writer is
`claimImportedExpedionQuotes`, which runs on every signup from either product
and claims historical rows by email match. A non-null `user_id` means "somebody
signed up with an address that appears on an imported quote" — a claim about an
address, not about who owns the account.

A row with no account is normal and is the majority case. It renders as `—`,
not as an error.

### 2.2 What "manage" means here

An owner with no `user` row has nothing to suspend, impersonate or password-
reset — there is no account. What the screen offers instead:

- **View quotes** — a dialog listing that owner's quotes: bordereau, status,
  payment status, accepted price, created date. Served by
  `GET /api/admin/expedion/clients/[ownerId]`.
- **Open account** — only when `accountUserId` is set; links to `/admin/users`
  filtered to that account, where the existing actions already live.
- **Copy owner id** — the value that scopes every Expedion API call to this
  client, so an admin can use it in a support thread or a query.

The screen deliberately adds no write actions of its own. Quotes are edited at
`/admin/expedion`, which already owns that lifecycle; a second place to change
a quote is how two screens come to disagree about one.

---

## 3. API

### `GET /api/admin/expedion/clients`

Session **and** the `admin` role, checked in the service. Same guard as
`/api/admin/expedion/report`, and for the same reason: this is unscoped by
design and must never be reachable by a client credential.

| Param | Type | Default | Meaning |
|---|---|---|---|
| `search` | string | — | Matches `first_name`, `last_name`, `email`, `phone`, `client_city`, `bordereau_number` or `firebase_uid`, case-insensitive |
| `page` | int ≥ 1 | 1 | |
| `pageSize` | int 1–100 | 25 | |
| `sortBy` | `lastSeen` \| `quotes` \| `value` \| `name` | `lastSeen` | |
| `sortOrder` | `asc` \| `desc` | `desc` | |
| `linked` | `all` \| `withAccount` \| `withoutAccount` | `all` | |

The search predicate is applied **before** aggregation, so an owner matches
when *any* of their quotes matches. Searching a bordereau number therefore
finds the client who filed it, which is the question an admin actually asks.

Response: `{ success: true, data: { clients, total, page, pageSize, totalPages } }`.

### `GET /api/admin/expedion/clients/[ownerId]`

Same guard. Returns that owner's aggregate plus up to 100 of their quotes,
newest first. 404 `CLIENT_NOT_FOUND` when the owner key matches no quote.

### Errors

| Code | Status | When |
|---|---|---|
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Session without the `admin` role |
| `CLIENT_NOT_FOUND` | 404 | Owner key matches no quote |
| `INTERNAL_SERVER_ERROR` | 500 | Anything else; detail to the log, fixed message on the wire |

The 500 body carries a fixed message, matching every other Expedion route:
these are raw aggregate failures and their text names tables and columns.

---

## 4. Test coverage required

- Aggregation: an owner with several quotes collapses to one row, counts and
  sums correct, paid-only value.
- "Most recent non-null" wins over both `max()` and over a later null.
- Search matches on a bordereau number and returns the owner, not the quote.
- `linked` filter partitions the set and the two halves sum to the whole.
- Permission: no session → 401; session without `admin` → 403; both refused in
  the service, not the route.
- Account link is made on `firebase_uid = user.id` and **never** on `user_id`.
- Pagination totals count distinct owners, not quotes.
- Unknown owner key → `CLIENT_NOT_FOUND`.

---

## 5. Configuration

`EXPEDION_APP_ORIGINS` must name the Expedion app's origin(s) in every
deployment, or §1.1 stays broken and the `Expedion` badge in `/admin/users`
never appears on a new signup. It is listed in `.env.example` and is empty
there. This screen does not depend on it — it reads quotes, not origins — which
is the point: the client book works whether or not the label does.
