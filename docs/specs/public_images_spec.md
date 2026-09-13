# Specification: Public images

Covers `GET /api/images/[...key]`, `storageService.readImage`,
`R2StorageProvider.read`, and the `R2_PUBLIC_URL` setting every public upload
depends on.

---

## 1. What was broken

Every image uploaded through `POST /api/upload` showed as a broken image:
feedback screenshots, listing photos on `/create`, incident photos and profile
pictures — the four callers of that route.

The upload itself worked. Production logs show `POST /api/upload` → **200** and
the feedback that carried the screenshot → **201**, and the object is written to
`R2_BUCKET_NAME`. What the route returned was dead:

```
R2_PUBLIC_URL = https://cdn.prayoga.io
upload()      → https://cdn.prayoga.io/<userId>/<nanoid>.webp
```

**`cdn.prayoga.io` has no DNS record** — no A, no CNAME. A browser cannot
reach it, so it is not a 404 and not a CORS or CSP problem: the request never
leaves the machine. Local development was configured with the same value, so
uploaded images have never displayed anywhere.

Private files were never affected. KYC documents, shipment photos and Expedion
files live in separate buckets and are read through short-lived presigned links
that never touch `R2_PUBLIC_URL`.

## 2. The fix, and why this shape

The app serves the public bucket itself, and `R2_PUBLIC_URL` points at that
route:

```
R2_PUBLIC_URL = https://expeditoo-ship-five.vercel.app/api/images   (production)
R2_PUBLIC_URL = http://localhost:3000/api/images                    (local)
```

`upload()` still returns `${R2_PUBLIC_URL}/<key>`, and `delete()` and the image
cleanup cron still strip `${R2_PUBLIC_URL}/` to recover the key. **None of them
changed**, which is the reason for this shape rather than rewriting URLs in each
caller. Binding a real domain to the bucket later is a change to one variable
and no code.

## 3. The route

`GET /api/images/[...key]`, unauthenticated — these objects always had permanent
public URLs.

| Case | Answer |
|---|---|
| Image found | **200**, streamed, stored `Content-Type` |
| No such object | **404** `IMAGE_NOT_FOUND` |
| Stored object is not `image/*` | **404** `IMAGE_NOT_FOUND` |
| Key fails validation (§4) | **400** `INVALID_IMAGE_KEY` |

Headers on 200:

- `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable` — a key
  is `<owner>/<nanoid>.<ext>` and is never reused, so a cached copy cannot go
  stale. Each image costs one function invocation per edge location, not per
  view.
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox`
- `Content-Disposition: inline`

The body is streamed from R2, never buffered.

## 4. What `readImage` refuses

Before storage is asked: an empty key; a key over 512 characters; a leading
`/`; a backslash; a control character; any empty, `.` or `..` segment.

After storage answers: anything whose stored type is not `image/*`, including an
object with no stored type. The stream is cancelled rather than left open.

Everything `POST /api/upload` writes has been re-encoded to WebP by sharp, so the
type check refuses nothing legitimate. It exists because this is the one route
that serves stored bytes from the app's own origin.

## 5. Data already written

URLs are stored whole, so rows written before the fix still name
`cdn.prayoga.io`. In production on 2026-09-13 that was **one** feedback
screenshot; the database had been rebuilt on 2026-09-10. It is corrected with:

```sql
UPDATE feedback_tickets
SET screenshot_urls = replace(screenshot_urls::text,
  'https://cdn.prayoga.io/',
  'https://expeditoo-ship-five.vercel.app/api/images/')::jsonb
WHERE screenshot_urls::text LIKE '%cdn.prayoga.io%';
```

## 6. Known limits

- **The local dev bucket does not exist.** `expeditoo-dev` answers `NotFound` to
  the local credentials, so uploads fail locally before this route is reached.
  Create the bucket, or point `R2_BUCKET_NAME` at one that exists.
- **Preview deployments** share the `R2_PUBLIC_URL` entry with production. Each
  preview has its own hostname, so previews resolve images through production's
  route, which reads the same bucket.
- **Every image now passes through a Vercel function** on its first request per
  edge location. If volume ever makes that matter, bind a domain to the bucket
  and change the variable — §2.

## 7. Test coverage required

- The route streams the stored bytes with the stored type, rejoins nested key
  segments, and sets the cache, `nosniff` and sandboxed CSP headers.
- The route answers 404 and 400 in the standard envelope.
- `readImage` refuses each shape in §4 without calling the provider, returns
  images, and answers not found — cancelling the stream — for non-images and
  untyped objects.
