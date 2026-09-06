# STATUS.md

## Current state: user-testing mode — driver-side revamp complete (2.36.0)

_AI agents: add an entry here every time you finish a task. See AGENTS.md §8._

One entry per released session, newest first. This is the engineer-facing half
of each release; the user-facing half is [`CHANGELOG.md`](./CHANGELOG.md), and
the two are held in lockstep by `pnpm changelog:check` and by
`src/lib/__tests__/changelog.test.ts`.

### How to read the backfill

Entries `2.0.0` … `2.32.0` were reconstructed on 2026-09-05 from the 69
commits that make up this repository's whole history, because the discipline
that produces them did not exist while they were being written. Each is
grounded in its commit message and diff — nothing here is invented — but they
are a reconstruction, not a contemporaneous record. **Verification lines say
what the commit itself claimed**; where a commit claimed nothing, the entry
says "Not recorded in the commit." rather than guessing.

Entries marked with a `>` note were drafted but did not get the second
adversarial verification pass — treat their detail as slightly less certain.

### Operator to-do

Work that needs a human hand outside the codebase. Add to this list rather
than leaving it in a chat message.

- [ ] **Run `Actions → Migrate database` before any deploy** that ships a new
      migration. The Vercel build is a plain `next build` and never migrates.
- [ ] **Set `EXPEDION_APP_ORIGINS` in `.env.local`** — it exists in Vercel
      Production only, so `user.origin` reads `expedion` on the deployment and
      never locally. It back-fills nothing, deliberately.
- [ ] **Decide the commission split for Expedion-origin jobs** (`ROADMAP.md`
      §10). `COMMISSION_RATE` is 1.0 and payouts cannot go live until it is named.
- [ ] **Purge `pi_mock_` payment rows before turning `MOCK_PAYMENTS` off** —
      each is a captured payment with no money behind it (`docs/TESTING_MOCKS.md` §1).
- [ ] **Bundle a TTF and set `FONTCONFIG_PATH`** so the shipment-photo location
      band renders glyphs on Vercel. A licensing and bundle-size call.
- [ ] **Set `INVOICE_ISSUER_*` and `INVOICE_VAT_RATE`** once the company's
      registration and VAT position are known. Until then every payment document
      is a *reçu de paiement* that says it is not a facture; filling them
      promotes each new document to a conforming *Facture* with the VAT
      treatment, with no code change and nothing backdated
      (`docs/specs/invoice_at_payment_spec.md` §4.1). The variables are listed
      in `.env.example`.

---

## ✅ 2026-09-05 — Cancellations From Both Sides (2.36.0)

Spec: `docs/specs/cancellations_spec.md` · Plan: `docs/plans/plan_cancellations.md`
Supersedes `shipment_spec.md` §6, which is v1 and describes a `PRICE_PROPOSED` status not in `shipmentStatusEnum`.

- [x] **The whole point: one button was doing two opposite jobs.** `cancelJob` ends the transport — listing cancelled, bids expired, money refunded, quote → `cancelled`. New `withdrawFromJob` does the other thing — listing back to `open` with its window re-armed, rival bids restored to `pending`, money refunded, quote → `escalated` and the carrier cleared. Before this a transporter pressing cancel got the first outcome and a paid client's delivery died silently.
- [x] `src/server/services/shipment-cancellation.service.ts` (new) owns both verbs; `POST /api/shipments/[id]/withdraw` and `POST /api/expedion/quotes/[id]/cancel` are the new routes, the latter authorised through `expedionService.getQuote` so a non-owner gets **404, not 403** — the same shape the confirmation route already uses, because most Expedion clients have no `user` row.
- [x] **Migration `0021_cancellations.sql`** (hand-written; `pnpm db:generate` is banned here). New enums `shipment_cancellation_side` (`requester | transporter | operator`) and `shipment_cancellation_category` (11 values). The side is stored, not the actor role: `carrier`/`driver` are one commercial side and `shipper`/the accountless quote owner another, and the money and listing rules key on the side. `shipment_events.actor_role` could not stand in — it is a separate non-transactional insert and `recordEvent` collapses `staff → admin`.
- [x] Categories are fenced **per side by Zod**, not by three columns, so a report can `group by cancellation_category` with no join. `cargo_mismatch` and `access_impossible` are named deliberately: the transporter presses the button but the cause is the client's description or the pickup site, and a future reliability count must not charge those to the driver.
- [x] `shipments` gains `cancelled_by_side`, `cancellation_category`, `cancelled_by_user_id` and `cancelled_by_ref` — the identity pair copied verbatim from `shipment_confirmations`, and for the same reason: a foreign key alone cannot record an Expedion client who has no row to point at. `cancelled_at` / `cancellation_reason` are unchanged and still written.
- [x] `listings.reopened_at` (new): a job another transporter dropped is not the job that was posted — its bidding window has been machine-extended and possibly its pickup window too, and a bidder is entitled to know.
- [x] **No approval gate before pickup, on purpose.** A withdrawal is unilateral: a driver with a dead van at 06:00 waiting on an operator is a job that dies during the only hours it could be re-sold. Accountability is the record — side, category, actor, timestamp — not a gate. After pickup the calculus inverts and it becomes operator-only.
- [x] **`refundForJob(listingId)` replaces `refundForShipment(shipmentId)`.** The listing is the correct key: after a withdrawal the shipment is dead and a refund keyed on it would miss the payment. Not-`captured` returns the row untouched rather than marking it refunded, which would put a refund in front of an operator that never happened. `REFUND_NOT_LOCAL` is caught **by name** and becomes a refund-owed record for the Expedion side; a dead Stripe call surfaces as `refundFailed: true` rather than vanishing.
- [x] `StopTransportDialog` is the one shared client surface across `/deliveries/[id]`, `/listing/[id]` and `/driver/shipments/[id]`; rejected bidders are notified when a job returns to the board.

**Verification:** `npx tsc --noEmit` 0 errors · `npx eslint .` 0 errors · `npx vitest run` **1412 passed, 107 files, 0 failures** (includes `shipment-cancellation.service.test.ts` and `cancellation-policy.test.ts`) · `pnpm changelog:check` ok.

**Known limits:**

- Recorded by the spec itself (§10.3): an admin-initiated refund path is not closed.
- Entry written during the 2026-09-05 release sweep from the spec and the diff, not by the session that built it — that session recorded its invoice work as 2.34.0 and left this feature and 2.35.0 unrecorded.

---

## ✅ 2026-09-05 — Transporteurs Disponibles Sur Le Trajet (2.35.0)

Spec: `docs/specs/carriers_on_route_spec.md` · Plan: `docs/plans/plan_carriers_on_route.md`

- [x] **The mirror of the board's route search.** `board_route_search_spec.md` let a carrier find jobs on their trajet; nothing let a requester see the carriers whose trajet covers their job. One new tab on `/listing/[id]` — *Transporteurs disponibles (n)* — with a **Contacter** button per card.
- [x] **Discovery, not a second award path.** It writes no offer, moves no money, changes no status. The thread it opens is bound to the listing, so a carrier contacted here lands on the thread-offer lane and bids from the bubble (`thread_offer_spec.md` §3) — it feeds the reverse auction rather than routing around it.
- [x] **The match definition** (`src/lib/route-match.ts`, `carrier-discovery.service.ts`): an `approved` carrier on a live account, owning a trajet that is `is_active` **and** `is_discoverable`, whose corridor contains the job's pickup **and** dropoff *in that order along the trajet*, within that trajet's own `radius_km`, whose `capacity_kg IS NULL OR >= listing.weight_kg` (the same direction `TakeJobPanel` already uses for vehicles), with at least one upcoming run inside the pickup window.
- [x] Two-stage matching so the expensive half runs on few rows: a cheap SQL prefilter in the DAL (bounding boxes, capacity, flags, occasional-date existence — no trig, no `sqrt`) capped at `MAX_MATCH_CANDIDATES` 500, then the real corridor test in TypeScript, returning at most `MAX_MATCHES` 30 with `MAX_RUNS_SHOWN` 3 dates per card.
- [x] **Migration `0020_carrier_route_discoverable.sql`**: `carrier_routes.is_discoverable boolean NOT NULL DEFAULT true`, followed immediately by `UPDATE carrier_routes SET is_discoverable = false`. New trajets default findable — a supply pool nobody opts into is a dead tab — but **no trajet declared before this shipped was exposed without its carrier saying so**. Backed by `carrier_route_discoverable_idx (is_discoverable, is_active)`.
- [x] `NOT_LISTING_OWNER` answers **403, not 404**: a listing is public, so hiding its existence from someone who can already read it on the board buys nothing. An operator passes on an Expedion job, because nobody signs in as `EXPEDION_SYSTEM_USER_ID`.
- [x] Consequence the spec names as a product fact rather than a bug: the tab is empty until drivers opt in.

**Verification:** `npx tsc --noEmit` 0 errors · `npx eslint .` 0 errors · `npx vitest run` **1412 passed, 107 files, 0 failures** (includes `carrier-discovery.service.test.ts`, `carrier-discovery.dto.test.ts`, `route-match.test.ts`) · `pnpm changelog:check` ok.

**Known limits:**

- Entry written during the 2026-09-05 release sweep from the spec and the diff, not by the session that built it.

---

## ✅ 2026-09-05 — Invoicing At Payment, Emailed, And Correctable (2.34.0)

*"Invoicing — After payment, automatically generate an invoice that can be sent
by email or downloaded."*

Downloading already worked. The other two halves did not, and the reason was one
line of history: `invoicesService.createFromPayment` was wired to
`settleDelivery`, written when the money was captured on delivery. The client has
been charged **at booking** since `payment_at_booking_spec.md`, so the sequence
was card debited Monday, document issued Thursday, if the job completed at all.
And the only mail was an English `<h1>Your invoice is ready</h1>` with a link to
the profile screen — no attachment, and no way to ask for it again.

**What changed.** The document is raised from `paymentsService`, in its own try,
at the single transition into `captured`. `settleDelivery` keeps its call as a
backstop for payments captured before this shipped. Files:
`payments.service.ts`, `invoices.service.ts`, `invoice-email.service.ts` (new),
`invoices.dal.ts`, `invoice-issuer.ts` (new), `invoice-pdf-props.ts`,
`InvoicePDF.tsx`, `InvoiceDocumentEmail.tsx` (new), four routes under
`/api/user/invoices`, `invoices.api.ts` (new), `useInvoices.ts`,
`InvoiceList.tsx`, and migration `0019_invoice_documents.sql`
(`document_sequences`, `invoices.kind`, `related_invoice_id`, the frozen billing
block, and a partial unique index on `payment_id`).

**The judgment calls.**

- **Only `payment.source === 'stripe'` is documented.** An escalated job's client
  paid *in Expedion*, into Expedion's Stripe account, against a listing owned by
  `EXPEDION_SYSTEM_USER_ID`. A numbered Expeditoo invoice for that money would
  assert a charge this company never made, to a party that is not a person — and
  could never be corrected, because `refundForJob` throws `REFUND_NOT_LOCAL`
  before any correction could be minted. This is `billing_documents_spec.md`
  §4.1's own reasoning followed through; that section said the row was written
  but unseen, and it is now not written.
- **The document's title is derived, not asserted.** Every legal identifier is
  `TODO(EXPEDITOO-LEGAL)` and nobody has stated the VAT position, so
  `invoice-issuer.ts` reads `INVOICE_ISSUER_*` from the environment: complete →
  *Facture* with the mentions and an HT/TVA/TTC split; incomplete → the same
  document titled *Reçu de paiement*, footed with the "ne vaut pas facture"
  wording `EarningsStatementPDF` already uses. Filling the mentions légales
  promotes every future document with no code change. Emailing a document headed
  *Facture* with no SIRET and no VAT line is worse than emailing a receipt.
- **`isPaid` is not `status === 'paid'`.** It is
  `source === 'stripe' && !isMockIntent(intentId)` — the guard `refundForJob`
  already applies. `MOCK_PAYMENTS` writes `captured` rows with no money behind
  them and that is the lane user testing runs on; the document prints
  "Paiement simulé" where the stamp would be.
- **The correction is an avoir, not a `void`.** The document now precedes
  delivery, so refunds can invalidate it. `void` is defensible only for a draft
  that never left the building, which this codebase never produces. A
  `credit_note` row — negative, own `AV-` series, `related_invoice_id` — is
  minted from `paymentsService.markRefunded`, the one transition into
  `refunded`, so `refundForJob` and `refundService.processRefund` cannot drift.

**The bugs found on the way.**

- **The Stripe webhook was a second capture writer.** `stripe.service.ts` did a
  bare `UPDATE payments SET status='captured'` with **no `capturedAt` and no
  status predicate**. `chargeForShipment` stamps the intent id onto a *failed*
  row, so a late `payment_intent.succeeded` settled a payment outside every
  service and scheduled a payout — and a retry arriving after a refund flipped
  the refunded row back to captured. Now routed through
  `paymentsService.captureByIntent`, which allows only `pending|failed →
  captured`.
- **Invoice numbers were `count(*) + 1`** read in a statement of its own against
  a UNIQUE column: two awards in the same second collided with a 23505, and once
  any non-highest row was deleted the count re-derived an already-issued number
  forever. Both of `invoices`' foreign keys cascade, and `TESTING_MOCKS.md` asks
  for the `pi_mock_` payments to be purged. Replaced by a counter row claimed
  with `ON CONFLICT DO UPDATE ... RETURNING` inside the insert's transaction.
- **`invoicesDal.create` ignored the `status` its caller passed**, writing
  `"issued"` after the spread — so the PAYÉ stamp could never render.
- **`GET /api/user/invoices` never read `from`/`to`.** They were declared on
  `invoiceQuerySchema`, sent by the screen and honoured by the DAL, but the route
  hand-picked three params out of the URL. The period dropdown filtered the bulk
  download and did nothing to the list beside it.
- **`invoicesService.getById` threw a bare `Error`** for an ownership failure,
  which `handleError` cannot translate; the existing route only worked because it
  string-matched the message. Now `InvoiceError("INVOICE_NOT_YOURS", 403)`.
- **`/api/user/invoices/[id]/pdf` called the DAL directly** and inlined the
  ownership check, answering outside the standard envelope.
- **The public terms contradicted the ledger.** `marketing.terms` §Paiement still
  said funds were authorised and held at award and debited on delivery
  confirmation. Corrected in FR and EN, because a receipt cannot be honest while
  the contract behind it says the opposite.

**Verification.**

- `npx tsc --noEmit` — 0 errors in the invoicing files. Six errors remain in
  `offers.service.test.ts`, `shipment.service.ts:315` and
  `revoke-award/route.ts`, all belonging to a **concurrent session's in-flight
  cancellations refactor** (it renamed `refundForShipment` → `refundForJob` and
  removed `revokeAward` while this work was in progress).
- `pnpm lint` — 0 errors, 0 warnings across every file this session authored.
- `pnpm test` — 1247 passing. The only failures are in
  `payments.service.test.ts` and `offers.service.test.ts`, both calling the
  methods that concurrent session renamed or removed; neither is touched by this
  work. New: 64 tests across six files.
- **The migration was applied for real** against local `expeditoo_dev` — all 20
  migrations run clean — and the partial unique index verified by hand in a
  rolled-back transaction: a credit note against the same payment is accepted, a
  second invoice is refused with `invoice_payment_unique`. The counter upsert was
  exercised against real Postgres (INV 1→2, AV 1, independent series).
- **The PDF and the email render for real** (`invoice-render.test.ts`): receipt,
  facture with VAT, credit note, a document whose payment and account are both
  gone, an empty period bundle and a multi-document bundle — all producing a
  `%PDF-` buffer.

**Found by the adversarial review pass, and fixed.** Eleven findings survived
verification; nine were code, two were the spec describing something the code
does not do.

- **The avoir's footer claimed "la facture référencée ci-dessus" with no
  reference anywhere on the page.** `related_invoice_number` is now frozen onto
  the row beside the id and printed as *Avoir sur INV-…* on the PDF, in the
  email and in the list.
- **Dates were rendered in the server's zone.** `toLocaleDateString("fr-FR")`
  with no `timeZone`, on a host that runs UTC — a payment taken at 23:30 in
  Paris printed the previous day on the client's own receipt.
  `photo-stamp.service.ts` already pins `Europe/Paris`; so does this now, on the
  document and on the list screen.
- **VAT rounding was not symmetric.** `Math.round` breaks ties toward
  +infinity, so at 20% a facture and its avoir for the same amount split one
  centime differently and the pair failed to sum to zero — for every total
  congruent to 3 mod 6, a sixth of all amounts. Rounded on the magnitude and
  re-signed.
- **A swallowed credit-note write was unreachable forever.** `markRefunded`
  contains its own paperwork failure, and both refund entry points then refuse
  an already-refunded payment. `refundForJob`'s early return now retries it —
  the backstop the invoice side has in `settleDelivery`.
- **The correction had no database constraint.** `invoice_correction_unique`
  mirrors the invoice-side partial index; a losing writer would otherwise take a
  *fresh* number from the sequence rather than collide, leaving two avoirs
  against one facture.
- **The webhook wire and the PDF route's envelope had no test** — reverting
  either left the suite green. Both now have one.

**Known limits.**

- **A refund Stripe reports as `pending` mints and emails the avoir anyway.**
  `refundService.processRefund` has always treated `pending` as terminal, and
  nothing listens for `charge.refund.updated`, so a refund that later fails
  leaves the correction standing. Not fixed here: it is a gap in refund
  confirmation, not in invoicing, and the honest fix is a webhook case rather
  than a change to what a refund means.
- **No document is issued for the escalated lane at all.** If those clients ever
  need paperwork from this side it needs its own type, and it must not say
  Expeditoo took the money.
- **The client's billing address is only present if they set a default address.**
  It is a mandatory mention on a facture, which is another reason the title stays
  *reçu* until the surrounding identity exists.
- **The rate limit on the re-send is in-process**, so a multi-instance
  deployment grants it per instance. It is a brake on casual abuse, not a control.
- **Nothing backfills.** Documents issued at delivery before today keep their
  numbers, their `issued` status and their live-join billing block.

Specs: `docs/specs/invoice_at_payment_spec.md`,
plan `docs/plans/plan_invoice_at_payment.md`.
`docs/specs/billing_documents_spec.md` §2, §4.1, §6.2 and §7 amended in place
rather than left asserting the opposite of the code.

## ✅ 2026-09-05 — Session Discipline: Changelog, STATUS And The Gate That Enforces Them (2.33.0)

Operator: *"analyze epidom, and make the dicipline update rule and changelog system, just like epidom codebase, make every session is trackable to update, and recorded on the changelog, ever since the project started till forward"*

Ported the discipline system from the sibling `epidom` repo (`AGENTS.md` §6/§8,
`CHANGELOG.md`, `STATUS.md`, `TEMPLATE-checkpoint-agentic.yaml`,
`src/lib/version.ts`) and backfilled it across this repo's entire 69-commit
history. Two things were deliberately **not** ported — see below.

