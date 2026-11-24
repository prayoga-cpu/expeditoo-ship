# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, Codex, Aider) working in
this repo. Keep this file short and link out — long context lives in `/docs`,
and the architectural source of truth is [`CLAUDE.md`](./CLAUDE.md).

**If this file and `CLAUDE.md` disagree, `CLAUDE.md` wins on architecture and
product; this file wins on process.** Flag the inconsistency to the operator.

---

## 0. Navigate with graphify first (save tokens)

`graphify-out/graph.json` is a merged cross-repo knowledge graph covering this
repo **and** the sibling `expedion_encheres` Flutter client. Node IDs carry a
`repo` attribute, so you can tell which side of the bridge a result came from.

```bash
graphify query "<question>"      # broad context — BFS over the graph
graphify explain "<symbol>"      # one node plus its edges, in plain language
graphify path "<A>" "<B>"        # shortest relationship path between two concepts
graphify <path> --update         # regenerate after structure changes
```

Query it **before** grepping for anything architectural, cross-file, or
cross-repo — especially the Expedion escalation bridge (`markPaid`,
`escalateAfter`, `external_ref`, `expedion_quotes`). Fall back to reading source
directly only when the graph does not surface enough.

The graph goes stale. If a session-start hook says it is, regenerate it before
trusting a query.

---

## 1. What Expeditoo is, in one paragraph

Expeditoo is the **driver-side app for Expedion demand** in France. Expedion —
the sibling quote product — escalates paid jobs no driver has taken; approved
drivers bid **downward** on price, ETA and vehicle, and an **operator** selects
the winner. A `listing` is a transport job, not an item for sale. `budgetCents`
is what the client already paid, **not a cap** — it is the ceiling the
platform's margin comes out of. Revenue is a commission on each completed
delivery. Full context: [`CLAUDE.md`](./CLAUDE.md), then `ROADMAP.md`.

---

## 2. Project status

| Dimension | Current state |
| --- | --- |
| Phase | Driver-side revamp complete; **user-testing mode** |
| Inlets | Expedion escalation, and a direct request posted at `/create` |
| Money | Behind `MOCK_PAYMENTS`; commission split still unnamed (`ROADMAP.md` §10) |
| Languages | `fr` primary, `en` at exact parity — both, always |
| Product source of truth | `ROADMAP.md` |
| Session history | [`CHANGELOG.md`](./CHANGELOG.md) (users) · [`STATUS.md`](./STATUS.md) (engineers) |

Read `docs/TESTING_MOCKS.md` before trusting anything money-shaped. Every mock
carries a `TODO(EXPEDITOO-TESTING)` marker — `grep -rn` it before shipping.

---

## 3. Stack at a glance

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 + shadcn/ui ·
**Drizzle + PostgreSQL** · Better Auth · Ably · Stripe Checkout + Connect ·
Cloudflare R2 + Sharp · Resend + React Email · Twilio (SMS) ·
MapLibre/OSM/Nominatim/OSRM · next-intl (FR + EN) · next-pwa + Capacitor ·
Vitest + Playwright.

---

## 4. Commands you can run

```bash
pnpm dev            # dev server (localhost:3000)
pnpm build          # production build
pnpm lint           # ESLint
pnpm test           # Vitest, run once
pnpm test:e2e       # Playwright
npx tsc --noEmit    # typecheck — the gate that matters

pnpm db:migrate     # apply migrations — to YOUR database only (§4a)
pnpm db:studio      # Drizzle Studio
pnpm changelog:check  # version ↔ CHANGELOG ↔ STATUS agreement (see §8)
```

`npx tsc --noEmit && pnpm lint && pnpm test` before you call anything done.

**`pnpm db:generate` is unusable here** — it re-emits the whole transport
realignment and can `DROP COLUMN` on a live database. Hand-write the `.sql`,
add the journal entry with a strictly increasing `when`, and let
`src/db/__tests__/migrations-journal.test.ts` check it. Full reasoning in
`CLAUDE.md` §"Essential Commands".

---

## 4a. Dev first: how a change reaches production

