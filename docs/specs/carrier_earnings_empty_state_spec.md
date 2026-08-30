# Spec: "Mes gains" — the empty and unavailable states

Covers `/carrier/withdrawals` (sidebar: *Mes gains* / *My earnings*) and
`GET /api/carrier/withdrawals`. The withdrawal mechanics themselves — minimum,
one open request at a time, operator decision — are unchanged and are described
in `withdrawals.service.ts`.

## 1. The three states

The screen renders exactly one of these, in this order:

| # | Condition | Renders |
|---|---|---|
| 1 | the balance query failed, or returned nothing | **unavailable** — the existing retry state |
| 2 | `!hasEverEarned && !openRequest && history.length === 0` | **empty** — §3 |
| 3 | otherwise | the balance card |

**1 beats 2.** A failed request is not the same as an empty balance, and telling
a driver who has money that they have never earned any would be worse than the
blank page this replaced.

**3 covers `€0.00` with a history.** A driver who has withdrawn everything has
`availableCents === 0` and `deliveries === 0`, but they have earned before: they
get the card, not the onboarding pitch.

### 1.1 Why `hasEverEarned` and not `deliveries > 0`

`deliveries` counts *unclaimed* `scheduled` payouts. A payout that is
`processing`, `paid`, `failed` or `cancelled` is not counted, so a driver
mid-withdrawal — or one whose only payout failed — would read as a newcomer.
`hasEverEarned` asks the honest question: has a payout row ever existed for this
user, in any status.

## 2. Payload

`GET /api/carrier/withdrawals` gains two fields. Everything already there is
unchanged.

```ts
{
  availableCents: number
  deliveries: number
  minimumCents: number
  canRequest: boolean
  openRequest: Withdrawal | null
  history: Withdrawal[]
  hasEverEarned: boolean              // NEW — any payout row, any status
  carrierStatus: CarrierStatus | null // NEW — null when they never applied
}
```

`carrierStatus` derives from `carrierStatusEnum` (`src/db/schema/carriers.ts`)
and is never restated as a literal union in a Zod schema or a DTO.

The route stays open to any session, as it was: it requires no carrier record
and no role. A signed-in user who never applied gets
`hasEverEarned: false, carrierStatus: null` and a 200, not a 403 — the screen is
in the sidebar for them, so it has to answer.

## 3. The empty state

`CenteredEmptyState`, `variant="page"`, wallet icon, one button. Which copy and
where the button goes is decided by `carrierStatus`, because generic advice on
this screen is advice that is wrong for most of the people reading it.

| `carrierStatus` | title | button → |
|---|---|---|
| `approved` | Nothing earned yet | *Browse jobs* → `/expedion` |
| `submitted`, `under_review` | Nothing earned yet | *Check your application* → `/carrier/application` |
| `draft` | Nothing earned yet | *Finish your application* → `/carrier/application` |
| `rejected`, `suspended` | Nothing earned yet | *Open your application* → `/carrier/application` |
| `null` | Nothing earned yet | *Become a driver* → `/carrier/application` |

The title is shared; the description carries the difference. An approved driver
is told that a delivered job is what pays; everyone else is told what stands
between them and one.

### 3.1 What it does not do

It does not redirect. A driver who opened *Mes gains* asked for their gains, and
bouncing them to another screen answers a question they did not ask. The route
out is a button they choose to press.

## 4. Money is still explained

Both the empty state and the card keep the standing caveat: payments are
collected by Expeditoo and a withdrawal is an operator-approved manual transfer.
Nothing here implies an automatic payout.

## 5. Not fixed here: the deployed database

The failure in the report was `withdrawals` not existing — the database was at
migration `0005`. Nothing in CI or the Vercel build runs migrations, so any
environment can drift the same way, and every environment must be brought
forward by hand:

```
MIGRATE_TARGET=production pnpm db:migrate   # deploy step
pnpm db:migrate                              # local
```

`src/db/__tests__/migrations-journal.test.ts` fails on an unregistered
migration, which is the *authoring* mistake. It cannot tell whether a given
database has run them. That gap is real and is not closed by this change.

## 6. Test coverage required

**`WithdrawalPanel.test.tsx`**
- every message key resolves in EN and FR (extend the existing parity test)
- empty payload + `carrierStatus: "approved"` → job-board link, not the €0 card
- empty payload + `carrierStatus: null` → application link
- empty payload + `carrierStatus: "under_review"` → the reviewing copy
- `hasEverEarned: false` **with** history → the card, never the empty state
- `isError` + `hasEverEarned: false` → the retry state, never the empty state

**`withdrawals.service.test.ts`**
- `getBalance` reports `hasEverEarned: false` for a user with no payout rows
- `getBalance` reports `hasEverEarned: true` for a payout that is not
  `scheduled`, while `availableCents` stays `0`
- `getBalance` passes `carrierStatus` through, and `null` when there is no
  carrier record
