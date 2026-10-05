# Plan — « Prendre cette course » on escalated jobs only

Feedback item 12, 2026-10-04: _"it's approved, go ahead with your
suggestion"_. The suggestion on record is the one 2.59.0 left as a question
for the client (`STATUS.md` → Known limits): restrict taking a job at its
budget to Expedion jobs. The owner confirmed that reading, and accepted that a
driver can then tell an escalated job by the panel being there.

Contract: `docs/specs/take_job_spec.md`.

## Steps

1. **Service** — `src/server/services/offers.service.ts`:
   - `takeJob`: after `assertListingOpen`, before `submitOffer`, throw
     `TAKE_NOT_AVAILABLE` (409) when `listing.origin !== "expedion"`.
   - `acceptOffer`: `isSelfAward` also requires `listing.origin ===
     "expedion"`, so the flag on a direct job falls through to
     `FORBIDDEN_NOT_SHIPPER`.
   - Doc comments on both.
2. **Route** — `src/app/api/listings/[id]/take/route.ts`: doc comment only.
   `handleError` already maps every `OfferError`.
3. **UI** — `JobBidSection.tsx` renders `TakeJobPanel` only when
   `job.origin === "expedion"`; `SubmitOfferForm` is unchanged.
   `useCarrierOffers.ts` `useTakeJob` names `TAKE_NOT_AVAILABLE`.
4. **Copy** — `i18n.patch.json` for the integrator, FR + EN:
   `listing.bid.errors.TAKE_NOT_AVAILABLE` (new); `create.budget.hint`,
   `create.success.next.choose`, `create.success.next.pay` lose what 2.59.0
   added about direct takes.
5. **Specs amended** — `request_posted_page_spec.md` §3 (the authority table)
   and §4 (`next.choose`, `next.pay`); `pay_at_accept_spec.md` §2 and §3.3 (the
   off-session saved-card branch is now reachable only through the API);
   `offer_time_slots_spec.md` §3.4 (escalated jobs only).
6. **Tests** per the spec's §9: `offers.service.test.ts` (the `takeJob`
   describe runs on an escalated listing with no operator role in play; a
   direct take and a direct self-award are refused) and a new
   `JobBidSection.test.tsx`.

## Dependencies

- **The copy and the guard ship together.** The hint and the thank-you page
  render only for `/create` jobs, which are always `direct`; either half alone
  makes one of them false.
- No migration, no new route, no env var, no Stripe change. No change to the
  Flutter `expedion_encheres` client, which has no `/take` caller.
- Release bookkeeping (`CHANGELOG.md`, `STATUS.md`, `package.json`,
  `src/lib/version.ts`, the `CLAUDE.md` gotcha on who chooses) belongs to the
  2.60.0 integrator, as does ticking question (1) of the 2.59.0 operator to-do.