**You never develop, debug or test against production.** Production is real
drivers, real requests and live card payments; nothing you do while working may
be able to reach it. There are three places, and production is not one you
touch:

| | Your machine | **dev** — where you work | production — hands off |
|---|---|---|---|
| Git | any branch | `dev` | `main` (protected) |
| URL | localhost | https://dev.expeditop.fr (Vercel login) | https://www.expeditop.fr |
| Database | local Postgres | Neon branch `dev` (`ep-late-night-aw6o8h4v`), anonymised copy | Neon `main` (`ep-sweet-bonus-awtyfuyz`) |
| Stripe | test / `MOCK_PAYMENTS` | **test keys**, real flow | **live** keys |
| Mail | dropped or redirected | redirected to `EMAIL_DEV_RECIPIENT` | sent |

**The flow — every change, every agent, no exceptions:**

1. **Work** on `dev`, or on a branch cut from `dev` and merged back into it.
   Release bookkeeping (§8) is done here, in the commit that goes to `dev`.
2. **Push to `dev`.** GitHub runs `gates`; Vercel builds dev.expeditop.fr and,
   in that build, runs the same gate, refuses a destructive pending migration,
   **migrates the dev database**, then builds (`scripts/vercel-build.ts`). A red
   build means nothing on dev changed — fix and push again.
3. **Validate on dev.expeditop.fr.** Walk the change in a real browser with the
   dev accounts (`admin@dev.local`, `carrier@dev.local`, … — password is the
   repo secret `DEV_USER_PASSWORD`; the owner keeps a copy). The host is behind
   Vercel login: an agent gets in with the Vercel MCP's
   `get_access_to_vercel_url`. A payment there is Stripe **test** money —
   `4242 4242 4242 4242`.
4. **Launch: open a pull request `dev → main`** —
   `gh pr create --base main --head dev`. GitHub lets it merge only when
   `gates`, `release-source` (it came from `dev`) and `Vercel` (the dev
   deployment, which already migrated the dev database) are green. Merge it with
   `gh pr merge --merge`. **Never push to `main`.**
5. **Production migrates itself.** The production build re-runs the gate,
   refuses a destructive pending migration, **migrates production**, then
   builds. If any step fails, the build is not promoted and the previous
   deployment keeps serving. Check Vercel's production deployment and Admin →
   Paramètres afterwards. `sync-dev.yml` then fast-forwards `dev` to `main`.

**Migrations ship additively.** Add the column or table, backfill, switch the
code — and remove the old thing in a *later* launch, once nothing serving reads
it. The build refuses `DROP TABLE`/`COLUMN`/`TYPE`/`SCHEMA`, `TRUNCATE`,
`DELETE FROM`, `RENAME`, a column `TYPE` change, `SET NOT NULL` and an
`ADD COLUMN … NOT NULL` without `DEFAULT` unless the `.sql` carries
`-- release:allow-destructive <reason>` — and that marker is only honest after
the code that stopped using the thing is already in production.

**Never, without the owner asking in the same conversation:** a production
database URL anywhere (`.env.local` included), `MIGRATE_TARGET=production`,
Actions → « Migrate database » or « Seed beta » on production, `vercel --prod`,
`vercel env` writes to Production, a push to `main`, or switching off the
protection on `main`. Need realistic data? Actions → « Refresh dev database »
(anonymised — never a raw copy of production).

---

## 5. Directory map

```
src/
├── app/
│   ├── (app)/          # authenticated product surface
│   ├── (auth)/         # sign-in, sign-up, verify
│   ├── (marketing)/    # public site — /changelog lives here
│   └── api/            # REST routes; never touch the DAL directly
├── features/           # one folder per feature: ui/, hooks/, api/
├── components/         # SHARED UI only (shadcn primitives, providers)
├── server/
│   ├── dal/            # database access — permission-blind by design
│   ├── services/       # business logic — this is where permissions live
│   ├── dto/            # Zod schemas at every boundary
│   ├── emails/         # React Email templates
│   └── pdf/            # @react-pdf documents
├── db/
│   ├── schema/         # Drizzle tables — userRoleEnum is canonical here
│   └── migrations/     # hand-written .sql + meta/_journal.json
└── lib/                # cross-cutting helpers
messages/               # fr.json + en.json, exact key parity
docs/{plans,specs}/     # spec-driven development — read before building
```

