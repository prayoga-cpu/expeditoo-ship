# Landing page, rebuilt (2.96.0)

**Status:** implemented in 2.96.0. **Owner surfaces:** `src/app/(marketing)/page.tsx`,
`src/features/marketing/**`, `GET /api/public/recent-requests`, `/create?title=&from=&to=&date=`.

## 0. Why

On 19 November the client pointed at a reference site for the homepage:
« more clear and direct, more readable », « simple & quick », and, on its hero
search card, « just exchange date exacte by title of the add ». The owner then
asked for the whole homepage to be rebuilt with that site as the reference for
**structure and clarity**, realigned to Expeditop's product and more
professional than both, with real photographs.

What is taken from the reference: a blue hero band with a white card of four
fields and one wide button, example trajets under it, the recent items, three
numbered steps under « Simple et rapide », a closing call to action. What is
not: its name, logo, words, images and colours. Ours are Expeditop's — the
app's `--primary` (#076BE3, ROADMAP.md §7) and Plus Jakarta Sans.

The previous landing spoke to carriers (« Les courses viennent à vous ») and
carried a demo bid card and four figures nobody could vouch for (« 320+
courses par mois », « 6h », « −38 % »). The new one speaks first to the person
who needs something moved; carriers get their own card and button.

## 1. Page structure

Top to bottom (`src/app/(marketing)/page.tsx`):

| # | Section | id | Component |
|---|---|---|---|
| 1 | Header (shared) | — | `LandingNavbar` |
| 2 | Hero: headline + search card | `top` | `LandingHero`, `LandingSearchCard` |
| 3 | Trust strip (4 rules) | — | `LandingTrust` |
| 4 | « Demandes récentes » | `recent` | `LandingRecentRequests` |
| 5 | « Comment ça marche ? » | `how` | `LandingHowItWorks` |
| 6 | Two audiences | `shippers`, `carriers` | `LandingAudiences` |
| 7 | Closing call to action | `cta` | `LandingCTA` |
| 8 | Footer (shared) | — | `LandingFooter flush` |

- The header and footer may link only to ids the page renders:
  `/#top` (logo), `/#how`, `/#recent`, `/#carriers` —
  `landing-anchors.test.tsx` and `LandingFooter.test.tsx` hold it.
- `<main>` carries **no** `lp` class: the sections use the app's own tokens
  (`bg-background`, `text-foreground`, `bg-card`, `border-border`,
  `bg-primary`), which follow the theme toggle. The shared header and footer
  keep `lp` on their own roots, as on every marketing page, and set
  `font-sans` inside it so they too are in Plus Jakarta Sans.
- Every section's content sits in one measure: `max-w-[1200px]` padded
  `px-4 sm:px-8` **inside** it, so header, sections and footer share one
  content edge (152 px at 1440).
- Metadata: a French title and description on the page (`metadata` export).

### 1.1 Header (2.92.0 rules kept)

- Phone (< `sm`): one « Connexion / Inscription » link to `/signin`, two lines.
- From `sm`: « Connexion » (`/signin`), « Inscription » (`/signup`), « Devenir
  transporteur » (the gated carrier flow).
- Signed in: « Ouvrir l'app » (`/home`) only.
- Nav links (« Comment ça marche », « Demandes récentes », « Transporteurs »)
  from `xl` only — at 1024 px they collide with the controls (seen in Chromium).
