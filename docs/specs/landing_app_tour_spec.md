# « Dans l'application » — the home page's tour of the app (2.98.0)

## 1. What it is

One section of the home page, between the promises and the carriers band, anchor
`#app`. It follows **one transport** through eight steps and shows, for each, the
app's own screen on a computer and on a phone, and whose screen it is.

| # | Key | Whose | Screen |
|---|---|---|---|
| 1 | `request` | requester | `/create` |
| 2 | `board` | carrier | `/expedion` |
| 3 | `choose` | requester | `/listing/:id`, scrolled to the offers |
| 4 | `messages` | both | `/messages/:id` |
| 5 | `run` | carrier | `/driver/shipments/:id` |
| 6 | `track` | requester | `/deliveries/:id` |
| 7 | `money` | carrier | `/carrier/withdrawals` |
| 8 | `team` | staff | `/admin/drivers` |

## 2. Behaviour

- A tablist (`aria-orientation="vertical"`): a column of steps from `lg`, a sideways
  strip of cards below it. Arrow keys, Home and End move and select; the selected tab
  is the only one in the tab order.
- One panel is open. **Only its two pictures are in the document.**
- From `md` the phone picture overlaps the desktop frame's corner; below `md` only
  the phone picture shows.
- The pictures follow the reader's language (`-fr` / `-en`); they are light theme in
  both themes of the site.
- The frame above the desktop picture names the page (`expeditop.fr/create`).
- A line under the section says the data is fictional.
- Copy: `marketing.tour.*`. A step's description may claim only what
  `CLAUDE.md` §"Core Flow" says the product does.

## 3. The demo data

`pnpm db:seed:demo` — `src/scripts/seed-demo-data.ts`.

- Refuses anything but a local/development database and anything but
  `MOCK_PAYMENTS=true`. Idempotent. Sets the database's timezone to UTC.
- Every write the product has a service for goes through that service, as in
  `seed-beta-data.ts`; history is back-dated afterwards.
- Accounts are `@demo.expeditop.test`, password `DEMO_PASSWORD` (default in the
  script). **Everything in it is invented** — names, streets, phones (ARCEP's fiction
  range), SIRETs, IBANs — because the pictures are published.
- The data is anchored to the day it runs: re-seed on the day of a shoot.

## 4. Re-taking the pictures

1. Recreate and seed `expeditop_demo` (commands at the top of the seed script).
2. Run the app on it with `TZ=Europe/Paris` and `MOCK_PAYMENTS=true`.
3. `node scripts/capture-app-tour.mjs` — signs in to the demo accounts, finds each
   record by what it is, writes `public/images/landing/app/<key>-<desktop|phone>-<fr|en>.webp`
   (1280×800 and 780×1560).

Never point the script at a database holding real people.

## 5. Edge cases

- A step whose picture is missing: `LandingAppTour.test.tsx` fails; the page would
  show a broken image.
- No JavaScript: the first step and its pictures are in the server HTML.
- Reduced motion: nothing here animates.

## 6. Test coverage required

`LandingAppTour.test.tsx`: the 32 files exist; every step and role has copy in both
languages; one panel and two images at a time; arrow keys and End; French pictures
for a French reader. `landing-anchors.test.tsx`: `#app`.
