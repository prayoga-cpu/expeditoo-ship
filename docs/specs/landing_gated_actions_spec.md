# Spec — Landing gated actions

**Plan:** `docs/plans/plan_landing_gated_actions.md`
**Surface:** `/` (marketing landing), with a two-line addition to `/signin` and
`/signup`.
**Roles:** none. The landing page is anonymous; the only thing it reads is
whether a session exists.

---

## 1. Intents

`LandingIntent` is a closed union. Every gated element on the page declares one.

| Intent | Raised by |
|---|---|
| `bid` | the hero bid card, each **Bid** button on the board |
| `jobs` | "See all jobs", the board's join link |
| `carrier` | "Become a carrier" (navbar, CTA band), "Join the network" (hero) |

## 2. Where a gated action lands

`resolveLandingDestination(intent, session, ref?)` is pure and total.

| `isAuthenticated` | `isReturning` | `bid` / `jobs` | `carrier` |
|---|---|---|---|
| `true` | — | `/expedion` | `/profile` |
| `false` | `true` | `/signin?intent=…` | `/signin?intent=carrier` |
| `false` | `false` | `/signup?intent=…` | `/signup?intent=carrier` |

Rules:

- **A signed-in visitor never sees an auth page.** The session wins over the
  returning flag.
- **First time on this device means signup**, not login: there is nothing to log
  in to yet.
- `ref` is appended as `&ref=<value>` only when the caller supplies one, and only
  on the auth destinations. In-app destinations take no query.
- `ref` is URL-encoded. `intent` never needs encoding — the union is
  `[a-z]+` — but goes through the same builder.
- Coming back the other way, off the query string, `ref` is untrusted: only
  `^[A-Za-z0-9][A-Za-z0-9-]{0,23}$` is accepted (`isJobReference`). Anything
  else is dropped, by both the note and the signin↔signup link, so nobody can
  hand themselves a paragraph of text above a password field.

### 2.1 The returning flag

One `localStorage` key, `expeditoo-returning`, value `"1"`. Written by
`AuthProvider` the moment `isAuthenticated` is true, so it survives sign-out —
which is the point: a signed-out driver who used this browser before is sent to
login, not signup.

`isReturningVisitor()` returns `false` when there is no `window` and when
`localStorage` throws (Safari private mode, storage disabled). Never throws.

Because the flag is only readable on the client, the first client render assumes
`false`. The destination is recomputed on mount, before any gated action can be
pressed, so no visitor is routed on the placeholder value.

## 3. The gated-action flow

Four phases, in order. A gated element can be in exactly one.

| Phase | Duration | What is shown |
|---|---|---|
| `idle` | — | the element's normal label |
| `validating` | 650 ms | spinner + the intent's validating label |
| `success` | 900 ms | tick + the intent's success label |
| `redirecting` | until navigation | the success frame, held |

- The phases are visual only. Nothing is written to the server: there is no
  listing and no carrier to write against yet.
- `prefers-reduced-motion` collapses the two beats to 0 ms and 250 ms, and drops
  the shake and the scale-in. The phases still run, so the label still says what
  happened.
- A second press while a phase is running is ignored. The element is
  `disabled` from `validating` onward and `aria-busy` while it runs.
- **The button carries `aria-live="polite"`; the label is a plain span.** One
  text node, so the phase is announced once and the element's accessible name
  always matches what is drawn. The label must *not* carry `role="status"`
  itself: a live-region role on a descendant is skipped by name-from-content, so
  that arrangement leaves the button with no accessible name at all in Chromium
  — and jsdom does not reproduce it, so no unit test will catch a regression
  here. In a compact row the label is `sr-only` while the flow runs, so the row
  keeps its width and the phase is still both announced and reachable by name.
- All timers are cleared on unmount. A component that unmounts mid-flow never
  pushes.

## 4. The hero bid card

The only element with something real to validate. `submit(raw)` parses the input
and applies these rules, first match wins:

| Condition | Outcome | Message key |
|---|---|---|
| not a number after `,` → `.` | rejected | `bidCard.errorInvalid` |
| `< 50` — which is also where `0` and negatives land | rejected | `bidCard.errorTooLow` |
| `>= best` | rejected | `bidCard.errorTooHigh` |
| otherwise | accepted | — |

- A **rejected** offer shakes the input, marks it `aria-invalid`, shows the
  message under the field, and **stays on the page**. No phase runs, no
  redirect. The message clears as soon as the field is edited.
- An **accepted** offer is **floored** to the euro — rounding could push 195.6
  back up to a standing 196, claiming a lead at a price that never undercut —
  becomes the standing best,
  increments the offer count, flips the card to "Your offer is in the lead",
  and runs the gated flow with `intent: "bid"` and `ref: "EX-2481"`.
- The floor is 50 €. It exists so the demo cannot be walked down to 1 € and
  because an offer below it is not a serious one.
- The countdown keeps running through all of it.

## 5. The board