- [x] **`AGENTS.md`** — the agent entry point this repo did not have, adapted to its actual conventions (Drizzle not Prisma, hand-written migrations, the strict `UI → Hooks → Client API → REST → Service → DAL` layering, FR/EN parity, light+dark, `userRoleEnum` derivation, the `.prettierc` trap). §8 is the new rule: a session is done when CHANGELOG, STATUS, both version fields and the gates all agree. `CLAUDE.md` gained a pointer to it; `CLAUDE.md` stays the architecture source of truth rather than being gutted into it.
- [x] **`CHANGELOG.md`, backfilled — 69 releases, `2.0.0` → `2.32.0`.** The first commit is literally *"Baseline: expeditoo-ship at start of v2.0 pivot"*, so `2.0.0` is where the history genuinely starts, and `package.json`'s existing `"2.0.0"` — which nothing read and nothing kept true — became correct rather than decorative. Minor bump per `feat`/`ux`, patch per `fix`/`infra`. Tag spread: 27 feat, 20 fix, 15 infra, 7 ux.
- [x] **`STATUS.md`, backfilled to match**, one entry per release with the commit hash, the diff scale, the engineering detail, and a **Verification** line quoting *what the commit itself claimed*. Where a commit claimed nothing the entry says "Not recorded in the commit." — no test count anywhere here is invented. Header carries an **Operator to-do** list seeded from `CLAUDE.md`'s open items (migrate-before-deploy, `EXPEDION_APP_ORIGINS`, the commission split, `pi_mock_` purge, the photo-stamp font).
- [x] **How the backfill was produced, and its one honest weakness.** A 23-agent workflow read every commit body and diff through `rtk proxy` (the shell hook truncates bare `git` output), drafted both entries per commit, then re-read the commit adversarially to refute fabrications, jargon leaks and misclassification. **5 of the 10 verification agents died on a session limit**, so 34 of 69 entries carry the drafted-but-unverified text and are marked in place with a `>` note. The drafts were recovered from the workflow journal rather than re-run.
- [x] **`src/lib/changelog.ts`** — the one parser, so the page, the gate and the test cannot drift. `lintChangelog` reports *every* problem rather than the first, and specifically catches a `## [` line the header pattern rejects: an unparsed header does not degrade the page, it removes the release from it entirely. `RELEASE_TAGS` is the canonical tag list; nothing restates it.
- [x] **`/changelog`** (`src/app/(marketing)/changelog/`) and **`GET /api/public/changelog`**, both `force-static`, so `CHANGELOG.md` is read once during `next build` and never from a serverless function whose bundle is not guaranteed to carry the file. `ChangelogView` renders `**bold**` and `` `code` `` by building React nodes — never `dangerouslySetInnerHTML` — and colours tags from the `--lp-*` variables, which are redefined under `.dark .lp`, so both themes come for free. Dates format with `timeZone: "UTC"` because a date-only header would otherwise print the previous day west of Greenwich.
- [x] **The gate, in two places.** `pnpm changelog:check` (`scripts/check-changelog.ts`) and the "repo's own release records" block in `src/lib/__tests__/changelog.test.ts` both assert CHANGELOG ↔ STATUS ↔ `package.json` ↔ `APP_VERSION`, in both directions — a STATUS entry with no release is as much a mistake as a release with no STATUS entry. New `.github/workflows/gates.yml` runs `changelog:check`, `typecheck`, `lint` and `test` on push and PR; **this repo had no CI gate at all**, and `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so a type error and a passing build were previously indistinguishable. Added `pnpm typecheck`, which also did not exist.
- [x] **Deliberately not ported: the `releases` table and its build-time sync.** Epidom syncs `CHANGELOG.md` into Postgres on every build because it feeds an in-app "what's new" bell with per-user read state. This product has no such surface, this repo's build does not migrate (`.github/workflows/migrate.yml` is a separate `workflow_dispatch`), so a build-time write would fail against a database without the table — and it would have been dead weight of exactly the kind that already bit here, where `invoicesService.createFromPayment` shipped called from nowhere. The schema, migration and journal entry were written and then backed out; `changelog.service.ts` records the reasoning and is the single function a future bell would read through. Backing it out also avoided a `0019_` filename collision with a concurrent session's `0019_invoice_documents.sql`.
- [x] **`TEMPLATE-checkpoint-agentic.yaml`** — the closeout record, extended past epidom's with `records` (was the changelog/STATUS/version/spec/migration actually written?) and `operator_todo`, because those are the two things that go missing.
- [x] FR/EN keys added to both `messages/*.json` under `marketing.changelog` plus a footer entry; `locale-parity.test.ts` green.

**Verification:** `npx tsc --noEmit` **0 errors**. `npx eslint` clean on every file touched here. `npx vitest run` — **1169 passed, 2 failed**, both failures in `invoices.service.test.ts` and `refund.service.test.ts`, which belong to a **concurrent session's in-flight invoice work** in this same tree and were not touched here (`git status` confirms the split). 17 new tests in `changelog.test.ts`. `pnpm changelog:check` reports all 70 releases agreeing.

**Known limits:**

- 34 of the 69 backfilled entries did not get the adversarial verification pass (session limit). Each is marked in place. Re-running that pass is a contained job: the workflow resumes from its run id with the verified batches served from cache.
- `pnpm changelog:check` reads `APP_VERSION` with a regex rather than importing `src/lib/version.ts`, so a computed or re-exported constant would defeat it. It is a literal today and the test asserts the same thing a second way.
- `GEMINI.md` is stale — it predates the transport pivot and claims there are no test commands. Flagged in `AGENTS.md` §10 rather than rewritten, which is its own session.

---

## ✅ 2026-08-30 — Two-Endpoint Corridor Search And A Map On The Board (2.32.0)

`de2ab04` · feat · 22 files changed · *Put the board on a map, and let a driver name the trajet they actually drive*

- [x] `src/lib/route-corridor.ts` (+175/−) implements the real two-endpoint filter that `carrier_trips_spec.md` §10.1 recorded as missing: a job is on the way only when both its ends sit inside the corridor *and* it travels the driver's direction. A trajet is a path with up to three étapes, and progress is measured along the whole path, so a load may not double back through an étape.
- [x] Corridor query 500'd whenever both ends named the same place: a zero-length leg contributes a literal `0`, which was enough for Postgres to infer *integer* for the whole expression, so a projected coordinate arrived as "invalid input syntax for type integer". Every projected constant in `src/server/dal/listings.dal.ts` (+166/−) now states its own type.
- [x] `src/components/ui/city-field.tsx`: `CityField` reports `null` when an edit invalidates the coordinates, and the waypoint list read `null` as "remove me" — the first keystroke unmounted the field being typed in, so an étape could never be filled. `null` now means "no longer resolved"; removing is the ✕ button's job. Covered by the new `city-field.test.tsx` (149 lines).
- [x] `Number("")` is 0, so a half-written waypoint `via=45.7,` passed as a real point in the Atlantic rather than being rejected; `src/server/dto/listings.dto.ts` now rejects it.
- [x] `src/features/app/home/ui/BoardMap.tsx` (new, 267 lines): one price pin per job on the pickup, trajet drawn under it; desktop renders both halves, mobile gets a switch above them rather than inside the half it hides.
- [x] `JobCard.tsx` (+173) with new `src/lib/french-cities.ts` and `src/lib/card-annotations.ts`: commune, postcode, nearest known city, and the full pickup window instead of the first day alone.
- [x] `useJobBoard.ts` now reads its own URL, which it never did — so `routeMatchHref` (the "voir les courses correspondantes" link on a declared trip) stops producing a query the board ignores, and a search became shareable. `jobBoardUrl.test.ts` covers the round-trip.
- [x] Fixed by review before shipping: the trajet line sat under the contrast floor on the dark basemap, every étape field shared one accessible name, and the map claimed "no jobs in this area" while the list beside it was still loading.
- [x] `docs/specs/board_route_search_spec.md` (+124) carries the reasoning.

**Verification:** 1154 tests.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-30 — Audit Fixes: Incident Photos, KYC Bucket Fallback, Mirror Scrub (2.31.1)

`30ca398` · fix · 9 files changed · *Stop the weekly sweep eating the evidence, and the docs from lying*

- [x] `uploadIncidentPhoto` posts to `/api/upload`, which writes `R2_BUCKET_NAME` (public), and `getValidImageKeys` in `image-cleanup.service.ts` never learned about `shipment_incidents.photo_urls` — so every incident photo was an orphan by construction and `0 3 * * 0 ... dryRun=false` would have deleted it the next Sunday. Now scanned.
- [x] `R2_KYC_BUCKET_NAME` is unset in Vercel Production and `kyc-storage.service.ts` fell back to `R2_BUCKET_NAME`, putting identity documents in the public bucket behind guessable URLs on that same weekly timer. The fallback is now the private expedion bucket, which production already has, and the error message says why. `expedion-storage.service.ts` has refused that same fallback since it was written; this only matched it.
- [x] Blast radius verified before shipping: production holds 0 `carrier_documents`, 0 incidents and 0 shipment photos today. Both bugs would have bitten on the first real upload.
- [x] `scripts/sql/anonymize.sql` scrubbed 18 tables and none of the three new ones holding free text (incident descriptions and resolution notes, confirmation notes, chat-offer notes), while `verify-anonymized.sql` — the gate whose whole job is making a half-scrubbed mirror impossible — did not check them and therefore passed. Both extended. `db-mirror-daily.sh` runs unattended from launchd, so this ran nightly.
- [x] Docs that would have cost someone a day: `TESTING_MOCKS.md` §2 called the escalation bridge dead code and listed two "deliberately not fixed" risks that are both fixed — re-"fixing" the claim-release branch would reintroduce duplicate listings; `ROADMAP.md` §1, the named product source of truth, still said Expedion is the only inlet and that Stripe holds and releases, when four features in the previous commit are built on the direct inlet and the money is taken; `transporter_api_spec.md` still documented the deleted `POST /api/shipments/:id/proof-of-delivery` as the contract handed to the Flutter side; `environments_spec.md` promised every free-text field is destroyed, which is only true as of this commit.
- [x] Removed `driverShipmentsApi.submitProofOfDelivery` and `uploadPodPhoto` from `src/features/app/driver/api/shipments.api.ts` — no callers, and the route they posted to was deleted in `c8babca`.
- [x] Provenance: a 30-agent audit of `c8babca` finished after that commit had already been pushed. Most of what it raised was refuted; only these survived verification.

**Verification:** tsc 0 errors, eslint 0 errors, 1115 tests.

**Known limits, recorded by the commit itself:**

- `R2_KYC_BUCKET_NAME` remains unset in Vercel Production — the fix changes the fallback to the private expedion bucket rather than provisioning the intended bucket.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-30 — Eleven Features In One Commit, Migrations 0013-0018 And migrate.yml (2.31.0)

`c8babca` · feat · 239 files changed · *Land eleven features, and the way to migrate what they need*

- [x] Deliberately one commit: the working tree held two sessions' work interleaved through `messages/*.json`, `CLAUDE.md` and the migration journal, so any split would have invented intermediate states no gate ever saw. 239 files, +24,326 / −1,284.
- [x] Migrations `0013_offer_slots`, `0014_payment_source`, `0015_shipment_photos`, `0016_shipment_confirmations`, `0017_shipment_incidents`, `0018_thread_offers`, all registered in `meta/_journal.json`. Schema grows `src/db/schema/thread-offers.ts` (new) and reworks `shipments.ts` (+352), `offers.ts`, `payments.ts`, `messages.ts`.
- [x] `.github/workflows/migrate.yml` (new, 91 lines, manual and confirmed) is now the sanctioned way to migrate: every production variable in Vercel is Sensitive, so a laptop cannot reach that database at all. Nothing in CI applied migrations before — that is how `withdrawals` once reached production as a 500.
- [x] New services: `photo-stamp.service.ts` (GPS burned into the pixels before storage), `shipment-photos.service.ts` / `shipment-photo-storage.service.ts`, `storage/private-r2.ts`, `shipment-confirmations.service.ts`, `shipment-incidents.service.ts`, `thread-offers.service.ts`, `shipment-access.ts`, `message-publish.ts`. `payments.service.ts` reworked (+296) for charge-at-booking with a `payments.source` column.
- [x] `POST /api/shipments/:id/proof-of-delivery` deleted. Replacing it: `/api/shipments/:id/photos` and `.../photos/[photoId]`, `/api/shipments/confirm` (the app's only unauthenticated write, a signed stateless link), `/api/expedion/quotes/:id/confirm` and `.../photos`, `/api/shipments/:id/incidents`, `/api/admin/incidents`, `/api/messages/conversations/:id/offer` and `/api/messages/offers/:id/{accept,decline,withdraw}`.
- [x] Thread offers are one `thread_offers` row plus a `messages` row pointing at it, so price/date/status are read from the join and an operator's award rewrites no message. On a thread about an open job it mints a real bid through `offersService.submitOffer` and accepting is `acceptOffer` — the one money path; elsewhere it is a standalone quote that moves no money and says so. It proposes exactly one slot, never twelve, which is what makes accept-in-bubble safe without a `slotId`.
- [x] `/create` gains `PaymentStep.tsx`, `WeightBracketField.tsx`, `SizeField.tsx`, `FieldError.tsx` and `cargo.ts`; the board gains `RouteSearchBar.tsx` and `AvailabilityField.tsx`; shared `city-field.tsx`, `useGeolocation.ts`, `ShipmentPhotoCapture.tsx`, `ShipmentPhotoGallery.tsx`.
- [x] Two bugs found on the way past: the job's owner — who is exactly who accepts — was computed as unable to award; and `useMessageDetail` read `listing.images` where the DAL returns `photos`, so the thread header had always shown the placeholder.
- [x] Ten new plans under `docs/plans/` and eleven new or revised specs under `docs/specs/`; `messages/{en,fr}.json` +457 lines each.

**Verification:** tsc 0 errors, eslint 0 errors, 1115 tests, build succeeds, and all 18 migrations apply cleanly to an empty database.

**Known limits, recorded by the commit itself:**

- Shipped as a single unsplittable commit — no intermediate state between the eleven features was ever verified, so bisecting inside it is not possible.
- Migrations are still not applied by CI or by the Vercel build; `.github/workflows/migrate.yml` is manual and must be run before a deploy goes out.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — Journal Test Fails The Build On An Unregistered Migration (2.30.2)

`ef0255d` · infra · 1 file changed · *Fail the build when a migration is written but never registered*

- [x] `src/db/__tests__/migrations-journal.test.ts` (new, 77 lines) asserts four invariants: every `.sql` in the migrations folder has a journal entry; every journal entry names a file that exists; `when` timestamps strictly increase; numeric prefixes are unique.
- [x] Those are the four ways a migration can sit in the repo looking applied while never running — the migrator reads `meta/_journal.json`, not the directory listing.
- [x] Belongs with `221c135` and missed the stage there, so it lands on its own; it is the guard for the unregistered-migration class of bug recorded in the previous commit's `CLAUDE.md` entry.

**Verification:** Not recorded in the commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — CLAUDE.md Record Plus FR/EN Keys For Three Surfaces (2.30.1)

`3379571` · ux · 3 files changed · *Record what changed, and the two things still owed*

- [x] `CLAUDE.md` "Done" gains three entries: the two migrations that had never run anywhere (`0009_offer_self_accepted` and a second `0010_withdrawals`, absent from `meta/_journal.json`, renumbered to `0011`/`0012` **above** `0010_carrier_routes` because drizzle skips a backdated `when` in silence); `/admin/expedion-clients`; and the sidebar role badge whose precedence now lives once in `src/lib/primary-role.ts`.
- [x] New gotcha #9: a query hook that returns `null` on failure renders a blank page — no heading, no error, nothing to retry, evidence only in the browser console. That is what hid the withdrawals 500. Every `useQuery` surface needs an `isError` branch. The `.prettierc` gotcha renumbers to 10.
- [x] "Not done" records `EXPEDION_APP_ORIGINS` unset in both `.env.local` and the deployment, so `user.origin` never reads `expedion` and every account wears the Expeditoo badge in `/admin/users`. Setting it fixes the label from that moment only — it back-fills nothing, deliberately (`admin_user_management_spec.md` §1.2). `/admin/expedion-clients` does not depend on it.
- [x] Also recorded as owed: nothing in CI runs migrations and the Vercel build is a plain `next build`, so production still needs `MIGRATE_TARGET=production pnpm db:migrate` by hand. (Superseded three commits later by `.github/workflows/migrate.yml`.)
- [x] `messages/{en,fr}.json` +94 lines each: the whole `admin.expedionClients.*` tree (filter, sort, table, pagination, `empty`/`emptySearch`/`loadFailed` states, `detail`), `roles.*` with a "Your access level" hint, plus `withdrawals`, `myEarnings` and `language` nav keys.
- [x] FR/EN parity checked by key diff rather than by eye: 1,983 keys each, zero difference.

**Verification:** FR and EN message catalogues verified equal by key diff — 1,983 keys each, zero difference. No typecheck, lint, test or build gate is claimed.

**Known limits, recorded by the commit itself:**

- `EXPEDION_APP_ORIGINS` is unset in `.env.local` and in the deployment, so `user.origin` never reads `expedion` anywhere; setting it labels only accounts created afterwards and back-fills nothing by design.
- Nothing in CI applies migrations — production must be migrated by hand with `MIGRATE_TARGET=production pnpm db:migrate`.
- Real Stripe hold/capture still runs under `MOCK_PAYMENTS`; it needs SetupIntent confirmation and `amount_capturable_updated` webhook handling.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — Ably Env Substitution Fix, FR/EN Toggle, Expedion Marks (2.30.0)

`638e486` · feat · 8 files changed · *Land the language toggle, the Expedion signposts and the Ably env fix*

- [x] `src/lib/env.ts`: `resolveAppEnv` took `process.env` as a defaulted parameter. A bundler substitutes the literal token `process.env.NEXT_PUBLIC_APP_ENV`, not `env.NEXT_PUBLIC_APP_ENV` on a parameter that merely defaults to it — so every client bundle fell through to `local`. A production page subscribed to `local:user:<id>:stream` while its Ably token granted `user:<id>:*`, and Ably refused the channel with 40160. Each variable is now spelled out at the read site.
- [x] `src/components/ui/lang-toggle.tsx` (new, 55 lines) mounted from `src/components/layouts/MainLayout.tsx`; position and order deliberately match the landing header and the Expedion app.
- [x] `src/components/ui/brand-mark.tsx` (new, 117 lines) adds `ExpedionMark` / `ExpedionWordmark`, ported ratio-for-ratio from `ds_logo.dart` on the Flutter side.
- [x] `src/features/app/home/ui/ExpedionSourceBanner.tsx` (new) renders inside `JobBoard.tsx` as the source signpost on the board.
- [x] `EXPEDION_URL` moved into `src/lib/constants/expedion.ts` now that both the app and `src/features/marketing/ui/styles.ts` link out to it.
- [x] Provenance matters here: the diff was authored outside the session, sat untouched in the working tree for over an hour, and was committed as found rather than rewritten — so nothing in it was shaped by review.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- Committed as found, not rewritten — the work was authored outside the session and recorded so it would not be lost; the commit attaches no typecheck, lint, test or build result.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — SidebarRoleBadge, And primary-role Precedence Shared With map-api-user (2.29.0)

`142c740` · ux · 6 files changed · *Say which access the session is carrying, in one place*

- [x] New `SidebarRoleBadge.tsx`, rendered from `AppSidebarHeader` so all three shells get it from one component rather than three copies. Loud variant for staff access, quiet for ordinary access.
- [x] Real bug behind it: `map-api-user.ts` ranked roles itself and fell through to `roles[0]` for anything it did not name — and that array's order is whatever the join returned, so a support or finance account could display as "Shipper" in the admin table.
- [x] Precedence now lives once in `src/lib/primary-role.ts`, shared by the sidebar badge and the admin table.
- [x] `primary-role.test.ts` asserts the precedence list covers `userRoleEnum` exactly, so an eighth role cannot quietly fall through to "user".
- [x] The badge renders nothing while the session loads rather than flashing a placeholder, and its row keeps its height either way so the nav below does not jump. `SidebarRoleBadge.test.tsx` covers it (+100 lines).

**Verification:** Not recorded in the commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — /admin/expedion-clients: Quote Owners Grouped By firebase_uid (2.28.0)

`3e599c8` · feat · 20 files changed · *Show Expedion's clients to the admin who cannot find them under Users*

- [x] Two independent reasons nobody appeared, and fixing either alone leaves the screen empty. (1) `user.origin` is written at signup from the request's Origin matched against `EXPEDION_APP_ORIGINS`, which is unset — all 28 accounts read `expeditoo`. That is configuration and back-fills nothing by design. (2) Expedion clients are `expedion_quotes` rows keyed by `firebase_uid`: 4,592 distinct owners, **not one** with a `user` row, and `/admin/users` reads the `user` table, so it structurally cannot show them.
- [x] New surface: `/admin/expedion-clients` over `expedion-clients.dal.ts` + `expedion-clients.service.ts` and `GET /api/admin/expedion/clients` / `[ownerId]`. Grouped by `firebase_uid` — the key `expedionDal.list` already scopes a client's own quotes by, so "this client" means one thing everywhere.
- [x] Server-paginated because the shared `DataTable` pages in the browser and 4,592 owners is a download, not a table. Search runs *before* aggregation, so a bordereau number finds the client who filed it.
- [x] The account column joins `user.id = firebase_uid`, which is proof the client authenticated here — the Better Auth path in `expedion-auth.ts` writes the Better Auth user id into that column. It never joins `user_id`, which `claimImportedExpedionQuotes` writes on every signup from either product by email match: that says something about an address, not about who owns an account.
- [x] Read-only by design; edits stay at `/admin/expedion`.
- [x] Found on the way: `/admin/users` ignored `?search=` — `DataTable` already forwarded an `initialValue` to its toolbar and just needed a caller. And `AdminBottomNav` matched with a bare `startsWith`, so `/admin/expedion` claimed `/admin/expedion-clients` and lit two tabs at once (`AdminBottomNav.test.tsx` added).
- [x] Specs: `docs/plans/plan_admin_expedion_clients.md`, `docs/specs/admin_expedion_clients_spec.md`.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- `EXPEDION_APP_ORIGINS` is unset, so every existing account reads `origin = expeditoo`; the value is stamped at signup only and is never back-filled.
- The new screen cannot edit a quote — that stays at `/admin/expedion`, deliberately.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — Unregistered Migrations Renumbered Above 0010, Blank-Page Guard Removed (2.27.1)

`221c135` · fix · 5 files changed · *Run the two migrations that never ran, and stop the blank page hiding it*

- [x] `0009_offer_self_accepted` and the second `0010_withdrawals` were both absent from `meta/_journal.json` — twelve files, ten recorded rows — and the migrator walks the journal, not the directory. Neither had ever run anywhere: production has no `withdrawals` table, no `payouts.withdrawal_id`, no `offers.self_accepted`, and `GET /api/carrier/withdrawals` answers 500.
- [x] Renumbered to `0011_offer_self_accepted.sql` / `0012_withdrawals.sql` *above* `0010_carrier_routes`, because drizzle applies a migration only when its journal timestamp beats the newest one the database already recorded — a backdated entry would stay skipped exactly as these were.
- [x] `CREATE TYPE` is now guarded the way `0004` guards `user_origin`: any database where these were applied by hand already has the type, and a bare `CREATE TYPE` would abort the whole migration there.
- [x] Second fault: `WithdrawalPanel` ended `if (!data) return null`, so the 500 rendered an empty document. It now states the failure and offers a retry; `WithdrawalPanel.test.tsx` added (+128 lines).
- [x] `migrations-journal.test.ts` now fails on an unregistered `.sql`, a journal entry naming a file that is gone, a non-increasing timestamp, or a duplicate numeric prefix.
- [x] Nothing in CI runs migrations — production still needs `MIGRATE_TARGET=production pnpm db:migrate` run by hand.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- No CI step applies migrations; the fix only makes the files applicable, and production must still be migrated manually with `MIGRATE_TARGET=production pnpm db:migrate`.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — Commission Back To 10%, Withdrawals Ledger, Carrier Trips And Billing (2.27.0)

`16fa2e1` · feat · 70 files changed · *Put the driver's 90% back, and give them a way to ask for it*

- [x] Two workstreams in one commit because `api-response.ts` and `db/schema/index.ts` each carry registrations from both — splitting them would produce commits that do not compile. The trips/earnings/billing half was authored in a parallel session; this is where both became green together.
- [x] `COMMISSION_RATE` 1.0 → 0.1. The rate is not the interesting part: there is no Stripe Connect transfer on the payout path and `carriers.stripe_account_id` is written by nothing, so money was never going to reach a driver by itself. Every payment captures into the platform account, the driver's share accrues there, they ask, an operator approves, a human transfers, the reference is recorded.
- [x] `payouts` is reused as the balance — it was already one row per delivered shipment at price minus commission, and already inert, which is what makes it usable. `payouts.withdrawal_id IS NULL` means earned and available; set means spoken for. New `withdrawals` schema/DAL/service, migration `0010_withdrawals.sql`.
- [x] Request amount is deliberately not a parameter; a request claims every available payout and freezes the total. One open request at a time, because two live requests against one balance is how the same money gets approved twice.
- [x] Three terminal actions, deliberately not collapsed: `approve` says yes and moves nothing (the transfer happens outside this system, and pretending otherwise would put a lie in the ledger); `mark_paid` demands a reference (a payment recorded with nothing to reconcile against is worse than one not recorded); `reject` releases the payouts back to available.
- [x] `earnings.service.test.ts` had asserted `commissionRetainsAll` was true — correct at 1.0, wrong now, and it would have had the earnings screen tell a driver they are owed nothing while a withdrawal sat waiting. It now derives from the constant instead of restating it.
- [x] Also landing: `/carrier/trips` on new `carrier_routes` / `carrier_route_dates` (`0010_carrier_routes.sql`, `carrier-route-matching.ts`, service + DAL + DTO + four UI panels), `/carrier/withdrawals` and `/admin/withdrawals`, `earnings.service.ts` / `earnings.dal.ts` with `EarningsStatementPDF.tsx`, an `InvoicePDF.tsx` rework, `statement-period.ts` and `invoice-pdf-props.ts`.
- [x] Trap for the next engineer: two migrations both numbered `0010` land here and the journal registration was wrong — `0010_withdrawals` (and `0009_offer_self_accepted`) never reached `meta/_journal.json`. Fixed in 221c135.

**Verification:** The commit claims only that the two workstreams "became green together" at this point; no test count, typecheck or lint result is recorded.

**Known limits, recorded by the commit itself:**

- No Stripe Connect transfer exists on the payout path and `carriers.stripe_account_id` is still written by nothing — the actual transfer is a human action outside the system, and `approve` moves no money by design.
- Two new migration files share the `0010` prefix and `0010_withdrawals.sql` is not registered in the journal, so it never runs; corrected in a later commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — takeJob = submitOffer + acceptOffer, Plus revokeAward (2.26.0)

`0c6f670` · feat · 14 files changed · *Let a driver take a job outright, and let an operator take it back*

- [x] `takeJob` is composed from `submitOffer` + `acceptOffer`, exactly as `expedionEscalationService.assignDirect` already composes them. That is the whole concurrency argument, not tidiness: the guarantee lives in `commitAward`'s `SELECT … FOR UPDATE` on the listing plus the re-check inside that lock, and reuse inherits it verbatim — both drivers mint an offer, both reach the award, the second blocks on the row and is refused.
- [x] Fusing insert and award into one new transaction was rejected: it would mean threading `tx` through the payments service and forking the money path — the mistake `assignDirect` records having already made and reverted.
- [x] Price is the listing's budget, read server-side; `POST /api/listings/[id]/take` has no price field for a caller to name.
- [x] Self-award is an explicit opt-in — `acceptOffer({ selfAward: true })`, and only `takeJob` passes it. That permission branch is shared with the operator award queue and `assignDirect`, so widening it in place would have let any offer holder self-award from all three surfaces.
- [x] `offers.self_accepted` (migration `0009_offer_self_accepted.sql`, `src/db/schema/offers.ts`) records which it was — without it a self-take and an operator's decision are the same row and every award-queue metric (time to award, operator intervention rate, what the auction saved) counts one as the other. Mirrors `expedion_quotes.assigned_directly` on the pool lane. The mark is best-effort: an unmarked take is recoverable, a take refused because a boolean would not write is not.
- [x] `revokeAward` (`POST /api/listings/[id]/revoke-award`) reuses the rollback shape that already existed as `compensateFailedAward`, previously private to the payment-failure path. The hold is released first and deliberately — a job back on the board with the client's funds still ring-fenced would collect a second hold on the next award. Refuses past collection.
- [x] UI: new `TakeJobPanel` in `JobBidSection`, take-it-now first, under-capacity vehicles disabled rather than hidden. `useCarrierOffers` error copy moved off its hardcoded English map onto next-intl (`messages/en.json` / `fr.json`) — `LISTING_NOT_OPEN` above all, since two drivers tapping at once is the expected case, not the edge case.

**Verification:** The commit names two tests pinning the self-award flag — a carrier accepting their own offer without the flag is refused, and the flag is refused when the offer belongs to somebody else (`offers.service.test.ts`, +129 lines). No suite count, typecheck or lint result is recorded.

**Known limits, recorded by the commit itself:**

- The `offers.self_accepted` mark is best-effort: the take succeeds even if the boolean does not write, so award analytics can under-count self-takes.
- Revoking is refused once the shipment is past collection; there is no un-award path after pickup, only cancel-with-refund.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — COMMISSION_RATE 0.1 → 1.0, And Why It Moves No Money (2.25.2)

`e1cb707` · fix · 6 files changed · *Keep 100% of the payment, and stop the ledger claiming otherwise*

- [x] `COMMISSION_RATE` 0.1 → 1.0 in `payments.service.ts`, per the client's 26 August decision: no split for now, everything to the platform's Stripe account.
- [x] This changes no money, and the commit says so explicitly: `executePayout` is the only caller of `stripe.transfers.create` and nothing calls it; `carriers.stripe_account_id` is a column no code writes (the Connect account id is written to the *users* table by a different service); the PaymentIntent carries no `application_fee_amount`, no `on_behalf_of`, no `transfer_data`. A payout today is a recorded row.
- [x] What actually changes is what the database asserts: at 0.1 the `payments` row claimed a 90% liability to a driver the business has decided not to owe, and both admin revenue queries (`SUM(commission_cents)`) reported a tenth of what arrived. Leaving 0.1 was the dishonest option, not the conservative one.
- [x] `payments.service.test.ts` no longer restates the rate. It pins the arithmetic — rate applied, rounds to whole cents, never exceeds the amount charged — plus one test that deliberately pins the testing-phase value, so reverting the constant without revisiting the file fails loudly.
- [x] Two gaps written into `ROADMAP.md` §10 rather than fixed: `payments` records no per-row rate, so an old 10% row and a new 100% row are told apart only by date; and `/terms` still promises the balance is paid to the carrier, which is now false.
- [x] Docs touched alongside: `docs/TESTING_MOCKS.md`, `docs/specs/offers_engine_spec.md`, `src/db/schema/payments.ts` comments.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- `payments` stores no commission rate per row — 10% rows and 100% rows are distinguishable only by date.
- `/terms` still states the post-commission balance is paid out to the carrier; false at rate 1.0, flagged as a legal question and left uncorrected.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — Gemini Fallback Un-Pinned, Name Backfill, Approved-Carrier Seed (2.25.1)

`ee4dc35` · fix · 6 files changed · *Close the gaps the audit left open, and un-break the AI fallback*

- [x] `expedion-extraction.service.ts`: new `GEMINI_MODEL = "gemini-pro-latest"` replaces the hardcoded `gemini-2.5-pro` in the `generativelanguage.googleapis.com/v1beta` URL. Floating alias on purpose — this path runs only when OpenAI is down, which is the worst moment to learn the pinned model was retired. The failure now logs its HTTP status: 404 (retired), 429 (no quota) and 403 (not enabled) previously all returned null, indistinguishable from "no key configured".
- [x] `src/scripts/backfill-expedion-names.ts` (dry run by default, `--execute` to write) re-splits `expedion_quotes` names that `toQuotePatch`'s old first-space split filed backwards. Only recoverable because the raw model output survives in the `extraction` jsonb, so `extraction->>'buyerName'` can be re-parsed rather than reconstructed from the halves.
- [x] The backfill skips any row whose stored name does not match what the old split would have produced — that mismatch is the signal a human corrected it, and a hand correction outranks anything the script can infer.
- [x] `src/scripts/seed-approved-carrier.ts` (+ package.json script) mints what `db:seed:dev-users` stops short of: the `carrier` role is not the gate — bidding, offers, shipments and proof of delivery all sit behind an approved `carriers` row, which nothing in the repo could create. Seeds a vehicle too, since an offer names the vehicle that will do the job.
- [x] Tests for two rules the audit specified but never wrote: `listings.service.test.ts` pins that `createListing` stamps `origin` itself whatever the caller sends, and resolves a category when none is named. New `src/features/app/create/__tests__/schemas.test.ts` covers the client-side schema mirror's France bounds, 500 m minimum and blank-means-absent coercion.
- [x] Quirk documented rather than endorsed: `createListing` gates its own PICKUP_IN_PAST check on `publish`, then calls `resolveExpiresAt` unconditionally, which rejects the same date as PICKUP_TOO_SOON — so a draft with a past pickup is refused, just not by the check written to refuse it.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- `createListing` refuses a past-pickup draft with PICKUP_TOO_SOON rather than PICKUP_IN_PAST; the test records the behaviour instead of fixing it.
- The name backfill is a manual script, dry run unless `--execute` is passed; rows a human already corrected are skipped by design and never re-derived.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — Direct Transport Request Restored, Board Unpinned (2.25.0)

`33f2a4e` · feat · 25 files changed · *Let somebody ask for a transport again, and let a driver see it*

- [x] Restored from `7a455c0`'s parent, where the code survives — but not verbatim: four things were broken and one was a hazard. The hazard was an invisible, ungated button over the photo dropzone that appended a data URI to the photo list for anyone who found it (there for E2E). Gone.
- [x] The three bugs: `z.coerce.date()` declares its own *input* as Date while `datetime-local` speaks a string, so date fields rendered blank; an emptied number field coerced to 0 and then failed a `.positive()` check with a message about zero; the photo remove button had no `type`, so it submitted the form.
- [x] The client mirror now copies the two server rules it lacked — France bounds and the 500 m minimum route — which had let the form submit work the API then rejected with a code the form had no message for.
- [x] `origin` is stamped in `toInsert` and is deliberately **not** a field on `createListingSchema`. `offersService.acceptOffer` reads it to decide whether an operator may award a job in the owner's place, so accepting it from a client would let any signed-in account post work straight into the operator award queue. Escalation stamps its own value the same way, server-side.
- [x] `categoryId` is optional now, resolved by `ensureDefaultCategory`. The column is a non-null FK, so the row is **upserted rather than looked up** — an environment whose seed predates it would otherwise fail the insert in a way that reads as "posting is broken".
- [x] `/expedion` was pinned to `origin: "expedion"` and would have hidden every one of these requests. The pin is gone — it is the board of all open jobs, which is also what the brief asks a transporter dashboard to show — and `useDriverDashboard`'s count is unpinned to match so the number agrees with the list.
- [x] The recovered form carried ~40 hardcoded English strings; 119 keys added across both catalogues.
- [x] `CLAUDE.md` corrected on two points it now contradicts: "Expedion escalation is the only inlet" is no longer true, and the `shipper` role is granted to every signup rather than held only by the system account.

**Verification:** "119 keys added across both catalogues, parity verified by key diff rather than by eye."

**Known limits, recorded by the commit itself:**

- Named in the commit as the thing gating going live: a direct request has no money behind it. An Expedion job arrives already paid for; this one does not, and accepting an offer runs the same MOCK_PAYMENTS path. Usable for testing, not for a customer.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — French Name Order Inferred From Capitalisation (2.24.4)

`42fb38c` · fix · 7 files changed · *Read a buyer's name off the slip in the order the slip wrote it*

- [x] `toQuotePatch` split `buyerName` on the first space, so the given name was whatever came first. Nothing downstream ever showed the client the two fields, so nobody could see it happen.
- [x] `parseFrenchName` (`src/lib/french-names.ts`) infers order instead of assuming it. The signal is capitalisation — the one thing these documents agree on: the longest run of caps is the surname, whichever side of the given name it sits on, extended back over particles so "DE LA TOUR" stays whole.
- [x] Honorifics are stripped first, "et" and "&" among them, so "M. et Mme DUPONT" collapses to the surname. A legal form short-circuits the whole parse so a company never gets an invented first name — and a two-letter form only counts when printed in caps the way a legal form always is, or "Sa Thi NGUYEN" loses her first name to Société Anonyme.
- [x] Anything the parser cannot justify comes back null, which is load-bearing: both callers drop nulls, so a null leaves a hand-corrected field alone where a guess would overwrite it.
- [x] That null rule needed a second one. With a parser that legitimately returns half a name, dropping only the null half would marry a client's own first name to a company's surname — "Jean" beside "SARL Brocante du Centre". `writableFields` replaces the six lines both call sites had duplicated: nulls are still dropped, but the name pair moves together, written only when the model supplied both halves or the row has neither to contradict.
- [x] Also closes `ROADMAP.md` §10.2, which still listed "who calls /paid" as an open decision — the Expedion payment server has been posting to it since `api/_payment_core.js` started verifying the Checkout session.

**Verification:** Not recorded in the commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — Bordereau Upload Moves To Private R2 (2.24.3)

`c3dd16d` · fix · 18 files changed · *Give Expedion somewhere private to put a bordereau*

- [x] Root cause: the Flutter client wrote to Firebase Storage under `allow write: if request.auth != null && request.auth.uid == userId`. `request.auth` is a Firebase session, and a Better Auth user has no Firebase identity at all — so every upload from an account created since that migration was denied, and the bordereau form hard-gates its submit on the URL the upload was supposed to return. The primary quote-creation flow had been dead for new users. No rule fixes it: there is no Firebase subject left to write a rule about.
- [x] `POST /api/expedion/upload` takes the same base64 body `/api/expedion/extract` already accepts, authenticates with `requireExpedionCaller`, enforces the client's own 3 MB cap and a PDF/JPEG/PNG/WEBP allow-list *before* anything is written, and returns a permanent `/api/expedion/files/<id>` URL. The permanent-URL shape is deliberate: `photoUrls` is `z.array(z.string().url())`, the AI readers `fetch()` what is stored, and the admin dialog previews it — an opaque key means changing all three, and a presigned URL would be persisted into Postgres and a 30-day client draft only to expire.
- [x] `GET /api/expedion/files/:id` 302s to a 300-second presign for the owner or an admin, and 404s otherwise so a probe cannot tell "not yours" from "not there".
- [x] Storage is a dedicated private R2 bucket that will **not** fall back to `R2_BUCKET_NAME`, and that refusal is load-bearing: that bucket is public (custom domain, r2.dev URL, `CORS: *`) and `imageCleanupService` deletes every object no known column references. Bordereaux are referenced by columns it has never scanned, so a single cron run would have destroyed all of them. `getValidImageKeys` now also scans `expedion_files.object_key` as a second line of defence.
- [x] Ownership is checked where the bytes are read, not only at the route. `bordereau_doc_url` is written from a request body, so a quote naming another person's file id would have had that PDF read out of R2, run through vision, and its contents — name, address, phone, declared value — written onto the caller's own quote, which they may read back. `bordereauDataUrl` therefore takes the owner and refuses a mismatch, and `attachToQuote` scopes its UPDATE by owner rather than trusting the ids it was handed.
- [x] Migration `0008` adds `expedion_files`. The message also records that `0006` and `0007` were still pending on production, and `0007` was already deployed **as code** — `expedion_quotes.assigned_directly` declared in the schema and absent from the database, so selects over that table were failing outright.
- [x] Old Firebase URLs are untouched and keep resolving: `getDownloadURL()` tokens are honoured by the Storage service itself, not by the rules.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- Explicitly not done: revoking the old Firebase download tokens, and backfilling those objects into R2 before that bucket is ever emptied.
- Migrations 0006/0007 were still pending on production at the time of this commit, with 0007 already live as code — selects over expedion_quotes failing until it lands.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-26 — Expedion Quote Claiming On Sign-In, And An Auth Origin Preflight (2.24.2)

`56ac97f` · fix · 9 files changed · *Let Expedion buyers reach their own history, and check the origins that gate auth*

- [x] Quote ownership is a string compare against a column holding three disjoint id spaces: a Better Auth id for new rows, a raw Firebase UID for legacy ones, and `airtable:<recordId>` for the ~4,450 imported rows that carried no UID. A buyer who signed in through Better Auth therefore saw an empty list and no error — the worst way for this to fail.
- [x] `claimImportedExpedionQuotes` → `claimExpedionQuotesForUser`: it was scoped to `airtable:%` and ran only from the user-create hook, so anyone who already had an account never triggered it. It now runs on session creation as well as signup, and matches legacy Firebase-UID rows too.
- [x] Two guards keep that safe: it refuses an unverified address outright (an unverified address is a claim, not proof — matching on one would let anyone reach another person's history by signing up with it), and a `NOT EXISTS` against the user table makes a row owned by a live account untouchable. That second guard is also what makes it idempotent, since the first run writes an id later runs can no longer match.
- [x] Google added as a trusted linking provider in `src/lib/auth.ts`: better-auth otherwise links a Google identity onto an existing password account only when the provider reports the address verified. Consumer accounts do; a Workspace account on an unverified domain hit "account not linked", a dead end once Expedion's Firebase fallback goes away.
- [x] `PasswordResetEmail` / `VerificationEmail` brand and route on the `origin` column the user row already carries. The reset *link* still points here deliberately — the reset form is a page on this app and Expedion's router has no route for it, so rebasing that URL would strand every Expedion user.
- [x] `requireExpedionCaller` (`src/lib/expedion-auth.ts`) now logs which credential answered — path only, no id, address or token. `via:"firebase"` reaching zero is the gate for deleting that path.
- [x] `scripts/auth-preflight.mjs` + `.github/workflows/auth-preflight.yml`: four allowlists gate these two apps, `EXPEDION_APP_ORIGINS` feeds two of them, and the other two live in the Firebase and Google Cloud consoles where no code, test or deploy can reach them. That asymmetry is exactly how Expedion's Google sign-in broke — origin present in the variable (CORS and trustedOrigins both correct), absent from Firebase's list, popup refused. The script checks the three checkable ones, asserts an untrusted origin is actually rejected so a widened allowlist cannot pass silently, and states plainly that Google's JavaScript origins are not covered. Runs on PRs, nightly (the only run that catches a hand-edited console) and on demand.
- [x] `src/scripts/backfill-expedion-owners.ts` is the census for rows no sign-in will ever reach; dry run unless given `--execute`.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- Google Cloud's JavaScript origins are outside what the preflight can check, and the script says so rather than implying coverage.
- The `via:"firebase"` counter measures only half the legacy population: a legacy user who signs in but never opens a quote passes through no route that reaches it.
- `backfill-expedion-owners.ts` is a dry run unless `--execute` is passed.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-23 — Three Post-Fork Defects: Price Carve-Out, markPaid Half-Write, Overflow Regression (2.24.1)

`615e490` · fix · 8 files changed · *Close three holes the post-payment fork left, one of them self-inflicted*

- [x] Completeness pass over `c4b44c8`; one of the three defects was created by that commit's own fixes.
- [x] `isSupplyingMissingPrice` had no caller: `QuoteDetailDialog` gated both the editable field and `patchToSend` on `canRepriceQuote`, which is false for every paid quote — so the carve-out and the spec section naming that dialog as the repair surface were both unreachable. Both now gate on `canSupplyMissingPrice`, the client mirror of the server predicate, so the one field the server still accepts is the one field the form still offers. 16 live quotes are settled-but-priceless.
- [x] `markPaid` kept the existing status when the move to `paid` was illegal but wrote `payment_status` anyway — a `quoted` row marked paid. Every fork capability reads that as nothing to do: not priceable (payment_status is paid), not dispatchable (status is not paid), not re-quotable, and `nextAction` renders no button. Only a direct DB edit could free it. It now refuses the transition instead of half-writing it.
- [x] That state was reachable via `cancelAndRequote`, which sets `payment_status` back to unpaid, while the Expedion success page fires confirm-payment from `initState` on every mount — so the payment server re-posts `/paid` for as long as Stripe still reports the session paid, re-settling a quote behind the operator who reopened it.
- [x] `canAssign` was derived from queue and status alone, and the overflow keeps every capability that is not already a primary button — so "Assign a driver" reappeared on exactly the rows `nextAction` had collapsed to a Fix button, in a menu whose stated purpose is that the server accepts what it shows. All 41 rows in the fork queue are escalation-blocked, so it was every one. Readiness is folded into `canAssign`; `canEscalate` is left alone because its click already routes to the fix form rather than to a publish that would fail.

**Verification:** "Verified in Chromium against a real priceless row: badge 'Escalation blocked', one Fix button, overflow offering only Storage terms and Cancel and re-quote, and the accepted-price field editable while the two published figures stay read-only. 438 unit tests, tsc and lint clean, production build succeeds."

**Known limits, recorded by the commit itself:**

- Explicitly not fixed here: nothing in the deploy pipeline runs migrations, and this code reads `assigned_directly` on every `expedion_quotes` select — `0006` and `0007` have to reach production before or with the deploy (plan §5a).

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-23 — Post-Payment Fork: Operator Chooses Pool Or Auction (2.24.0)

`c4b44c8` · feat · 28 files changed · *Make a paid Expedion quote a decision an operator takes, not a countdown*

- [x] The five deadline columns on `expedion_quotes` were naked `timestamp`. Drizzle sends a JS Date as its UTC wall-clock; SQL `now()` is evaluated in the session zone — so on a server at UTC+8 every paid quote read as escalation-due eight hours early, while `findDueForEscalation` (which compares against a JS Date, not `now()`) stayed correct. Migration `0006` makes them `timestamptz`, guarded so a replay cannot shift them again.
- [x] `adminUpdate` refuses `quoteStandardCents`, `quoteInsuredCents`, `quoteAvailable` and `acceptedPriceCents` once `paymentStatus` is `paid`; `autoPrice` declines a paid quote so re-extracting a bordereau cannot rewrite them from the background. One carve-out: a price may be **supplied** where none was recorded — 95 live quotes arrived from Airtable settled but priceless, and `escalationBlockers` will never publish them without one.
- [x] `expedionEscalationService.assignDirect` escalates the quote, submits an offer from the chosen carrier at the price the client paid, and awards it through `offersService.acceptOffer` — so the pool lane and the auction lane produce the same listing, offer, shipment and payment. Going through `submitOffer` rather than the DAL is what checks the vehicle can carry the load and keeps `offers_count` honest. The actor's authority is settled before anything is published, so a caller who cannot award no longer escalates a quote as a side effect of a 403.
- [x] Write-back FK bug, found here: `expedion_quotes.assigned_carrier_id` references `carriers.id`, but `offers.carrier_id` and `shipments.carrier_id` reference `user.id`, and `onOfferAccepted` passed the user id straight through. The FK violation fired inside the write-back, which `notifyExpedion` swallows by design — award succeeded, client never told, quote stuck at `escalated`. No row had ever been escalated *and* awarded, which is why nobody hit it. `expedion-bridge.service.ts` resolves the id now and records both on the timeline.
- [x] `QUEUE_WHERE.needsDriver` admitted 1085 imported rows at `picked_up` with a settled payment (collected outside the system) into a queue named "needs a driver". Pinning `status = 'paid'`, as `ESCALATION_DUE` already did, drops it to 42. `cancelAndRequote` carries the same guard — on those rows it would have succeeded and wiped the price the client paid.
- [x] `nextAction` collapses a blocked paid row to one Fix button, because the same ten `escalationBlockers` checks gate both lanes; offering two shut doors is worse than naming the one that is open. Both quote tables filter their overflow through `quoteCapabilities`, so a menu entry the server would refuse is never drawn.
- [x] Migration `0007` adds `expedion_quotes.assigned_directly`: direct assignment now mints a listing exactly as an auction does, so without this column the escalation-rate KPI pins at 100%.

**Verification:** "Verified end to end in Chromium: one click produces listing → offer → shipment → authorised hold, with the carrier row id on the quote and the user id on the shipment. 429 unit tests, tsc and lint clean, production build succeeds."

**Known limits, recorded by the commit itself:**

- Unwind and re-quote deliberately moves no money — EXPEDITOO never took the payment, so the refund is issued on the Expedion side.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-22 — Landing CTAs Gated Through One Flow, Plus Four Marketing Pages (2.23.0)

`21893f8` · feat · 64 files changed · *Make every landing CTA do something, and give the footer real pages*

- [x] Two features that had been sitting uncommitted, landed and verified together. Specs: `docs/specs/landing_gated_actions_spec.md`, `docs/specs/marketing_footer_pages_spec.md`.
- [x] `useGatedAction` + `LandingGatedButton` give every landing interaction one flow (interact → animated validation → animated success → redirect). Redirect reads the session: signed in → `/expedion` for bid/jobs, `/profile` for carrier; signed out returning → `/signin?intent=`; signed out first time on this device → `/signup?intent=`.
- [x] "Returning" is a localStorage flag written by `AuthProvider` (`src/lib/returning-visitor.ts`, `src/lib/auth-context.tsx`) the moment a session exists, so it outlives sign-out — that is the whole mechanism behind sending a returning driver to signin rather than signup.
- [x] `ref` coming back off the query string is untrusted and is checked against a job-reference shape (`src/lib/landing-intent.ts`) before display, so nobody can hand themselves a paragraph of text above a password field.
- [x] `LandingBidCard` validates for real — parse, 50 EUR floor, must undercut the standing best — and an accepted offer is **floored, not rounded**, so it can never land back on the price it had to beat. `LandingJobBoard` countdowns and staggered offer-walks are seeded so first paint matches the server render. Carrier CTAs change or disappear once a session exists, and are inert while one is resolving.
- [x] New public `POST /api/contact` rate-limits per address *before* it does any work (`src/lib/rate-limit.ts`), Zod-validates via `src/server/dto/contact.dto.ts`, and `contact.service.ts` drops the enquiry into the sender's own support thread when they have one.
- [x] Marketing copy corrected against product reality: the driver CTA asked for a Kbis (an auto-entrepreneur has none, and `/verification` says it is not required) → now SIRET; the board's three demo rows are labelled sample data.
- [x] `src/i18n/__tests__/locale-parity.test.ts` added alongside — FR/EN parity for the ~483 new keys per catalogue is asserted, not eyeballed.

**Verification:** "Gates: tsc 0 errors, eslint 0 errors, 375 unit tests pass, production build succeeds. Both features walked end to end in Chromium, light and dark, FR and EN. The contact route's validation and rate limiting were exercised against the built server without sending mail."

**Known limits, recorded by the commit itself:**

- `/legal-notice` ships visible "TO BE SUPPLIED" placeholders for the registered identifiers, with a notice saying the page is not finished until they are replaced.
- The contact form's inline field errors are still English-only in both locales.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-22 — Expedion Contact Form Into The Support Inbox, Plus A Support-Chat Auth Hole (2.22.0)

`aea1b36` · feat · 8 files changed · *Bridge Expedion's contact form into the shared support-chat inbox*

- [x] New GET/POST /api/expedion/support (CORS-enabled, unlike the web-only routes) authenticates the Flutter caller and delegates to messagesService, so an Expedion message lands in the same conversations/messages tables as Expeditoo's own support chat. Replaces the write-only Airtable form.
- [x] Both entry points now share `messagesService.getOrCreateSupportConversation`. The old /api/chat/support read a user's *first* participant row and only accepted it if that row happened to be a support one — so anyone who had ever messaged a carrier minted a fresh support thread every visit, and the admin inbox showed one person as several conversations.
- [x] /api/admin/support-chats was raising a bare `sql` template with a JS Date spliced in; the pg driver refuses a Date as a bind parameter, so it only 500'd once an admin had joined a thread and read it, i.e. from the second visit onward. Swapped for drizzle's `gt()`.
- [x] Security hole found pre-ship: /api/admin/support-chats verified only that the caller was signed in, never that they were staff — any authenticated user could read every support conversation, names, emails and message content included. Added the admin/support role gate.
- [x] `requireChatUser` in src/lib/expedion-auth.ts resolves caller identity for the new route: session match, Firebase-to-Better-Auth email fallback, shared-key refusal, and a 409 when no account exists. All four paths covered in src/app/api/expedion/support/__tests__/route.test.ts (287 lines).
- [x] messages.dal.ts and messages.service.ts carry the shared getOrCreateSupportConversation; its tests cover both existing-thread reuse and first-use creation.

**Verification:** "Tests: messagesService.getOrCreateSupportConversation (existing thread vs. first-use creation), and the new route's requireChatUser identity resolution — session match, Firebase-to-Better-Auth email fallback, the shared-key refusal, and the missing-account 409." No overall suite count, typecheck or lint result is recorded.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-22 — Ably Fan-Out For The Expedion Operator Report (2.21.0)

`7771cee` · feat · 5 files changed · *Push Expedion dashboard updates to admins over Ably instead of requiring a refresh*

- [x] New src/server/services/expedion-realtime.service.ts: `notifyExpedionAdmins(resourceId?)` reads `getUsersByRole("admin")` and calls `ablyServer.publishDataUpdate(admin.id, { type: "expedion", resourceId })` for each.
- [x] Fan-out per admin because there is no admin-wide channel: ably.service.ts's token capability only grants a user its own `user:{id}:stream` — the same private stream the message badge and notifications already ride.
- [x] Called after commit from expedion.service.ts (create, payment, admin edit, reextraction, autoprice), expedion-escalation.service.ts, and expedion-bridge.service.ts (shipment write-back).
- [x] AblySubscriptions.tsx gained an `"expedion"` case invalidating `["admin", "expedion"]` — broad on purpose, matching what the page's own mutations already invalidate; its whole job is reaching the admins who did not fire the mutation.
- [x] No polling by design: the operator report is a handful of full-table aggregates, already cut from 18 queries to 3 batches after a connection-pool incident, so a timer refetch was never an option.
- [x] Every publish is wrapped in try/catch and fire-and-forget, matching every other Ably publish here — a failed realtime signal must never fail the write that triggered it.

**Verification:** "Verified end-to-end with two live sessions: a quote created in one tab appeared in the other's already-open dashboard with no reload." No test count, typecheck or lint result is recorded.

**Known limits, recorded by the commit itself:**

- Fan-out is a per-admin loop over `getUsersByRole("admin")` rather than one shared channel, because the Ably token capability grants no admin-wide channel — cost grows with the number of admins.
- Failures are swallowed to `console.error` by design, so a silently broken fan-out looks exactly like a quiet dashboard.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-21 — Newest-First Ordering In The Recent Quotes Panel (2.20.0)

`30f4ec3` · ux · 3 files changed · *Sort the recent quotes panel newest-first everywhere, including To handle*

- [x] RecentQuotesPanel.tsx: the "To handle" tab now filters the report query's already newest-first rows to the actionable subset and preserves that order, instead of re-sorting it by urgency kind with an oldest-first tiebreaker.
- [x] Deleted `byUrgency` / `RANK` from quote-action.ts (30 lines) and their tests — the ranking is gone, not merely bypassed, so there is no dead second ordering to drift.
- [x] Ordering authority now lives in one place, the report query, rather than being restated client-side.

**Verification:** Not recorded in the commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-21 — Contain The photoUrls Crash And Add Error Boundaries (2.19.3)

`083e975` · fix · 3 files changed · *Stop the quote detail dialog crashing on a malformed photoUrls entry, and add error boundaries*

- [x] `photoUrls` is jsonb, typed `string[]` only at compile time — a non-string entry (legacy data, a hand edit) rendered straight into JSX and threw "Objects are not valid as a React child" the instant QuoteDetailDialog opened. Now filtered to actual strings before render.
- [x] There was no error.tsx anywhere in the app, so that throw escaped to the root and blanked the whole page rather than staying contained.
- [x] Added src/app/error.tsx (segment-level boundary, retry through the existing CenteredEmptyState) and src/app/global-error.tsx (dependency-free, for a crash in the root layout itself).
- [x] Repro and fix were both confirmed in a real browser against a production build — not jsdom, which would not have shown the blanking.

**Verification:** "confirmed with a real browser repro against a production build, and confirmed fixed the same way." No test count, typecheck or lint result is recorded.

**Known limits, recorded by the commit itself:**

- The fix is at the render site, not at the type: `photoUrls` is still declared `string[]` while the jsonb column can hold anything, so any other reader is still trusting a compile-time-only guarantee.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-20 — Tests For geocodeMissingCoordinates (2.19.2)

`417eedc` · infra · 1 file changed · *Add test coverage for the address-only coordinate geocode*

- [x] Pure test back-fill for c4b9d83, which shipped `geocodeMissingCoordinates` with no coverage; 124 lines added to src/server/services/__tests__/expedion.service.test.ts and no source change.
- [x] Pins three behaviours: a full pickup/delivery address geocodes on create with no dimensions required; a side that already has coordinates is left alone; editing an address clears that side's stale pin immediately rather than leaving it pointing at the old location until the background re-geocode lands.
- [x] The third case is the one worth keeping — it is the invariant that makes the fill-only-nulls design safe.

**Verification:** The commit records only which behaviours are pinned (address-only geocode on create, existing coordinates untouched, stale pin cleared on address edit). No test count, typecheck or lint result is claimed.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-20 — Geocode On Address, Independent Of Pricing (2.19.1)

`c4b9d83` · fix · 1 file changed · *Geocode a quote's address as soon as it has one, independent of pricing*

- [x] New `geocodeMissingCoordinates(id)` in expedion.service.ts: re-reads the row, calls `geocodeFr` for each side that has address + postalCode + city but null lat/lng, and persists the result in a single `expedionDal.update`; no-op when the patch is empty.
- [x] Deliberately independent of `hasDimensions`, unlike `autoPrice` — coordinates there are a means to a price, but `escalationBlockers` (expedion-escalation.service.ts) reads those same coordinates to decide publish-readiness, and the bordereau flow collects dimensions after the address.
- [x] Called fire-and-forget from `createQuote` and from `adminUpdate` when dimensions or address changed.
- [x] `dimensionsOrAddressChanged` widened from postal code alone to the full pickup/delivery triples (address, city, postalCode).
- [x] `adminUpdate` now nulls `pickupLat`/`pickupLng` and `deliveryLat`/`deliveryLng` when that side's address changed, because `geocodeMissingCoordinates` only fills a lat/lng that is *null* — otherwise an edited address keeps its old pin forever. Safe because `adminUpdateExpedionQuoteSchema` never carries coordinates from the client, so the clear cannot clobber a value the same request just set.
- [x] Coordinates stay server-resolved only; nothing here accepts client-supplied lat/lng.

**Verification:** Not recorded in the commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-20 — Expedion Quote Dialog: Translations, Close-Button Overlap, Maximize, Auto-Extraction (2.19.0)

`d715ce1` · feat · 24 files changed · *Fix the fix-and-publish dialog's missing translations, close a real overlap, add a maximize view, and auto-refill quotes from AI extraction*

- [x] messages/{en,fr}.json: backfilled `common.locationPicker.*` — LocationPickerField shipped a `useTranslations` namespace nobody added, so keys rendered raw, including inside the postal-code/city grid, which is what read as an overlap. Also backfilled `admin.expedion.detail.valueBracket`, a pre-existing gap from the concurrent edit-mode work. Every `t()` across all nine admin/expedion files was audited against both locale files; these were the only two gaps.
- [x] QuoteDetailDialog.tsx: the Dialog default close button sits at a fixed corner offset and collided with the custom header's button row once `p-0` moved the edge in — replaced with an explicit close button inside the same flex row, which cannot overlap itself. Same file gained the maximize/restore toggle (desktop and mobile).
- [x] location-picker-field.tsx: hardened the "outside France" error path, which could leave the "click to pin" hint and the error pill stacked on the same spot.
- [x] expedion.service.ts `createQuote` now fires `this.reextractDocument(quote.id, { actor: "system" })` fire-and-forget when `input.bordereauDocUrl` is present, mirroring the existing `autoPrice` trigger. Extraction only fills fields still null, so it cannot clobber client input, and it is what records `extractionConfidence`.
- [x] `reextractDocument(id, opts: { actor?: "admin" | "system"; message?: string })` — the admin route stays role-gated as a supervision tool, but the merge-and-record logic is one function rather than two copies drifting apart; the system path writes a distinct FR event message ("Champs pré-remplis automatiquement par l'IA à la réception").
- [x] Bundled from the working tree: the admin data-table date-range refactor — `useAdminDateRange.tsx` / AdminDateRangeProvider deleted in favour of a per-table `data-table-sort-field.tsx`, threaded through AdminLayout and the five tables (Users, Listings, Payments, Deliveries, CarrierApplications).
- [x] Bundled: graphify knowledge-graph setup — tracked `graphify-out/graph.json` (227k lines) and GRAPH_REPORT.md, plus .gitignore, CLAUDE.md and scripts/clean-dev-caches.sh.

**Verification:** The commit claims a full audit: "Audited every t() call across all nine admin/expedion files against both locale files; these were the only two gaps." No test count, typecheck or lint result is recorded.

**Known limits, recorded by the commit itself:**

- The commit flags its own scope creep: the admin data-table date-range refactor and the graphify setup were "bundled alongside" from the working tree, so this is not a single reviewable change.
- Auto-extraction is fire-and-forget with a `console.error` catch — a failed extraction on submission surfaces nowhere in the UI.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-20 — Clear Two Exhaustive-Deps Warnings In QuoteDetailDialog (2.18.1)

`69fb63c` · infra · 1 file changed · *Clear the two exhaustive-deps warnings QuoteDetailDialog picked up*

- [x] `src/features/app/admin/expedion/ui/QuoteDetailDialog.tsx`, +1/-5: two `react-hooks/exhaustive-deps` warnings cleared, no behaviour change.
- [x] The `now` memo keeps its quote-id dependency on purpose — it exists to reset on a new quote id, not because the callback reads it. Same suppression pattern already used by neighbouring memos in this file.
- [x] The auto-edit effect's disable comment was pre-emptive and wrong: nothing there actually violates the rule, so ESLint was flagging the directive itself as dead. Removed.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-20 — Escalation-Blocked Rows Become Fixable, And A Patch-Schema Null Bug (2.18.0)

`571ae5d` · feat · 12 files changed · *Close the escalation-blocked self-service loop, and fix a patch-schema footgun it surfaced*

- [x] The bug: `adminUpdateExpedionQuoteSchema` had been extended with `weightKg`/`lengthCm`/`widthCm`/`heightCm` using the file's own `looseNumber`, which is only safe inside a `.partial()` schema — used outside one, an untouched field patches in as an explicit `null`, so every admin edit silently wiped those four columns. Fixed with `looseNumberPatch` in `expedion.dto.ts`, mirroring `looseDate`'s existing ".optional() after the transform" shape.
- [x] Scope of that bug: the four fields were added one commit earlier (bd49c34, the admin write path), alongside the edit form that triggers it — so it was introduced and fixed inside the same day's work rather than being long-standing.
- [x] `QuoteDetailDialog.tsx` largely rewritten (1300 lines touched): edit mode now mounts `LocationPickerField` for both pickup and delivery coordinates and an editable `acceptedPriceCents`, routed through the audited admin route rather than the client's own confirm-details one (an Airtable-imported row has no client account to reach that).
- [x] `quote-action.ts` gains `draftEscalationBlockers`, read live off the in-progress form: the dialog banner lists the outstanding blocker codes and `readyToPublish` is only true when the list is empty. A blocked row's Publish button and dropdown item now open the dialog straight into edit mode, replacing a disabled button that could not even surface the server's own `ESCALATION_INCOMPLETE` message.
- [x] `ExpedionDashboard.tsx`: the data-quality tiles become clickable, with the queue tab now controlled so a tile can jump straight to the queue it counts.
- [x] New `StorageDialog.tsx` (124 lines) patching `storageFreeUntil` / `storageDailyFeeCents` — fields `adminUpdateExpedionQuoteSchema` already accepted, with no UI behind them until now.
- [x] Two pre-existing, unrelated test breaks fixed en route: `ExpedionDashboard.test.tsx` was missing the new `AdminDateRangeProvider`, and `src/lib/ai/openai.ts` now passes `dangerouslyAllowBrowser: true` — the flag is misleading here, the module is server-only (it reads a non-`NEXT_PUBLIC_` env var), but without it the SDK refuses to construct under Vitest's jsdom environment, which fakes `window`.

**Verification:** The commit claims the schema regression was "caught by expedion.service.test.ts", and that two pre-existing unrelated test breaks were fixed "while getting the suite green". Treat the first claim cautiously: this commit changes no service test — `expedion.service.test.ts` is not among its 12 files, and the cases added to it one commit earlier cover the AI-suggestion cache, not the admin patch path. No test count, typecheck or build result is recorded.

**Known limits, recorded by the commit itself:**

- The original `looseNumber` is still in `expedion.dto.ts` and still unsafe outside a `.partial()` schema — only the four dimension fields were moved to `looseNumberPatch`, so the same trap is available to the next person who reuses it in a patch schema.
- No regression test for the null-wipe is added in this commit.

---

## ✅ 2026-08-20 — Client-Visible AI Price Estimate, Admin Write Path, And Date-Range Plumbing (2.17.0)

`bd49c34` · feat · 34 files changed · *Let clients see the AI price suggestion while a devis is pending, and give operators self-service date-range and location tools*

- [x] New `expedion-price-suggestion.service.ts` (318 lines) behind two routes: `POST /api/expedion/quotes/:id/suggest-price` (`requireExpedionAdmin`, writes nothing) and `POST .../estimate` (`requireExpedionCaller`, the client counterpart). Both `maxDuration = 60` — GPT-4.1 vision over a bordereau plus lot photos is not fast.
- [x] Hand-written migration `0005_expedion_ai_price_suggestion.sql` (+ journal entry) adds seven `ai_suggested_*` / `ai_suggestion_*` columns to `expedion_quotes` as the cache, all `ADD COLUMN IF NOT EXISTS`. `expedionService.getPriceSuggestion` writes them and a `actor: "system"` quote event in one transaction, `.catch`-logged rather than awaited-fatal — losing the cache write only costs a recompute on the next open.
- [x] `getPriceSuggestion` throws `QUOTE_ALREADY_PRICED` (409) once `quote.quoteAvailable`: a priced quote makes the estimate moot and letting a client keep triggering it is pure model cost.
- [x] `expedionService.updateQuote` now nulls the whole AI suggestion block whenever length/width/height/weight or either postal code changes, sharing one `dimensionsOrAddressChanged` flag with the existing `autoPrice` re-run — a stale estimate is worse than none because it was grounded in exactly those values.
- [x] **WP2 of the plan lands here**: `adminUpdateExpedionQuoteSchema` gains the ten `escalationBlockers` fields plus the rest of the edit form (+45 lines), and `QuoteDetailDialog.tsx` (+639) gains edit mode over client / pickup / delivery / cargo. The four dimension fields are added using the file's own `looseNumber` — the null-wipe bug 571ae5d fixes is introduced right here.
- [x] New `POST .../reextract` (admin only, `maxDuration = 120`): re-runs `expedionExtractionService` over the stored `bordereauDocUrl` via `imageUrlToBase64DataUrl`, merges only non-null extracted fields so a hand-corrected value is never blanked, promotes `pending` → `awaiting_confirmation`, logs an `actor: "admin"` event, then fires `autoPrice` again (void + catch).
- [x] New `src/lib/utils/date-range.ts` and `data-table/date-range-filter.ts` do all arithmetic on local calendar days, deliberately not `.toISOString()`. `toComparableISO` special-cases already-local "YYYY-MM-DD" values (e.g. `joinDate`) because a date-only ISO string parses as UTC midnight and shifts a day backward behind UTC. Rows with no readable date never match an active range. `dateRangeFilterFn<TData>()` is a factory, not a shared constant, so `TData` stays a real type parameter at every call site.
- [x] New `date-range-field.tsx` and `useAdminDateRange` context mounted in `AdminLayout`, wired through the data-table toolbar into `CarrierApplicationsList`, `DeliveriesTable`, `ListingsTable`, `UsersTable`. **`location-picker-field.tsx` (273 lines) lands unused** — it appears nowhere but its own new file in this commit; it is wired into the quote dialog in 571ae5d. `hasDimensions`, `geocodeFr` and a new `adValoremInsuranceCents` are exported from `expedion.service.ts`.
- [x] `expedion.service.test.ts` +158 lines, seven new cases: cached-suggestion hit, fresh compute and persist, the `QUOTE_ALREADY_PRICED` refusal, non-owner hiding, and the three cache-invalidation branches. Nothing here tests the admin patch path.
- [x] `docs/plans/plan_expedion_operator_self_service.md` (171 lines) lands with it: enumerates the ten `escalationBlockers()` checks, records that `adminUpdateExpedionQuoteSchema` covered none of them, and lays out WP1–WP6. This commit is the plumbing half.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- The commit says it only "lands the operator self-service work toward closing the 'escalation blocked' gap" — the fix-and-publish loop itself is not closed here, and the location picker it adds is not yet attached to any screen.
- The accompanying plan is marked Status: Proposed and its §7 puts real Stripe hold/capture, the Expedion `paid` webhook, commission-split policy, and bulk/CSV remediation of the Airtable backlog explicitly out of scope.

---

## ✅ 2026-08-20 — One Currency Formatter, With A Visible Thousands Separator (2.16.1)

`d36f7be` · fix · 16 files changed · *Format euro amounts with a dot thousands separator, not a narrow space*

- [x] Cause per the body: every display used `Intl.NumberFormat("fr-FR", ...)` directly, duplicated across 14 files with slightly different signatures. Recent CLDR data renders fr-FR's thousands separator as U+202F (narrow no-break space), which enough fonts collapse to nothing that "189543,65 €" reads as one number.
- [x] All call sites consolidated onto a single `formatCurrency`/`formatNumber` in `src/lib/currency.ts`, now using `"de-DE"` — same decimal-comma convention, but a literal "." thousands separator, e.g. "189.543,65 €".
- [x] Removes the seven duplicated local formatters this replaces — three of them under the same `formatCurrency` name, each with an incompatible second-argument type.
- [x] Touches server-side output too, not just screens: `src/server/pdf/InvoicePDF.tsx` and `src/server/services/expedion-sms.service.ts`, so the invoice PDF and the client's SMS agree with the UI.
- [x] Net -21 lines across 16 files: this is deletion of duplication, not new surface.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-20 — FR/EN Strings For Impersonation, Applications And The Worklist (2.16.0)

`2d22e47` · ux · 2 files changed · *Add French/English strings for impersonation, applications and the report worklist*

- [x] `messages/en.json` and `messages/fr.json` only, +187 lines each side (330 insertions, 44 deletions across the two).
- [x] Covers three earlier feature commits, named in the body: admin impersonation and account-moderation dialogs, the carrier-applications "all statuses" filter, and the operator report's recent-quotes worklist (tabs, next-step badges, document preview labels).
- [x] Kept as one commit rather than folded into each feature deliberately: splitting a single JSON file by feature means reconstructing intermediate states no build ever saw.
- [x] Parity is asserted by key diff, not by eye — 1340 keys each side, no one-sided keys.

**Verification:** "FR/EN key parity verified by diff, not by eye: 1340 keys each side, no one-sided keys."

---

## ✅ 2026-08-20 — Brand Lockup Scales From One Size Prop (2.15.1)

`d4abba5` · fix · 1 file changed · *Make the wordmark's own size prop actually control its proportions*

- [x] `src/components/ui/brand-mark.tsx` is the only file this commit touches (+46/-7). `BrandMark`/`BrandWordmark` took a `size` prop that only ever reached the mark — both wordmark font sizes, the line gap and the mark-to-text gap were flat pixel values. Every dimension, corner radius included, is now a ratio of `size`.
- [x] Observed symptom recorded in the body: called at four real sizes across the app (24/28/30/32), the mark:text ratio ranged 0.96x to 1.28x — mobile header versus landing navbar.
- [x] The ratios (cap:mark 0.5524, gap:mark 0.3631) are chosen to be shared with `XpdLogo` in `expedion_encheres/lib/design_system/ds_logo.dart`, which the body says has the identical defect — `XpdLogo(markSize: 26.0)` calls with no matching `wordmarkSize`, so the wordmark stays at its default while the mark shrinks around it. **The Flutter side is not changed here**; this commit touches one file in this repo.
- [x] The numbers are an average of the two brands' originals rather than one side's: neither had design authority, both shipped un-scaled by the same bug, and the single system has to work for a solid filled square and a thin ring alike.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- The two codebases are coupled by convention only: change one side and the other must be changed the same way. Each file's doc comment names its sibling, but nothing enforces it — and the sibling change is not in this commit.

---

## ✅ 2026-08-20 — Operator Report Becomes A Worklist, And Survives Its Own Fan-Out (2.15.0)

`5e75463` · feat · 17 files changed · *Turn the operator report into a worklist, and make it survive its own fan-out*

- [x] Reliability root cause, stated in the commit body: `expedion-report.service.ts` fired eighteen concurrent queries; once postgres.js's pool was exhausted it pipelined the rest onto a busy connection, which Supabase's transaction pooler does not answer — so the page hung rather than failed. Now three concurrent batches (scalars, row sets, platform figures), with per-section failure tracking kept so one broken aggregate costs that card only.
- [x] New `src/features/app/admin/expedion/lib/quote-action.ts` (153 lines) plus a 211-line test: the badge and the matching button (Set price / Assign / Publish) are derived in one place, so a row's label and its action cannot disagree about what it is waiting for.
- [x] Queue-membership flags now live on `QuoteRow.queues`, computed once in the shared quote projection in `expedion-report.dal.ts` (403 lines touched, +126-line test) and reused by both the queue tables and the recent list rather than re-derived per caller.
- [x] New `RecentQuotesPanel.tsx` (506 lines) moves recent quotes to the top of `ExpedionDashboard` with a To-handle / All toggle and most-urgent-first ordering.
- [x] New `QuoteDetailDialog.tsx` (527 lines): per-row detail with client contact info and inline preview of the uploaded bordereau/photos instead of a bare link.
- [x] New nav-badge stack — `src/server/dal/admin-nav.dal.ts`, `admin-nav.service.ts`, `GET /api/admin/nav-counts` (one query), `useAdminNavCounts` (`refetchInterval` 60s, `staleTime` 30s) — feeding per-entry badges in `AdminLayout` (425 lines touched) and `AdminBottomNav`; red for staff-blocking work, grey for volume, off the same queue predicates the report runs on so a badge cannot disagree with the queue it links to.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-20 — Make Carrier Application Status Filter Optional End To End (2.14.1)

`a73e036` · ux · 6 files changed · *Land an admin on the whole carrier queue, not a slice of it*

- [x] `/admin/applications` defaulted to `status=submitted`, so an admin saw one status and had to know to widen the filter to find everything else awaiting review.
- [x] `status` is now optional through the whole chain — the query param in `src/app/api/admin/carrier-applications/route.ts`, `carrierService.listForReview`, and `carriersDal.listByStatus` (where clause becomes `undefined` rather than an equality) — so an absent status means no status filter rather than a hidden default.
- [x] The route's status list stopped being a restated literal and now derives from `carrierStatusEnum.enumValues`, the same never-restate-the-enum rule the role enum is under.
- [x] `listByStatus` gained `orderBy: desc(carriers.createdAt)`, so the list is newest first now that "everything" is a real result set an admin scrolls rather than a five-row status slice.
- [x] Client side (`carriers.api.ts`, `useCarrierApplications.ts`, `CarrierApplicationsList.tsx`): the dropdown keeps every status as a narrowing option; "All statuses" is the new default, not a new capability — which is why this is a patch, not a minor.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-20 — Impersonation, Real Suspension, And The No-Write Invariant (2.14.0)

`8026db7` · feat · 57 files changed · *Let admins impersonate, reset, and suspend without a borrowed session writing on its own*

- [x] `/admin/users` gains a last-login column, a working "view profile", impersonation ("log in as", 60 min, audited in `impersonation_sessions`, `ImpersonationBanner` while active), password reset, sign-out-everywhere and account delete — routes under `src/app/api/admin/users/[id]/` (`route.ts`, `status/route.ts`, `sessions/route.ts`, `password-reset/route.ts`), service in `impersonation.service.ts` over `impersonation.dal.ts`.
- [x] Impersonation is a hand-rolled Better Auth plugin (`src/lib/auth-impersonation.ts`, 274 lines) rather than Better Auth's shipped `admin` plugin, because that plugin decides who is an admin from a `user.role` string column — a second source of truth competing with `user_roles`. Same mechanism, permission check delegated to the service layer; the admin's own session token is parked in an `admin_session` cookie while they are somebody else, and session minting/cookie signing has to live in an endpoint context.
- [x] The hard invariant: a borrowed session never writes by itself. Every mutation that used to fire from a page load — message read receipts (`messages/conversations/[id]`), `mark-seen`, Stripe customer/SetupIntent/Connect provisioning — is suppressed via `isImpersonated()` (`src/lib/impersonation-guard.ts`). Add a new auto-firing write and you must guard it too.
- [x] The same guard covers the email-verification and ban gates in `proxy.ts`, which would otherwise make an unverified or suspended account unviewable to the one person who needs to see it. `src/__tests__/proxy.test.ts` (+110 lines) covers that path.
- [x] `user.banned` was written and read by nobody before this: it now blocks session creation and kills live sessions, and `session.cookieCache.maxAge` drops from 7 days to 5 minutes so a revocation is not invisible for a week.
- [x] Every action the menu can refuse — impersonate, delete, suspend — is decided once in `src/server/services/account-policy.ts` and reaches the UI as a reason, so a disallowed action renders with an explanation rather than vanishing from the menu.
- [x] Two hand-written migrations. `0003_admin_user_management.sql`: `user.last_login_at` (backfilled from the newest surviving session per user — accounts whose sessions have all expired stay NULL and render "Never"), `session.impersonated_by`, and the `impersonation_sessions` table with its indexes. `0004_user_signup_origin.sql`: `user.origin` (`expeditoo` | `expedion`), stamped from the request's Origin header via `src/lib/app-origins.ts` reusing `EXPEDION_APP_ORIGINS`, with **no backfill** — 4,588 of 4,593 imported quotes carry no user at all, and the tempting proxy (`expedion_quotes.user_id`) is written by the email-matching claim path on every EXPEDITOO signup, so it labelled exactly one account and that account was an EXPEDITOO admin.
- [x] Housekeeping and paperwork: `users.dal.ts` adds `mapApiUser` as a shared projection (plus `src/features/app/admin/lib/map-api-user.ts`) so the admin table and the driver picker stop each carrying their own copy; the hand-rolled toast system (`components/ui/toast.tsx`, `toaster.tsx`, `use-toast.ts`) is retired for the sonner-backed one already used elsewhere; ships `docs/plans/plan_admin_user_management.md`, a heavily expanded `docs/specs/admin_user_management_spec.md` and new suites in `impersonation.service.test.ts`, `admin.service.test.ts`, `messages.service.test.ts` and `stripe.service.test.ts`.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- The no-write invariant is enforced call site by call site: any newly added mutation that fires from a page load has to be wrapped in `isImpersonated()` by hand, and nothing structurally prevents forgetting.
- `user.origin` is deliberately not backfilled — every account created before this migration reads `expeditoo` whether or not it came from Expedion, and 28 distinct Firebase uids own quotes with no `user` row behind them at all, so those Expedion clients cannot appear in the admin user list.

---

## ✅ 2026-08-20 — APP_ENV, Fail-Closed DB Guards And An Anonymised Mirror (2.13.6)

`70e8854` · infra · 34 files changed · *Separate local/preview/production so dev never touches production data*

- [x] `.env.local` was a raw `vercel env pull` dump, so `pnpm dev`, `db:push`, `db:migrate` and the seed scripts read and wrote the production Supabase database from a laptop, published to production Ably channels and could land a real verification or shipment email in a real driver's inbox.
- [x] `src/lib/env.ts` exports `APP_ENV` (local | preview | production), resolved `NEXT_PUBLIC_APP_ENV` → explicit `APP_ENV` → off-Vercel means local → `VERCEL_ENV`. Never `NODE_ENV`: a local `next build` and every Preview deploy set it to "production". `next.config.mjs` duplicates that resolution to inject `NEXT_PUBLIC_APP_ENV` at build time so a browser bundle agrees with the server — change the order and you change both places.
- [x] `src/lib/db-target.ts` `describeDatabase(url)` is the single definition of "which database is this", parsing both Supabase URL shapes (`db.<ref>.supabase.co` and the pooler's `postgres.<ref>` username). `PRODUCTION_DB_REFS` is hardcoded, not read from env, so a missing variable can never silently disable the check; `DEV_DB_REFS` lists registered dev projects. Both assertions fail closed — an unrecognised remote host is refused, not assumed safe.
- [x] `assertNotProductionDatabase` runs from `src/db/index.ts` on every server boot; the stricter `assertDevelopmentDatabase` guards everything destructive — `db:migrate`, `db:clean`, `db:push`/`db:studio` via `scripts/guard-db.ts`, the `db:mirror` restore leg and `db:seed:dev-users`. `src/lib/env-assertions.ts`, run once from `src/instrumentation.ts`, throws (not warns) on the mirror-image failures: production pointed at a non-production database, a production `STRIPE_SECRET_KEY` that is not `sk_live_`, a live key outside production, or `MOCK_PAYMENTS=true` in production.
- [x] `pnpm db:mirror` (`scripts/db-mirror.sh`) pg_dumps production read-only through `MIRROR_SOURCE_URL` — a deliberately different variable name so `POSTGRES_URL` can never resolve to production by typo — restores into a guarded dev target, runs `scripts/sql/anonymize.sql` in one transaction, then `verify-anonymized.sql`, which exits non-zero if anything the scrub should have removed survives. It hunts for the newest pg_dump on the box because production runs 17.x and an older client refuses.
- [x] Anonymisation keeps row counts, ids, FKs, timestamps, statuses, amounts, listing text and photo URLs, and city names with coordinates rounded to ~1 km (the postcode's first two digits survive, because French routing keys off the département); it destroys names, emails, phones, street addresses, KYC keys, avatars, proof-of-delivery photos, all free text, session and verification rows, password hashes, OAuth tokens and every live Stripe id. `MIRROR_KEEP_EMAILS` exempts your own account so you can still find yourself; password hashes are wiped, so `pnpm db:seed:dev-users` is what makes a mirrored database signable-into.
- [x] Ably channel names and token capability patterns all go through `namespaced()` (production unsuffixed, so existing production data keeps its names) — `ably-server.ts`, `ably.service.ts`, `AblySubscriptions.tsx` and `useMessageDetail.ts` must stay in agreement, because one API key is shared and the namespace is the only thing stopping a local publish reaching a production subscriber. `sendViaResend()` in `src/lib/email.ts` is the only sanctioned Resend path: outside production it rewrites the recipient to `EMAIL_DEV_RECIPIENT` or logs and drops the mail.
- [x] `docs/specs/environments_spec.md` is the contract, with `.env.example`, `pnpm db:start`/`db:stop`, `pnpm env:list`/`env:set`, and `env:pull:*` dumps that are for reading only — renaming one to `.env.local` is the exact mistake the spec exists to undo.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- The environment resolution order lives in two places — `src/lib/env.ts` and `next.config.mjs` (which runs before webpack can import a `.ts` file) — and must be changed in both.
- R2 separation is manual: bucket names are plain env vars (`R2_BUCKET_NAME`, `R2_KYC_BUCKET_NAME`) that have to be pointed at separate dev buckets by hand.
- Ably uses one shared API key across all three environments; channel namespacing is the only isolation, so a call site that bypasses `namespaced()` reaches another environment's data.
- Adding a second development database means creating the Supabase project and registering its ref in `DEV_DB_REFS` in both `.env.local` and the Vercel Preview scope.
- `db:mirror` needs pg_dump/pg_restore 17 on the machine; the 14.x psql that ships on macOS is refused by a 17.x server.

---

## ✅ 2026-08-19 — Publishing A Price Now Advances The Quote To Quoted (2.13.5)

`c618110` · fix · 2 files changed · *Advance a quote to `quoted` when the operator publishes its price*

- [x] Publishing a price from the supervision dashboard set `quoteAvailable` and left the status alone — a dead end in both directions: the row left the "to price" queue (predicate `quote_available = false and status in ('pending','awaiting_confirmation')`) while remaining `pending`, and `acceptQuote` refuses it because `TRANSITIONS` only allows `quoted -> accepted`. The client saw a price and got a 409 on acting on it.
- [x] `adminUpdate` never infers status: `nextStatus` comes from an explicit `input.status` or from attaching a driver, and nothing else — so `RepriceDialog` has to say it, alongside the `quoteAvailable: true` it already sent.
- [x] New `PRICEABLE_STATUSES = ["pending", "awaiting_confirmation"]` in `src/features/app/admin/expedion/ui/RepriceDialog.tsx` gates the send (`status: PRICEABLE_STATUSES.includes(quote?.status ?? "") ? "quoted" : undefined`); from any other state `status` is left `undefined`, because an operator correcting the price of an already accepted or paid job must not rewind it and `adminUpdate` would throw `INVALID_TRANSITION` anyway.
- [x] The added tests in `expedion.service.test.ts` (+32 lines) pin the transition graph itself rather than the dialog, because the graph is what made the old behaviour a dead end and what makes the fix safe.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-19 — Filter Retired Roles Through canonicalRoles() Before Any Schema (2.13.4)

`7047d8e` · fix · 2 files changed · *Stop one retired role from hiding a user's real ones*

- [x] `GET /api/user/roles` validates its response with `z.array(UserRoleSchema)`, and one invalid member fails the whole array. An account carrying `transporter` (retired with v1, absent from `userRoleEnum`) 500ed the endpoint → `useUserRoles` errored → `userRoles` came back undefined → `isAdmin` evaluated false. `getProfile` had the identical shape, so that payload would have failed too.
- [x] `UserRoleSchema` in `src/server/dto/user-roles.dto.ts` was a restated copy of the enum — correct values, but the same fragility that let `user.dto.ts` drift to the v1 list and break every admin role assignment. It is now `z.enum(userRoleEnum.enumValues)`.
- [x] Derivation alone is not sufficient: derived or restated, the schema still rejects a legacy row. A new `canonicalRoles()` helper in `user.service.ts` filters rows against `userRoleEnum.enumValues` before they reach any schema, in both `getProfile` and `getUserRoles`, so a retired role degrades to "not a role" instead of taking every other role down with it.
- [x] Ten `user_roles` rows across ten accounts deleted — seven `transporter`, three `buyer`. They granted nothing: no code has read either name since the vocabulary purge. Accounts left with no rows fall back to the `shipper` default the session already assumes for an empty list.
- [x] Verified against the database: both requested accounts resolve to `[admin]`, so Profile renders its Admin Dashboard link to `/admin/expedion`.

**Verification:** Gates: tsc 0 errors, lint 0 errors, 192 tests, build passes. The commit additionally records a database check that both requested accounts resolve to [admin].

---

## ✅ 2026-08-16 — Drop And Recreate The Four Drifted Enums In 0002 (2.13.3)

`347a8e0` · infra · 2 files changed · *Rebuild the drifted enum types alongside the tables*

- [x] The first attempt at `0002_realign_transport_schema.sql` aborted at statement 13 with `invalid input value for enum listing_status: "draft"` and rolled back cleanly — the database was left untouched, not half-migrated. The column-level drift comparison that greenlit it named only three drifted tables, because comparing column names says nothing about the values a type admits.
- [x] Four enum TYPES had drifted: `listing_status` (db: active/sold/ended/cancelled vs code: draft/open/awarded/in_progress/completed/…), `payment_status` (db: pending/succeeded/failed/refunded vs code: pending/authorising/authorised/captured/…), `actor_role` (db: system/driver/buyer/seller/admin) and `review_role` (db: buyer/seller/driver/client).
- [x] The migration now drops those four types with CASCADE once nothing depends on them and recreates them on the transport vocabulary — `actor_role` as system/shipper/carrier/driver/operator/admin and `review_role` as shipper/carrier. `reviews` and `shipment_events` join the rebuild only because they own columns of the drifted enums; `reviews` was empty and the seven shipment events belonged to the two v1 shipments already being removed (previously a bare `DELETE FROM shipment_events`, now a `DROP TABLE … CASCADE` plus recreate).
- [x] Applied as 70 statements in one transaction. `expedion_quotes` kept all 4,592 rows, as did `user`, `user_roles`, `offers`, `carriers`, `vehicles`, `conversations` and `messages`; `listings`/`shipments`/`payments`/`reviews`/`shipment_events` came back empty; the seven v1 tables (`bids`, `orders`, `earnings`, `listing_images`, `shipment_proposals`, `transporter_profiles`, `driver_applications`) are gone.
- [x] `listingsDal.browse` had been failing with `column listings.shipper_id does not exist` and now returns cleanly; every endpoint that was 500ing answers 200 or 401 on both localhost and production.
- [x] The drizzle journal was reconciled so `pnpm db:migrate` no longer tries to replay `0000` against an existing schema, and the one-off runner `scripts/apply-realign-migration.ts` (75 lines) is deleted now that its job is done.

**Verification:** Gates: tsc 0 errors, 192 tests (no lint or build claimed). The commit also records the applied result: 70 statements in one transaction, expedion_quotes keeping all 4,592 rows, and every previously-500ing endpoint answering 200 or 401 on both localhost and production.

---

## ✅ 2026-08-16 — Trust The Deployment's Own Hostnames For Sign-In (2.13.2)

`91c7c15` · fix · 2 files changed · *Let a deployment trust its own origin*

- [x] Production at expeditoo-ship-five.vercel.app rejected sign-in with "Invalid origin" because `NEXT_PUBLIC_APP_URL` still named the previous deployment (expeditoo-rho.vercel.app), which was the only trusted origin. Probing the live site is what showed it.
- [x] Post-login redirects were never implicated — they are relative ("/home") and stay on whatever origin signed you in. The failure was purely the origin check in front of them.
- [x] `src/lib/auth.ts` adds a `deploymentOrigins()` helper reading Vercel's injected `VERCEL_PROJECT_PRODUCTION_URL` (stable production domain) and `VERCEL_URL` (the immutable per-deploy URL a preview is served from), and always folds them into Better Auth's `trustedOrigins` alongside `NEXT_PUBLIC_APP_URL` and `EXPEDION_APP_ORIGINS`, de-duplicated through a `Set`.
- [x] `src/proxy.ts` adds the same two hostnames to the CORS allowlist, so the two checks agree.
- [x] `NEXT_PUBLIC_APP_URL` deliberately stays the canonical origin rather than becoming derived: it drives `baseURL` and therefore the OAuth callback, which must match a redirect URI registered with Google. It now falls back to the first deployment origin (and only then localhost) when unset, so an unset variable no longer means localhost on Vercel.
- [x] Still required for Google specifically: `NEXT_PUBLIC_APP_URL` updated to the live domain on Vercel, and that domain's `/api/auth/callback/google` registered in the Google console.

**Verification:** Gates: tsc 0 errors, lint 0 errors, 192 tests, build passes.

**Known limits, recorded by the commit itself:**

- Google sign-in on a new domain still needs two manual steps: `NEXT_PUBLIC_APP_URL` updated in Vercel, and that domain's `/api/auth/callback/google` registered in the Google console.
- `NEXT_PUBLIC_APP_URL` remains hand-maintained by design, so a stale copy still misconfigures the OAuth callback even though it can no longer take sign-in down on its own.

---

## ✅ 2026-08-16 — Realign the Live Schema to Transport, Drop Four Dead Routes (2.13.1)

`d1b3ce2` · fix · 13 files changed · *Realign the database with the transport schema, and drop four dead routes*

- [x] Six screens returned 500 and none of it was a code fault: the live database still carried the v1 goods-auction shape. `listings` had `seller_id`, `winner_id`, `start_price`, `buy_now_price`, `ends_at`; `shipments` had `user_id`, `price`, `package_weight`, `scheduled_date`; `payments` had `amount`, `application_fee_amount` — so every query died on "column listings.shipper_id does not exist".
- [x] Full introspection of the live schema against the Drizzle definitions puts the damage at exactly three tables; the other twenty-four match, which is why `/admin/profile` worked while everything touching a listing did not.
- [x] `pnpm db:migrate` cannot fix this: the database's journal records six migrations from before the repo squashed its history to `0000_old_slayback`, so drizzle would replay `0000` and abort on "relation listings already exists".
- [x] `0002_realign_transport_schema.sql` rebuilds the three tables from `0000`'s own definitions and drops the seven v1 tables the schema no longer defines (`bids`, `orders`, `earnings`, `listing_images`, `shipment_proposals`, `transporter_profiles`, `driver_applications`). Rebuilt rather than altered because a v1 row carries no pickup window, budget or origin — nothing in it maps onto a transport job.
- [x] Applied by `scripts/apply-realign-migration.ts` in a single transaction, so any failure leaves the database untouched.
- [x] Untouched: `user`, `user_roles`, `offers`, `carriers`, `vehicles`, `expedion_quotes`. The 4,591 imported quotes are safe regardless — `listing_id` is null on every one, so none references a listing. Casualties are 31 v1 listings, 2 shipments, 3 payments and 26 bids/orders rows, all goods-auction records.
- [x] Four routes with no inbound link anywhere in the codebase are deleted: `/admin/reports` (a "coming soon" stub) plus `/user/[id]`, `/faq` and `/splash` — complete screens that had lost their entry points — along with the splash feature nothing imported. 54 routes down to 50.
- [x] Diff note for whoever runs drizzle-kit next: the diff adds the `0002` journal entry (`src/db/migrations/meta/_journal.json`) but no `meta/` snapshot file alongside it.

**Verification:** "Gates: tsc 0 errors, lint 0 errors, 192 tests, FR/EN parity exact."

**Known limits, recorded by the commit itself:**

- Deliberate data loss, enumerated in the commit: 31 v1 listings, 2 shipments, 3 payments and 26 bids/orders rows are dropped, plus seven v1 tables.
- The migration cannot be applied by the normal migrator — it needs `scripts/apply-realign-migration.ts`, because the live journal predates the squashed history.

---

## ✅ 2026-08-16 — Pivot to the Driver-Side App for Expedion Demand (2.13.0)

`7a455c0` · feat · 129 files changed · *Make Expeditoo the driver-side app for Expedion demand*

- [x] Shipper surface deleted, not hidden: `useJobForm`/`JobForm`, the stranded `create/success` route (which still shared links to a nonexistent `/auction/:id`), `MyJobs`, `AddressMapPicker`, `PhotoDropzone`, `create/schemas.ts`, plus dead analytics (`SellerAnalytics`, `BuyerPurchaseHistory`, `DriverStats`), `useUserRoles` and `features/auth/types.ts`. `/listings/me` redirects to `/expedion`.
- [x] `/home` becomes `DriverDashboard` (`useDriverDashboard`, `orderRuns.ts`), composed from endpoints that already existed so it adds no server surface. The board it replaced moved to `/expedion`, pinned to `origin='expedion'` with the filter threaded DTO → DAL → client (`listings.dto.ts`, `listings.dal.ts`, `useJobBoard`); `JobBoard.tsx` was hardcoded English and picked up a `jobBoard` next-intl namespace on the way past.
- [x] `offersService.acceptOffer` now accepts an operator or admin, but only on Expedion-origin jobs; a direct listing keeps the shipper-only rule. It bills `listing.shipperId` rather than the actor — load-bearing the moment those two stopped being the same person. Operators award from the job page and from the new `/admin/awards` queue (`AwardQueue.tsx`), so there is one accept path rather than two.
- [x] `POST /api/expedion/quotes/:id/paid` gives `expedionService.markPaid` its first caller, so `escalateAfter` is finally written and the sweep has something to find — payment *reported* over HTTP rather than observed, since `expedion_quotes` carries no Stripe payment intent and the webhook cannot recognise a quote. Beside it, `expedion-escalation.service.ts` can no longer mint duplicate listings: it adopts an orphan via `external_ref` and, after creating a listing, refuses to release its claim — a stuck quote is visible and repairable, a duplicate is neither.
- [x] `carriers` is person-level now: KBIS is no longer required (an auto-entrepreneur has none), while SIRET and one vehicle remain, because a sole trader carrying goods for hire in France has the former and an offer names the latter.
- [x] Not mentioned in the commit message but sizeable in the diff: a third credential path for the Flutter client. `src/lib/firebase-token.ts` verifies Firebase ID tokens as plain RS256 JWTs against Google's published JWKS with `jose` — no Admin SDK and no service account, only the public project id — giving a cryptographically established UID instead of the shared key's client-asserted one. `GET /api/expedion/me` reports which credential answered and whether the caller is an operator, granting nothing (every guarded route re-derives the role). `src/proxy.ts` adds credentialed CORS for `/api/auth/*` and `/api/expedion/*`: the origin is echoed rather than `*`, `set-auth-token` is exposed (without it the Flutter web build signs in then goes anonymous on the next request), preflight is answered in the proxy so a route with no OPTIONS handler cannot 405 it, and any loopback port is allowed outside production because `flutter run` picks a fresh one each launch.
- [x] Two bugs found on the way, neither cosmetic. `user.dto.ts` restated the role enum as the v1 list and admin role assignment validates against it, so granting carrier, driver, shipper, support or finance was rejected as invalid while `transporter` passed validation and then failed at the database — it now derives from `userRoleEnum`, and the same dead role had made `getActiveUsersCount` exclude nobody. And `shipment.service.test.ts` stamped `createdAt` with `new Date()` in a fixture compared against a freshly built one, so it passed only when both landed in the same millisecond — now frozen, and the suite is stable across repeated full runs.
- [x] A multi-agent review raised 25 findings and 23 were refuted; the two survivors are fixed here — the dashboard took the newest active shipment as the "current run" rather than the one actually underway, and `MyOffers` still sent drivers to `/home` for the board.

**Verification:** "Gates: tsc 0 errors, lint 0 errors, 192 tests, production build passes, FR/EN parity exact." Also: a multi-agent review raised 25 findings, 23 refuted, 2 fixed in this commit.

**Known limits, recorded by the commit itself:**

- Nothing on the Expedion side posts to `POST /api/expedion/quotes/:id/paid` yet — until it does, auto-escalation stays inert on real data.
- Payment is reported over HTTP rather than observed, because `expedion_quotes` carries no Stripe payment intent and the webhook therefore cannot recognise a quote.

---

## ✅ 2026-08-16 — One Operator Report at /admin/expedion (2.12.0)

`1a666b8` · feat · 19 files changed · *Make /admin/expedion the whole-platform operator report*

- [x] The old admin surface was a hand-rolled quotes table reachable from no navigation array and the only server component under `/admin` — which is why it could only ever render French: `i18n/request.ts` always returns the default locale on the server and nothing called `getTranslations`. Meanwhile `/admin/dashboard` showed four platform KPIs and nothing about the auction business paying for them.
- [x] Both are now one client-rendered page fed by a single endpoint (`/api/admin/expedion/report` → `expedion-report.service.ts` → `expedion-report.dal.ts`), so no two figures on it can disagree: six KPIs absorbing the old four, the quote funnel along the transitions `canTransition` actually permits, four operator queues (to price, no driver, storage at risk, escalation due) with reprice/assign/escalate inline, and supply plus data-health cards — including the 4,450 rows still keyed `airtable:` that no client can see until they are claimed.
- [x] The queues are the point: an operator works down them, and the round trip through a detail page per row is the friction this removes. Mutations invalidate rather than update optimistically, because each triggers server-side work the client cannot predict — an event row, a listing, an SMS.
- [x] Escalation is irreversible, so it is confirmed behind an `AlertDialog` and disabled outright when pickup coordinates are missing, which is the thing that makes the escalation service refuse the job.
- [x] Data access follows the house rule the previous page skipped — UI → hooks → REST → service → DAL — with the aggregates moved out of a component-local `queries.ts` into `src/server/dal/expedion-report.dal.ts`, and the route guarded on session plus the admin role like `/api/admin/stats`.
- [x] New components: `ExpedionDashboard.tsx`, `QuoteQueueTable.tsx`, `RepriceDialog.tsx`, `AssignDriverDialog.tsx`, `EscalateDialog.tsx`, `StatCard.tsx`, hook `useExpedionReport.ts`.
- [x] An `admin.expedion` namespace is added to both catalogues, leaf-key parity kept exact at 1417 each. The two `note:` strings sent with a mutation stay French on purpose: they are persisted onto the quote's timeline beside the event messages `expedion.service.ts` writes, so they belong to that log rather than to whichever locale the operator had selected.
- [x] `/admin/dashboard` and its five inbound links redirect here; the old page is kept as a redirect rather than deleted because it was the admin landing page and is in browser histories. Tests render the dashboard against both real catalogues and assert next-intl never reports a missing message — the templated `funnel.${status}` and `queues.${key}Empty` lookups are invisible to both the compiler and grep, and a typo would ship as a raw key path sitting in the UI rather than as a crash.

**Verification:** The commit claims FR/EN leaf-key parity kept exact at 1417 keys each, and tests that render the dashboard against both real catalogues asserting next-intl reports no missing message. No test count, typecheck, lint or build result is recorded.

**Known limits, recorded by the commit itself:**

- Money on the report is explicitly provisional: `markPayment` runs behind `MOCK_PAYMENTS` and payouts never leave `scheduled`, so the figures are indicators, not accounts.
- 4,450 quote rows are still keyed `airtable:` and no client can see them until they are claimed — surfaced on the data-health card rather than fixed here.
- `/admin/dashboard` survives only as a redirect (browser history), not as a live page.

---

## ✅ 2026-08-16 — Quote List Scoped by a Discriminated Union, Not a Falsy Owner (2.11.1)

`c76675b` · fix · 5 files changed · *Scope the Expedion quote list to its caller*

- [x] `GET /api/expedion/quotes` widened for admins with `firebaseUid: caller.isAdmin ? undefined : caller.userId`, and `expedion.dal.ts` read a falsy owner as "no predicate", so the filter was dropped entirely and the whole table came back. This is the endpoint the Flutter client's "Mes devis" calls; an operator holds the admin role, so their own quote list returned all 4,591 rows.
- [x] The hole was possible because "this owner" and "every owner" were the same value. `QuoteFilters.firebaseUid?: string` becomes a required discriminated union — `{ scope: "mine"; ownerId } | { scope: "all" }` (`src/server/dto/expedion.dto.ts`) — so omitting the owner no longer compiles. A one-line route fix would have closed today's hole and left the footgun for the next caller.
- [x] Breadth is asked for, never inferred: `?scope=all` requires an admin and is refused with 403 rather than quietly downgraded, because a caller that asked for every row should learn it cannot have them instead of receiving its own and believing it saw everything. Default is `mine` for everyone, admins included.
- [x] The Flutter client sends no `scope` and no user id — identity is entirely the Authorization header — so it is corrected by the server change alone, with no client release.
- [x] Reading a single quote by id still lets an admin through: id-addressed rather than enumerable, and the operator dashboard needs it. The comment now says so, so it reads as a decision rather than the same oversight twice.
- [x] Adds the first tests this service has had (`src/app/api/expedion/quotes/__tests__/route.test.ts`, `expedion.service.test.ts`). The route tests drive the real guard and the real service with only leaf dependencies stubbed, so they cover route → service → DAL and the admin resolution with it; the case that matters is "an admin with no scope gets only their own rows".

**Verification:** Not recorded in the commit — no test count, typecheck, lint or build result. The message states only that it adds the service's first tests, driving the real guard and real service with leaf dependencies stubbed.

**Known limits, recorded by the commit itself:**

- Fetching a single quote by id still allows any admin through — a deliberate exception, justified as id-addressed rather than enumerable and needed by the operator dashboard.

---

## ✅ 2026-08-14 — Theme and Locale Follow the Device (2.11.0)

`423ecce` · ux · 4 files changed · *Open in the device's theme and language, not a hardcoded pair*

- [x] `Providers.tsx`: `defaultTheme` flipped to `"system"`; `enableSystem` was already set, so only the default needed changing. Every consumer was already safe — the maps and Stripe surfaces read `resolvedTheme`, and Settings, the landing toggle and the header toggle all already offer and tick a "system" row.
- [x] `useThemeToggle`'s pre-hydration fallback moves from `"light"` to `"system"`, so it stops ticking the wrong radio for the first frame.
- [x] `src/i18n/config.ts` gains `detectDeviceLocale()`, which walks `navigator.languages` in preference order and matches on the primary subtag, so en-GB, en-US and en all resolve to `en`.
- [x] French stays the product default deliberately: it is the fallback for a device asking for a language the app does not ship, and it is what SSR still renders.
- [x] `getStoredLocale` renamed `getInitialLocale`, since it no longer returns only a stored value; an explicit user choice still wins over both device defaults. `LocaleProvider` updated to match.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- SSR still renders French regardless of the device, so device-language detection is a client-side correction after the first server frame.

---

## ✅ 2026-08-14 — Crons Moved to GitHub Actions to Unblock Hobby Deploys (2.10.3)

`191ccac` · infra · 3 files changed · *Drive the crons from GitHub Actions so Hobby deploys pass*

- [x] Every Vercel deploy was rejected at config validation on every account tried: `vercel.json` `crons` was written for Pro. `expire-listings` (*/15) and `expedion-escalate` (*/10) both run more than once per day, which Hobby forbids, and four crons exceed the Hobby cap of two per project. Switching accounts could never help — the config was the problem.
- [x] `crons` dropped from `vercel.json`; `.github/workflows/scheduled-jobs.yml` drives the same four endpoints at the original cadence: `/api/cron/expire-listings` (*/15), `/api/cron/expedion-escalate` (*/10), `/api/cron/carrier-documents` (0 6 * * *), `/api/cron/cleanup-images?dryRun=false` (0 3 * * 0).
- [x] Auth is the same `Bearer CRON_SECRET` that `src/lib/cron-auth.ts` already accepts from Vercel Cron, so there was no server-side change at all.
- [x] Retry is deliberately off: `curl --retry` replays 5xx, and these jobs send mail and move money-adjacent state, so a 5xx following partial work would double the side effects. curl has no "retry connection errors but not 5xx" mode, so it is off entirely; a failure stays failed and the next tick picks it up, and a failed curl fails the workflow so the run shows red.
- [x] One `run` job resolves the endpoint from `github.event.schedule` or the `workflow_dispatch` `job` choice input, erroring out on an unmapped trigger; `concurrency` is grouped per trigger with `cancel-in-progress: false` so a long sweep never overlaps its own next tick; 10-minute job timeout and a 300s curl `--max-time`; any non-200 fails the run.
- [x] Requires repo variable `APP_URL` (no trailing slash) and repo secret `CRON_SECRET`, both checked at runtime with an `::error::` and exit if unset; fires only from the default branch.
- [x] Caveat written into the file's header: GitHub delays scheduled runs under load (minutes, occasionally more) and disables schedules after 60 days without repo activity. These are sweeps, not deadlines — lateness is tolerable, silence is not.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- Retry is intentionally absent, so a transient 5xx simply loses that tick's work until the next one.
- GitHub Actions delays scheduled runs under load and disables schedules after 60 days without repo activity — both acknowledged in the workflow's own header comment.
- Depends on two pieces of repo configuration that live outside the codebase: variable `APP_URL` and secret `CRON_SECRET`.

