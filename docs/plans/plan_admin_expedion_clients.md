# Plan — Expedion clients in the admin panel, and two bugs found beside it

Spec: [`docs/specs/admin_expedion_clients_spec.md`](../specs/admin_expedion_clients_spec.md)

Three reported problems. They turned out to be unrelated, so they are listed
separately rather than merged into one narrative.

---

## 1. "My earnings" renders an empty page

**Cause — the migration was never registered.** `0009_offer_self_accepted.sql`
and `0010_withdrawals.sql` were both absent from
`src/db/migrations/meta/_journal.json`, and there were two files numbered
`0010`. Drizzle's migrator walks the **journal**, not the directory, so neither
file had ever run anywhere. `drizzle.__drizzle_migrations` held ten rows for
twelve files.

The deployed database therefore had no `withdrawals` table, no
`payouts.withdrawal_id` and no `offers.self_accepted`.
`GET /api/carrier/withdrawals` answered 500, which is the error in the
browser console on the screenshot.

**Cause — the panel swallowed it.** `WithdrawalPanel` ended `if (!data) return
null`, so a failed call rendered nothing at all: no heading, no message, no
retry. The page was blank for as long as the endpoint was broken and said
nothing about why.

### Steps

1. Renumber `0009_…` → `0011_…` and `0010_withdrawals` → `0012_withdrawals`,
   above `0010_carrier_routes`. Order matters: drizzle applies a migration only
   when its journal `when` exceeds the newest timestamp already recorded, so a
   backdated entry would be skipped in production exactly as it is today.
2. Register both in `_journal.json` with increasing timestamps.
3. Guard `0012`'s `CREATE TYPE` with `DO $$ … EXCEPTION WHEN duplicate_object`,
   as `0004` does. Any database the file was applied to by hand while it sat
   unregistered already has the type, and a bare `CREATE TYPE` would abort the
   whole migration there.
4. `src/db/__tests__/migrations-journal.test.ts` — every `.sql` registered,
   every tag present, timestamps strictly increasing, prefixes unique. The
   class of bug, not the instance.
5. `WithdrawalPanel`: a `CenteredEmptyState` with a retry, instead of `null`.

**Deploying it.** Nothing in CI runs migrations — `.github/workflows` has none
and the Vercel build command is a plain `next build`. Production needs
`MIGRATE_TARGET=production pnpm db:migrate` run against it, or the table still
will not exist.

---

## 2. No Expedion users in the admin panel

Two causes, and fixing either alone leaves the screen empty.

**The origin label never fires.** `user.origin` is written at signup from the
request's `Origin` matched against `EXPEDION_APP_ORIGINS`. That variable is
empty in `.env.example` and unset in the deployment, so `originOfRequest`
matches nothing and all 28 accounts read `expeditoo`. Configuration, not code.

**Most Expedion clients have no account here.** The deeper reason, and the one
no configuration fixes. They are rows on `expedion_quotes` keyed by
`firebase_uid`: 4,592 distinct owners, **none** with a matching `user` row.
`/admin/users` reads the `user` table and structurally cannot show them.

### Steps

1. `expedion-clients.dal.ts` — aggregate by `firebase_uid`, left join `user` on
   `user.id = firebase_uid`, filter before aggregating so a bordereau search
   finds the client who filed it.
2. `expedion-clients.service.ts` — `admin` role enforced here, Zod on the query,
   DTO with the name parts joined once.
3. `GET /api/admin/expedion/clients` and `/[ownerId]`.
4. `ExpedionClientsTable` + `ExpedionClientDialog`, server-paginated. The shared
   `DataTable` pages in the browser and there are 4,592 owners.
5. Sidebar entry beside Users — the screen an admin looks at first and does not
   find them on.
6. `/admin/users` learns `?search=`, so the dialog's "Open account" link lands
   on the account rather than an unfiltered list.

Read-only by design: quotes are edited at `/admin/expedion`, and a second
screen that could change one is how two surfaces come to disagree.

---

## 3. No role label in the sidebar

The sidebar showed the wordmark and nothing about who is signed in.

### Steps

1. `src/lib/primary-role.ts` — one precedence, most privileged first, shared.
   `map-api-user.ts` had its own copy that fell through to `roles[0]`, and that
   array's order is whatever the join returned, which is why a support or
   finance account could read "Shipper" in the admin table.
2. `SidebarRoleBadge` — reads the session, colours staff access loudly and
   ordinary access quietly, renders nothing while the session loads rather than
   flashing a wrong role.
3. Rendered from `AppSidebarHeader`, so all three shells — app, driver, admin —
   get it from one place.
4. A test asserting the precedence list covers `userRoleEnum` exactly, so an
   eighth role cannot silently fall through to "user".

---

## Verification

- `npx tsc --noEmit`, `pnpm lint`, full Vitest suite.
- `pnpm db:migrate` against the dev database: 10 recorded rows → 12.
- Playwright against the running dev server, both themes and both locales:
  earnings renders (and renders its error state when the endpoint is forced to
  500), the client book pages 4,592 owners across 184 pages, search narrows to
  1, the dialog opens, the badge reads ADMIN.
