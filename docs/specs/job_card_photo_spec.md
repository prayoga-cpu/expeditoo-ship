# Spec: The job card's photo

## 1. Overview

The board at `/expedion` described every job in words alone. A driver deciding
whether "Chaise" is a dining chair or a wing-back armchair had to open the job
to find out, and the answer changes the vehicle, the price and whether the job
is worth bidding on at all.

The card now leads with the job's first photo.

- **Component**: `src/features/app/home/ui/JobCard.tsx`
- **Consumers**: `/expedion` (`JobBoard`), and anything else that renders a
  `BoardJob`.

## 2. Which photo

The photo with the **lowest `order`**.

`order` is the index the photo was uploaded at — `listingsService.createListing`
numbers `data.photos` from the array, so photo zero is the one the requester put
first. For a job escalated from Expedion the array is the quote's `photoUrls`,
capped at ten (`expedion-escalation.service.ts`).

Two things enforce this, deliberately:

- `photosInOrder` in `src/server/dal/listings.dal.ts` sorts the `photos`
  relation on every read that returns it — `browse`, `getById`,
  `getByExternalRef`, `getByShipperId`. Without it Postgres may return the rows
  in any order, so "the first photo" would be a different photo between two
  loads of the same board.
- `leadPhotoUrl` in the card picks the minimum `order` rather than trusting
  `photos[0]`. The failure it guards against is silent: a card quietly showing
  a different photo on each load reports nothing and breaks no test.

No new endpoint and no new query. `GET /api/listings` already returns the
`photos` relation on every row.

## 3. Rendering

| Case | What is drawn |
|---|---|
| Job has a photo that loads | `<img>`, `object-cover`, `alt` = the job title |
| Job has no photo | Placeholder: `Package` icon on `bg-muted` |
| Photo fails to load | Placeholder, from the `<img>`'s `onError` |

The slot is drawn in all three cases, at `h-16 w-16` and `h-20 w-20` from `sm`,
so a board mixing jobs that have a photo with jobs that do not keeps one left
edge instead of two.

- `alt` is the job title, not a description of the picture: the photo is the
  job, and a driver using a screen reader gets the same fact either way.
- The placeholder icon is `aria-hidden`; there is nothing there to announce.
- `loading="lazy"` and `decoding="async"`, because twenty of these load at once.
- Both themes: `bg-muted`, `border-border` and `text-muted-foreground` only.

## 4. Known gap: a driver cannot see an Expedion job's photos

**A photo uploaded to an Expedion quote since the R2 storage move is an
`/api/expedion/files/<id>` URL, and that route serves the quote's owner or an
admin and nobody else** (`src/app/api/expedion/files/[id]/route.ts`). A driver
browsing the board is neither, so the request 404s and the card falls back to
the placeholder. Legacy Firebase download URLs on older quotes still resolve and
do show.

That is why the `onError` fallback exists rather than being defensive padding —
on today's data it is the path the Expedion inlet actually takes.

Closing the gap is a **permission decision, not a UI one**, and it is not made
here: `GET /api/listings` takes no session at all, so widening that route to
"anyone who can see an open listing" would put auction-lot photos in front of
anonymous visitors. The two candidate fixes are to copy the photo into public
listing storage at escalation time, or to serve it through a listing-scoped
route that checks the viewer. Whoever picks one should say so in
`expedion_post_payment_fork_spec.md`.

## 5. Test coverage required

`src/features/app/home/ui/__tests__/JobCard.test.tsx`

- The lead photo is rendered, named by the job it belongs to.
- The lowest `order` wins even when the array arrives in another order.
- A job with no photos draws the placeholder, not an `<img>`.
- A photo that raises `error` draws the placeholder — the Expedion case above.
- The route, the load and the budget still render alongside the photo.

Chromium, not jsdom, for the rest (see the `verify-ui-in-a-real-browser` note):
the photo, the placeholder and the `onError` fallback were each confirmed on the
running board in light and dark, at 1180px and at 390px.