---

## ✅ 2026-08-14 — Session-First Auth on the Expedion Routes (2.10.2)

`0aa7e0f` · fix · 10 files changed · *Authenticate Expedion callers by session, not by shared key*

- [x] `requireExpedionCaller` (`src/lib/expedion-auth.ts`) resolves a Better Auth session first and falls back to the shared key only for callers that have none: Firebase-era clients naming their UID in `x-expedion-uid`, plus server-to-server automation on the admin key.
- [x] Admin is now the real `admin` role, read the same way the web app reads it, rather than inferred from which secret the caller presented. Nothing about identity is client-asserted on the session path — which is what makes it safe for the Flutter web build to talk to these routes at all; the shared key, where any holder can claim any UID, should never have shipped in a browser bundle.
- [x] The guard is async because the session lookup is, so the eight routes calling it await it (`extract`, `quotes`, `quotes/[id]`, `accept`, `admin`, `escalate`, `events`, `write-back`).
- [x] A failed session lookup returns null rather than throwing — the caller may still be presenting a valid key, and if that fails too the request is refused. No path silently succeeds. A failing role lookup logs and leaves `isAdmin` false: an unreadable role table must not promote anyone, but must not stop a buyer reading their own quotes either.
- [x] `ExpedionCaller.firebaseUid` renamed to `userId`, since on the session path it holds a Better Auth id. The service's caller parameter becomes `ExpedionCallerIdentity`, declared structurally so `expedion.service.ts` does not import Better Auth — and through it the database adapter — merely to name a shape.
- [x] `expedion_quotes.firebase_uid` keeps its column name; it means "owner" now, and renaming it is a migration.

