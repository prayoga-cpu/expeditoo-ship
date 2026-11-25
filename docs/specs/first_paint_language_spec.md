# First-paint language — spec

**Release:** 2.99.0 · **Asked:** 2026-11-25 (owner) — « make sure it detects the
user's device language before the website loads; if not detected, French ».

## 1. The problem

`detectDeviceLocale()` (`src/i18n/config.ts`) read `navigator.languages`
correctly, but only inside a `useEffect` in `LocaleProvider`. The server could
not know the device, so every response was French (`src/i18n/request.ts` was
hard-coded, and so was `<html lang>`). An English device therefore saw French
for the first paint, then the whole tree re-rendered in English. Crawlers and
no-JS visitors only ever saw French.

## 2. Behaviour

The server settles the language **per request, before the first byte**:

1. **The person's own choice** — cookie `expeditop-locale` (`fr` | `en`).
2. else **the device's `Accept-Language`** — entries ordered by `q`, primary
   subtag compared (`en-GB` → `en`), `q=0`, `*` and malformed weights dropped,
   first one we ship wins.
3. else **French** (`defaultLocale`).

`getRequestLocale()` (`src/i18n/request-locale.ts`, server only) is the one
reader. The root layout stamps `<html lang>` with it and hands it to
`Providers` → `LocaleProvider initialLocale`, so the server HTML and the first
client render agree and nothing swaps. `src/i18n/request.ts` (next-intl's
server config) uses the same function.

### 2.1 What `LocaleProvider` still does on mount

It corrects only what the server could not know:

- A choice kept in `localStorage` before the cookie existed → applied, and
  **copied to the cookie once**, so the next request needs no correction.
- No cookie and no stored choice → the server used `Accept-Language`. If that
  header was absent (a bot, a proxy) the client falls back to
  `detectDeviceLocale()`.
- A visitor who never chose is **never given a cookie** — the header already
  answers, and no consent wall is needed for a preference they did not set.

### 2.2 Writing a choice

`setStoredLocale(locale)` writes `localStorage` (guarded — private mode can
throw) **and** the cookie: `Path=/; Max-Age=31536000; SameSite=Lax`, plus
`Secure` on https. The language toggle is the only caller.

## 3. Edge cases

| Case | Answer |
|---|---|
| `Accept-Language: de-DE,de;q=0.9` | French |
| `Accept-Language: de-DE,en;q=0.5` | English (first *shipped* language by weight) |
| `Accept-Language: fr;q=0.4,en;q=0.9` | English (weight beats order) |
| `en;q=0` | French (the device refused it) |
| Cookie `de`, `""`, anything unknown | ignored → header → French |
| Cookie `fr`, header `en-US` | French (the choice wins) |
| localStorage blocked | cookie still carries the choice |

## 4. Trade-off

Reading `cookies()`/`headers()` in the root layout makes every route render per
request rather than from a static prerender. The app already needs the session
per request; the landing page loses CDN-level static caching. Chosen over a
blocking inline script because only the server fixes `<html lang>`, the
crawler's view and the no-JS view.

## 5. Not in scope

Page `<title>` / meta description in `layout.tsx` and `(marketing)/page.tsx`
are static French strings; localising them is a separate change.

## 6. Test coverage required

- `src/i18n/__tests__/request-locale.test.ts` — header parsing, weights,
  fallbacks, cookie precedence, cookie write/read.
- `src/components/providers/__tests__/LocaleProvider.test.tsx` — SSR in the
  settled language with no French in the HTML; no swap with a cookie;
  localStorage → cookie migration; device fallback; cookie written on switch.
- Verified in a browser: `curl -H 'Accept-Language: en-US' /` → `<html lang="en">`
  and the English hero; `de-DE`, empty, absent → French; cookie `fr` beats an
  English header.
