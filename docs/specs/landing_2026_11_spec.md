# Landing page, rebuilt (2.96.0) and redressed (2.97.0)

**Status:** implemented in 2.96.0; redesigned in 2.97.0. **Owner surfaces:**
`src/app/(marketing)/page.tsx`, `src/features/marketing/**`,
`GET /api/public/recent-requests`, `/create?title=&from=&to=&date=`,
`public/images/landing/`, `public/videos/landing/`.

## 0. Why

On 19 November the client pointed at a reference site for the homepage:
« more clear and direct, more readable », « simple & quick », and, on its hero
search card, « just exchange date exacte by title of the add ». The owner then
asked for the whole homepage to be rebuilt with that site as the reference for
**structure and clarity**, realigned to Expeditop's product and more
professional than both, with real photographs (2.96.0).

On 24 November the owner asked for the best of a second reference — a
logistics template, shipit.framer.ai — to be brought in: its navbar, footer,
animations, scroll, content structure, pictures and hero video, **while
keeping** the client's reference (the blue band with the white four-field
card, « Demandes récentes », « Comment ça marche ? » in three numbered steps
« Simple et rapide », the promises) and Expeditop's identity (#076BE3,
Plus Jakarta Sans, the wordmark). That is 2.97.0.

### 0.1 What was taken from the second reference, and what was not

| Taken (adapted to our brand) | Where |
|---|---|
| Lenis smooth scroll | `LandingMotion`, home page only (§6.2) |
| A floating header inset from the edges, glass over the hero, solid below it | `LandingNavbar` (§1.1) |
| A three-line button opening a full-screen menu of large section links | `LandingMenu` (§1.2) |
| A full-bleed muted looping video behind the hero, a giant tight headline | `LandingHero`, `LandingHeroVideo` (§2) |
| Text that comes in from a blur; blocks that fade up as they enter | `landing.module.css` `.blurIn`, `[data-reveal]` (§6.2) |
| An infinite horizontal marquee | `LandingMarquee` (§3) |
| A slowly rotating circular badge | `HowBadge` in `LandingHero` (§2) |
| Services as tabs, each a photo, text and a call to action | `LandingServices` (§3) |
| Numbered points around a central photograph (« Perks ») | `LandingPromises` (§3) |
| Three steps joined by dotted connectors | `LandingHowItWorks` (§3) |
| A dark full-width statement band | `LandingCarriers` (§3) |
| An FAQ accordion | `LandingFaq` (§3) |
| A closing band on a photograph | `LandingCTA` (§3) |
| A footer of wordmark, short text and link columns | `LandingFooter` (§3) |

**Not taken, on purpose:** its red, its fonts (Clash Grotesk, Barlow, Anek
Bangla, Manrope, Host Grotesk), its wording, its images and its video
(template assets, licence unknown); and every section we would have to fake —
pricing plans, a testimonial, a client logo wall, counters (« 1+ projects »),
a blog, a newsletter, socials. We have none of them. The crane-hung swaying
container was not reproduced either: it is the template's own illustration.

## 1. Page structure

Top to bottom (`src/app/(marketing)/page.tsx`):

| # | Section | id | Component | Background |
|---|---|---|---|---|
| 1 | Header (shared, floating) | — | `LandingNavbar overlay` | glass, then solid |
| 2 | Hero: video, headline, search card | `top` | `LandingHero` | video under blue |
| 3 | Marquee of what people move | — | `LandingMarquee` | `--h-bg` |
| 4 | « Demandes récentes » | `recent` | `LandingRecentRequests` | `--h-alt` |
| 5 | « Ce que nous transportons » (tabs) | `shippers` | `LandingServices` | `--h-bg` |
| 6 | « Comment ça marche ? » | `how` | `LandingHowItWorks` | `--h-alt` |
| 7 | « Nos engagements » | `promises` | `LandingPromises` | `--h-bg` |
| 8 | « Vous transportez ? » | `carriers` | `LandingCarriers` | `--h-navy` |
| 9 | Questions fréquentes | `faq` | `LandingFaq` | `--h-bg` |
| 10 | Closing band | `cta` | `LandingCTA` | photo under blue |
| 11 | Footer (shared) | — | `LandingFooter flush` | navy |