**Verification:** "tsc clean, 147 vitest tests pass. None of this has served a real request."

**Known limits, recorded by the commit itself:**

- The commit states plainly: "None of this has served a real request." — the new session path was unexercised at the time it landed.
- The shared-key path is retained deliberately for Firebase-era clients and automation, so the any-holder-can-claim-any-UID weakness still exists for callers that present no session.
- `expedion_quotes.firebase_uid` still carries the old column name while now meaning "owner"; renaming it requires a migration.

---

## ✅ 2026-08-14 — Delivery Lifecycle Reachable; Five Review Findings Fixed (2.10.1)

`07cfc74` · fix · 29 files changed · *Make the delivery lifecycle reachable, and fix what the review caught*

- [x] The lifecycle was unreachable end to end: `acceptOffer` creates the shipment at `PENDING`, the only writer of `ASSIGNED` was an endpoint no client code called, and even wired it would have thrown `DRIVER_NOT_IN_FLEET` because nothing ever inserted a `carrier_drivers` row. On top of that the winning carrier was redirected out of `/driver`, since approval granted only the `carrier` role while that area requires `driver`.
- [x] `carrier.service.ts` gains `enrolAsOwnDriver` (+45/-5): on approval it calls the new `usersDal.assignRoleIfMissing` for both `carrier` and `driver` and the new `carriersDal.upsertDriverLink` for the fleet row, all inside the approval transaction and all idempotent — which is what lets re-approving backfill carriers approved before this existed. Both helpers are transaction-aware and documented as such: `assignRole` throws on a repeat, and there is no unique constraint on `(user_id, role)`, so the check is a read inside the caller's transaction rather than an upsert.
- [x] `ShipmentActions.tsx` gained a Start job action on `PENDING` that calls the real assign endpoint with the viewer's own id, and `useDriverShipments` / `ActiveShipments` now surface `PENDING` shipments so the button has somewhere to live.
- [x] Regression from the previous commit: moving `sendResetPassword` into `emailAndPassword` activated it, but it sent the account-verification mail and overwrote the reset link's `callbackURL`, so reset could not complete. It has its own mail path in `auth.service.ts` now, pinned by 75 new lines in `auth.service.test.ts`.
- [x] `bg-success` and `bg-warning` generated no CSS — the tokens existed on `:root` but were never registered in `@theme inline`, so 14 files styled elements against nothing and the active timeline step rendered white on white. Fixed in `globals.css`.
- [x] `isMockIntent` treated any PaymentIntent as mock while `MOCK_PAYMENTS` was on, so a real hold could be marked captured without being captured. It is now purely prefix-based (`src/lib/stripe/mock-payments.ts`), and the `TODO(EXPEDITOO-TESTING)` there was rewritten to say the prefix is the sole marker of a synthetic hold.
- [x] `redactForDriver` in `src/server/services/shipment.service.ts` only stripped top-level fields, so a driver reading a shipment received the shipper's email, Stripe ids and the listing budget. New 204-line `shipment.service.test.ts` covers it.
- [x] Two clean-ups the message does not list: the carrier vocabulary (`VEHICLE_TYPES`, `DOCUMENT_KINDS`, `REQUIRED_DOCUMENT_KINDS`, `EXPIRING_DOCUMENT_KINDS`) is extracted to a new 59-line `src/lib/carrier-constants.ts` so the screens added yesterday stop importing `src/server/dto/carrier.dto.ts` into the client bundle, and the orphaned admin `ShipmentProposalsDialog` (-240) and `useShipmentProposals` (-83) are deleted.