---

## 6. Coding rules (non-negotiable)

Full rules in `docs/rules.md`. The ones that get broken most:

**Architecture — `UI → Hooks → Client API → REST → Service → DAL → Database`**

- UI never calls a Service or the DAL. API routes never call the DAL directly.
- **Services enforce permissions.** Routes resolve the session and pass it down.
  Never inline a role check in a route handler.
- Zod at every boundary. No `any`. Functions under 50 lines.
- Services throw typed errors carrying a `code` and `status`; routes translate
  them through `src/lib/api-response.ts`.

**Database**

- Every schema change is a **hand-written** migration plus a journal entry with
  a strictly increasing `when`. A `.sql` the journal does not name is inert —
  that is how production shipped without a `withdrawals` table.
- Money is integer cents. Never a float.

**Roles**

- **Never restate the role enum.** Derive from `userRoleEnum`
  (`src/db/schema/users.ts`). A restated copy in `user.dto.ts` silently broke
  every admin role assignment once already.
- Primary-role precedence lives once, in `src/lib/primary-role.ts`.

**i18n**

- Every user-facing string goes through next-intl. Add the key to **both**
  `messages/fr.json` and `messages/en.json` — parity is exact and verified by
  key diff, not by eye.
- French is the primary language. English is a real translation, not a
  placeholder.

**Styling**

- Tailwind utilities and CSS variables. Colour comes from `oklch` in
  `globals.css`; never a raw hex in a component.
- **Light and dark are both mandatory** for every new surface.
- Empty states go through `centered-empty-state.tsx`; page transitions through
  `page-wrapper.tsx` / `page-loader.tsx`. Never ad-hoc.

**Query hooks**

- Give every `useQuery` surface an `isError` branch. A hook that returns `null`
  on failure renders a blank page with nothing to retry — that is what hid a
  500 for weeks.

**Prettier**

- `.prettierc` is misnamed (missing an `r`), so Prettier never loads it and
  reformats whole files. **Do not run Prettier.** Match surrounding style by
  hand.

---

## 7. Things you must not do

1. **No goods-auction concepts.** No `bids` on items, no `orders`, no `sellers`
   or `buyers`. Won-checkout and goods-auction leftovers get **removed**, never
   extended.
2. Do not accept `origin` from the client on `createListingSchema` — the
   service stamps it. Accepting it lets anyone post work into the operator
   award queue.
3. Do not charge the payer on an escalated job. That client already paid
   Expedion. `payments.source` records which of the two happened.
4. Do not let a confirmation become a status change. Nothing in
   `shipment-confirmations.service.ts` may write `shipments.status`,
   `shipment_events`, a payment, or a listing status — the public
   unauthenticated link is only defensible while that holds.
5. Do not serve a KYC document by direct URL, and never persist a full IBAN.
6. Do not add a feature flag or a backwards-compatibility shim. Make the change
   directly.
7. Do not add an auto-firing write without guarding it with `isImpersonated()`.
   A borrowed session never writes by itself.
8. Do not commit any `.env*` file other than `.env.example`.
9. Do not reach production — not its database, not its deploy, not `main`.
   Work on `dev`, validate on dev.expeditop.fr, launch through the pull
   request. §4a.

---

## 8. Session discipline — the update rule

**Every session that changes the repo ends with a recorded release.** This is
not optional bookkeeping: `CHANGELOG.md` is the source of truth the `releases`
table and the public `/changelog` page are built from, and `STATUS.md` is the
only place the *reasoning* behind a session survives.

A session is done when all five of these are true:

