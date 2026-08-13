# Specification: Multilanguage (i18n) Support

## Overview
This spec defines the expected behavior for multilingual support in Expeditoo.

## Supported Languages
| Code | Label | Flag |
|------|-------|------|
| fr | Français | 🇫🇷 |
| en | English | 🇬🇧 |
| es | Español | 🇪🇸 |

## Default Behavior
- **Default language**: French (fr)
- **Persistence**: Language preference stored in localStorage under key `expeditoo-locale`
- **Fallback**: If stored locale is invalid, fallback to French

## Language Selection
### Location
- Settings page (`/settings`) under "Language" section
- Radio button selection (existing UI)

### Behavior
1. User selects a language
2. Language is immediately persisted to localStorage
3. UI updates without page reload (React re-render)
4. All text across the app updates to selected language

## Translation Namespaces
| Namespace | Description |
|-----------|-------------|
| common | Buttons, labels, errors, navigation |
| marketing | Landing page content |
| auth | Login, signup, password reset |
| home | Dashboard, search, filters |
| profile | Profile page, settings |
| messages | Chat UI |
| deliveries | Shipping, tracking |
| auction | Bidding, auctions |
| admin | Admin dashboard |
| notifications | Notification texts |

## Translation Format
```json
{
  "common": {
    "buttons": {
      "save": "Enregistrer",
      "cancel": "Annuler",
      "submit": "Soumettre"
    },
    "navigation": {
      "home": "Accueil",
      "profile": "Profil"
    }
  }
}
```

## Component Usage
```tsx
// Client Component
"use client";
import { useTranslations } from "next-intl";

function MyComponent() {
  const t = useTranslations("common");
  return <button>{t("buttons.save")}</button>;
}
```

## Edge Cases
1. **Missing translation key**: Show key name in development, fallback to French in production
2. **Invalid locale in localStorage**: Reset to French
3. **Page refresh**: Locale persists from localStorage

## Validation Rules
- Locale code must be one of: `fr`, `en`, `es`
- Translation files must include all required keys
- No hardcoded strings in components after implementation

## Success Criteria
1. All visible text is translatable
2. Language switch is instant (no page reload)
3. Language preference persists across sessions
4. Settings page language selector works correctly