**Verification:** Gates recorded in the commit: tsc 0 errors, lint 0 errors, 147 tests pass, build succeeds (106 pages).

**Known limits, recorded by the commit itself:**

- Self-assignment is the model because most carriers here drive themselves; the commit states plainly that a real multi-driver fleet needs a driver invite flow instead, and carries a `TODO(EXPEDITOO-TESTING)` on `enrolAsOwnDriver` saying to replace it and stop auto-enrolling the owner.

---

## ✅ 2026-08-14 — Every Journey Made Walkable For Human Testers (2.10.0)

`544287b` · feat · 120 files changed · *Clear the MVP testing blockers across both sides of the marketplace*

- [x] `assignDefaultRole` (`src/server/dal/users.dal.ts`) inserted `'buyer'`, which the seven-value `user_role` enum rejects — every email signup died before its verification email. Default is now `'shipper'`, assigned once for both email and OAuth through Better Auth `databaseHooks` in `src/lib/auth.ts` (+104/-17), and a role failure no longer aborts the mail. Covered by the new 44-line `users.dal.test.ts`.
- [x] `src/server/dto/user-roles.dto.ts` still enumerated the v1 roles, so `GET /api/user/roles` 500'd for every real user. This is the restated-enum trap the repo now warns about.
- [x] Roles reach the client through the `customSession` plugin, which is what makes `30af0ff`'s role-aware `BottomNav` reachable at all — it was statically dead before this.
- [x] Screens that existed only as backends are now written and mounted: `CarrierApplicationScreen`, `CarrierFleetScreen`, `CarrierProfileForm`, `VehicleForm`, `DocumentChecklist`, `BankingSection` (~1,080 new lines) over the pre-existing `useCarrier` hooks, which had zero callers and gain 70 lines here; `SubmitOfferForm` — untouched by this commit, so it really was fully wired and rendered nowhere — via the new 119-line `JobBidSection.tsx` on job detail; `MyJobs` at `/listings/me`, the destination a draft save already redirected to.
- [x] Admin review repointed from `/api/admin/driver-applications`, which never existed, onto the real carrier-applications routes — `DriverApplications{List,Detail}` and `useDriverApplications` deleted (-394) and replaced by `CarrierApplication{List,Detail}`, `CarrierStatusBadge`, `useCarrierApplications` and `carriers.api.ts` (+955).
- [x] Shipper deliveries and the driver area rewritten against the current shipments API (`deliveries.api.ts` replaces `shipments.api.ts`, `driver/api/shipments.api.ts` replaces `proposals.api.ts`); both were pre-pivot code that crashed on real responses. `ProposalForm.tsx` (-451), `ShipmentProposals.tsx` (-111) and `useTransporters.ts` (-107) go with them, and `PendingPaymentsWidget.tsx` is deleted outright (-73) one commit after `f430e14` repointed it.
- [x] Payments: accepting an offer authorised nothing — the PaymentIntent was created with `confirm:false` and no caller ever passed a payment method, so capture threw at delivery and payout never ran. Behind `MOCK_PAYMENTS` (`src/lib/stripe/mock-payments.ts`) the chain completes with synthetic intents and the real 10% commission; the Stripe path is untouched with the flag off. New 359-line `payments.service.test.ts`.
- [x] Two quieter passes the message does not list: the three `/api/reviews` routes lose ~200 lines of hand-rolled error JSON to the shared `ok`/`unauthorised`/`handleError` helpers in `src/lib/api-response.ts`, the pattern `docs/rules.md` mandates; and the marketing landing is rebuilt (`LandingBidCard`, `LandingJobBoard`, `LandingPlatform`, `LandingControls`, `LandingBanner` in; `LandingShowcase`, `LandingWhatToShip`, `LandingHeroForm`, `FloatingLanguageSwitcher` out) on a self-contained `.lp` palette added to `globals.css`, plus a new `brand-mark.tsx`, app icon and `logo.svg`. `src/scripts/seed-expedion-demo.ts` (330 lines) lands for the escalation demo.

