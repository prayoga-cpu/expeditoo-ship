# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**EXPEDITOO** (`expeditoo-ship`) is the **driver-side app for Expedion demand** in
France. Expedion — the sibling quote product — escalates paid jobs no driver has
taken; approved drivers bid downward on price, ETA and vehicle; **an operator
selects** the winner. Status writes back so the Expedion client never leaves
their app. Revenue is a commission on each completed delivery.

**There are two inlets.** Expedion escalation, and a direct transport request
posted at `/create` by anyone with a session. The second was deleted in
`7a455c0` and restored on 2026-08-26 because the client asked for it back; if
you are reading an older doc that says "Expedion escalation is the only inlet",
that is what changed. **Won-checkout code and goods-auction concepts are still
leftovers** and should be removed, not extended — the only auction here is the
reverse auction on transport.

The two inlets differ in who awards the job, and that difference is load-bearing:
an escalated job is owned by the Expedion system account and awarded by an
**operator**; a direct request is owned by the person who posted it and awarded
by **them**. `offersService.acceptOffer` reads `listing.origin` to tell the two
apart, which is why `origin` is stamped by the service and is **not** a field on
`createListingSchema` — accepting it from the client would let anyone post work
straight into the operator award queue.

**Nobody signs in as the owner of an escalated job.** Those listings belong to a
system account (`EXPEDION_SYSTEM_USER_ID`) that no human logs into, which is why
awarding is an operator permission rather than an owner permission. (This is not
the same as saying nobody holds the `shipper` role — every signup does. See
§"Data Model".)

`ROADMAP.md` is the product source of truth. Read it before planning anything.

**Session discipline is mandatory and enforced.** Every session that changes
this repo ends with a release recorded in four places that must agree:
`CHANGELOG.md` (what a driver, operator or client got), `STATUS.md` (why, for
the next engineer), `package.json` and `src/lib/version.ts`. The full rule is
[`AGENTS.md`](./AGENTS.md) §8; `pnpm changelog:check` and
`src/lib/__tests__/changelog.test.ts` fail when they drift, and
`.github/workflows/gates.yml` runs both. `CHANGELOG.md` is the source of truth
the public `/changelog` page is rendered from — do not edit the page instead.

**Current status:** driver-side revamp complete; the Expedion inlet needs a real
payment signal. See §"Where Things Stand".

**Knowledge graph:** `graphify-out/graph.json` is a merged cross-repo graph
covering both this repo and the sibling `expedion_encheres` Flutter client —
node IDs carry a `repo` attribute so you can tell which side of the bridge a
result came from. Query it (`graphify query "<question>"`) before grepping for
architecture, cross-file, or cross-repo questions, especially anything about the
Expedion escalation bridge (`markPaid`, `escalateAfter`, `external_ref`,
`expedion_quotes`). Regenerate with `graphify <path> --update` after either
repo's docs or structure change meaningfully — it goes stale otherwise.

---

## Essential Commands

```bash
pnpm dev            # Dev server (localhost:3000)
pnpm build          # Production build
pnpm lint           # ESLint
pnpm test           # Unit tests (Vitest)
pnpm test:e2e       # E2E tests (Playwright)
npx tsc --noEmit    # Typecheck — the gate that matters during the pivot

pnpm db:generate    # DO NOT USE - see below; hand-write the .sql instead
pnpm db:migrate     # Apply migrations
pnpm db:studio      # Drizzle Studio
```

**`pnpm db:generate` is not usable in this repo.** `0002` left no meta
snapshot, so drizzle-kit diffs the schema against `0001` and re-emits the whole
transport realignment: on a database that already has it, that means `CREATE
TABLE` for tables that exist and — the dangerous part — `DROP COLUMN` for
columns a live deployment still needs. It also numbers the file from its own
count, colliding with the hand-written ones, and stamps a `when` that can be
*lower* than the newest journal entry, which drizzle then skips in silence.
Every migration from `0002` on is hand-written for this reason; write the
`.sql` yourself, add the journal entry with a strictly increasing `when`, and
let `src/db/__tests__/migrations-journal.test.ts` check it.

---

## Core Flow

```
Expedion client accepts a quote and pays
   ↓  POST /api/expedion/quotes/:id/paid sets escalateAfter (+48h)
No driver assigned inside the window
   ↓  cron sweep auto-escalates
Quote becomes a listing (origin='expedion', externalRef=quote id)
   ↓  appears on /expedion
Approved drivers submit offers
   ↓  price + ETA + vehicle + message
An operator compares and accepts one
   ↓  the client pays, shipment created (nothing to pay on an escalated job —
      that client already paid Expedion when they accepted the quote)
   ↓  status writes back to Expedion
Pickup → In transit → Delivered
   ↓  payout recorded; the client's card is not touched again
Payout to driver, two-way review
```

