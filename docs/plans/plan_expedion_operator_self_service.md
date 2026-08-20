# Plan — Expedion Operator Self-Service (closing the "Escalation blocked" gap)

**Status:** Proposed
**Roadmap ref:** `ROADMAP.md` §5, §9 (Expedion bridge) · extends the operator report shipped in
`plan_transport_only_refinement.md` and the commits that turned it into a worklist
**Date:** 2026-08-20

---

## 1. What "Escalation blocked" actually means

`/admin/expedion` → **Recent quotes** is `RecentQuotesPanel`
([RecentQuotesPanel.tsx](src/features/app/admin/expedion/ui/RecentQuotesPanel.tsx)). Its badge and
button both come from one function,
[`nextAction()`](src/features/app/admin/expedion/lib/quote-action.ts#L85):

```
queues.escalationDue && !escalationReady  →  badge "Escalation blocked", button disabled
```

`escalationReady` mirrors
[`escalationBlockers()`](src/server/services/expedion-escalation.service.ts#L126) — the same ten
checks run again, server-side, the instant an admin tries to publish:

| # | Blocker | Column(s) |
|---|---|---|
| 1 | Pickup coordinates | `pickup_lat`, `pickup_lng` |
| 2 | Delivery coordinates | `delivery_lat`, `delivery_lng` |
| 3 | Pickup address | `pickup_address` |
| 4 | Pickup city | `pickup_city` |
| 5 | Pickup postal code (5 digits) | `pickup_postal_code` |
| 6 | Delivery address | `delivery_address` |
| 7 | Delivery city | `delivery_city` |
| 8 | Delivery postal code (5 digits) | `delivery_postal_code` |
| 9 | Weight | `weight_kg` |
| 10 | Accepted price | `accepted_price_cents` |

A quote lands here when its 48h escalation clock (`escalateAfter`) has expired with no driver
assigned, **and** at least one of the above is still empty — overwhelmingly rows imported from
Airtable (`firebase_uid like 'airtable:%'`), which never went through the Flutter app's
confirm-details screen that normally fills these columns and geocodes the two addresses.

**The badge is correct. The dashboard just stops there.**

## 2. Why an operator can't finish the job today

Everything downstream of that badge is read-only or out of scope for admin:

- The **Publish button is disabled**, so the row can't even be clicked to surface the server's own
  `ESCALATION_INCOMPLETE` message (which *does* name the missing fields — see
  [useExpedionEscalate](src/features/app/admin/expedion/hooks/useExpedionReport.ts#L124) — it's just
  unreachable while the button is `disabled`).
- The badge and the row's overflow menu never say **which** of the ten checks failed — same red
  "Escalation blocked" / "not ready" whether it's one missing digit of a postal code or the entire
  delivery leg.
- **`QuoteDetailDialog`** ([QuoteDetailDialog.tsx](src/features/app/admin/expedion/ui/QuoteDetailDialog.tsx))
  — the only place an operator can see the full quote, coordinates included — is display-only. No
  form, no edit button.
- **`adminUpdateExpedionQuoteSchema`** ([expedion.dto.ts:149](src/server/dto/expedion.dto.ts#L149)),
  the only admin write path, covers price, status, carrier and storage dates — **none of the ten
  blocker fields**. Address, coordinates and weight are only writable through
  `updateExpedionQuoteSchema`, which is the *client's own* confirm-details endpoint. For an
  Airtable-imported row there is no client account to do that with — `owned: false` means nobody
  can ever reach that screen.
- The one component in the codebase that already solves "correct an address and get coordinates
  for it" — [`AddressForm.tsx`](src/features/app/profile/ui/AddressForm.tsx), Nominatim search +
  draggable pin + reverse geocode, built for the user's profile addresses — has no admin
  equivalent pointed at a quote.

Net effect: today, unblocking one of these rows means opening a database client and hand-editing
`expedion_quotes`. That is precisely the "code solving" the request asks to eliminate.

## 3. The same dead end, elsewhere on the page

Auditing the rest of `/admin/expedion` for the same pattern — a badge or KPI that names a problem
with no click-through to fix it:

| Where | What it shows | Why it's a dead end |
|---|---|---|
| **Data quality** panel — `health.missingCoords`, `health.missingDims` ([ExpedionDashboard.tsx:392](src/features/app/admin/expedion/ui/ExpedionDashboard.tsx#L392)) | "N quotes without pickup coordinates — blocks escalation" | Plain stat tiles, no `onClick`/`href` at all — the dashboard counts the exact problem in §1 and stops. |
| **`health.unowned`** hint | "imported from Airtable, invisible to clients until claimed" | No "claim" flow exists anywhere in the codebase (checked — the only `claim` hit is unrelated driver-shipment code). The copy promises a resolution path that was never built, for either the client or the admin. |
| **Storage queue** — `kind: "storage"` in `nextAction()` | Badge only, `dialog: null` | `storageFreeUntil` and `storageDailyFeeCents` **are already** in `adminUpdateExpedionQuoteSchema` — the write path exists — but no dialog was ever built to use it, so extending a grace period or waiving a fee still means a direct PATCH. |
| **Escalation cron** ([expedion-escalate/route.ts](src/app/api/cron/expedion-escalate/route.ts)) | Runs every sweep, silently re-skips blocked rows forever | A quote can sit blocked indefinitely with nothing but the badge — no digest, no alert — surfacing that it needs a human. |

Everything else on the page — repricing (`RepriceDialog`), driver assignment (`AssignDriverDialog`),
and publish-when-ready (`EscalateDialog`) — is already a real, working self-service loop. The gap is
specific: **the ten escalation-blocker fields, plus storage terms, have no admin write surface.**

## 4. Design direction

Reuse what already exists rather than invent new patterns:

1. **Name the specific blockers on the row**, not just "blocked" — cheap, server already computes
   this per-row (`ESCALATION_READY` in `expedion-report.dal.ts` is one SQL boolean; splitting it
   into named sub-checks costs nothing extra at query time).
2. **One combined "Fix & Publish" dialog**, opened from the row whenever it's blocked, replacing the
   disabled button. It reuses `AddressForm`'s exact mechanism (Nominatim search, draggable pin,
   reverse geocode) for the pickup and delivery legs, plus plain inputs for weight and accepted
   price (mirroring `RepriceDialog`'s euros-typed/cents-stored pattern) — pre-filled with whatever
   the row already has, empty only where a blocker exists. Saving resolves the coordinates
   *before* they reach the server (same as the profile address form), so `adminUpdate` never has to
   guess at geocoding on the server side.
3. **Extend `adminUpdateExpedionQuoteSchema` and `expedionService.adminUpdate`** with the ten
   fields, following the same patch semantics already documented there (absent = untouched, `null`
   = clear).
4. **Turn the two "Data quality" tiles into links** into the same "To handle" worklist, pre-filtered
   to the rows each tile is counting — the number and the fix become one click apart instead of
   two disconnected facts on the same page.
5. **A small `StorageDialog`**, wired to fields that already accept writes, closing that gap without
   any backend change.
6. Drop or rewrite the `health.unownedHint` "claimed" copy to match what's actually possible today
   (admin can now fix and publish it directly; nothing "claims" it), unless a real claim flow is
   wanted — see the open decision in §6.

## 5. Work packages

**WP1 — Name the blockers (small, no schema change)**
- `expedion-report.dal.ts`: split `ESCALATION_READY` into per-check SQL booleans (or a single
  `escalation_blockers` array via `array_remove(array[...], null)`); add to `QUOTE_COLUMNS` /
  `QuoteRow`.
- `quote-action.ts`: carry the blocker list through `QuoteAction`.
- `RecentQuotesPanel.tsx` / `QuoteQueueTable.tsx`: render it — a tooltip or an inline chip list
  ("missing: pickup coordinates, weight") instead of the flat "not ready" badge.
- New strings under `admin.expedion.table.blockers.*` (FR + EN).

**WP2 — Admin write path for the ten blocker fields**
- `expedion.dto.ts`: extend `adminUpdateExpedionQuoteSchema` with pickup/delivery
  address+city+postal+lat+lng, `weightKg`, `acceptedPriceCents` — same nullish/patch convention as
  the existing fields.
- `expedion.service.ts`: `adminUpdate` accepts them; no server-side geocoding needed given §4.2,
  but validate postal codes server-side the same way `escalationBlockers` does, so a malformed
  save can't silently stay blocked.
- Route + DAL already generic enough to need no change beyond the schema.

**WP3 — "Fix & Publish" dialog**
- New `FixEscalationDialog.tsx`, modeled on `AddressForm.tsx` (map, search, pin) for the two legs,
  plus weight/price inputs, replacing `EscalateDialog` as the button's target whenever the row is
  blocked. `EscalateDialog` stays as-is for the already-ready case.
- On save: PATCH via WP2, then immediately call the existing escalate mutation — one operator
  action, not two round trips.
- Wire into both `RecentQuotesPanel` and `QuoteQueueTable` (escalation queue).

**WP4 — Data-quality tiles become entry points**
- `ExpedionDashboard.tsx`: `health.missingCoords` / `health.missingDims` tiles become links (or
  buttons) into the report's "To handle" view, filtered to the matching rows — reuses the
  existing `todo`/`all` tab and search/date-range filtering already built into `RecentQuotesPanel`.

**WP5 — Storage terms dialog**
- New `StorageDialog.tsx`, same shape as `RepriceDialog.tsx`, patching `storageFreeUntil` /
  `storageDailyFeeCents` — no backend change, wired from the `storage` queue's now-null `dialog`.

**WP6 — Copy correction + stale-block visibility**
- Fix or scope down `health.unownedHint`'s "claimed" promise (§6).
- Optional: cron sweep logs (or the report itself) surface *how long* a row has sat blocked past
  its deadline, so it ages into visible urgency rather than looking identical on day 1 and day 30.

## 6. Decisions (confirmed 2026-08-20)

1. **Admin-only.** No client "claim" flow. Scope stays WP1–WP5; `health.unownedHint`'s "invisible
   to clients until claimed" copy gets rewritten in WP6 to describe what's actually true after this
   ships — an admin can fix and publish these rows directly, nothing "claims" them.
2. **Combined save & publish.** `FixEscalationDialog` (WP3) saves the corrected fields and calls
   the escalate mutation in the same action — no separate confirmation step.

## 7. Out of scope

- Real Stripe hold/capture, the Expedion `paid` webhook, and commission-split policy — all called
  out as separately open in `CLAUDE.md` §"Where Things Stand" and untouched by this plan.
- Bulk/CSV remediation tooling for the Airtable backlog — worth a follow-up if the blocked count is
  large, but WP1–WP3 already make the per-row fix fast enough to judge that need afterward rather
  than guessing now.