- `LP_BTN_PRIMARY` is the app primary since 2.96.0 (was #0052FF), with
  `hover:text-white!` because `.lp a:hover` (unlayered) repainted a
  link-button's label light blue on blue.

## 2. Hero and search card

- Badge « Objets, meubles et déménagements · France et étranger », headline
  « Trouvez un transporteur pour vos objets », one subtitle, the card, and one
  line under it: « Publier une demande est gratuit. Vous ne payez qu'en
  acceptant une offre. »
- Band: `landing.module.css` `.band` — #076BE3 in light, navy #0A2348 in dark,
  written with explicit alpha (no `color-mix()`, which iOS 15.4–16.1 lacks).
- Photo: one `<Image priority>` placed twice by CSS — below `lg` behind the
  band under `.shade` (≥ 82 % blue, so white text keeps AA on any part of it);
  from `lg` a framed 4:5 picture beside the text. One file, one download.

### 2.1 The card

Four labelled fields, in this order, then one full-width button:

| Field | `name` | Input | Cap | Label key |
|---|---|---|---|---|
| Ville de départ | `from` | text, `autocomplete=address-level2` | 80 | `marketing.search.from.label` |
| Destination | `to` | text | 80 | `marketing.search.to.label` |
| Date | `date` | `type=date`, `min` = today (set after mount) | — | `marketing.search.date.label` |
| Que transportez-vous ? | `title` | text | 120 | `marketing.search.title.label` |

- Each box is a `<label>` (a press anywhere focuses the input); the input's
  name comes from `aria-labelledby` only, so it reads « Ville de départ », not
  « Ville de départ Paris ». Focus ring on the box (`focus-within`).
- Button « Obtenir des offres » → `router.push(buildCreateUrl(values))`.
  `buildCreateUrl` (`src/features/marketing/landing-search.ts`) trims, folds
  whitespace, drops empty keys, keeps the order `title, from, to, date`;
  nothing typed → `/create`.
- The card is a real `<form action="/create" method="get">`: before the script
  loads it still reaches `/create` (empty keys are dropped there).
- « Exemples : » three chips — Paris → Lyon, Lille → Paris, Marseille → Nice.
  A chip fills both towns and moves focus to the title when it is empty.
  **Examples, not a ranking**: no figure says they are the most requested.
  French towns only (a foreign town would leave the request's country on FR).
- Signed out, `/create` sends the visitor to `/signin?callbackUrl=…` with the
  checked values in the callback (§5.3); since 2.95.0 sign-in brings them back.
  Verified in Chromium; without JavaScript the same redirect arrives as a
  streamed meta refresh.

## 3. The other sections

**Copy rule.** Everything said is a rule the app enforces. No numbers,
ratings, speeds or guarantees (`payout-claims.test.ts` scans the catalogues).

- **Trust strip** (`marketing.trust.*`), each item with its source:
  - « Paiement à l'acceptation » — `payment_at_booking_spec.md`, `pay_at_accept_spec.md`
  - « Transporteurs vérifiés » (in-house and professional, checked before the
    first offer) — approval is never automatic, `driver_types_spec.md` §3.1
  - « Photos au retrait et à la livraison » (each carries place and time) —
    `shipment_photos_spec.md`
  - « Remboursé en cas d'annulation » (before pickup) — `cancellations_spec.md`
- **Comment ça marche ?** (`marketing.howItWorks.*`): three numbered steps —
  describe, receive offers (price and slots, messages), choose and pay at
  acceptance (photos at both handovers); one « Publier une demande » button.
- **Two audiences** (`marketing.audiences.*`): « Vous expédiez » (photo, three
  points, « Publier une demande » → `/create`) and « Vous transportez » (photo,
  three points, the gated carrier button — « Devenir transporteur », or
  « Ouvrir votre profil » with a session; `landing_gated_actions_spec.md` §6).
- **Closing band** (`marketing.cta.*`): « Quelque chose à faire transporter ? »,
  « Publier une demande » (white) and the carrier button (outlined); a photo
  beside it from `lg` (lazy, never fetched on a phone).
- **Footer**: a new first column « Expédier » (Publier une demande, Comment ça
  marche, Demandes récentes); « Transporteurs » gained « Devenir transporteur »
  (`/#carriers`); new tagline. Small grey text moved from `--lp-faint` (3:1) to
  `--lp-muted` for AA. `flush` drops its top margin on the landing.

## 4. « Demandes récentes »

### 4.1 Endpoint

`GET /api/public/recent-requests` → `{ success, data: { items: RecentRequest[] } }`.

- No session is read; the answer is the same for everyone.
- `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=120`
  on success only; an error carries no cache header.
- Route → `recentRequestsService.list(now)` → `recentRequestsDal.latestOpen(6, now)`.

### 4.2 Read

`recent-requests.dal.ts`, its own query (not `listingsDal.browse`, which joins
the requester's whole `user` row and every photo):

- `status = 'open' AND expires_at >= now` — the board's own rule, so a job the
  expiry cron has not reached yet never shows once it stops taking offers;
- `ORDER BY coalesce(published_at, created_at) DESC, reference DESC`;
- `LIMIT 6`; selects only the card's columns plus `status`.

### 4.3 Projection

The service drops any row that is not `open`, keeps at most
`RECENT_REQUESTS_LIMIT` (6), runs each through `toListingView(row, "public")`
and then `recentRequestSchema` (`src/server/dto/recent-requests.dto.ts`),
which keeps exactly **fourteen** fields:

`id, reference, title, jobKind, pickupCity, pickupCountry, dropoffCity,
dropoffCountry, pickupFrom, pickupUntil, isFlexible, weightKg,
movingSurfaceM2, movingVolumeM3`

All fourteen are in `PUBLIC_LISTING_FIELDS`. Never: a street, a postal code, a
pin (not even the rounded one), a contact, a note, the description, the
budget, a photo, the requester or `shipperId`. A fifteenth field is a spec
change, and the service test fails on one.

### 4.4 Rendering

- Read in the browser (`useRecentRequests`, React Query, `staleTime` 60 s):
  the landing is a static page served from the edge; a database read while
  rendering it would make every visit dynamic, or run at `next build`. The
  server renders the skeleton, so nothing differs at hydration.
- Loading: three skeleton cards. Empty: `CenteredEmptyState` with « Publier
  une demande » → `/create`. Failure: `LoadErrorState` with « Réessayer » and
  the same `/create` way on (`no-dead-ends.test.ts`).
- Card: kind chip (`Objet` / `Déménagement`), « N° {reference} », the title
  (the link, `/listing/[id]`, stretched over the card), « town → town » with
  the country named when it is not France, « Retrait le … » or « Retrait du
  … au … » (Europe/Paris; French prints a shared month once), the weight for
  items or the surface / volume for a move.
- Casing (`src/features/marketing/display-text.ts`): a town typed all in
  capitals or all in lower case is shown as a name (« MARSEILLE » →
  « Marseille », « aix-en-provence » → « Aix-en-Provence »); a name typed with
  mixed case is left exactly as typed. A title gets a capital first letter; one
  typed all in capitals becomes a sentence.
- « Voir toutes les demandes » → `/expedion` (signed out: sign-in first).

## 5. `/create` prefill contract

### 5.1 Keys

`/create?title=&from=&to=&date=` — parsed once, on the server, by
`parseRequestPrefill(query, now)` (`src/features/app/create/prefill.ts`):

| Key | Rule | On failure |
|---|---|---|
| `title` | control characters removed, whitespace folded, cut to 120 characters (code points, never half a surrogate pair) | absent → blank |
| `from`, `to` | ≤ 80 characters; letters in any script, digits, space and `' ’ . , ( ) / -`; must start with a letter or digit | dropped (a cut town names somewhere else) |
| `date` | a real `YYYY-MM-DD` day from **today in France** to twelve months ahead (`statedDay`, the request assistant's rule) | dropped |

A repeated key reads its first value. A value that fails is dropped, never
repaired. Nothing valid → `null` → the plain `NewRequestForm`.

### 5.2 What the form does with it

Only for a **new** request (`useJobForm({ prefill })`); `?draft=` never reads
the prefill (the page does not parse it and the hook ignores it beside a
draft):

- `title` → the title field;
- `from` / `to` → `pickup.city` / `dropoff.city`, with no street, no postal
  code and **no pin**, `locationEntry: "address"`; a pinless town is placed by
  the server at posting (`listingPinsService`);
- a town prefilled at either end keeps the address book from auto-filling
  (it would read a town without a street as empty and write over it);
- `date` → the When step as a one-day flexible range on that day, delivery the
  day after at the earliest (`timingFromDraft`, the assistant's rule).
- Gotcha 15 holds: no clock rule enters `jobFormSchema`; the date is checked
  in the parser, and publication timing stays `publication.ts`'s question.

### 5.3 Sign-in round trip

Signed out, the page redirects to `/signin?callbackUrl=` with the **checked**
values (`prefillQuery`) beside `type`; a draft's way back carries no prefill.

## 6. Photographs

- Public domain only (CC0 or PDM), found through Openverse, no watermark, no
  recognisable face, no brand or plate a viewer would read. Credits, licences
  and Openverse ids: `public/images/landing/CREDITS.md`.
- Files: `hero.webp` 960×1200 (kraft parcel tags), `shipper.webp` 960×600
  (a sofa in a living room), `carrier.webp` 960×600 (the motorway from the
  driver's seat), `packing.webp` 720×540 (hands closing a box) — all StockSnap
  CC0, WebP q80 via sharp, metadata stripped, 27–64 KB each. Hero ≤ 1600 px,
  others ≤ 1000 px, each ≤ 250 KB.
- `next.config` serves images unoptimised, so the sizes in
  `landing-images.ts` are what the browser downloads.
- `next/image` with width/height; `priority` on the hero only; alt text in
  `marketing.images.*`, both catalogues. Treatment: rounded corners, soft
  shadow, the hero's blue shade; no image stacked for decoration.

## 7. Theme, accessibility, widths

- Light and dark through the app toggle (`.dark` on `<html>`); the band
  deepens to navy in dark rather than inverting. Checked in Chromium at 390,
  1024 and 1440 in both themes; no horizontal scroll at any of them.
- Contrast: white on #076BE3 is 5.0:1; muted text ≥ 4.5:1 on its surface;
  primary-coloured text in dark uses #8FB8FF.
- Every field labelled; every button has text; focus rings on fields, chips,
  buttons and the card links; sizes in rem (the root is 17 px below `lg`).

## 8. Copy

Patch: `~/.claude/projects/-Users-darwinprayoga-Code-expeditoo-ship/tools/i18n-2.96.0-landing.json`
(82 keys set per catalogue, identical key sets).

- **Deleted:** `marketing.hero` (old), `marketing.bidCard`,
  `marketing.advantages`, `marketing.howItWorks` (old).
- **Set:** `marketing.hero.*`, `marketing.search.*`, `marketing.trust.*`,
  `marketing.recent.*`, `marketing.howItWorks.*`, `marketing.audiences.*`,
  `marketing.images.*`; `marketing.navbar.recent|carriers`;
  `marketing.footer.requesters|request|recent|becomeCarrier|tagline`;
  `marketing.cta.title|subtitle|subtitleAuthed|request` (`primary` and
  `primaryAuthed` kept).
- **Kept for now:** `marketing.stats.*` — `LandingStats.tsx` is no longer
  rendered but `src/i18n/__tests__/payout-claims.test.ts` imports it.

## 9. Test coverage required

- `recent-requests.service.test.ts` — the fourteen fields pinned; all within
  the public projection; a whole row (every column, requester, photos) yields
  exactly the card's fields and no street, pin, contact, note, budget, photo,
  email or Stripe id; ISO timestamps; asks for 6 and never returns more; open
  only; empty list; a move's size.
- `recent-requests.dal.test.ts` — the SQL: `status = 'open'`,
  `expires_at >= $now` bound as a value, the order, the limit, no private
  column selected.
- `api/public/recent-requests/__tests__/route.test.ts` — no session read;
  `s-maxage=60` on success; no cache header on failure.
- `prefill.test.tsx` — valid values; whitespace; any script; repeated keys;
  today in France; invalid dates, past and > 1 year; non-town values; caps
  (title cut, town dropped, surrogate pairs); `prefillQuery`; `prefillTiming`;
  `useJobForm` with a prefill (title, pinless towns, the day) and with a draft
  (ignored).
- `create/__tests__/page.test.tsx` — the sign-in round trip keeps the checked
  values and drops the rest; none on a draft; the prefilled form when signed
  in; the blank form when nothing survives; never on a draft.
- `LandingPage.test.tsx` — sections in order; every publish door to `/create`;
  carrier buttons; alt text and a single priority image; four labelled
  fields; the submit URL; blank submit; GET form fallback; chips and focus;
  caps; `buildCreateUrl`; skeleton, cards, single-day date, casing, empty and
  failure states with retry.
- `display-text.test.ts`, `landing-anchors.test.tsx`,
  `LandingFooter.test.tsx`, `LandingSessionCtas.test.tsx`,
  `LandingPage.i18n.test.tsx` (both catalogues, cards of both kinds and the
  empty state), `no-dead-ends.test.ts`, `payout-claims.test.ts`.