**Verification:** Gates recorded in the commit: tsc 0 errors, lint 0 errors, 137 tests pass, build succeeds. FR/EN parity restored at 1,283 keys.

**Known limits, recorded by the commit itself:**

- The payment chain only completes because `MOCK_PAYMENTS` substitutes synthetic PaymentIntents; the real Stripe path is deliberately untouched and unproven. Documented in the new `docs/TESTING_MOCKS.md`, and every mock carries a `TODO(EXPEDITOO-TESTING)` marker.

---

## ✅ 2026-08-13 — CLAUDE.md Header No Longer Contradicts Its Own Status Section (2.9.1)

`323bcb6` · infra · 1 file changed · *docs: align CLAUDE.md header with the recorded status*

- [x] Two header lines in `CLAUDE.md` still described the project as mid-Phase-A with the Expedion bridge unbuilt, which the status section further down the same file already contradicted after `30af0ff`.
- [x] Pure documentation correction: 3 insertions, 2 deletions, one file. No code, no behaviour change.
- [x] Worth noting as a pattern: the header and the status section of `CLAUDE.md` drift apart independently, so a status update needs the header checked in the same pass.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-13 — Role-Aware BottomNav, And CLAUDE.md Told The Truth (2.9.0)

`30af0ff` · ux · 4 files changed · *WP15: role-aware bottom navigation, and an honest status in CLAUDE.md*

