# Plan: "Mes gains" shows something useful when there is nothing to show

## Why

`/carrier/withdrawals` rendered "Earnings unavailable" — the error state, with a
retry that could never succeed. The cause was not the code: the database was
five migrations behind, so `withdrawals` did not exist and every
`GET /api/carrier/withdrawals` threw. See §"Database" below; that half is an
environment fix, not a code change.

Underneath it sits a second problem the error state was hiding. Once the query
succeeds, a driver who has earned nothing gets a card reading `€0.00`, "From no
deliveries", and a greyed-out "Request a withdrawal" button. That is a dead end:
it states a fact and offers no way to change it. The screen should say why the
balance is empty and point at the one action that fills it.

## Steps

1. **Bring the dev database up to date.** `pnpm db:migrate` — it was stopped at
   `0005`, missing `0006`…`0012` including `withdrawals` and
   `payouts.withdrawal_id`.
2. **Widen the balance payload** so the screen can tell the two empty cases
   apart. `withdrawalsService.getBalance` gains `hasEverEarned` (has any payout
   row ever existed for this user) and `carrierStatus` (their application state,
   or `null` if they never applied).
   - `withdrawalsDal.hasAnyPayout` — one `exists`, not a count.
   - `carriersDal.getByUserId` for the status; nothing new in the DAL.
3. **Add the empty state to `WithdrawalPanel`**, between the error branch and
   the balance card. Four lanes keyed off `carrierStatus`, because the advice is
   only useful if it is the advice that applies to this driver:
   | status | says | goes to |
   |---|---|---|
   | `approved` | bid on a job to start earning | `/expedion` |
   | `submitted`, `under_review` | your application is being reviewed | `/carrier/application` |
   | `draft` | finish your application | `/carrier/application` |
   | `null`, `rejected`, `suspended` | apply / read why | `/carrier/application` |
4. **Messages**, FR and EN, exact key parity.
5. **Tests** — `WithdrawalPanel.test.tsx` for the lanes and the
   still-render-the-card cases, `withdrawals.service.test.ts` for the two new
   fields.

## Files

- `src/server/dal/withdrawals.dal.ts` — `hasAnyPayout`
- `src/server/services/withdrawals.service.ts` — payload
- `src/features/app/withdrawals/api/withdrawals.api.ts` — types
- `src/features/app/withdrawals/ui/WithdrawalPanel.tsx` — the empty state
- `messages/en.json`, `messages/fr.json`
- `src/features/app/withdrawals/ui/__tests__/WithdrawalPanel.test.tsx`
- `src/server/services/__tests__/withdrawals.service.test.ts`

## Not in scope

- Making the page a full earnings ledger. Per-delivery money already lives at
  `/carrier/trips` → *Effectués*, and duplicating it here would be two screens
  disagreeing about the same number.
- Production's migration state. Nothing in CI runs migrations; that is a deploy
  step (`MIGRATE_TARGET=production pnpm db:migrate`) and is called out in the
  spec rather than fixed here.

## Database

The migration gap is why the screenshot showed a failure. It is not
reproducible from the repo — a fresh clone that runs `pnpm db:migrate` never
sees it — so there is no code fix to make. It is recorded here because the
same gap is what took production's withdrawals endpoint down before
(`CLAUDE.md`, "Two migrations had never run anywhere").
