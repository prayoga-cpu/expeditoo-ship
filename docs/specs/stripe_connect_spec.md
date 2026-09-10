# Specification: Stripe Connect onboarding and the payout button

Covers `POST /api/stripe/connect`, `GET /api/stripe/connect/dashboard`,
`GET /api/stripe/connect/return`, `GET /api/stripe/connect/refresh`, the
*Configuration des paiements* card in `src/features/app/profile/ui/Profile.tsx`,
and `paymentsService.executePayout`.

---

## 1. What was actually wrong

The reported symptom was "the connect button doesn't work". Three separate
faults sat behind it, and only the first is Stripe's.

### 1.1 The platform account is restricted (not a code fault)

`POST /api/stripe/connect` reached Stripe and Stripe refused it. From the
production runtime log:

```
StripeInvalidRequestError, HTTP 400
"We've temporarily restricted your ability to create this type of connected
 account due to suspicious activity. Please log in to the Stripe Dashboard to
 confirm that you intended to create this account, then try your request again."
```

This is a restriction on the **platform's** Stripe account. No code change
lifts it; the owner clears it in the Stripe Dashboard. It is recorded in
`STATUS.md`'s Operator to-do.

**Do not re-diagnose this from the browser.** The console shows only
`500 (Internal Server Error)` — see §1.2 for why — and two earlier sessions in
this repo's history were lost chasing an auth problem that was really a database
outage for the same reason. The answer is always in `vercel logs`.

### 1.2 Every failure was reported as a 500

The route caught `error: any` and answered `500` with `error.message`. So a
`400` that Stripe had already decided was reported as this server falling over,
and prose written for the platform owner was forwarded to a driver's browser.

### 1.3 The button was silent

```ts
const data = await res.json();
if (data.url) window.location.href = data.url;
```

On any failure there is no `url`, so the handler fell off the end. No message,
no pending state, no logged branch — **a refusal and a dead button were
indistinguishable**, which is exactly how it was reported.

`GET /api/stripe/connect/refresh` had the same shape from the other direction:
it redirects to `/profile?stripe=error`, and nothing anywhere read that
parameter.

---

## 2. The error contract

`stripeService` throws `StripeConnectError`, carrying a `code` and a `status`,
which `handleError` translates (`src/lib/api-response.ts`). No route in this
group hand-rolls a `NextResponse`.

| Code | Status | Raised when |
|---|---|---|
| `STRIPE_REQUEST_REJECTED` | 422 | Stripe answered `invalid_request_error` — the platform restriction above, and any other request Stripe itself refused |
| `STRIPE_ACCOUNT_MISSING` | 409 | A dashboard link was asked for before onboarding started |
| `STRIPE_ACCOUNT_NOT_READY` | 409 | Onboarding started but `stripeAccountStatus` is not yet `active` |

**`STRIPE_REQUEST_REJECTED` is deliberately broad.** Stripe attaches no stable
machine-readable code to the restriction, and matching its English prose would
break the first time Stripe rewrote the sentence. The raw message stays in the
server log, where the operator can read it; the browser gets our own wording.

The client branches on `ApiError.code` (`src/lib/fetcher.ts`) and shows
`payout.error.rejected` for that one, `payout.error.generic` otherwise.

---

## 3. The button

- Goes through `payoutApi.startOnboarding()`
  (`src/features/app/profile/api/payout.api.ts`), never a raw `fetch` —
  `docs/rules.md` §3.6. Envelope unwrapping happens once, in the fetcher.
- Shows a pending state while the round trip is in flight.
- **Stays pending on success.** The browser is navigating to Stripe, and
  restoring the idle label would flash it over a page that is already leaving.
- On mount, reads `?stripe=error`, reports it, and strips the parameter so a
  reload does not re-announce a stale failure.

`?stripe=success` is written by the return route and read by nobody. That is
fine and deliberate: `checkAccountStatus` has already run by then, so the status
badge on the same card is the honest signal.

---

## 4. Where the Connect account id lives

**`user.stripe_account_id`.** `createConnectAccount` writes it there, and
`checkAccountStatus` promotes `stripeAccountStatus` there.

`carriers.stripe_account_id` (`src/db/schema/carriers.ts`) exists in the schema
and is **dead** — no writer, and, since this change, no reader. It should be
dropped in a hand-written migration; it is left in place here because a schema
change was outside this work.

That column was the bug: `executePayout` read the carrier row, so a driver who
completed onboarding still got `CARRIER_ACCOUNT_MISSING` forever. It now
resolves from the user row.

### 4.1 What `executePayout` refuses

Added because the method would otherwise send real money for a row that no
longer represents a debt:

| Guard | Why |
|---|---|
| `status === 'paid'` | Idempotency; pre-existing |
| `status === 'cancelled'` | `cancelPayoutForShipment` writes this when the client has been **refunded**. Transferring it pays out money the platform gave back |
| `withdrawalId` is set | The row is already claimed by the by-hand withdrawal flow. Transferring it pays the same money twice |
| `stripeAccountStatus !== 'active'` | Stripe refuses a transfer to an account that has not finished onboarding; refusing here makes it legible instead of a raw throw |

All four refuse **before** any Stripe call and leave the row untouched.

---

## 5. Known limits

- **`executePayout` has no caller.** The driver's 90% reaches them through
  `withdrawals.service.ts`: they ask, an operator approves, a human makes the
  transfer. Everything in §4 is correct but not yet switched on.
- **`CARRIER_ACCOUNT_NOT_READY`, `PAYOUT_CANCELLED` and `PAYOUT_ALREADY_CLAIMED`
  have no FR/EN copy**, because they have no caller to surface them. Whoever
  wires the Connect payout path owes the translations.
- **The restriction in §1.1 is unverified from here.** It is taken from the
  production log. Whether clearing it in the Stripe Dashboard makes onboarding
  succeed can only be confirmed by trying it.
- `getOrCreateCustomer`, `findCustomer` and `detachPaymentMethod` still throw
  untyped `Error`s and so still translate to 500. They were out of scope; the
  same treatment applies when they are next touched.

---

## 6. Test coverage required

- The service maps a Stripe `invalid_request_error` to `STRIPE_REQUEST_REJECTED`
  and anything else to an unexpected failure.
- The route answers 422 rather than 500 for that case, and 401 with no session.
- The dashboard route answers 409 for both not-connected and not-ready.
- `executePayout` refuses each of the four states in §4.1 **without calling
  Stripe** and without writing the row.
- FR/EN parity for every `payout.*` key.