- Anchors kept stable: `#top`, `#recent`, `#how`, `#shippers`, `#carriers`,
  `#cta`; new: `#promises`, `#faq`. The header, footer **and menu** may link
  only to ids the page renders — `landing-anchors.test.tsx` opens the menu to
  check it, `LandingFooter.test.tsx` holds the footer's three.
- `<main>` carries `styles.home` (the home tokens, §7) and **no** `lp`. The
  shared header and footer keep `lp` on their own roots, as on every
  marketing page, and set `font-sans` inside it (Plus Jakarta Sans).
- One content measure: `max-w-[1200px]` padded `px-4 sm:px-8`
  (`H_CONTAINER`); sections are `py-20 sm:py-24 lg:py-32` (`H_SECTION_Y`).
- `LP_ANCHOR_OFFSET` is `scroll-mt-[92px]` at every width: 12 px of inset,
  the 64 px bar, air. The bar no longer wraps, so one value holds.
- Metadata: a French title and description on the page (`metadata` export).

### 1.1 Header

A floating bar inset 10–12 px from the edges, `max-w-[1240px]`, 64 px tall,
`rounded-2xl`, `backdrop-blur-xl`. On the home page (`overlay`) it is
`fixed` over the hero; on the other marketing pages it is `sticky`, so their
content starts below it. Its root clears `.lp`'s background inline; the bar
is the only surface. Over the hero it is glass (white 86 %, navy 62 % in
dark); once the hero has scrolled under it (an `IntersectionObserver` on
`#top`, 88 px margin) it turns solid (`data-solid`). `false` on the server,
so hydration agrees; the switch moves nothing (no layout shift).

The 2.92.0 / 2.94.0 rules are kept:

- Phone (< `sm`): one « Connexion / Inscription » link to `/signin`, two lines.
- From `sm`: « Connexion » (`/signin`), « Inscription » (`/signup`), « Devenir
  transporteur » (the gated carrier flow).
- Signed in: « Ouvrir l'app » (`/home`) only — now at every width.
- FR / EN and the theme menu sit in the bar from `lg`; below `lg` they are in
  the full-screen menu (and the footer), which left a phone room for its one
  door and the menu button.
- Section links (« Comment ça marche », « Demandes récentes »,
  « Transporteurs ») from `xl` only.
- A three-line button (`Menu` icon, « Ouvrir le menu », `aria-expanded`,
  `aria-controls`) at every width.

### 1.2 Full-screen menu

`LandingMenu`, opened by the header's button, behaviour in
`hooks/useMenuDialog.ts`:

- `role="dialog"`, `aria-modal="true"`, labelled « Menu »; `fixed inset-0`,
  `z-[70]`, its own scroll (`data-lenis-prevent`), carries `lp` itself.
- On open: focus moves to the first control; Tab and Shift+Tab go round the
  panel and never leave it; Escape closes; the page behind is locked
  (`overflow: hidden` on `<html>`, Lenis stopped); on close focus returns to
  the button (`preventScroll`). Written by hand, not Radix: the theme switch
  inside would otherwise be a portalled dropdown inside a focus trap.
- Content: the wordmark and a close button; six sections in large type
  (2.1 → 3.6 rem, weight 800, −4 % tracking), numbered 01–06: Demandes
  récentes, Ce que nous transportons, Comment ça marche, Nos engagements,
  Transporteurs, Questions fréquentes. Then real routes only —
  « Créer une demande » `/create`, « Aide » `/help`, « Contact » `/contact`;
  signed out: « Devenir transporteur » (gated flow), « Connexion »,
  « Inscription »; signed in: « Ouvrir l'app ». Then « Préférences »: FR / EN
  and a Clair | Sombre switch (`LandingThemeSwitch`, `aria-pressed`).
- Every link closes the menu. No socials: there are none.
- Lines arrive with a short stagger (`tw-animate-css`), none under reduced
  motion.