1. **`CHANGELOG.md` has a new entry at the top**, formatted exactly:

   ```
   ## [x.y.z] - YYYY-MM-DD · tag
   ```

   where `tag` ∈ `feat | fix | infra | ux`. Bullets start with `- ` and are
   written **for a driver, an operator or a client** — plain language, no file
   names, no type names, no "refactored". A fix names the symptom the user saw,
   not the cause.

   **The same entry goes into `CHANGELOG.fr.md`, in French, in the same
   session.** `/changelog` shows that file to a French reader. The header line
   is copied verbatim (same version, date, tag), every bullet is translated
   and none merged or dropped, `` `code` `` and « UI labels » stay as they are.
   English is the source; French is a real translation, written the way
   `messages/fr.json` words the same screens. `pnpm changelog:check` and
   `changelog.test.ts` fail on a missing release, a different bullet count or a
   bullet left in English. The same goes for every new key in
   `messages/en.json`: it is translated into `fr.json` in the same change.

   **Every session gets an entry — there is no opt-out.** A session that
   changed nothing a user can see is tagged `infra` and says so plainly
   ("Nothing you can see changes" ), then says why it mattered. That is what
   `infra` is for, and it is why `CHANGELOG.md` and `STATUS.md` can be held in
   exact lockstep by a test.

2. **`STATUS.md` has a matching entry at the top**, formatted:

   ```
   ## ✅ YYYY-MM-DD — Title (x.y.z)
   ```

   This one is for the next engineer. Open with the operator's request —
   verbatim, in italics, when there was one. Then what changed and **why**,
   naming real files and tables; the judgment calls; the bugs found on the way;
   a **Verification** block with real numbers; and **Known limits** for anything
   deliberately left. Never claim a check you did not run.

3. **The version is bumped in both places and they agree**: `package.json`
   `"version"` and `APP_VERSION` in `src/lib/version.ts`, both equal to the
   newest `CHANGELOG.md` header. Minor bump for `feat`/`ux`; patch for
   `fix`/`infra`.

4. **The gates are green**: `npx tsc --noEmit`, `pnpm lint`, `pnpm test`.
   `pnpm changelog:check` verifies items 1–3 mechanically and runs in CI, so a
   forgotten bump fails the build rather than shipping silently.

5. **Outside-codebase work is written down.** An env var to set, a Stripe or
   Twilio setting to change — add it to the
   **Operator to-do** list in `STATUS.md`. Nothing that needs a human hand may
   live only in a chat message.

If you touched the schema, commit the migration `.sql` **and** its journal entry
together — the dev build migrates the dev database from them, and the launch
migrates production from the same files (§4a). If you added a spec, link it
from the `STATUS.md` entry.

The session ends with the release **on `dev`** and validated there. Launching
it to `main` is the pull request in §4a — open it when the operator asks for a
launch, or when the session's request was a launch.

`TEMPLATE-checkpoint-agentic.yaml` is the minimal closeout record — copy it when
a session needs a machine-readable evidence trail (changed files, checks run,
rollback command, what was *not* verified).

---

## 9. Spec-driven development (mandatory)

1. Read `ROADMAP.md` for what to build.
2. Write `docs/plans/plan_<feature>.md` — steps, files, dependencies.
3. Write `docs/specs/<feature>_spec.md` — exact behaviour, edge cases,
   validation, error codes, and a "test coverage required" checklist.
4. Implement to the spec. No improvisation.
5. Verify against the spec, including its coverage checklist.

Specs are the contract used to debug later. Docs under `docs/specs/` and
`docs/plans/` written for the v1 goods marketplace are **stale** — check the
date and the vocabulary before building from one.

---

## 10. Where to find more

| You need to understand... | Read |
| --- | --- |
| Product, architecture, gotchas, current state | [`CLAUDE.md`](./CLAUDE.md) |
| What ships next, and the open decisions | `ROADMAP.md` |
| What users got, release by release | [`CHANGELOG.md`](./CHANGELOG.md) |
| Why a past session did what it did | [`STATUS.md`](./STATUS.md) |
| The non-negotiable engineering rules | `docs/rules.md` |
| What is mocked and must not be trusted | `docs/TESTING_MOCKS.md` |
| A specific feature's exact behaviour | `docs/specs/<feature>_spec.md` |

`GEMINI.md` is **stale** — it predates the transport pivot and claims there are
no tests. Do not build from it.