---

## Data Model

| Entity | Meaning |
|---|---|
| `listings` | **A transport job**, not an item for sale |
| `offers` | A carrier's competing bid on a job |
| `shipments` | The execution record, created when an offer is accepted |
| `carriers` / `vehicles` / `carrier_documents` | **An individual driver's** profile, vehicle and KYC file |
| `payments` / `payouts` | Money in (held then captured) and money out |
| `user_roles` | Many-to-many; seven roles |

`listings.origin` (`direct` \| `expedion`) and `listings.external_ref` are the
bridge to the sibling Expedion product. Both legs are wired: escalation creates a
listing, and shipment status writes back so the Expedion client sees progress.
`external_ref` holds the quote id and is the **idempotency key** that stops a
retried escalation minting a second listing.

New listings are always `expedion`. `direct` survives only as the default on
legacy rows, and `/expedion` filters them out.

**The `carriers` table is person-level.** Applicants are individual drivers, not
haulage companies, so KBIS is not required — an auto-entrepreneur has none.
SIRET still is: a sole trader carrying goods for hire in France has one, and the
column is `NOT NULL`. One vehicle is required because an offer names the vehicle
that will do the job; that is not fleet management.

**Roles (7):** `shipper`, `carrier`, `driver`, `operator`, `support`, `finance`,
`admin`. The canonical list is `userRoleEnum` in `src/db/schema/users.ts` — Zod
schemas must **derive** from it, never restate it. A `driver` executes shipments
and never sees prices, offers or payouts. `shipper` is the **default role granted
to every new signup** (`assignDefaultRole`, `src/server/dal/users.dal.ts`) — a
leftover from the era when shippers posted work. No shipper-facing surface exists,
so the role reaches nothing in the UI, but do not read that as "nobody holds it":
`POST /api/listings` checks for a session and no role at all, so the job-posting
API is live for any signed-in user even though nothing links to it. The Expedion
system account is the owner of escalated listings, not the only holder of the
role. See `docs/specs/roles_spec.md` for the permission matrix.

---

## Architecture (STRICT)

```
UI → Hooks → Client API → REST API → Service → DAL → Database
```

- UI never calls a Service or the DAL.
- API routes never call the DAL directly — always through a Service.
- **Services enforce permissions.** Routes resolve the session and pass it down;
  the DAL is permission-blind. Never inline a role check in a route handler.
- Zod at every boundary. No `any`. Functions under 50 lines.
- Errors: services throw typed error classes carrying a `code` and `status`;
  routes translate them via `src/lib/api-response.ts`.

Full rules in `docs/rules.md` — non-negotiable.

---

## Spec-Driven Development (MANDATORY)

1. Read `ROADMAP.md` for what to build.
2. Write `docs/plans/plan_<feature>.md` — steps, files, dependencies.
3. Write `docs/specs/<feature>_spec.md` — exact behaviour, edge cases,
   validation, error codes.
4. Implement to the spec. No improvisation.
5. Verify against the spec, including its "test coverage required" section.

Specs are the contract used to debug later. They are not optional.

---

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 + shadcn/ui ·
Drizzle + PostgreSQL · Better Auth · Ably (realtime) · Stripe Checkout + Connect ·
Cloudflare R2 + Sharp · Resend + React Email · MapLibre/OSM/Nominatim/OSRM ·
next-intl (FR + EN) · next-pwa + Capacitor (Android) · Vitest + Playwright.

---

## Design System

`ROADMAP.md` §7 is canonical. Source of truth for colour is `oklch` in
`globals.css`; the hex table exists so Flutter can match.

- Fonts: Plus Jakarta Sans (UI), Geist Mono (code/numerals)
- `radius` base `0.5rem`; card padding 16–20px; section gap 24px
- Empty states go through `centered-empty-state.tsx`, never ad-hoc
- Page transitions go through `page-wrapper.tsx` / `page-loader.tsx`
- **Light and dark are both mandatory** for every new surface

---

## Where Things Stand

The driver-side revamp is complete: the shipper surface is gone, Expedion is the
only inlet, and an operator awards in the client's place. Tracked in
`docs/plans/plan_phase_a_bidding_core.md` and
`docs/plans/plan_transport_only_refinement.md` (both partly superseded by the
revamp above).

**The repo is in user-testing mode.** Every MVP journey walks end to end through the
UI, but payments run behind `MOCK_PAYMENTS` and the Expedion escalation demo runs off
a seed script — read `docs/TESTING_MOCKS.md` before trusting anything money-shaped.
Every mock carries a `TODO(EXPEDITOO-TESTING)` marker; `grep -rn` it before shipping.

