# Client feedback of 25 November 2026 — spec

**Release:** 2.99.0. Source: Nicolas's WhatsApp messages (1:30–3:27 PM) plus two
owner requests. Decisions taken with the owner the same day.

| # | Point | Reading | Where |
|---|---|---|---|
| 1 | « This icon has to be changed (my offers for shipment — not for auction) » | `Gavel` is an auction symbol. Every carrier- and requester-facing « offers » surface uses `HandCoins` (a price proposal). The operator « Awards » queue keeps the gavel: an operator *awards*. | `MainLayout`, `BottomNav`, `MyOffers`, `DriverDashboard`, `JobCard`, `JobBidSection`, `RequestViews`, `MyRequestsPanel`, `PendingOffersPanel` |
| 2 | « Mes trajets »: typed place, other data fills the fields under the map | §2 below | `location-picker-field.tsx`, `geocoding.ts` |
| 3 + 5 | « Rajouter *partagé* après transport » — the owner placed it on the **headline**: « Trouvez un transporteur *partagé* pour vos objets » (EN « Find a *shared* carrier… »; `marketing.hero.title`). Separately, badge centred, higher, larger, reading « transport d'objets, meubles et déménagements France et étranger » | Owner: *that is the copy*. Badge = « Transport partagé d'objets, meubles et déménagements · France et étranger » (EN: « Shared transport of items, furniture and home moves · France and abroad »). Moved out of the headline column into a centred row under the floating header, 0.95 rem (1.1 rem from `sm`), wraps on a phone. | `LandingHero.tsx`, `marketing.hero.badge` |
| 4 | « Enlever le mot vérifiés après Des transporteurs » | Owner: **every** occurrence. The adjective is removed from running copy in both catalogues, the page titles/descriptions and the welcome mail. Where a title *is* the KYC claim (trust card, FAQ headline) it reads « contrôlés » / "checked" — the claim stays true, the word goes. « Comment les transporteurs sont vérifiés » (the process page) is a verb phrase and stays. | `messages/*.json`, `layout.tsx`, `(marketing)/page.tsx`, `WelcomeEmail.tsx` |
| 6 | Device language before load; French by default | `first_paint_language_spec.md` | `src/i18n/*`, `LocaleProvider`, `layout.tsx` |
| 7 | Signed-in users can open the website | Owner chose the logo itself. `AppSidebarHeader` defaults to `/` and no shell overrides it (app, driver, admin); the phone's top-bar wordmark too. `/` was already public and unredirected; the landing header's « Ouvrir l'app » returns to `/home`. Each shell keeps its own Home / landing entry in the nav. | `AppSidebarHeader`, `MainLayout`, `DriverLayout`, `AdminLayout` |

## 2. « Mes trajets » — why the fields filled with other data

`LocationPickerField` had two compounding faults:

1. A pin's address text was written **only into blank boxes** (so a nudge could
   not overwrite what someone typed). Text a *previous pin* had written counted
   as typed, so the first pin — a stray click on the map, an earlier search —
   fixed the boxes for good and a later search moved the pin but not the text.
2. Picking a search result discarded the hit's own address and reverse-geocoded
   its coordinates, so a *town* search wrote the street nearest the town's
   centre.

Fix:

- A search pick **is** the address: street, city and postal code come from the
  hit itself (`SearchResult` now carries them); a town has no street, so the
  street box is emptied, not filled with a guess. A missing city/postal code
  falls back to the reverse lookup.
- Boxes track whether a person **typed** in them (`typedByHand`). Text a pin
  wrote is replaced by the next pin; text a person typed is still kept on a map
  click or drag (feedback tickets `l5mUHEzi6Ey5tuXL1cWbm`, `7HtRRTGWKRfzuRZValkCr`).
- Switching to the map or link mode resets the flag.

This component also serves `/create` (`allowManualOnly`), where the fields lock
after a pin; the same replacement rule now applies there.

## 3. Test coverage required

- `location-picker-field.search.test.tsx` — a search pick writes the hit's own
  address; a second pick replaces the first pin's text, with a street-less town
  emptying the street box.
- `LandingPage.test.tsx` — badge centred, before the headline, in the larger type.
- `client-feedback-2026-11-25.test.ts` — the badge copy in both languages; no
  `transporteurs/carriers/movers/chauffeurs + vérifiés/verified/vetted` in either
  catalogue.
- `AppSidebarHeader.test.tsx`, `MainLayout.test.tsx`, `AdminNav.roles.test.tsx`
  — the logo opens `/`.