- [x] `src/components/BottomNav.tsx` becomes role-aware at +64/-17. It reads `roles` off `useAuth()` and the driver test is `roles.includes("carrier") || roles.includes("driver")` — a carrier counts as a driver for navigation purposes. That branch gets `/home` (relabelled `jobs`), `/carrier/offers` and `/deliveries`; everyone else keeps the old bar with `/create`. `messages` and `account` are hoisted out as shared items so both arms end the same way.
- [x] A user holding both roles resolves to the driver bar, on the stated reasoning that the driver side is where the time-sensitive work lives. The reasoning is left in the file as a comment, not just in the message.
- [x] Four new nav labels added to `messages/en.json` and `messages/fr.json` (+4/-1 each); FR/EN parity re-verified by key diff rather than inspection.
- [x] `CLAUDE.md` rewritten at +26/-23: Phase A functionally complete, Phase B (the Expedion bridge) wired in both directions, per-area test counts added (30 offers, 26 carrier KYC), and the old "`npx tsc --noEmit` does not pass yet" warning deleted in favour of a green gates block. The "Not done" section shrinks to a pointer at `plan_transport_only_refinement.md` WP11–WP16.
- [x] Note for whoever touches this next: the role-aware bar is only reachable if roles actually reach the client. That plumbing lands two commits later in `544287b` via the `customSession` plugin — until then `roles` is always `[]`, every user gets the shipper arm, and the driver arm is statically unreachable.

**Verification:** The commit records FR/EN locale parity re-verified by key diff. The gates figures are a claim the commit writes into CLAUDE.md rather than a run it reports: tsc 0 errors, lint 0 errors, 117 unit tests pass, build succeeds (104 pages).

**Known limits, recorded by the commit itself:**

- The driver arm cannot be exercised at this commit — roles do not reach the client until `544287b`.

---

## ✅ 2026-08-13 — Job Board Replaces The Auction Browse Surface (2.8.0)

`7e120f3` · feat · 17 files changed · *WP9: job board replacing the auction browse*

- [x] Deletes the auction browse: `ListingCard.tsx` (which rendered `currentBid`, a bid count and a hero image), `SearchBar.tsx`, `FilterSheet.tsx`, `useHome.ts` and `home/api/listings.api.ts` — 668 deleted lines. Adds `JobBoard.tsx` (231), `JobCard.tsx` (117) and `useJobBoard.ts` (82); `home/types.ts` reshaped (+40/-34). `home/page.tsx` is +5/-181, leaving a 13-line mount of `<JobBoard />` behind a `Suspense`.
- [x] `JobCard` leads on route, weight, date and pay, and deliberately does not render the description — the card is a scanning surface, not a summary.
- [x] Two markers on the card carry real product intent: closing within six hours (a lapsed bidding window is a lost job) and already-bid (so the board reads as a worklist).
- [x] `MapComponent.tsx` is the largest file in the commit at +249/-249 and is missing from any summary that only counts new files: it is retyped from `Listing` to the new `BoardJob`, pins each job at `pickupLng`/`pickupLat`, reads `listing.photos?.[0]?.url` instead of the old goods image, and gains a `prevListingsKey` ref so a refresh that returns the same spatial set does not re-fit the bounds and yank the user's viewport.
- [x] Escalated Expedion jobs render on identical terms to direct ones — the roadmap's "everything downstream is identical" made literal at the card level.
- [x] Filters follow the listing spec: budget band, category, and a max-weight filter framed as vehicle capacity rather than as a raw weight ceiling. Search is debounced and pagination keeps the previous page on screen.
- [x] `PublicProfile.tsx` is +12/-38: its listing mapper is gone. It was translating goods rows into the auction card shape, and the API now returns jobs directly.

**Verification:** Not recorded in the commit. No test file is touched.

---

## ✅ 2026-08-13 — Transport Categories, And The Goods Checkout Deleted (2.7.0)

`f430e14` · feat · 19 files changed · *WP8 + WP10: transport categories, and remove the goods checkout*

- [x] `src/db/seed.ts`: four of the five goods categories are replaced — `electronics`, `furniture`, `clothing` and `others` go, `vehicles` is the only one kept — leaving twelve transport verticals keyed on what is moved: `furniture_moving`, `appliances`, `pallets_freight`, `construction`, `vehicles`, `machinery`, `fragile_artwork`, `documents_parcels`, `refrigerated`, `bulk_goods`, `animals`, `other`.
- [x] Deletes the whole `src/features/app/checkout/` tree — `Checkout.tsx`, `StripePaymentSection.tsx`, `ShippingEstimate.tsx`, `PaymentMethodSelector.tsx`, `useCheckout.ts`, `useWonCheckout.ts`, `addresses.api.ts`, `types.ts` and the barrels — plus the three `/checkout` pages. 87 insertions against 1,730 deletions across 19 files.
- [x] Justification recorded in the message: there is no cart and no purchase in this product. Payment is authorised inside offer acceptance and captured on delivery, both of which already live in `payments.service.ts` and are covered by tests, so the checkout was a parallel money path with nothing behind it.
- [x] `PendingPaymentsWidget.tsx` and the payment mail in `email.service.ts` were repointed at the delivery instead of the removed checkout route; `src/proxy.ts` lost its checkout entry. Note for the next reader: the widget itself is deleted outright one commit later in `544287b`, so this repointing had a one-day life.
- [x] This is WP8 + WP10 of the plan added in `841f7e2`, taken together because the category reseed and the checkout deletion touch no common file.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-13 — Transport-Only Refinement Plan And Pivot Residue Audit (2.6.4)

`841f7e2` · infra · 1 file changed · *docs: plan for finishing the transport-only direction*

- [x] Adds `docs/plans/plan_transport_only_refinement.md` (199 insertions, the only file in the commit). Confirms the product direction in writing: no goods marketplace, and the only auction is carriers bidding down on a delivery order.
- [x] Audits what still carries the v1 model. The residue is vocabulary and dead surface rather than broken code, which is exactly why it survived the pivot: 35 files still say `seller`, 40 say `buyer`, the browse feature still renders an auction card with `currentBid`, the goods checkout is still present, and the category seed still offers Electronics and Clothing.
- [x] Nine work packages, numbered WP8 through WP16, sequenced so deletions happen before the domain rename — otherwise the rename lands on surfaces that are about to be removed. WP8+WP10 (`f430e14`), WP9 (`7e120f3`) and WP15 (`30af0ff`) are executed in the commits that follow; WP11–WP14 and WP16 are not.
- [x] The plan's own risk table is the useful part: WP13's rename touches ~75 files and names `tsc` as the gate rather than review, and the 12-category list in WP8 is flagged as a product decision — "a first cut for the client to edit", not a technical choice.
- [x] Raises a product question that blocks carrier onboarding copy: is the bidder a carrier company with employed drivers, or an individual driver? The plan recommends keeping the company model, since a sole trader is already expressible as a carrier with one driver and French road transport requires the company identifiers either way. Forward note for whoever reads this plan today: the repo went the other way later — `carriers` is now person-level and KBIS is not required.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- The company-vs-individual-driver question is left open and must be decided before the carrier onboarding screens harden their wording. The plan recommends the company model but does not settle it.

---

## ✅ 2026-08-13 — Settlement And Expedion Write-Back Wired Into shipment.service (2.6.3)

`9dc73b4` · fix · 1 file changed · *Close the money and bridge loops on the shipment lifecycle*

- [x] Two return legs were fully built but called from nowhere. Both are now wired in `src/server/services/shipment.service.ts` — the only file touched, and purely additive (+50/−0).
- [x] New module-level helper `settleDelivery(shipmentId, carrierId)` runs `paymentsService.captureForShipment` then `schedulePayout`, called from the `DELIVERED` branch of `updateStatus` **and** from the proof-of-delivery path — both places already flipped the listing to `completed`, so the two cannot diverge.
- [x] Settlement failures are caught and logged, never thrown: the goods genuinely arrived, and refusing to record that because Stripe was briefly unreachable is worse than a capture that needs re-running.
- [x] `cancel` now calls `paymentsService.releaseForShipment(shipmentId).catch(...)` before writing the cancellation — **release, not refund**, because the money was only ever held on an undelivered job.
- [x] New `reportToExpedion(listingId, shipmentStatus)` wraps `notifyExpedion(expedionBridgeService.onShipmentStatus(...))` and fires on assign (`ASSIGNED`), every status change, proof of delivery (`DELIVERED`) and cancel (`CANCELLED`). Not awaited by design — a bridge outage must not undo a delivery that happened — and a no-op for `direct` listings.
- [x] The bridge and its status mapping already existed; the gap was purely that the Expeditoo side never called them.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-13 — Listings Spec Tests, With The Bidding-Window Edges Pinned (2.6.2)

`0ee95f7` · infra · 1 file changed · *WP7b: listings spec tests*

- [x] `listings.service.test.ts` (349 lines), 25 tests over `docs/specs/transport_listing_spec.md`, bringing the suite to 117. The only file in the commit.
- [x] The bidding window gets the most coverage because its edge case is easy to get wrong: a job posted inside the 6-hour lead still gets a 30-minute window rather than publishing already closed, and one posted 10 minutes before pickup is refused outright rather than going live with no time to bid into.
- [x] The material / non-material edit split is asserted from both sides — description and budget leave live offers standing; weight and pickup window expire them and report how many — since that rule decides whether a carrier is left holding a quote for a job that changed underneath them.
- [x] A draft reports not-found rather than forbidden to a stranger, so an unpublished job does not leak its own existence.
- [x] The owner's own visits do not inflate the view count.

**Verification:** 25 tests, bringing the suite to 117.

---

## ✅ 2026-08-13 — Expiry Crons Wired, And The Cron Secret Fails Closed (2.6.1)

`88998c0` · infra · 4 files changed · *Wire the expiry crons both specs depend on*

- [x] The two jobs already existed as service methods with no caller. This commit is the wiring: `src/app/api/cron/expire-listings/route.ts` (34 lines) is a thin wrapper over `listingsService.expireDueListings()`, and `src/app/api/cron/carrier-documents/route.ts` (33) over `carrierService.processDocumentExpiry()`. Both set `dynamic = "force-dynamic"` and `maxDuration = 300`.
- [x] `expire-listings` closes jobs past their bidding window with no carrier selected, expires their pending offers and notifies the shipper. Its doc comment is explicit that it touches no payment — nothing was authorised on a job that was never awarded.
- [x] `carrier-documents` warns 30 days before a licence or insurance certificate lapses and suspends the carrier once a required one expires; suspension stops new bids while shipments already under way finish normally. Daily is enough resolution for a 30-day horizon.
- [x] New `src/lib/cron-auth.ts` (19 lines) → `isAuthorisedCron(req)` accepts either `Authorization: Bearer $CRON_SECRET` (how Vercel Cron calls) or `?secret=` (manual trigger), and **returns false when `CRON_SECRET` is unset** so a misconfigured deployment fails closed rather than leaving the endpoint open.
- [x] New `vercel.json` (21 lines) declares all four schedules: `expire-listings` `*/15 * * * *`, `carrier-documents` `0 6 * * *`, `expedion-escalate` `*/10 * * * *`, `cleanup-images?dryRun=false` `0 3 * * 0` — the last two previously had no declared cadence at all.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-13 — Carrier Bid Submission, My Offers And The Fleet Client Layer (2.6.0)

`aebc08d` · feat · 9 files changed · *WP5b: carrier-side UI - bid submission, my offers, fleet client layer*

- [x] New `offers/ui/SubmitOfferForm.tsx` (196 lines) and `offers/ui/MyOffers.tsx` (85). **Only one of them is routed**: `src/app/(app)/carrier/offers/page.tsx` (5 lines) renders `MyOffers`. `SubmitOfferForm` is exported from `offers/ui/index.ts` and imported by nothing — `git grep SubmitOfferForm` at this commit hits only its own file and the barrel.
- [x] Vehicles under the load's capacity render **disabled rather than filtered out** — a carrier who cannot find their van assumes the form is broken, not that it was filtered. The server re-checks capacity either way, so the UI state is a hint, not the gate.
- [x] Bidding above `budgetCents` warns rather than blocks: the budget is the shipper's expectation, not a cap.
- [x] `carrier/api/carrier.api.ts` (121) + `hooks/useCarrier.ts` (153) send KYC files through `FormData` **as the request body**, not a pre-uploaded URL, keeping identity documents off the public upload path; `viewDocument` reads them back only through the `{ url, expiresInSeconds }` signed URL the API issues. Same mounting gap: `useCarrier` is consumed only by `SubmitOfferForm` (for the vehicle list) and the barrels — there is no application screen.
- [x] Error codes are translated at the point the carrier can act on them — not approved yet, already bid, vehicle too small, pickup outside the window — instead of surfacing raw codes.
- [x] `offers.service.test.ts` adjusted alongside the client work (+6/−4).

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- The bid form is unreachable: `SubmitOfferForm` is exported but rendered by no page, so a driver still cannot place a bid through the UI after this commit.
- The carrier KYC client layer (`carrier.api.ts`, `useCarrier.ts`) has no screen either — the application, document upload and vehicle calls exist with nothing mounting them.

---

## ✅ 2026-08-13 — Spec Tests For The Offers Engine And Carrier Onboarding (2.5.1)

`9e432d8` · infra · 2 files changed · *WP7a: spec-required tests for the offers engine and carrier onboarding*

- [x] `offers.service.test.ts` (503 lines) + `carrier.service.test.ts` (221 lines): 56 new tests over the two specs carrying the most risk. The only two files in the commit.
- [x] Offer invariants pinned, not just the happy path: a bid above budget is accepted because the budget is not a cap; a suspended carrier cannot be awarded work even though its bid stands; the second concurrent accept loses on `acceptedOfferId` inside the lock; accepting twice returns the first shipment rather than minting a second; a failed authorisation compensates the award.
- [x] The viewer matrix is asserted in all four scopes, including that a non-participant's response carries no `offers` key at all — absence, not an empty array.
- [x] SIRET Luhn doubles **even** indices, not odd: at 14 digits, "every second from the right" lands on the opposite parity from the 9-digit SIREN, which is the usual way this is implemented wrongly. Checksums are pinned against known-good French identifiers and their single-character corruptions.
- [x] The KYC submission gate is tested for the property the spec insists on — it returns every gap at once, not the first — plus the 7.5t transport-licence rule in both directions.