**Gates — all green.** `npx tsc --noEmit` 0 errors · `pnpm lint` 0 errors ·
438 unit tests pass · `pnpm build` succeeds.

**Done**
- Schema remodelled to the transport model; one clean initial migration
- Goods-auction surface deleted, including its checkout, browse card and categories
- **Shipper surface deleted**: job form, `create/success`, my-jobs list. `/listings/me`
  redirected to `/expedion` — **no longer true**: restoring `/create` brought the
  requester back, and it now renders `MyRequestsScreen` (two URL-held tabs, the
  `/create` draft included). A request you cannot find again is not a request.
- **`/expedion` job board**, pinned to `origin='expedion'` (filter threaded DTO → DAL → client)
- **`/home` is the driver dashboard**: application status, current run, open jobs,
  bids awaiting decision
- **Operator award queue** at `/admin/awards`; `offersService.acceptOffer` accepts an
  operator or admin on Expedion-origin jobs, and bills `listing.shipperId` rather than
  the actor. 35 tests
- Offers engine: atomic accept, concurrency guarantee, idempotency, Stripe compensation
- Listings as transport jobs: DTO, DAL, service, routes. 25 tests
- Driver KYC (person-level): application, private document storage, vehicle, admin
  approve/reject/suspend, expiry cron. 26 tests
- Payments: taken on acceptance, refunded on cancellation, commission at source,
  payout recorded
- Driver UI: shipment list and detail, status transitions, proof-of-delivery upload
- Admin UI: driver application review, award queue, Expedion bridge monitor — the
  last two were previously orphaned and are now in the sidebar
- **Admin user management** at `/admin/users`: last-login column, working "view
  profile", impersonation ("log in as", 60 min, audited in `impersonation_sessions`,
  banner while active), password reset, sign-out-everywhere, account delete.
  `docs/specs/admin_user_management_spec.md`. **A borrowed session never writes
  by itself** — every mutation that fired from a page load (message read
  receipts, `mark-seen`, Stripe customer/SetupIntent/Connect provisioning) is
  suppressed for it via `isImpersonated()`; add a new auto-firing write and you
  must guard it too. **Suspension now bites** — `user.banned`
  was written and read by nobody: it blocks session creation, kills live sessions, and
  `session.cookieCache.maxAge` dropped 7 days → 5 min so revocations are not invisible
  for a week
- Expedion bridge: `POST /api/expedion/quotes/:id/paid` starts the escalation clock,
  and the Expedion payment server **does** call it — `api/confirm-payment.js` in
  `expedion_encheres` verifies the Checkout session with Stripe and posts here.
  Escalation is idempotent via `external_ref` and refuses to release its claim after
  creating a listing; status changes write back
- **Post-payment fork** at `/admin/expedion`: a paid quote reads "Needs a driver"
  and offers both lanes as buttons — assign from the pool, or publish to the
  marketplace — with the auto-publish deadline shown as the fallback it is. The
  price locks at payment (`PRICE_LOCKED`); the correction path is
  `POST /quotes/:id/requote`. Assignment goes through
  `expedionEscalationService.assignDirect`, which escalates and then awards the
  chosen driver through `offersService.acceptOffer`, so both lanes produce the
  same listing + offer + shipment + payment hold. A driver is never attached by
  patching `assignedCarrierId` — that route no longer accepts the field.
  `expedion_quotes.assigned_directly` is what keeps the escalation-rate KPI
  honest, since a pool assignment now mints a listing like an auction does.
  `docs/specs/expedion_post_payment_fork_spec.md`
- Crons: listing expiry, document expiry, escalation sweep, image cleanup — driven by
  `.github/workflows/scheduled-jobs.yml`, not Vercel Cron (Hobby caps crons at 2/project,
  once per day). Needs repo variable `APP_URL` and repo secret `CRON_SECRET`.
- Theme-aware loader (light/dark `.lottie` cuts, picked by `resolvedTheme`); one shared
  `BrandWordmark` lockup across sidebar, mobile header and marketing
- FR/EN parity exact, verified by key diff rather than by eye (a leaf count is
  quoted here at your peril — it has been stale three times)
- **Carrier trips** at `/carrier/trips`: one screen, two tabs, as the client asked.
  *Prévus* is the new `carrier_routes` / `carrier_route_dates` pair — routes a
  carrier declares as recurring (weekdays) or occasional (specific dates),
  **private to them**, rendered as a saved query against the board's existing
  `nearLat`/`radiusKm`/`pickupFrom` filters, so there is no matching engine.
  *Effectués* reuses `GET /api/shipments` and joins `/api/carrier/earnings` for
  the money. Pulls `ROADMAP.md` §8 Phase D forward and makes the marketing
  claim about filtering on existing trips true. 44 tests.
  `docs/specs/carrier_trips_spec.md`