## 2. Hero and search card

- A full-bleed video (§2.2) under `.heroShade`: a deep brand-blue gradient,
  strongest where white text sits — the whole band on a phone, the left half
  from `lg`. Over the brightest frame the headline stays above 9:1.
- Badge « Objets, meubles et déménagements · France et étranger », headline
  « Trouvez un transporteur pour vos objets » (2.55 → 4.6 rem, weight 800,
  −4.5 % tracking, leading 1), the subtitle, the card, and under it
  « Publier une demande est gratuit. Vous ne payez qu'en acceptant une
  offre. »
- Layout: headline left and card right from `xl`; stacked below it, the card
  at most 40 rem wide (at 1024 px a column left it too narrow for its four
  labels — seen in Chromium). The section pads 118–140 px at the top to clear
  the floating header; from `xl` it is `min(100svh, 960px)` tall.
- A rotating badge — « Comment ça marche · » on a circle (`textPath`,
  `textLength` so it closes in any language), an arrow in a white disc —
  links to `#how`, from `md`. Turns once in 24 s; still under reduced motion.
- First paint: badge, headline, subtitle and card come in from a light blur
  (`.blurIn`, CSS only, staggered 0–360 ms, ends visible with or without the
  script).

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

### 2.2 Video

- File: `public/videos/landing/hero.webm` (VP9, 1.29 MB) and `hero.mp4`
  (H.264 High, 2.07 MB, `+faststart`), 1280×720, 25 fps, 10.8 s, **no audio
  track**, seamless loop (the cut's first 0.8 s crossfaded into its tail);
  poster `hero-poster.webp` (26 KB), the loop's first frame.
- Source: « Vidéo autoroute A6 française direction Paris aux environs de
  l'aire de la Repotte (Maconge) », Benoît Prieur, Wikimedia Commons,
  **CC0 1.0** (checked on the file page and the API:
  `LicenseShortName: CC0`, `AttributionRequired: false`), downloaded
  2026-11-24. No people, no brands, plates a few pixels wide; the only text is
  road signage. Full record: `public/videos/landing/CREDITS.md`.
- Rendering (`LandingHeroVideo`): the poster is a server-rendered
  `next/image` with `priority`, so first paint is never blank and no video
  frame competes for LCP. The `<video>` is added **after mount** and only when
  `prefers-reduced-motion` is not `reduce` and `navigator.connection.saveData`
  is not `true`; no `matchMedia` counts as « reduce ». Attributes: `muted`,
  `loop`, `playsInline`, `autoPlay`, `preload="metadata"`, `poster`,
  `aria-hidden`, `object-cover`; WebM listed before MP4. It fades in over the
  poster on `playing`, and pauses whenever the hero is off screen
  (`IntersectionObserver`). The whole layer is `aria-hidden`.

## 3. The other sections

**Copy rule.** Everything said is a rule the app enforces or a field the form
asks. No numbers, ratings, speeds or guarantees (`payout-claims.test.ts`
scans the catalogues).

- **Marquee** (`LandingMarquee`): « Canapé · Armoire · Lave-linge ·
  Réfrigérateur · Piano · Vélo · Moto · Tableau · Palette · Carton de
  déménagement · Matelas · Valise · Mobilier de jardin · Colis ·
  Déménagement ». The words are **the request form's own suggestions**
  (`create.what.itemSuggestions`, `MARQUEE_ITEMS`) plus
  `marketing.recent.kind.moving`, so the strip cannot list something the form
  does not offer. Written twice for a seamless 60 s loop; the copy is
  `aria-hidden`; pauses on hover; under reduced motion it stops, the copy
  disappears and the list wraps, centred. Labelled « Ce que l'on fait
  transporter avec Expeditop ».
- **Ce que nous transportons** (`LandingServices`, `#shippers`): WAI-ARIA tabs
  with automatic activation (arrows, Home, End; roving `tabindex`; each tab
  `aria-controls` its panel, each panel `aria-labelledby` its tab). Below `sm`
  a 2×2 grid of pills; from `sm` four columns with a 3 px underline. Each
  panel: a 4:3 photograph, an icon, a title, two lines, one button.
  - Colis et objets — weight, size, a photo if wished → `/create`
  - Meubles et électroménager — the floor and the lift at each address, help
    loading (`create.where.floor|lift`, `create.what.help`) → `/create`
  - Déménagement — surface or volume, photos of the rooms
    (`create.moving.*`) → `/create?type=moving` (« Demander un devis
    déménagement », the moving form's own title)
  - France et étranger — each address has its country; the postal code and
    the map follow it (`src/lib/countries.ts`) → `/create`
- **Comment ça marche ?** (`marketing.howItWorks.*`): « Simple et rapide »,
  three steps — describe, receive offers (price and slots, messages), choose
  and pay at acceptance (photos at both handovers) — each an 88 px disc with
  its icon and a « 01 »–« 03 » badge, joined by dashed connectors (across from
  `md`, down on a phone); one « Publier une demande » button.
- **Nos engagements** (`LandingPromises`, `marketing.trust.*`), the
  reference's perks layout: four numbered cards around a central photograph
  (1 and 2 above, 3 and 4 below, three dashed rings behind) from `lg`; the
  photo then the cards on a phone. Each item with its source:
  - « Paiement à l'acceptation » — `payment_at_booking_spec.md`, `pay_at_accept_spec.md`
  - « Transporteurs vérifiés » (in-house and professional, checked before the
    first offer) — approval is never automatic, `driver_types_spec.md` §3.1
  - « Photos au retrait et à la livraison » (each carries place and time) —
    `shipment_photos_spec.md`
  - « Remboursé en cas d'annulation » (before pickup) — `cancellations_spec.md`
- **Vous transportez ?** (`LandingCarriers`, `#carriers`), the reference's dark
  band in navy: four points — open requests and your own price; declared
  trajets to find jobs on your road (`carrier_trips_spec.md`); the file is
  checked before the first offer; « une fois la livraison enregistrée, la
  course rejoint votre solde : vous demandez un retrait, versé par virement »
  (`payout_safety_spec.md`). **No delay and nothing automatic is promised**:
  an operator transfers a withdrawal by hand. The gated button — « Devenir
  transporteur », or « Ouvrir votre profil » with a session
  (`landing_gated_actions_spec.md` §6). The photograph drifts slowly (26 s).
- **Questions fréquentes** (`LandingFaq`, `#faq`): six questions, one open at
  a time, the first open on arrival. Four are `/help`'s own, word for word
  (`help.faq.q2`, `q5`, `q3`, `q1`), so the pages cannot drift; two are the
  landing's: « Combien coûte une demande ? » (free to post; the offer's price
  plus the service fee, both shown before paying — `pay_at_accept_spec.md`)
  and « Qui sont les transporteurs ? » (in-house and professional, file and
  vehicle checked by the team, approval never automatic). Each question is a
  `<button>` in an `<h3>` with `aria-expanded` / `aria-controls`; each answer a
  `role="region"` labelled by its question, `hidden` when closed. Ends on
  « Une autre question ? » → `/help`, `/contact` (no dead end).
- **Closing band** (`LandingCTA`, `#cta`): « Quelque chose à faire
  transporter ? », « Publier une demande » (white) and the carrier button
  (outlined). The photograph fills the band under a strong blue on a phone;
  from `lg` it is the right 58 %, starting in the band's own blue so there is
  no seam.
- **Footer** (`LandingFooter`), the reference's manner in our brand: navy in
  both themes (`.footer` re-points the `lp` palette), the wordmark and one
  line, three columns — « Expédier » (Publier une demande, Comment ça marche,
  Demandes récentes, Maisons de ventes), « Transporter » (Devenir transporteur
  `/#carriers`, Vérification), « Aide et légal » (Aide, Contact, Journal des
  versions, CGV, Mentions légales, Politique de confidentialité) — then the
  bottom line: ©, the running version, the group with « Expedion —
  acheteurs » (the only outside link, new tab, `noreferrer`), FR / EN and the
  theme. No socials, no newsletter. `flush` drops its top margin on the
  landing.

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
- 2.97.0 restyled the cards only: 22 px radius, the home tokens, a lift on
  hover (none under reduced motion), and the trajet drawn as two dots joined
  by a dotted line, pickup above delivery. What they say is unchanged.
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

## 6. Photographs, video, motion

### 6.1 Photographs

- Public domain only (CC0 or PDM), found through Openverse, no watermark, no
  recognisable face, no brand or plate a viewer would read. Credits, licences
  and Openverse ids: `public/images/landing/CREDITS.md`.
- Files (all StockSnap CC0, WebP q80 via sharp, metadata stripped):
  `hero.webp` 960×1200 (kraft parcel tags — now the promises' centre),
  `shipper.webp` 960×600 (a sofa — furniture tab), `carrier.webp` 960×600
  (the motorway from the driver's seat — carriers' band), `packing.webp`
  720×540 (hands closing a box — moving tab); added in 2.97.0:
  `parcel.webp` 720×540 (a shipping box, « Cardboard Box », Matt Bango —
  parcels tab), `europe.webp` 960×494 (« Mountain Road », Jonatan Pie —
  abroad tab), `closing.webp` 960×640 (« White Van », Forrest Cavale —
  closing band). 17–64 KB each.
- `next.config` serves images unoptimised, so the sizes in
  `landing-images.ts` are what the browser downloads.
- `next/image` with width/height and `sizes`; only the video poster is
  `priority`; alt text in `marketing.images.*`, both catalogues. One
  treatment: 26–32 px radius, a hairline ring, the home shadow.

### 6.2 Motion

All motion is progressive enhancement, and all of it stops under
`prefers-reduced-motion: reduce`.

- **Lenis** (`lenis@1.3.26`, loaded with a dynamic `import()` after mount) on
  the home page only — `LandingMotion` creates it and destroys it on unmount,
  so no other page and none of the app shells (which scroll inside `<main>`,
  gotcha 14) ever run it. Never on touch (`(hover: hover) and (pointer:
  fine)` required), never under reduced motion. `lenis/dist/lenis.css` is
  imported (its rules only apply to `html.lenis`).
- **Anchors** under Lenis: a capture-phase click listener catches same-page
  links (`/#how`, `#how` — `samePageHash`), cancels Next's own instant jump,
  pushes the hash and glides with `scrollTo(…, { force: true })` one frame
  later (a menu closing on the same click has unlocked the page first:
  Lenis's `start()` resets a scroll in flight). Lenis honours each section's
  `scroll-margin-top`, so every anchor lands 92 px down, under the bar —
  checked from the bar, the menu, the footer, and on touch (native jump).
- **Reveal**: blocks marked `data-reveal` fade up from a 6 px blur as they
  enter (0.8 s, staggered with `--lp-delay`). Hidden only under
  `html.lp-motion`, which `LandingMotion` sets in a layout effect **after**
  marking every block already on screen as in — so nothing visible blinks,
  and without the script (or with reduced motion) every block is in the
  server HTML and visible. Async content (the recent cards) sits inside a
  stable revealed container.
- **CSS only**: the hero's blur-in, the badge's turn, the marquee, the
  carriers' photo drift, the menu's stagger, hover lifts. `landing.module.css`
  stops each one under reduced motion.

## 7. Theme, accessibility, widths

- Light and dark through the app toggle (`.dark` on `<html>`). The home
  tokens live once on `.home` (`--h-bg`, `--h-alt`, `--h-card`, `--h-line`,
  `--h-text`, `--h-muted`, `--h-accent`, `--h-accent-text`, `--h-navy`,
  `--h-shadow`); dark moves them onto deep navy (#06122A / #091A37 /
  #0D2144), never grey. The search card's own dark palette moved from grey
  (#141A21) to the same navy; its fields, order and behaviour are unchanged.
- Type: Plus Jakarta Sans throughout; H1 weight 800, −4.5 %; H2 weight 800,
  −3.5 %, 2 → 3.25 rem (`H_H2`).
- Contrast: white on #076BE3 is 5.0:1, on the closing band's #0753B8 7.2:1;
  muted text ≥ 4.5:1 on its surface; primary-coloured text in dark is #8FB8FF.
- Checked in Chromium at 390, 1024 and 1440 in both themes (Dark chosen
  through the menu's own switch), WebKit at 1024; no horizontal scroll; no
  console errors or hydration warnings on the page.
- Every field labelled; every button has text or a name; focus rings on
  fields, chips, tabs, questions, buttons and the card links; sizes in rem
  (the root is 17 px below `lg`).

## 8. Copy

Patches: `~/.claude/projects/-Users-darwinprayoga-Code-expeditoo-ship/tools/i18n-2.96.0-landing.json`
(2.96.0, 82 keys) and `…/i18n-2.97.0-landing.json` (2.97.0, 62 keys set and 4 deleted per
catalogue, identical key sets).

- **2.97.0 set:** `marketing.navbar.menu|menuOpen|menuClose|menuSections|menuPreferences|services|promises|faq|request|help|contact`;
  `marketing.hero.howLink|howBadge`; `marketing.marquee.label`;
  `marketing.recent.eyebrow`; `marketing.services.*`;
  `marketing.trust.eyebrow|title|intro`; `marketing.carriers.*`;
  `marketing.faq.*`; `marketing.images.parcel|europe|closing`;
  `marketing.footer.carriers` (« Transporter »), `helpLegal`, `help`.
- **2.97.0 deleted:** `marketing.audiences` (the two-audience cards became the
  services tabs and the carriers' band), `marketing.trust.label`,
  `marketing.footer.group|legal`.
- **Reused, not copied:** `help.faq.q1|q2|q3|q5` (FAQ),
  `create.what.itemSuggestions.*` (marquee).

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
- `LandingPage.test.tsx` — the eight sections in order; every publish door to
  `/create`; carrier buttons in `#carriers` and `#cta`; every photo lazy with
  alt text, the poster the only eager image (empty alt, `aria-hidden`); no
  video without `matchMedia`; `data-reveal` blocks present and `lp-motion`
  not set by rendering; the card (four labelled fields, the submit URL, blank
  submit, GET fallback, chips and focus, caps); `buildCreateUrl`; recent
  requests (skeleton, cards, single-day date, casing, empty and failure states
  with retry).
- `LandingMenu.test.tsx` — closed by default; opens as a modal dialog with
  `aria-expanded` / `aria-controls`, focus inside, page locked; Escape and the
  close button close it, unlock, return focus; Tab wraps both ways; the six
  sections in order, following one closes it; routes all have a page on
  disk, no outside or mail link; signed-out vs signed-in doors; the language
  group and the Clair | Sombre switch.
- `LandingSections.test.tsx` — tabs (one panel, roving `tabindex`,
  arrows / Home / End with wrap, the moving tab → `/create?type=moving`); FAQ
  (six, `/help`'s answer word for word, one open at a time, region named by
  its question, the way on); marquee (exactly the form's suggestions plus
  « Déménagement », the copy `aria-hidden`); video (poster only without
  `matchMedia`, under reduced motion and with Save-Data; otherwise muted,
  autoplay, loop, playsinline, `preload="metadata"`, poster, `aria-hidden`,
  WebM then MP4); reveal (nothing under reduced motion; on-screen blocks marked
  before `lp-motion`, removed on unmount).
- `landing-anchors.test.tsx` (header, footer and the open menu),
  `LandingNavbar.test.tsx` (2.92.0 doors; preferences from `lg`; « Ouvrir
  l'app » at every width), `LandingFooter.test.tsx` (pages on disk, three
  anchors, three columns, toggles, one outside link), `LandingSessionCtas.test.tsx`,
  `LandingPage.i18n.test.tsx` (both catalogues), `display-text.test.ts`,
  `no-dead-ends.test.ts`, `payout-claims.test.ts`, `i18n-keys.test.ts`.
