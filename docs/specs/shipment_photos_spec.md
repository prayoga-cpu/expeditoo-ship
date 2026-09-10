# Pickup & delivery photos

`shipment_photos` · `src/server/services/shipment-photos.service.ts`

Plan: [`plan_shipment_photos.md`](../plans/plan_shipment_photos.md)
Related: [`shipment_spec.md`](./shipment_spec.md) §3 (the state machine this
gates), [`transport_status_confirmation_spec.md`](./transport_status_confirmation_spec.md)
(the client's other half of the same two moments)

---

## 1. What this is for

Two moments decide every dispute about a transport job: the moment the goods
leave, and the moment they arrive. Until now the platform held one photo of the
second and nothing at all of the first, so "it was already scratched" and "it
arrived scratched" were two assertions with no evidence between them.

A shipment photo is **evidence**, and that word decides every design choice
below. Evidence has to be taken at the moment it claims to describe, it has to
carry where it was taken, and it must not be editable by anyone with an
interest in the outcome.

## 2. The record

### 2.1 `shipment_photos`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | `nanoid()` |
| `shipment_id` | `text` NOT NULL → `shipments.id` | `ON DELETE CASCADE` |
| `stage` | `shipment_photo_stage` NOT NULL | `pickup` \| `delivery` |
| `object_key` | `text` NOT NULL | Private R2 key. **Never** leaves the server. |
| `mime_type` | `text` NOT NULL | Always `image/webp` — everything is re-encoded |
| `size_bytes` | `integer` NOT NULL | After stamping and compression |
| `captured_lat` | `double precision` NOT NULL | |
| `captured_lng` | `double precision` NOT NULL | |
| `captured_accuracy_m` | `double precision` | The fix's own error radius; null when the device did not report one |
| `captured_address` | `text` | Reverse-geocoded label, best effort (§5.3) |
| `captured_at` | `timestamp` NOT NULL | The **device** clock at the fix |
| `recorded_at` | `timestamp` NOT NULL | The **server** clock at upload |
| `uploaded_by_user_id` | `text` → `user.id` | `ON DELETE SET NULL` |
| `deleted_at` | `timestamp` | Admin removal only (§6.3) |
| `deleted_by_user_id` | `text` → `user.id` | `ON DELETE SET NULL` |
| `deletion_reason` | `text` | Required when `deleted_at` is set |
| `created_at` | `timestamp` NOT NULL | |

Indexes: `shipment_photo_shipment_idx` on `shipment_id`, and
`shipment_photo_stage_idx` on `(shipment_id, stage)` — every read is scoped to
one shipment, and the transition gate counts one stage of one shipment.

**Two timestamps, on purpose.** `captured_at` comes from
`GeolocationPosition.timestamp`, which is the device's clock and is therefore
whatever the device says it is. `recorded_at` is the server's, and it is the
one the burn-in stamps and the one any dispute is argued from. Storing the
device's as well costs one column and is the only way to notice a device whose
clock is hours out.

### 2.2 What is *not* stored

- **No public URL.** The row holds an object key, and the object lives in the
  private bucket (§4). A photo of someone's furniture standing in their hallway
  is not a thing to hand out a permanent link to.
- **No EXIF.** Sharp re-encodes to WebP and drops the metadata block, the
  device's own GPS tags included. Those tags are editable with a text editor,
  which makes them worthless as evidence; the coordinates that matter arrive as
  a separate, server-recorded field.

### 2.3 What happens to `shipments.proof_of_delivery_url`

Dropped. It was a single public URL for a single delivery photo, and every one
of those three properties is now wrong.

The migration does not try to convert existing values into `shipment_photos`
rows: the new table requires a private object key and a location, and a legacy
row has neither, so any conversion would be inventing the very facts the table
exists to guarantee. Instead each non-null value is appended to
`shipment_events` as a `system` row whose metadata carries
`legacyProofOfDeliveryUrl`. The timeline is append-only history and is already
rendered, so nothing is lost and nothing is fabricated.

## 3. Capture

### 3.1 The one endpoint

```
POST /api/shipments/:id/photos      multipart/form-data
  file        the image
  stage       "pickup" | "delivery"
  lat         number
  lng         number
  accuracyM   number, optional
  capturedAt  ISO 8601, the device clock at the fix
```

Multipart rather than the two-leg `/api/upload` → attach dance the old proof of
delivery used, because the location and the bytes have to arrive **together**.
The whole claim of the feature is that this picture was taken there and then;
an endpoint that accepts a URL and a location separately is an endpoint that
accepts any picture with any location.

### 3.2 Who may capture

`carrier`, `driver` or `staff` on that shipment — the same set that may move
its status. `shipper` may not: the client reads this evidence, and evidence one
party can add to is not evidence.

### 3.3 When

| Stage | Allowed shipment status | Error otherwise |
|---|---|---|
| `pickup` | `ASSIGNED` | `PHOTO_STAGE_NOT_OPEN` (409) |
| `delivery` | `IN_TRANSIT` | `PHOTO_STAGE_NOT_OPEN` (409) |

Narrow on purpose. A pickup photo is only worth anything if it was taken before
the goods moved, so the window closes the instant the run advances past it.
This is safe precisely because the transition itself is gated (§3.6): the
driver cannot skip past `ASSIGNED` without having photographed, so there is no
state in which they needed the window and it was shut.

### 3.4 Validation

| Rule | Error | Status |
|---|---|---|
| `file` present | `NO_FILE` | 400 |
| `file.type` starts `image/` | `INVALID_FILE_TYPE` | 415 |
| Decoded size ≤ 12 MB | `FILE_TOO_LARGE` | 413 |
| `lat` in [−90, 90], `lng` in [−180, 180] | `LOCATION_REQUIRED` | 400 |
| `lat`/`lng` present at all | `LOCATION_REQUIRED` | 400 |
| `capturedAt` parses as a date | `LOCATION_REQUIRED` | 400 |
| ≤ 6 live photos already at this stage | `PHOTO_LIMIT_REACHED` | 409 |

`LOCATION_REQUIRED` covers a missing, unparseable or out-of-range fix as one
code because the driver's remedy is the same for all three: allow location and
take the photo again. The UI never gets as far as posting without a fix (§7.1),
so this is the defence against a client that has been tampered with, not a
routine path.

The 12 MB cap is on what the browser sends. Modern phone cameras produce
4–8 MB; the cap exists to bound the function's memory, and everything is
re-encoded down to WebP immediately after.

### 3.5 What the server does with the bytes

1. Read the multipart file into a buffer.
2. Reverse-geocode `lat`/`lng` (§5.3). Best effort, 2.5 s budget.
3. **Stamp** (§5): resize to fit 1920×1920, burn the location panel into the
   bottom of the frame, encode WebP quality 82.
4. `PUT` to the private bucket under `shipments/<shipmentId>/<stage>-<nanoid()>`.
5. Insert the row.
6. Append a `shipment_events` row — status unchanged, `note` naming the stage
   — so the photo shows on the timeline both parties already read.

The order matters. The object is written before the row, so a crash leaves an
orphan object (swept by nothing, costing pennies) rather than a row pointing at
nothing (a broken image in the client's face). The stamp happens before the
upload, so **no unstamped copy is ever stored**.

### 3.6 The transition gate

`shipmentService.updateStatus` refuses two moves without evidence:

| Move | Requires | Error |
|---|---|---|
| `ASSIGNED → PICKED_UP` | ≥ 1 live `pickup` photo | `PICKUP_PHOTO_REQUIRED` (409) |
| `IN_TRANSIT → DELIVERED` | ≥ 1 live `delivery` photo | `DELIVERY_PHOTO_REQUIRED` (409) |

"Live" means not soft-deleted. Every other transition is untouched —
`PICKED_UP → IN_TRANSIT` needs nothing new, and `→ CANCELLED` is never blocked,
because a job that is being called off is the last thing that should demand a
photograph first.

The gate applies to `staff` as well. An operator moving a stuck run is exactly
the case where the record most needs to say what was seen, and support already
has `cancelShipment` for a run that genuinely cannot proceed.

`POST /api/shipments/:id/proof-of-delivery` and
`shipmentService.uploadProofOfDelivery` are **deleted**. Attaching evidence and
settling money were one call; they are now two, and the second one refuses
until the first has happened.

## 4. Storage

The private bucket, reached through `shipmentPhotoStorageService`, which is
built on the shared factory in `src/server/services/storage/private-r2.ts`.

`R2_SHIPMENT_BUCKET_NAME`, falling back to `R2_KYC_BUCKET_NAME` and then to
`R2_EXPEDION_BUCKET_NAME`. **There is no fallback to `R2_BUCKET_NAME`**, and
that omission is load-bearing rather than an oversight, for the same reason it
is in `expedion-storage.service.ts`: `imageCleanupService.performCleanup` lists
every object in the public bucket and deletes anything not referenced by
`user.image`, `categories.image`, `photos.url` or `messages.attachmentUrl`.
Shipment photos are referenced by none of those, so the nightly cron would
delete every one of them. Refusing to start is a far better outcome than
starting and being quietly emptied.

`imageCleanupService` also loses its `shipments.proofOfDeliveryUrl` scan, since
the column no longer exists.

## 5. The burn-in

### 5.1 Why the pixels and not just the row

A photo travels. It gets screenshotted into an email, forwarded to an insurer,
pasted into a claim. The database row is authoritative, but it does not travel
with the image, and an image with no context is an image anyone can say
anything about. Stamping puts the claim on the artefact.

### 5.2 What the panel says

A dark translucent band across the bottom of the frame, three lines:

```
RETRAIT · 29/08/2026 14:32 (Europe/Paris)
12 rue de la Paix, 75002 Paris
48.86919, 2.33144 · ±8 m · EXP-4f3a9c
```

- Line 1: the stage, and the **server** timestamp (`recorded_at`) in
  Europe/Paris. The device's own clock is recorded but never stamped — it is
  the one number in this feature that the person holding the camera controls.
- Line 2: the reverse-geocoded address, omitted entirely when §5.3 came back
  empty. No placeholder: a blank line is honest, "Unknown location" reads like
  a failure of the evidence rather than of a geocoder.
- Line 3: coordinates to five decimals (~1 m), the accuracy radius when the
  device reported one, and the shipment's short id.

Text is XML-escaped before it reaches the SVG. A reverse-geocoded street name
is third-party input, and an unescaped `&` in it breaks the whole overlay.

### 5.3 Reverse geocoding

`reverseGeocode` from `src/lib/geocoding.ts` (Nominatim), with a 2.5 s
`AbortController` budget and every failure swallowed. `captured_address` stays
null and line 2 is omitted. A geocoder being slow must never cost a driver
their delivery.

### 5.4 The font is bundled

Sharp renders the SVG overlay through librsvg, which finds fonts through
fontconfig — that is, through whatever the host provides. A serverless runtime
provides nothing, so the band shipped to production as **a black bar with no
glyphs** while rendering correctly on a developer's macOS machine, which answers
through CoreText and ignores fontconfig entirely.

Resolved in 2.39.0. `fonts/` holds Inter (SIL Open Font License) and the
`fonts.conf` that points fontconfig at it; `photo-stamp.service.ts` sets
`FONTCONFIG_PATH` at module scope — fontconfig reads it once, on the first
render, so setting it inside the render call would be a race — and only when the
config is actually present, so a wrong working directory leaves a host's own
fontconfig alone rather than blinding it. `next.config.mjs` traces the directory
into the function, because nothing imports these files and the tracer would
otherwise drop them.

**Still unproven from a laptop**: local rendering succeeds either way, so only a
deploy confirms the band has letters on the live host. The database row remains
the authoritative record and the UI renders the same three lines as text beside
every photo (§7.2), so the failure mode was always a loss of convenience, not of
evidence. See `docs/specs/stripe_connect_spec.md` for the sibling session's
notes on diagnosing this class of host-only fault from `vercel logs`.

## 6. Reading, and not editing

### 6.1 Listing

```
GET /api/shipments/:id/photos  →  { pickup: PhotoView[], delivery: PhotoView[] }
```

`PhotoView` carries `id`, `stage`, `url` (pointing back at §6.2, never at R2),
`capturedLat`, `capturedLng`, `capturedAccuracyM`, `capturedAddress`,
`capturedAt`, `recordedAt`. Soft-deleted rows are absent.

Any party to the shipment — `shipper`, `carrier`, `driver` — plus `staff`.
**The shipper is the client**, and this is the line that answers "the client
should have access to these photos" for a direct listing.

### 6.2 Fetching one

```
GET /api/shipments/:id/photos/:photoId  →  302 → presigned URL, 5 minutes
```

Authorise, then redirect, exactly as `/api/expedion/files/:id` does: the
redirect keeps multi-megabyte images out of the function's response budget, and
an `<img>` follows it without knowing anything happened.
`Cache-Control: private, no-store`, because the target is short-lived and
caller-specific and a shared cache holding it would serve the next reader a
link that skipped the check.

A photo whose id does not belong to the shipment in the path is a 404, not a
403 — same rule as the Expedion files route, so a caller cannot probe for which
ids exist by watching the two answers diverge.

### 6.3 Editing

There is no update path. No `PATCH`, no `PUT`, no service method — not for the
image, not for the location, not for the timestamps. This is not enforced by a
permission check that could be widened later; it is enforced by the absence of
code that could do it.

Removal is admin-only and soft:

```
DELETE /api/shipments/:id/photos/:photoId   { reason: string (3..500) }
```

- `viewer.isAdmin` only. **An operator is not enough** — operators award jobs
  and would be deciding a dispute about evidence they can remove.
  `FORBIDDEN` (403) otherwise.
- Sets `deleted_at`, `deleted_by_user_id`, `deletion_reason`. The row and the
  R2 object both survive; only the listings stop showing it.
- Appends a `shipment_events` row with `actorRole: "admin"` naming the deleted
  photo and the reason, so a removal is itself on the record.
- Deleting the last photo of a stage does **not** roll a status back. The
  transition was legal when it happened, and rewriting history to match a later
  deletion is not what an audit trail is.

## 7. Surfaces

### 7.1 The driver, capturing

`ShipmentActions`, in the `ASSIGNED` and `IN_TRANSIT` blocks. Both follow the
same shape: a camera button, a strip of thumbnails of what has been taken, and
the advance button disabled until at least one exists.

The location comes from `navigator.geolocation.getCurrentPosition` with
`enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 15000` — a **fresh** fix
per photo, requested at the moment the file is chosen, not a cached one.

Failure is explicit, never silent:

| Cause | What the driver sees |
|---|---|
| Permission denied | "Location is required for delivery photos. Allow location access and try again." |
| Position unavailable / timeout | "Could not get your location. Move somewhere with a clearer view of the sky and try again." |
| No geolocation API at all | The same, plus the capture button is disabled |

There is no "continue without location". A photo with no location does not
answer the question the feature was built to answer.

The advance button carries the reason it is disabled — "Take at least one photo
of the load first" — rather than being merely grey. A disabled control with no
explanation is how a driver ends up calling support.

### 7.2 The client, on the web

`/deliveries/[id]`, a `ShipmentPhotos` section below the timeline: two groups,
*Photos au retrait* and *Photos à la livraison*, each a responsive thumbnail
grid opening a full-size dialog. Under every thumbnail, as **text**: the
timestamp, the address when known, and the coordinates. Light and dark both,
per the design system.

Empty groups render a one-line "No photos yet" rather than being hidden, so a
client looking for pickup photos on a run that has not been collected learns
that from the screen instead of guessing.

### 7.3 The client, on the Expedion app

Escalated jobs belong to the Expedion system account, so their client is a
quote owner with no `user` row and no party seat — §6.1 cannot reach them.
Two routes, authorised by `requireExpedionCaller` (quote owner or admin) the
way the rest of `/api/expedion` is:

```
GET /api/expedion/quotes/:id/photos            →  { pickup: [...], delivery: [...] }
GET /api/expedion/quotes/:id/photos/:photoId   →  302 → presigned URL
```

Both resolve quote → `listing_id` → shipment → photos. A quote with no listing
yet, or a listing with no shipment yet, answers `200` with two empty arrays
rather than a 404: "nothing has been photographed yet" is a normal state on a
tracking screen, not an error.

`expedionBridgeService.onShipmentStatus` carries `pickupPhotoCount` and
`deliveryPhotoCount` in its event metadata, so the tracking feed can say
photos are available without a second call.

The Flutter half — `ExpedionApi.listShipmentPhotos` and a gallery on
`suivi_de_livraison` — lives in `expedion_encheres` and is listed as step 17 of
the plan.

## 8. Error codes

| Code | Status | Meaning |
|---|---|---|
| `NO_FILE` | 400 | Multipart had no `file` part |
| `LOCATION_REQUIRED` | 400 | Missing, unparseable or out-of-range fix |
| `INVALID_FILE_TYPE` | 415 | Not an `image/*` |
| `FILE_TOO_LARGE` | 413 | Over 12 MB |
| `PHOTO_STAGE_NOT_OPEN` | 409 | Stage does not match the shipment's status |
| `PHOTO_LIMIT_REACHED` | 409 | Already 6 live photos at this stage |
| `PICKUP_PHOTO_REQUIRED` | 409 | `→ PICKED_UP` with no pickup photo |
| `DELIVERY_PHOTO_REQUIRED` | 409 | `→ DELIVERED` with no delivery photo |
| `PHOTO_NOT_FOUND` | 404 | No such photo, or not on this shipment |
| `FORBIDDEN` | 403 | Not a party; or delete attempted by a non-admin |
| `SHIPMENT_NOT_FOUND` | 404 | |

## 9. Test coverage required

**`shipment-photos.service`**
- Capture refuses a `shipper`, accepts `carrier` / `driver` / `staff`
- `pickup` refused unless `ASSIGNED`; `delivery` refused unless `IN_TRANSIT`
- Out-of-range and missing coordinates both give `LOCATION_REQUIRED`
- The seventh photo of a stage gives `PHOTO_LIMIT_REACHED`; the seventh after a
  deletion is accepted
- The object is stamped before it is uploaded — the buffer handed to storage is
  not the buffer that came in
- A reverse-geocode failure still produces a photo, with a null address
- Listing excludes soft-deleted rows
- Reading a photo belonging to another shipment gives `PHOTO_NOT_FOUND`, and
  mints no presigned URL doing it
- Delete refused for `operator`, allowed for `admin`; the row survives and an
  event is written

**`shipment.service`**
- `ASSIGNED → PICKED_UP` blocked with no pickup photo, allowed with one
- `IN_TRANSIT → DELIVERED` blocked with no delivery photo, allowed with one
- A soft-deleted photo does not satisfy either gate
- `→ CANCELLED` is never blocked
- `staff` is gated the same as a driver
- No payment is captured when the gate refuses

**`photo-stamp.service`**
- Output is WebP, and smaller in both dimensions than a 4000px input
- EXIF is absent from the output
- An address containing `&` and `<` does not corrupt the overlay
- A null address produces a two-line panel, not a blank middle line

**Routes**
- `POST /api/shipments/:id/photos` without a session is 401 and stores nothing
- `GET …/photos/:photoId` sets `Cache-Control: private, no-store`
- `GET /api/expedion/quotes/:id/photos` refuses a non-owner, and answers
  `{pickup: [], delivery: []}` for a quote with no shipment yet

**Migration**
- `migrations-journal.test.ts` continues to pass with `0015` registered