**Verification:** 56 new tests; full suite 92 passing; the production build succeeds.

---

## ✅ 2026-08-13 — Hold-And-Release Payments, And Typecheck Green Across The Pivot (2.5.0)

`56e8c01` · feat · 32 files changed · *WP6 + cleanup: payments hold-and-release, typecheck green across the repo*

- [x] New `src/server/services/payments.service.ts` (278 lines): `authoriseForShipment` creates a `capture_method: "manual"` PaymentIntent, `PaymentError` carries `code`/`status`, `COMMISSION_RATE = 0.1` with `commissionFor()`, `transferGroup = shipment_<id>`, and a null `stripeCustomerId` throws `PAYMENT_METHOD_REQUIRED` (402). `captureForShipment` no-ops on an already-captured payment, `releaseForShipment` no-ops on an already-released one and throws `PAYMENT_ALREADY_CAPTURED` rather than cancelling a captured charge — double-charging and cancelling captured money are the two ways this goes badly wrong.
- [x] Stripe is called after the award transaction commits, never inside it: an HTTP call holding a row lock would block every other accept on that listing. A failure calls `compensateFailedAward` in `offers.service.ts` so the job returns to the board with its bids intact.
- [x] Split-transfer logic removed from `stripe.service.ts` (−69/+20): `processSplitTransfers` (seller cut + driver cut off `paymentIntent.metadata.orderId`) becomes `recordCarrierPayout`, which reads `metadata.shipmentId` and calls `schedulePayout`. The webhook branch that reached it was dead anyway — it gated on `paymentIntent.status === "captured"`, a status Stripe never emits — and that guard is gone.
- [x] **Losing bidders are notified in-app, not by email.** `notifyAwardOutcome` in `offers.service.ts` (+62/−1) writes `offer_accepted` to the winner and `offer_rejected` to each rejected bidder through `notificationsService`, each `.catch`-ed so a notification failure cannot fail the award. `email.service.ts`'s 536-line churn is the **opposite** change: CRLF normalisation plus the deletion of `sendAuctionWinEmail`, `sendAuctionEndedSellerEmail`, `sendAuctionLostEmail` and `sendItemPaidSellerEmail`. No email method was added.
- [x] `messages/en.json` / `messages/fr.json` rewritten — EN missing 3 keys, FR missing 57, and the dead `auction` / `bids` namespaces dropped from both. The currency fix is separate and is not a translation key: the `payments.currency` column defaulted to `idr`, and the new service writes `currency: "eur"` explicitly on every payment and payout row.
- [x] More goods-era leftovers go with it: the `seller/[id]` route is deleted, `PRICE_PROPOSED` is dropped from `VALID_STATUS_TRANSITIONS` and `getStatusLabel` so `PENDING → ASSIGNED` is direct, `CreateReviewModal` switches from `targetUserId`/`listingId` to a required `shipmentId`, and the Stripe `apiVersion` pin is removed so the SDK uses the version it was built against.
- [x] `vitest.config.ts` gains a stub `POSTGRES_URL` so the suite that imported `@/db` could load at all. **The reviews-DAL count/filter fix the commit body also claims is not in this diff** — no reviews DAL file is touched; the only review-shaped file changed is `CreateReviewModal.tsx`.

**Verification:** npx tsc --noEmit passes with 0 errors, down from 315 at the start of the pivot; pnpm lint clean; all 36 unit tests pass.

**Known limits, recorded by the commit itself:**

- `executePayout` is written but documented as Phase C — it only runs once Connect onboarding is live, so payouts stop at `scheduled`.

---

## ✅ 2026-08-13 — Transport Job Form, Offer Comparison And The Typed Fetcher (2.4.0)

`47e8308` · feat · 54 files changed · *WP5: transport job form, job detail with offer comparison, typed client layer*

- [x] `create/ui/Create.tsx` (865 lines) is replaced by `JobForm.tsx` (406) + `hooks/useJobForm.tsx` (110); `create/schemas.ts` is rebuilt around `jobFormSchema` with a `STEP_FIELDS` table so Next only gates on what is on screen, and `endpointSchema.superRefine` makes floor + lift required for `locationType === "apartment"`.
- [x] `listing/ui/ListingDetail.tsx` → `JobDetail.tsx` (302) plus a new `OfferCard.tsx` (133); the card renders whatever the API returned and marks the lowest bid without selecting it, and treats `priceCents > budgetCents` as normal (shows the delta) rather than an error. Scope is decided by the service per viewer, so a non-participant is never sent offers for the component to hide.
- [x] New `src/lib/fetcher.ts` (85 lines) unwraps the `src/lib/api-response.ts` envelope once and throws `ApiError` carrying `code`, `status` and `issues`. `useJobDetail.ts` branches on exactly two of them today — `LISTING_ALREADY_AWARDED` and `PAYMENT_METHOD_REQUIRED`; the capacity code the commit message also names is translated on the carrier side, which lands in `aebc08d`.
- [x] 17 files deleted, 2,910 lines (verified against `--diff-filter=D`). The goods-marketplace client surface is 11 of them — `AIPriceRecommendationCard.tsx`, `useAIPriceRecommendation.ts`, `PurchaseSlipUploader.tsx`, `useAISlipProcessor.ts`, `ai.api.ts`, `slip.api.ts`, `price-recommendation.api.ts`, `createListing.ts`, `create/api/listings.api.ts`, `useCreateForm.tsx`, `profile/ui/SellerProfile.tsx`. The rest are replacements (`Create.tsx`, `ListingDetail.tsx`, `useListingDetail.ts`, `create/types.ts`), plus `become-driver/page.tsx` and `api/listings/public/route.ts`.
- [x] Route reshuffle, and it is not uniform: `/api/listings/[id]` goes 240 → 57 lines (−213/+30) with the boilerplate replaced by `ok`/`handleError` and the work pushed behind `listingsService`; `GET /api/listings` becomes the public browse (it previously required a session and returned the caller's own listings), which is what makes `/api/listings/public` redundant enough to delete; new `GET /api/listings/me` (session required, optional `status` enum) with `/api/users/me/listings` reduced to an alias of it.
- [x] **Two routes moved the wrong way and now break the repo's own layering rule.** `/api/admin/listings` and `/api/users/[id]/listings` were rewritten to call `listingsDal.browse` / `listingsDal.getByShipperId` **directly from the route handler**, skipping the service layer that `docs/rules.md` makes mandatory. `/api/admin/listings` also inlines its own `viewer.isAdmin || viewer.isOperator` check in the handler.
- [x] New client-API modules `create/api/jobs.api.ts`, `listing/api/listings.api.ts`, `offers/api/offers.api.ts` and hooks `useJobDetail.ts`, `useCarrierOffers.ts` replace the old per-screen fetch code.
- [x] `payments.dal.ts`, `image-cleanup.service.ts`, `invoices.service.ts` and `api/admin/payments/route.ts` look enormous in the stat (262/418/336/138 lines) but are **CRLF→LF normalisation** carrying exactly one real edit each: the payment status union `succeeded` → `captured`, `listingImages` → `photos`, `payment.amount` → `payment.amountCents`, and `payments.amount` → `payments.amountCents`.

**Verification:** Not recorded in the commit.

---

## ✅ 2026-08-13 — Carrier KYC Routes, Reviews Retargeted To Shipments, Admin KPIs Remodelled (2.3.0)

`bd61b89` · feat · 27 files changed · *WP4b: carrier KYC routes, reviews retargeted, admin KPIs on the new model*

- [x] Twelve new routes give carrier onboarding its REST surface: `/api/carrier/application` (+ `/submit`, `/withdraw`), `/api/carrier/banking`, `/api/carrier/documents[/id]`, `/api/carrier/vehicles[/id]`, and `/api/admin/carrier-applications[/id]/approve|reject` plus `/api/admin/carriers/[id]/suspend`.
- [x] The driver-application layer is **replaced rather than duplicated**, as the plan called for: `/api/driver/apply`, the four `/api/admin/driver-applications/*` routes, `driver.service.ts` (+ its test) and `driver.dal.ts` are all deleted.
- [x] `kyc-storage.service.ts` (+85): documents are written under a private prefix and read only through a **five-minute presigned URL issued after the caller is authorised**, so an identity document never has a stable public URL. Uploads take the file directly instead of a pre-uploaded URL, which keeps KYC off the public upload route entirely.
- [x] `reviews.service.ts` rewritten (354 lines changed, net shrink): a review hangs off a **shipment**, only its two parties may write one, only once, and only after it was actually delivered. The listing is derived server-side so the two cannot disagree. Ratings are denormalised onto both the user and the carrier company.
- [x] `admin.dal.ts` KPIs move off the goods model: GMV is delivered transport value, platform revenue is the commission on captured payments.
- [x] **Latent bug fixed in `reviews.dal.ts`**: the total count ignored the filter applied to the page it was counting, so pagination over a filtered review list was wrong.
- [x] 27 files, 665 insertions against 806 deletions — the replacement surface is smaller than what it replaced.

**Verification:** Not recorded in the commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-13 — Carrier KYC, Shipment Execution Layer — And, Unannounced, The Whole Expedion Bridge (2.2.0)

`85cd3bc` · feat · 55 files changed · *WP4: carrier KYC, shipment execution layer, French identifier validators*

- [x] `carrier.service.ts` (+388) / `carrier.dto.ts` (+129) implement `docs/specs/carrier_kyc_spec.md`: the submission gate collects **every** gap in one pass; approval grants the `carrier` role and is idempotent; banking input is validated then reduced to last-4 of IBAN and BIC before it touches the database ("the full value is Stripe's to hold, not ours").
- [x] `src/lib/french-identifiers.ts` (+65): SIRET (Luhn), IBAN (**mod-97 in chunks, because the value overflows `Number`**), BIC, plate, phone. Checksums reject typos, not unregistered companies.
- [x] Shipments become the execution record: `shipment.service.ts` (1042 lines changed) and `shipments.dal.ts` (904) drop the proposal methods `offers` replaced; the service owns the status machine, the carrier/driver/shipper party rules, and **strips commercial terms for drivers at the service boundary** — "hiding a field in a component still ships it over the wire". Six shipment routes rewritten; the three `/api/shipments/[id]/proposals*` routes (406 lines) deleted. `viewer.service.ts` (+24) resolves roles per request so a revoked role bites immediately.
- [x] **The subject badly undersells the diff.** It also lands the entire Expedion bridge with no mention: `src/db/schema/expedion.ts` (+289) and hand-written `0001_expedion_quotes.sql` (`expedion_quotes` + `expedion_quote_events`, carrying `firebase_uid`, `escalate_after`, `escalated_at`, `listing_id`, `assigned_carrier_id`, `airtable_record_id`), 8 `/api/expedion/*` routes, `/api/cron/expedion-escalate`, `expedion.dal.ts`, `expedion.dto.ts`, and five services: `expedion.service.ts` (+523), `expedion-escalation.service.ts` (+318), `expedion-bridge.service.ts` (+187), `expedion-extraction.service.ts` (+424), `expedion-sms.service.ts` (+172).
- [x] Escalation policy is fixed in code in `expedion-escalation.service.ts`: `PICKUP_LEAD_DAYS 2` / `PICKUP_WINDOW_DAYS 7` / `DROPOFF_LEAD_DAYS 3` / `DROPOFF_WINDOW_DAYS 14`. The auction house maps to location type `other` because it is not one of the 13 and anything apartment-shaped would demand the floor/lift fields and reject the listing. Escalated listings are owned by `EXPEDION_SYSTEM_USER_ID` (503 `EXPEDION_SYSTEM_USER_UNSET` if absent) because the Expedion buyer has no Better Auth identity while Expedion stays on Firebase.
- [x] `src/lib/expedion-auth.ts` (+101): shared bearer key plus an `x-expedion-uid` header, constant-time compare, **fails closed** when `EXPEDION_API_KEY` is unset. Admin operations take a *separate* key so a leaked client key cannot reprice or reassign a job.
- [x] `expedion-extraction.service.ts` reads the bordereau with GPT-4.1 Vision under a strict JSON schema — one call, PDF and JPEG handled identically — with Gemini 2.5 Pro as fallback; low `confidence` highlights fields rather than failing the request. `expedion-sms.service.ts` calls Twilio over REST rather than the SDK (one authenticated POST does not justify a dependency in the serverless cold path), on three moments: devis ready, driver assigned, status moved.
- [x] `src/scripts/import-airtable-quotes.ts` (+403): one-time Airtable -> Postgres import, **dry run by default** (`--commit` to write), idempotent on the unique `airtable_record_id`, non-lossy via the `airtable_fields` jsonb, verifies counts and exits non-zero on mismatch. Deleted on the way past: the whole `src/features/app/earnings` feature and `/api/earnings*`, `src/db/clean.ts`, `testing/scripts/e2e-bid-pay.spec.ts`, and six service test suites (listings, shipment, stripe, reviews, earnings, transporters) that covered the deleted v1 shapes.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- `EXPEDION_API_KEY` authenticates the Expedion *app*, not the end user — any holder of the key can claim any Firebase UID. The code says this is acceptable only while the key lives in a server-side build, and that Expedion's calls must be routed through its own server (or the Firebase -> Better Auth migration finished) before any web client sees it.
- Bordereau extraction is never trusted on its own: the client must sign off on a confirm-details screen before the quote is priced.
- Every SMS is best-effort — a failed send must never fail the operation that triggered it.
- The auction house is mapped to location type `other` because it is not one of the 13; the code notes that guessing wrong changes what carriers quote.
- Six service test suites were deleted along with the v1 shapes they covered, and are not replaced in this commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-13 — CLAUDE.md Rewritten For The v2.0 Transport Product (2.1.1)

`3ffa7ed` · infra · 1 file changed · *docs: rewrite CLAUDE.md for the v2.0 product*

- [x] Single file, 116 insertions against 401 deletions — a net cut of 285 lines.
- [x] The old file described a goods-auction marketplace and claimed the backend was not implemented. Both were false after WP1–WP3, and both would have misdirected any future session reading it as ground truth.
- [x] Now describes the reverse-bidding transport product, the actual data model and the seven roles.
- [x] Records an honest Phase A status, explicitly including that `tsc` does not yet pass and which files the remaining errors live in — the same "what is and is not delivered" discipline the current "Where Things Stand" section still follows.

**Verification:** The commit records that tsc does not yet pass and names the files where the remaining errors live. No test, lint or build result is claimed.

**Known limits, recorded by the commit itself:**

- `npx tsc --noEmit` does not pass at this commit; the rewritten CLAUDE.md names the files holding the remaining type errors.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-13 — Listings And Offers Server Layer (WP3) (2.1.0)

`f12971f` · feat · 11 files changed · *WP3: listings and offers server layer*

- [x] Implements `docs/specs/offers_engine_spec.md` and `docs/specs/transport_listing_spec.md` along the DTO -> DAL -> Service -> Route boundary in `docs/rules.md`. New `offers.service.ts` (+343); `listings.service.ts`, `listings.dal.ts` and `listings.dto.ts` rewritten (net shrink of ~700 lines across the three).
- [x] New routes: `GET/POST /api/listings/[id]/offers`, `POST /api/offers/[id]/accept`, `POST /api/offers/[id]/withdraw`, `GET /api/carrier/offers`.
- [x] Accept path locks the listing row and **re-checks `status` and `acceptedOfferId` inside the lock**, so two simultaneous accepts cannot both win the job.
- [x] Stripe is called **after** the commit rather than inside it, with a compensating transaction that returns the job to the marketplace with every bid intact if authorisation fails.
- [x] Accept is idempotent: re-accepting an offer that already won returns the existing shipment instead of creating a second one.
- [x] Offer visibility is computed per viewer **in the service**, not left to the UI — shipper sees every bid, carrier sees only its own, everyone else gets a count and a lowest price.
- [x] `src/lib/api-response.ts` (new, +52) is the one place routes translate service error codes into responses.
- [x] Vehicle-capacity and pickup-window checks now run where the listing and vehicle rows are available, not against the input alone. `notifications.dto.ts` gains `linkUrl` (the column already had it) and its type enum drops `bid` for `offer`.

**Verification:** Not recorded in the commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-13 — Schema Remodelled To Transport; Goods-Auction Surface Deleted (2.0.2)

`9c346fc` · infra · 90 files changed · *WP1+WP2: remodel schema to the transport marketplace, strip goods auctions*

- [x] 90 files, 5,661 insertions against 30,437 deletions — this commit is mostly a demolition. Schema now matches the entity list in `ROADMAP.md` §5.
- [x] `listings` becomes the transport job (what/where/when/budget, 13 location types) and gains `origin` + `external_ref`, described here as the columns the Phase B Expedion bridge will use.
- [x] `src/db/schema/offers.ts` (new) replaces `bids`: a carrier's competing quote carrying the vehicle that will do it. A **partial** unique index allows one *live* offer per carrier per job while still letting a withdrawn offer be replaced.
- [x] `src/db/schema/carriers.ts` (+290: `carriers`/`vehicles`/`carrier_documents`) replaces `transporter_profiles`, whose single JSONB vehicle column could not express a fleet.
- [x] `shipments` become the execution record created on acceptance — proposals move to `offers`, and the pre-award states leave the status enum. `payments` gain hold-and-release states plus commission; `payouts` added; `user_role` expands to the seven roles from `docs/specs/roles_spec.md`.
- [x] Fixed in passing: `payments.currency` defaulted to `idr` on a France-only product; now `eur`.
- [x] Deleted goods-auction surface: `src/features/app/auction/*` (AuctionDetail 855 lines, MyBids 365, AutoBidDialog 148), `WonCheckout.tsx` (552), `MyAuctions.tsx` (583), the `auctions`/`bids`/`orders`/`earnings`/`transporters` DAL+service+DTO layers with their tests, `/api/cron/close-auctions`, and four auction email templates.
- [x] **Migrations regenerated from scratch into one initial migration** (`0000_old_slayback.sql`, 506 lines): the old `0000`–`0009` and all nine meta snapshots are deleted, per the greenfield decision recorded in the plan.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- Migrations were collapsed into a single fresh initial migration, so there is no upgrade path for any database already carrying the v1 goods schema — an explicit greenfield decision from the plan.
- `listings.origin` and `listings.external_ref` are created here but nothing writes them yet; the commit describes them only as what the Phase B bridge will use.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-13 — SDD Plan And Four Specs For Phase A Bidding Core (2.0.1)

`93c20af` · infra · 5 files changed · *docs: SDD plan and specs for Phase A bidding core*

- [x] Docs only — 5 files, 1,031 insertions, no code. Written to satisfy the mandatory spec-driven workflow in CLAUDE.md: plan and spec before implementation.
- [x] `docs/plans/plan_phase_a_bidding_core.md` (245 lines) maps the existing goods-auction model onto the ROADMAP v2.0 transport model and sequences the pivot into 7 work packages — the WP1..WP7 subjects of the commits that follow.
- [x] `docs/specs/offers_engine_spec.md` (252) is the reverse-bidding contract: the atomic accept transaction, its concurrency guarantee, and Stripe compensation. Implemented in `f12971f`.
- [x] `docs/specs/transport_listing_spec.md` (178): the job entity, the 13 location types, and the material vs non-material edit rule that invalidates live offers.
- [x] `docs/specs/roles_spec.md` (140) resolves the roadmap's undefined "5 -> 7 user types" into seven named roles with a full permission matrix — this is where the seven-role list that becomes `userRoleEnum` is decided.
- [x] `docs/specs/carrier_kyc_spec.md` (216): manual approval flow, plus the two standing rules that KYC documents stay private and full IBANs are never persisted. Implemented across `85cd3bc` and `bd61b89`.

**Verification:** Not recorded in the commit.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---

## ✅ 2026-08-13 — Baseline Snapshot Before The v2.0 Transport Pivot (2.0.0)

`1e3de15` · infra · 841 files changed · *Baseline: expeditoo-ship at start of v2.0 pivot*

- [x] Initial snapshot of the whole repo at the start of the pivot: 841 files, 139,641 insertions, zero deletions. Its stated purpose is to be the restore point Phase A rewinds to when it strips the goods-auction modules.
- [x] Project identity renamed to `expeditoo-ship`; "Auctions" dropped from the app title, the PWA manifest and its shortcuts. `src/app/manifest.ts` already carries `short_name: 'Expeditoo'` and the transport description ("Post a transport job, compare competing carrier offers, pick your carrier and track the delivery").
- [x] Everything else in the tree is still v1 goods-auction: `src/db/schema/auctions.ts`, `orders.ts`, `transporters.ts`, `earnings.ts`, the `src/features/app/auction/*` feature, `WonCheckout.tsx`, the `close-auctions` cron, and ten drizzle migrations `0000`–`0009` with their meta snapshots. All of it is deleted two commits later in `9c346fc`.
- [x] `ROADMAP.md`, `CLAUDE.md` and `GEMINI.md` all land here describing the v1 product; `CLAUDE.md` is rewritten for v2 in `3ffa7ed`.
- [x] `.prettierc` enters the tree with that exact filename — missing the `r` that would make Prettier load it. Still true in the repo today.

**Verification:** Not recorded in the commit.

**Known limits, recorded by the commit itself:**

- This is a restore point, not a change: the goods-auction marketplace is still fully present and functional. Only the project identity and title were renamed.

> Backfilled entry: drafted from the commit and its diff, but not put
> through the second adversarial verification pass the other entries had.

---
