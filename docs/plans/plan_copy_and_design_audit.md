# Plan — copy audit, design audit, « Dans l'application » (2.98.0)

Specs: `docs/specs/copy_and_design_audit_2026_11_spec.md`, `docs/specs/landing_app_tour_spec.md`.

| # | Step | Files | Depends on |
|---|---|---|---|
| 1 | Mechanical checks on the catalogues: parity, placeholders, identical values, dead sub-trees | `messages/*.json` | — |
| 2 | Read every EN/FR pair in five chunks; one more pass over text outside the catalogues | `messages/*.json`, `src/server/**`, `src/app/**` | 1 |
| 3 | Apply the corrections as `{lang:{set,delete}}` patches; write the catalogues canonically | `messages/*.json` | 2 |
| 4 | Server-written text to French; dead emails out; metadata, manifest, 404; dates by app locale; error fallbacks | `src/server/services/*`, `src/server/emails/*`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/not-found.tsx`, hooks | 2 |
| 5 | Survey the UI: count the patterns in source, then look at every major screen in Chromium | — | — |
| 6 | `AuthShell` for the six signed-out screens | `src/features/auth/ui/AuthShell.tsx`, `src/app/signin`, `src/app/(auth)/*` | 5 |
| 7 | Tones: tokens, `.tone-*`, `src/lib/tone.ts`; replace raw palette classes | `src/app/globals.css`, ~40 components | 5 |
| 8 | Flatten avatars, notifications, hover lifts, accent strips; name the AI controls' icons; fix doubled Card gaps | components | 5 |
| 9 | Header: two doors | `LandingNavbar.tsx` + test | — |
| 10 | Demo seed | `src/scripts/seed-demo-data.ts`, `package.json` | — |
| 11 | Capture script and the 32 pictures | `scripts/capture-app-tour.mjs`, `public/images/landing/app/` | 6–8, 10 |
| 12 | `LandingAppTour` + copy + menu entry + tests | `src/features/marketing/ui/*`, `messages/*.json` | 11 |
| 13 | Repair the tests the wording changed; gates; release record; dev → PR → main | tests, `CHANGELOG*.md`, `STATUS.md` | all |
