# Plan — Landing gated actions

**Spec:** `docs/specs/landing_gated_actions_spec.md`
**Surface:** `/` (the `(marketing)` landing page)

## Why

Every interactive element on the landing page is either a dead demo or a bare
`<Link href="/signup">`. Someone types an offer into the hero card and nothing
comes of it; someone presses **Bid** on a board row and is dropped on a signup
form with no memory of what they pressed. And the page is blind to the session:
a signed-in driver is still told to "Become a carrier".

## What we are building

One flow, used by every gated element on the page:

```
interact → animated validation → animated success → redirect
```

Where the redirect lands depends on the visitor:

| Visitor | Lands on |
|---|---|
| Signed in | the in-app surface for that intent |
| Signed out, has had a session on this device | `/signin` |
| Signed out, first time on this device | `/signup` |

The intent travels with them (`?intent=bid&ref=EX-2481`) so the auth page can
say what they are logging in for, rather than dropping it.

## Steps

1. **`src/lib/returning-visitor.ts`** — `markReturningVisitor()` /
   `isReturningVisitor()` over one `localStorage` key. Marked from
   `AuthProvider` the moment a session exists, so the flag is app-wide and not a
   landing-page trick.
2. **`src/lib/landing-intent.ts`** — the `LandingIntent`
   union and `resolveLandingDestination()`, a pure function over
   `(intent, { isAuthenticated, isReturning }, ref?)`. Pure so the whole
   redirect matrix is unit-testable without a router.
3. **`src/features/marketing/hooks/useGatedAction.ts`** — the phase machine
   (`idle → validating → success → redirecting`) plus the push. Owns the
   timings, honours `prefers-reduced-motion`, and clears its timers on unmount.
4. **`src/features/marketing/ui/LandingGatedButton.tsx`** — the button that
   renders the three phases (spinner, tick, label swap) for elements with
   nothing to validate.
5. **`LandingBidCard`** — real validation: the offer must parse, clear the floor
   and undercut the standing best. A rejected offer shakes and explains itself
   and does **not** redirect. An accepted one takes the lead, then redirects.
6. **`LandingJobBoard`** — each row's **Bid** becomes a gated action carrying
   that row's reference; rows count down live and their best offers tick down.
7. **`LandingNavbar` / `LandingHero` / `LandingCTA`** — carrier CTAs become
   gated actions, and change or disappear once there is a session.
8. **`LandingPlatform`** — the vignette cycles its accepted-offer row so the
   "LIVE" claim is not a still image.
9. **`src/features/auth/ui/AuthIntentNote.tsx`** — the line on `/signin` and
   `/signup` that names the intent the visitor arrived with; the cross-link
   between the two pages keeps the query.
10. **i18n** — new keys in `messages/en.json` and `messages/fr.json`, exact
    parity.
11. **Tests** — the destination matrix, the bid-card validation branches, a
    gated button end to end, and both catalogues rendering without a missing key.

## Files

| File | Change |
|---|---|
| `src/lib/returning-visitor.ts` | new |
| `src/lib/auth-context.tsx` | mark the device on first session |
| `src/lib/landing-intent.ts` | new (shared: the auth pages read the intent too) |
| `src/features/marketing/hooks/useGatedAction.ts` | new |
| `src/features/marketing/ui/LandingGatedButton.tsx` | new |
| `src/features/marketing/ui/LandingBidCard.tsx` | validation + redirect |
| `src/features/marketing/ui/LandingJobBoard.tsx` | gated rows + live board |
| `src/features/marketing/ui/LandingNavbar.tsx` | session-aware CTA |
| `src/features/marketing/ui/LandingHero.tsx` | gated CTA |
| `src/features/marketing/ui/LandingCTA.tsx` | session-aware CTA |
| `src/features/marketing/ui/LandingPlatform.tsx` | cycling vignette |
| `src/features/auth/ui/AuthIntentNote.tsx` | new |
| `src/app/signin/page.tsx`, `src/app/(auth)/signup/page.tsx` | render the note |
| `messages/{en,fr}.json` | new keys, both catalogues |

## Dependencies

None new. `framer-motion`, `next-intl` and `useAuth` are all already in the tree.

## Out of scope

Real bidding from the landing page (an offer needs an approved carrier and a
listing id), and post-login return-to-intent routing — `signIn()` always pushes
`/home`, and changing that is an auth change, not a marketing one. The intent is
carried and displayed, not replayed.
