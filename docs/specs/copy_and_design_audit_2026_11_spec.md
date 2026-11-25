# Copy and design audit — November 2026 (2.98.0)

What the owner asked: audit every translation in both languages; redesign whatever
looks machine-generated, on the site and in the app; keep the header to two buttons.

## 1. Copy

### 1.1 Rules the catalogues now hold

- **Same keys in `fr.json` and `en.json`**, same placeholders and tags per key
  (`i18n-keys.test.ts`, `locale-parity`).
- **Canonical JSON**: two-space indent, one key per line, as `json.dumps(indent=2,
  ensure_ascii=False)` writes it. A change is applied as a patch and the file
  re-dumped; nothing is hand-indented.
- **One thing, one name.** The carrier *makes* an offer (« faire une offre », "make an
  offer") — never « enchérir », never « répondre aux offres ». EN says "carrier" for
  « transporteur » and "driver" for « chauffeur ». Pickup is « retrait » wherever a
  screen had both words. Labels are in sentence case. English spelling is British.
- **A count is an ICU plural**, never `(s)` and never a bare `{count}` before a noun.
  French `one` covers 0 and 1.
- **No goods-marketplace vocabulary**: buyer, seller, cart, order, "Buy now".
- **The site claims only what the product does** (`payout-claims.test.ts` holds the
  payout wording; the rest is by reading).
- **No key without a consumer.** 217 were removed; a key read through a template
  literal or a label map counts as used.

### 1.2 Text outside the catalogues

- A notification, an SMS, a shipment event note and a server-written chat line are
  **French**: no account carries a locale, and the mail the same person receives is
  French. Titles are quoted with « ». Amounts go through `formatCurrency`.
- An email nothing sends is deleted, not kept.
- `metadata` is French, with `title.template = "%s · EXPEDITOP"`. A client page gets
  its title from a sibling `layout.tsx`.
- A date is formatted with the **app's** locale (`useDateLocale`, or `locale` passed
  to `toLocale*String`), never the browser's default and never none.
- A client surface never prints `error.message`. It maps `code` to a key and falls
  back to its namespace's generic sentence. (Staff-only surfaces are not converted yet.)
- An unknown URL renders `src/app/not-found.tsx`, which offers the way home.

### 1.3 Decided against, and why

- **Non-breaking spaces before ? ! : ;** — reverted. Testing Library normalises the
  DOM's whitespace and not the matcher's, so a test that reads the catalogue stops
  matching the screen it rendered.
- **« course » → « mission »** on the driver side — a product decision; the patch is
  kept outside the repo.
- **Legal pages** — stale in substance since `/create` returned. Not a wording fix.

## 2. Design

### 2.1 What "looks generated" meant here

Counted in source, then confirmed on screen: gradient page backgrounds with pulsing
blurred discs; translucent cards with `backdrop-blur`; gradient avatars; a colour
picked per file for the same status; hover-scale on cards; a bouncing hint; left
accent strips; a sparkle icon on anything a model assists; emoji as icons.

Kept on purpose: the home page's hero, search card, marquee and bands (the client's
references, 2.96.0–2.97.0); the phone's floating glass bar (asked for, 2.80.0); the
filled blue active item in the sidebar.

### 2.2 Tones

`src/lib/tone.ts` — `neutral | info | success | warning | danger`.

| Tone | Means | Tokens |
|---|---|---|
| `info` | under way | `--tone-info-bg/-ink/-line` |
| `success` | finished, good | `--tone-success-*` |
| `warning` | waiting on a person | `--tone-warning-*` |
| `danger` | refused, failed | `--tone-danger-*` |
| `neutral` | closed, inactive | `--muted`, `--muted-foreground`, `--border` |

- `.tone-*` sets background, colour and border-colour together. Unlayered, so it
  wins over whatever a `Badge` variant carries.
- `text-*-ink` is the ink alone, for text or an icon on the page.
- The solid colour (a dot, a fill) is `bg-primary | bg-success | bg-warning |
  bg-destructive`. Text on `bg-warning` is `text-warning-foreground`, not white.
- **No raw palette class** (`bg-blue-100`, `text-amber-600`…) in a component. A new
  status picks a tone.

### 2.3 Signed-out screens

`AuthShell` is the only frame: wordmark linking home, the form in a 26rem column on
the page background, the home page's photograph beside it from `lg`. No card, no
animation, no translucency. `AuthNote` is the one note style; a status icon is the
icon itself, not an icon in a tinted disc.

### 2.4 Header

A visitor with no session sees two doors from `sm`: « Connexion » as a link,
« Inscription » as the filled button. Below `sm`, the single « Connexion /
Inscription » button (client, 19 Nov). « Devenir transporteur » is the bar's third
link (to `#carriers`) and is in the menu. Signed in: « Ouvrir l'app » alone.

### 2.5 Cards

A `Card` that spaces its children itself (`space-y-*`) says `gap-0`: the component's
own `gap-6` otherwise adds to it.

## 3. Test coverage required

- `LandingNavbar.test.tsx`: two doors, no third button, the carrier link's target.
- `landing-anchors.test.tsx`: `#app` is in the menu and on the page.
- `i18n-keys.test.ts`, `locale-parity`: unchanged, must pass on the new catalogues.
- Every test that asserted a corrected string asserts the new one.
- `no-dead-ends.test.ts` passes with `not-found.tsx`.
