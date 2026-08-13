# Plan: Multilanguage (i18n) Implementation

## Overview
Implement multilingual support across the entire Expeditoo application using `next-intl`, with language settings accessible via the Settings page (under Profile).

## Tech Decision: next-intl
- **Why next-intl?**
  - Best integration with Next.js 16 App Router
  - Works seamlessly with both Server and Client Components
  - Built-in support for React Server Components
  - Type-safe translations
  - Easy locale switching without page reload

## Supported Languages
1. **French (fr)** - Default
2. **English (en)**
3. **Español (es)**

## Implementation Status

### Phase 1: Setup & Infrastructure ✅ COMPLETE
- [x] Install `next-intl` package
- [x] Create translation files structure: `messages/fr.json`, `messages/en.json`, `messages/es.json`
- [x] Create `src/i18n/config.ts` for locale configuration
- [x] Wrap app with LocaleProvider (NextIntlClientProvider)

### Phase 2: Locale Storage & Settings ✅ COMPLETE
- [x] Store user's locale preference in localStorage (for unauthenticated)
- [x] Update Settings page to use translations
- [x] Create LocaleContext for global locale state management
- [x] Language selector functional in Settings page

### Phase 3: Translation Files ✅ COMPLETE
Created translation keys for:
- [x] Common UI (buttons, labels, navigation)
- [x] Marketing page (hero, features, etc.)
- [x] Auth pages (login, signup)
- [x] App pages (home, profile, settings, messages, deliveries, etc.)
- [x] Admin pages

### Phase 4: Component Updates ✅ COMPLETE
Core components updated:
- [x] Settings.tsx - Full translations
- [x] BottomNav.tsx - Navigation labels
- [x] Profile.tsx - Profile page text
- [x] Messages.tsx - Messages page
- [x] LandingNavbar.tsx - Sign in button
- [x] LandingHero.tsx - Hero section
- [x] LandingFooter.tsx - Tagline
- [x] LandingAdvantages.tsx - Section title, feature cards
- [x] LandingHowItWorks.tsx - Section title
- [x] Deliveries.tsx - Title, tabs
- [x] Notifications.tsx - Title, empty state, mark all read
- [x] ListingDetail.tsx - Description, action buttons
- [x] Checkout.tsx - Title, order summary, payment method
- [x] Admin Dashboard - Title, KPI labels
- [x] Admin Users page - Title, subtitle
- [x] Admin Drivers page - Title, subtitle
- [x] Admin Listings page - Title, subtitle
- [x] Driver Dashboard page - Title, subtitle
- [x] Home page - Title, subtitle
- [x] Signin page - Title, labels, buttons
- [x] Signup page - Title, labels, buttons
- [x] Driver Shipments page - Title, subtitle, tabs
- [x] Help page - Title, subtitle, support options, FAQ
- [x] AuctionDetail.tsx - Description, pickup location, bid history, buttons

- [x] Create listing form (Create.tsx) - Full translations for Item, Logistics, and Pricing steps
- [x] Form Validation Schemas & Toast Messages (Create Listing)

## Phase 5: Verification & Cleanup ✅ COMPLETE
- [x] Verify all pages build successfully
- [x] Check for missing keys
- [x] Ensure inconsistent keys are merged/fixed

## File Structure
```
src/
  i18n/
    config.ts           # Locale configuration ✅
    request.ts          # Server-side locale handling ✅
  components/
    providers/
      LocaleProvider.tsx # i18n provider ✅
messages/
  fr.json               # French translations ✅
  en.json               # English translations ✅
  es.json               # Spanish translations ✅
```

## Notes
- Static imports used for translation files (Turbopack compatibility)
- Translation switching is instant (no page reload)
- Language preference persists in localStorage
- Remaining components can be gradually updated without breaking changes
- All translation keys already exist in JSON files, just need `useTranslations` hook in components