Three demo rows. Each carries its own reference and drives its own tickers.

- **Countdown** — seeded from the row's displayed time, decrements every second,
  and rolls over to its seed at zero.
- **Best offer** — every row steps its best down by 3 € on its own interval
  (11 s, 13 s, 17 s by row index, so they never move in lockstep), briefly
  highlighting the new figure. At its floor (60 % of the seed, rounded) the row
  returns to its seed. No randomness: identical on the server and after
  hydration.
- **Bid** — a gated action with `intent: "bid"` and that row's `ref`, compact.
- The join link is a gated action with `intent: "jobs"`.
- A "board updating live" pill sits beside the heading, so the movement reads as
  the board working rather than as the page glitching.

Every ticker starts inside an effect. The first paint is the seed values, so the
server render and the hydrated render agree.

## 6. Session-aware CTAs

| Element | Signed out | Signed in |
|---|---|---|
| Navbar "Become a carrier" | shown, `carrier` | **hidden** |
| Navbar "Log in" | shown → `/signin` | replaced by "Open app" → `/home` |
| Hero "Join the network" | `carrier` | label becomes "Open your profile", still `carrier`, so it lands on `/profile` |
| CTA band "Become a carrier" | `carrier` | label becomes "Open your profile" |
| CTA band subtitle | verification copy | "You are already signed in" copy |

While `useAuth().isLoading` is true the CTAs render their signed-out labels and
are inert (`disabled`), so nobody is shown "Become a carrier" for a beat and
then bounced, and nobody can press through on an unknown session.

## 7. The platform vignette

The accepted-offer row cycles through the three preview jobs every 4 s, the
matching preview row lifting while it is named. Cycling starts in an effect and
stops under `prefers-reduced-motion`, which holds whichever row the still design
shows — index 1, Lyon → Toulouse — because that is also what the server renders,
so a held vignette and a hydrated one agree. It is illustrative and stays
labelled as such.

## 8. `/signin` and `/signup`

Both read `intent` and `ref` from the query and render `AuthIntentNote` above
the form:

| `intent` | Note |
|---|---|
| `bid` | "Log in to place your offer" — with `ref`: "…on EX-2481" |
| `jobs` | "Log in to see the full board" |
| `carrier` | "Create your carrier account to start bidding" |
| absent or unknown | nothing renders |

`intent` is validated against the union before use; an unknown value renders
nothing rather than an empty note. The signin ↔ signup cross-links carry
`intent` and `ref` through, so a visitor who picks the wrong door keeps their
context — and only those two: `verified=true` belongs to the page it is on and
is dropped.

Both notes sit inside a `<Suspense fallback={null}>` — `useSearchParams()`
otherwise opts the whole route out of static rendering.

## 9. Error codes

None. Nothing here crosses the API boundary; there is no service and no DAL. The
only failure modes are client-side validation (§4) and unavailable storage
(§2.1), both of which degrade to a defined default.

## 10. Test coverage required

| Case | Where |
|---|---|
| Destination matrix, all 6 cells of §2 | `landing-intent.test.ts` |
| `isJobReference` accepts board references and refuses prose, markup, URLs and over-long values | `landing-intent.test.ts` |
| `AuthProvider` marks the device on session, never while pending, and the mark outlives sign-out | `auth-context-returning.test.tsx` |
| Every `marketing.actions.<intent>.<phase>` key resolves, in both catalogues | `GatedLabels.i18n.test.tsx` |
| §8 notes, unknown-intent rejection, hostile `ref` dropped, query carried across the hop | `AuthIntent.test.tsx` |
| Zero and negative amounts get the floor message, not the parse one | `LandingBidCard.test.tsx` |
| An accepted bid is floored so it can never land back on the standing best | `LandingBidCard.test.tsx` |
| A press while the session is resolving consumes nothing | `LandingBidCard.test.tsx` |
| `ref` appended and URL-encoded only on auth destinations | `landing-intent.test.ts` |
| Unknown/absent storage → `isReturning` false, no throw | `returning-visitor.test.ts` |
| Bid below floor, above best, non-numeric → error, no navigation | `LandingBidCard.test.tsx` |
| Valid undercut → leads, then pushes the resolved destination | `LandingBidCard.test.tsx` |
| Error clears on edit | `LandingBidCard.test.tsx` |
| Gated button: validating → success → push, one push per press | `LandingGatedButton.test.tsx` |
| Second press mid-flow is ignored | `LandingGatedButton.test.tsx` |
| Session loading → the button is inert and cannot push | `LandingGatedButton.test.tsx` |
| Unmounting mid-flow never pushes | `LandingGatedButton.test.tsx` |
| Signed-in navbar hides "Become a carrier"; CTA band swaps its copy | `LandingSessionCtas.test.tsx` |
| Both catalogues render every key the page reaches for | `LandingPage.i18n.test.tsx` |
| A comma decimal separator is accepted | `LandingBidCard.test.tsx` |