- **Billing documents**: `invoicesService.createFromPayment` was dead code —
  called from nowhere but its own test — so no invoice had ever been created.
  It now fires from `settleDelivery`, in its own try so paperwork cannot strand
  a captured payment. `/profile/invoices` was linked from nothing but an email
  body and is now in the profile quick links, with the Cocolis period filter and
  a bundle download. The carrier's half is a **relevé d'activité**, not a
  facture: while `COMMISSION_RATE` is 1.0 the net is €0 and the screen says so
  rather than inventing a split. `docs/specs/billing_documents_spec.md`
- **Two migrations had never run anywhere.** `0009_offer_self_accepted` and a
  second `0010_withdrawals` were absent from `meta/_journal.json`, and the
  migrator walks the journal, not the directory — so production had no
  `withdrawals` table, `GET /api/carrier/withdrawals` answered 500 and "My
  earnings" was a blank page. Renumbered to `0011`/`0012` **above**
  `0010_carrier_routes`, because drizzle applies a migration only when its
  journal `when` beats the newest one already recorded; a backdated entry is
  silently skipped. `src/db/__tests__/migrations-journal.test.ts` now fails on
  an unregistered `.sql`, a missing file, a non-increasing timestamp or a
  duplicate prefix. The Vercel build is still a plain `next build`, so a deploy
  never migrates: run **Actions → Migrate database** (`.github/workflows/migrate.yml`,
  `workflow_dispatch`, type `migrate` to confirm) **before** the deploy goes out.
  It is the only place that can: every production variable in Vercel is marked
  Sensitive, so `vercel env pull` returns `[SENSITIVE]` and a laptop has no way
  to reach the production database. Needs repo secret `POSTGRES_URL_PRODUCTION`.
- **Expedion clients** at `/admin/expedion-clients`: the client book, grouped by
  `expedion_quotes.firebase_uid`, server-paginated over 4,592 owners. It exists
  because `/admin/users` structurally cannot show these people — they are quote
  owners and **none** has a `user` row. The account column joins on
  `user.id = firebase_uid` (proof the client authenticated here) and never on
  `user_id`, which is email-matched claiming. Read-only: quotes are edited at
  `/admin/expedion`. `/admin/users` learned `?search=` so the link lands on the
  account. 18 tests. `docs/specs/admin_expedion_clients_spec.md`
- **Cargo asked the way people answer it** on `/create` step 1: weight is six
  brackets rather than an empty spinner, size is a standard format (S…XXL, "a
  bike", "a watch") or exact dimensions, and the dropzone says it takes several
  photos. **The stored shape is unchanged** — a bracket resolves to its
  **ceiling** in `toCreatePayload` and nothing downstream learns a new
  vocabulary, because `TakeJobPanel` matches a vehicle on
  `maxWeightKg >= weightKg` and rounding down would put a 90 kg load in a 50 kg
  van. `over1000` is the one bracket that still asks for a figure, so the 44 t
  the DTO accepts stays reachable. Fixed beside it: the photo cap was 5 while
  its comment claimed to match the server's 10, and "Prendre une photo" shared
  the gallery picker's input so it could not take a photo. 46 tests.
  `docs/specs/cargo_input_spec.md`
- **Role badge in the sidebar**, from `AppSidebarHeader`, so all three shells
  show which access the session carries. Precedence lives once in
  `src/lib/primary-role.ts`; `map-api-user.ts` had its own copy that fell
  through to `roles[0]`, and that array's order is whatever the join returned,
  so a support or finance account could read "Shipper" in the admin table. A
  test asserts the list covers `userRoleEnum` exactly.
- **An offer proposes several time slots, and the award books one.** A driver
  free on the 25th *or* the 27th had to pick one and hope: the offer carried a
  single `estimated_pickup`. A slot is now a day plus a time of day —
  `morning` / `afternoon` / `evening`, the vocabulary the board search already
  speaks — one to twelve of them over at most four days, in `offer_slots`.
  Delivery is one control, not a second calendar: a lead in days, promising
  22:00 local on the day it names, which is what makes a
  delivery-before-pickup offer unrepresentable rather than merely refused.
  **`estimated_pickup` / `estimated_delivery` stayed** and hold the *booked*
  slot — the earliest until one is chosen — so `pickup_asc`, the shipment write
  and the Expedion write-back read the pair they always have. `slots: []` means
  "the job's own window" and is the lane `takeJob` and `assignDirect` take; the
  DTO forbids it over the wire. **The form gates periods, not just days**: an
  offer is refused *whole*, and `SLOT_IN_PAST` / `PICKUP_OUTSIDE_WINDOW` are
  decided per slot while a calendar can only close a day — so
  `offerablePeriods` asks the service's own question at the service's own
  granularity, and a job collecting 09:00–11:00 no longer defaults its one
  allowed day to "en journée" and loses the driver the bid. `SubmitOfferForm`
  and `OfferCard` were translated on the way past — both were hardcoded
  English. 65 new tests, 106 across the suites it touches.
  `docs/specs/offer_time_slots_spec.md`
- **Pickup and delivery photos, with the location burned in.** There was one
  photo: `shipments.proof_of_delivery_url`, a single **public** R2 URL, taken
  only at delivery, by a call that also captured the payment — so "attach
  evidence" and "the goods arrived" could not be separated. It is replaced by
  `shipment_photos`: several photos per stage, each carrying a live
  `navigator.geolocation` fix that is **stamped into the pixels** before the
  object is stored, so no unstamped copy exists anywhere. EXIF is dropped, not
  read — its GPS tags are editable with a text editor, which is the opposite of
  what this is for. **The two moves that change hands are now gated**:
  `→ PICKED_UP` and `→ DELIVERED` are refused without a photo of that stage,
  staff included, and the gate runs *before* any money moves. Storage is
  private, on the `kyc`/`expedion` pattern — `R2_SHIPMENT_BUCKET_NAME`, never
  `R2_BUCKET_NAME`, which the image-cleanup cron sweeps. **There is no update
  path in the stack**: no PATCH, no service method, for the image, the location
  or the timestamps. Removal is admin-only (not operator) and soft. The client
  reads them at `/deliveries/[id]` and — for an escalated job, whose client has
  no `user` row and no party seat — over `GET /api/expedion/quotes/:id/photos`,
  rendered on the Flutter `suivi_de_livraison` screen. 68 tests.
  `docs/specs/shipment_photos_spec.md`
- **The client pays at booking, and the money is taken rather than held.**
  The client asked for it plainly: payment happens once the transport is
  confirmed and chosen, before delivery. Both inlets were half-right in
  opposite directions — a direct job had the right *timing* (money event at
  award) but only placed a hold captured days later, while an Expedion job took
  real money at the wrong *moment* (quote acceptance, before any driver
  existed) and was then charged a **second** time at award. That second charge
  went to the system account that owns escalated listings, which has no card,
  so `authoriseForShipment` threw `PAYMENT_METHOD_REQUIRED` and
  `compensateFailedAward` unwound it: **no escalated job could be awarded at
  all with `MOCK_PAYMENTS` off.** `chargeForShipment` now confirms an
  automatic-capture, off-session PaymentIntent for a direct job, and for an
  Expedion job records `source='expedion'` with no Stripe call — the money
  moved in that app. `settleDelivery` stopped capturing and only settles the
  driver; cancel and revoke **refund** instead of releasing, and refuse
  (`REFUND_NOT_LOCAL`) on money Expedion took. A direct job may not reach the
  board without a card, so `/create` gained a fifth step that collects one —
  nothing is charged there, because the amount is the winning offer and no
  carrier has bid yet. Found on the way past: `PaymentError` was missing from
  `handleError`, so every payment failure on an accept reached the browser as a
  bare 500 and `useJobDetail`'s `PAYMENT_METHOD_REQUIRED` branch had never
  fired. 61 tests. `docs/specs/payment_at_booking_spec.md`

- **The transporter moves the status; the client attests it.** Status was
  driver-only: `updateStatus` accepts `carrier`, `driver` or `staff` and throws
  `FORBIDDEN` for the shipper, so `/deliveries` was read-only tracking and the
  client had no say in the record. They now confirm the two moments goods
  change hands — `PICKED_UP` and `DELIVERED` — in `shipment_confirmations`,
  which is a **separate fact** from `shipment_events`: that table records who
  *moved* the status, not who *agreed it happened*. **An attestation grants
  nothing** — it cannot move a status, capture a payment, close a listing or
  write an event — and that is the only reason the one-tap link is safe to text
  to someone with no account. Two channels: the Expedion app
  (`POST /api/expedion/quotes/:id/confirm`, authorised through
  `expedionService.getQuote`, so a non-owner gets 404 not 403) and a signed
  stateless link (`POST /api/shipments/confirm`, the app's only unauthenticated
  write) that rides on the SMS the bridge already sends rather than a second
  one. `confirmed_by_role` records *who* answered as distinct from `channel`'s
  *how*, so an operator answering for a client never reads as the client. The
  public payload carries **cities, not street addresses** — the link lives 30
  days in an SMS and the dropoff is the client's home — and every write path
  returns a projection, never the audit columns. Statuses relabelled to the
  client's vocabulary: *En préparation*, *En retrait*, *En cours de livraison*.
  The Flutter `suivi_de_livraison` screen grew the matching card. 83 tests.
  `docs/specs/transport_status_confirmation_spec.md`
- **A price offer inside the message thread.** The client asked for a form
  behind a button in a thread, sending a price with pickup and delivery dates,
  beside ordinary messages. It is one `thread_offers` row plus a `messages` row
  pointing at it: `messages.thread_offer_id IS NOT NULL` is the whole
  discriminator, so price, dates and status are read from the join at render
  time and an operator awarding at `/admin/awards` flips the winner's card to
  accepted and every rival's to rejected with **no message rewrite**. Two lanes
  share one form. On a thread about an **open** job it also mints a real
  `offers` row through `offersService.submitOffer`, so the chat feeds the
  reverse auction rather than shadowing it, and accepting in the bubble is
  `acceptOffer` — the one money path. On any other thread, including the
  listing-less one the client screenshotted, it is a standalone quote that
  moves no money and says so. The chat offer proposes **one** slot, never the
  twelve `SubmitOfferForm` allows, and that is what makes accept-in-bubble
  safe: `acceptOffer` needs no `slotId` for a one-slot offer, so there is no
  wrong slot to book. `getThread` computes the whole gate once
  (`contextFor`) and **contains its failure** — a gate that cannot answer costs
  the button, not the conversation. Found on the way past: the job's owner, who
  is exactly who accepts, was getting `viewerCanAward: false`; and
  `useMessageDetail` read `listing.images` where the DAL returns `photos`, so
  the thread header had *always* shown the placeholder. 88 tests.
  `docs/specs/thread_offer_spec.md`
- **The receipt is raised when the money is taken, and it arrives by email.**
  The client asked for an invoice generated after payment, sendable or
  downloadable. Downloading worked; the other two halves did not. The document
  was raised on **delivery** — days after the card was debited, and only if the
  job completed — and the only mail was an English `<h1>` with a *link* and no
  attachment. It is now raised from `paymentsService`, in its own try, from the
  single transition into `captured`; the Stripe webhook was the other capture
  writer and wrote no `capturedAt` and had **no status predicate**, so a retry
  after a refund flipped the row back. **`settleDelivery` keeps its call as a
  backstop.** Predicated on `payment.source === 'stripe'`: an escalated job's
  client was debited *in Expedion*, against a listing owned by a system account
  nobody signs into, and that document could never be corrected —
  `refundForJob` refuses that money outright. **The correction exists because
  the document now precedes delivery**: a refund raises a `credit_note` row,
  negative, on its own `AV-` series, from the one `captured → refunded`
  transition both refund writers go through. Numbers come from
  `document_sequences` rather than `count(*)`, which collided between two awards
  and re-issued a used number forever once any row was deleted — and both of
  `invoices`' foreign keys cascade. **The document says only what it can
  prove**: while the issuer's identifiers are `TODO(EXPEDITOO-LEGAL)` it is a
  *Reçu de paiement* footed "ne vaut pas facture", and filling
  `INVOICE_ISSUER_*` promotes it to a *Facture* with the VAT treatment and no
  code change; a `pi_mock_` charge never prints PAYÉ. French throughout, with
  the billed party frozen onto the row so the emailed PDF and a later download
  are the same document. Found on the way past: `/api/user/invoices` declared
  `from`/`to` and never read them, so the period dropdown filtered the bulk
  download and nothing else; and the public terms still promised funds were
  *held* until delivery. 64 tests.
  `docs/specs/invoice_at_payment_spec.md`
- **A cancellation from the transporter and one from the requester are two
  different verbs.** There was one: `cancelShipment`, reachable by shipper,
  carrier, driver and staff alike, which always refunded and always set the
  listing to `cancelled` — so a van breaking down at 06:00 **destroyed a paid
  client's delivery**, and the transporter was kept out of it only by a boolean
  in a browser hook. **Cancel** now ends the job; **withdraw** takes only the
  transporter off it and the job goes back on the board, which is
  `revokeAward`'s shape finished and handed to the person it belongs to — that
  method was operator-only, reachable from no UI, wrote nothing back to
  Expedion, and handed the re-opened job straight to the expiry cron.
  `reopenForRebid` re-arms `expires_at` and slides the whole pickup window
  forward when the original has passed: without it `findExpired`
  (`status='open' AND expires_at < now`, every 15 min, against an `expires_at`
  of `pickup_from − 6 h` that is already past by award time) eats the job and
  every bid just restored, inside a quarter of an hour. **Both verbs refund** —
  nobody holds a client's money for a job with no driver — and the escalated
  lane's `REFUND_NOT_LOCAL` is caught *by name* and becomes a refund-owed event
  on the quote, while any other failure is stamped `refundFailed` on the
  cancellation event rather than living only in a server log.
  `recordExternalCharge` became idempotent **per listing**: a re-award after a
  withdrawal would otherwise write a second `captured` `expedion` row for one
  quote. The Expedion client hears the truth — quote → `escalated` with
  `assigned_carrier_id`/`assigned_at`/`assigned_directly` cleared *together*
  (leave one and the row falls out of both escalation-KPI buckets), and an SMS
  saying a replacement is being found rather than that their transport is off.
  **The back door is closed**: `PATCH /api/shipments/:id/status` accepted
  `CANCELLED` and reached a path with no reason, no refund and a live listing,
  from `PICKED_UP` where the cancel endpoint refuses. `IN_TRANSIT` gained a
  `CANCELLED` edge so the support lane the copy has always promised finally
  works — it answered `INVALID_STATUS_TRANSITION` to operators. The requester on
  the escalated inlet cancels at `POST /api/expedion/quotes/:id/cancel`,
  authorised through `getQuote` (404, never 403). Found on the way past: a job
  can now carry more than one shipment, so `getByListingId` returns the **live**
  run instead of an unordered `findFirst` — and both verbs now refuse a shipment
  that is *not* the one the listing holds (`SHIPMENT_NOT_CURRENT`), because a
  declined card already left orphaned `PENDING` rows around and stopping one
  would have refunded a different carrier's award. **A retry finishes the work**
  rather than answering "already done": the verbs are four writes across four
  tables and are not one transaction, so a run that flipped to `CANCELLED` and
  then failed on the listing or the bridge was otherwise unrepairable — every
  recovery route lands on the same shipment. Also closed: `DELETE
  /api/listings/:id` would cancel an **awarded** job with no refund and
  `accepted_offer_id` left set, from a client's own screen and from an admin
  button; the re-pointed Expedion charge kept the first driver's price, which is
  what `schedulePayout` reads; a `scheduled` payout survived the refund and went
  on counting as withdrawable; a re-board could publish a five-minute bidding
  window the sweep then ate; `compensateFailedAward` slid the client's dates on
  a declined card with nothing saying so; and an operator cancelling on the
  quote lane was recorded as the client themselves. 103 tests.
  `docs/specs/cancellations_spec.md`
- **The requester sees who already drives their trajet, and reaches them in one
  tap.** `carrier_routes` gave a driver a way to declare the trip they make, but
  it faced one way: the board filtered *jobs* by a driver's trajet, and nothing
  answered the requester's version of the same question. `/listing/[id]` gained a
  second tab — **Transporteurs disponibles** — listing the approved carriers whose
  declared trajet covers *this* job, in the right direction, inside its pickup
  window; **Contacter** opens a thread and posts the opening line. Because the
  thread carries `listingId` it lands on the thread-offer lane, so a cold contact
  feeds the reverse auction instead of shadowing it. **This reverses a documented
  privacy promise, and does it with consent, not silently**: trajets were declared
  under a dialog reading « Vous seul le voyez », so `is_discoverable` defaults true
  for new trajets and the migration backfills every existing row to **false** —
  the pool starts empty and fills as drivers opt in, and the copy was corrected in
  the same change. What crosses the wire is nine fields, pinned by a DTO test that
  fails on a tenth: the carrier, their rating, the trajet's two **cities** and its
  next run days — never an address, a postal code, a coordinate, a vehicle or a
  **user id**. Contact is addressed by an opaque `matchId`, and the service
  **re-runs the match** rather than looking it up: that re-run *is* the
  authorisation, so the endpoint cannot be walked as a carrier directory. No third
  copy of the corridor maths — `isOnPath` decides geometry and
  `upcomingOccurrences` the calendar; the SQL is a bounding-box prefilter that may
  narrow the set and may never decide a match, which it briefly did not (its
  longitude pad scaled at the job's latitude instead of the trajet's mean, making
  the box 6% too tight on a Lille → Marseille trajet). Found on the way past:
  `JobDetail` had **zero** `useTranslations` and was hardcoded English, so it was
  translated to carry its own tab labels; and a requester who is also a carrier
  matched their own job, where `findConversation(u, u, listingId)` — a
  conversation the user is in *twice* — would have posted the opening line into a
  different carrier's thread. **No Particuliers/Professionnels filter**: every
  carrier here passes KYC with a `NOT NULL` SIRET and `legal_form` is optional
  free text, so the two boxes could not partition the set. 107 tests.
  `docs/specs/carriers_on_route_spec.md`

**Not done**
- **`EXPEDION_APP_ORIGINS` is set in Vercel Production but not in `.env.local`**,
  so `user.origin` reads `expedion` on the deployment and never locally — an
  account created since it was set wears the right badge in `/admin/users`, one
  created before it does not, and one created on a laptop never will. It
  back-fills nothing, deliberately (`admin_user_management_spec.md` §1.2).
  `/admin/expedion-clients` does not depend on it.
- **The photo burn-in needs a bundled font on Vercel.** librsvg finds fonts
  through fontconfig, i.e. through whatever the host provides. The band renders
  correctly in local development; on a host with no system fonts it renders
  without glyphs. The fix is a TTF in the repo plus `FONTCONFIG_PATH` — a
  licensing and bundle-size call, not a code one. The database row is
  unaffected and every surface prints the same three lines as text beside the
  photo, so a fontless deployment loses the convenience, not the evidence.
  `TODO(EXPEDITOO-TESTING)` in `photo-stamp.service.ts`.
- **Real Stripe charging** — the code path is written and the card is collected
  for real at `/create`, but `MOCK_PAYMENTS` still short-circuits the charge
  itself. Turning it off needs `pi_mock_` rows purged first: each is a captured
  payment with no money behind it (`docs/TESTING_MOCKS.md` §1)
- **Driver pay on either lane.** Escalation hands the driver the full
  `acceptedPriceCents` as the bid ceiling; direct assignment writes it as the
  offer price. The commission split (`ROADMAP.md` §10) is what decides how much
  of that is actually theirs, and it is still unnamed.
- **Commission split on Expedion-origin jobs is undecided** (`ROADMAP.md` §10).
  `budgetCents` is what the client already paid; the margin is whatever the driver
  bids below it. Payouts cannot go live until this is named.
- Payouts stop at `scheduled`. A carrier earnings *view* now exists at
  `/carrier/trips` → Effectués, but it reports €0 net because the platform
  retains 100% during testing — nothing moves money
- Realtime shipment data: the Ably path exists on both ends but is not connected
- `seller`/`buyer` vocabulary still in ~50 files (live paths fixed; the rest cosmetic)
- Marketing copy still describes a two-sided marketplace and oversells (J+7 payout,
  live bid refresh, 24 h verification)
- E2E proving the exit criteria end to end

## Gotchas

1. **No goods-auction concepts.** No `bids` on items, no `orders`, no `sellers`
   or `buyers`. And no shipper-facing surface at all — Expedion is the inlet.
2. A listing is a *job*. `budgetCents` is what the Expedion client already paid,
   **not a cap** — it is the ceiling the platform's margin comes out of.
3. Lowest price never wins automatically. An **operator** chooses.
4. Money is **taken when the transport is chosen**, not on delivery — the client
   pays at booking (`docs/specs/payment_at_booking_spec.md`), and that is when
   the receipt is raised and emailed (`invoice_at_payment_spec.md`). Delivery
   settles only what the driver is owed, and cancelling **refunds** rather than
   releasing a hold — which raises a credit note, because the document was
   issued before the goods moved. The payer is `listing.shipperId`, never whoever clicked accept — and
   on an escalated job nobody is charged here at all, because that client paid
   in Expedion. `payments.source` records which of the two happened; it is not
   `listings.origin` under another name.
5. KYC documents are private. Never serve them by direct URL, and never persist
   a full IBAN — only the last 4.
6. No feature flags, no backwards-compatibility shims. Make changes directly.
7. Docs under `docs/specs/` and `docs/plans/` written for the v1 goods
   marketplace are stale. The Phase A specs listed above are current.
8. **Never restate the role enum.** Derive from `userRoleEnum`. A restated copy
   in `user.dto.ts` silently broke every admin role assignment.
9. **A query hook that returns `null` on failure renders a blank page.** That is
   what hid the withdrawals 500 for as long as it did — no heading, no error,
   nothing to retry, and the only evidence in the browser console. Give every
   `useQuery` surface an `isError` branch.
10. **A confirmation is not a status change.** The client attests; only the
   transporter moves the run. Nothing in `shipment-confirmations.service.ts`
   may start writing `shipments.status`, `shipment_events`, a payment or a
   listing status — the public unauthenticated link is only defensible while
   that holds, and a test asserts it directly.
11. **Cancelling and withdrawing are different verbs and must stay different.**
   The requester ends the job; a transporter only comes off it and the job goes
   back on the board. Never route a transporter through `cancelJob` — it answers
   `USE_WITHDRAW_ENDPOINT` on purpose — and never let a re-board skip
   `reopenForRebid`, whose whole job is re-arming `expires_at` before the
   15-minute expiry cron eats the job and every bid just restored.
12. **`shipments.status = 'CANCELLED'` has exactly one writer**, and it is
   `shipment-cancellation.service.ts`. `updateStatus` refuses the value and the
   status route no longer accepts it; a driver-side button wired to
   `PATCH /status` was one line from cancelling with no reason and no refund.
13. `.prettierc` is misnamed (missing an `r`), so Prettier never loads it and
   falls back to `trailingComma: "all"`. Running Prettier reformats whole files.
   Match surrounding style by hand instead.
