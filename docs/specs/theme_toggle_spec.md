# Specification: Theme Toggle (Light/Dark Mode)

## Feature Overview

User dapat mengubah tema aplikasi antara light mode, dark mode, atau mengikuti system preference. Preferensi tema disimpan di cookie dan persisten setelah refresh.

## User Stories

1. **As a user**, saya ingin toggle antara light/dark mode agar sesuai preferensi saya
2. **As a user**, saya ingin tema yang saya pilih tersimpan sehingga tidak perlu set ulang setiap kali
3. **As a user**, saya ingin opsi untuk mengikuti system preference
4. **As a user**, saya ingin transisi tema yang smooth tanpa flicker

## Functional Requirements

### FR-1: Theme Toggle Component

**Component:** `ThemeToggle`

**Behavior:**

- Menampilkan button dengan icon sesuai tema aktif:
  - ☀️ Sun icon → Light mode aktif
  - 🌙 Moon icon → Dark mode aktif
  - 💻 Monitor icon → System mode aktif
- Saat diklik, membuka dropdown dengan 3 opsi:
  - "Light" - Force light mode
  - "Dark" - Force dark mode
  - "System" - Follow system preference
- Opsi yang sedang aktif diberi checkmark (✓)

**Input:**

- User click pada toggle button
- User select salah satu opsi dari dropdown

**Output:**

- Tema berubah sesuai pilihan
- Cookie `theme` ter-update
- UI re-render dengan color scheme baru

**Edge Cases:**

- Jika system preference berubah saat mode "System" aktif → tema otomatis update
- Jika cookie tidak ada → fallback ke `light` (default)
- Jika cookie corrupt → fallback ke `light`

### FR-2: Cookie Persistence

**Cookie Name:** `theme`

**Valid Values:**

- `"light"` - Light mode
- `"dark"` - Dark mode
- `"system"` - Follow system preference

**Cookie Attributes:**

- `path=/` - Available for entire app
- `max-age=31536000` - 1 year expiry
- `SameSite=Lax` - CSRF protection

**Behavior:**

- Cookie di-set setiap kali user mengubah tema
- Cookie dibaca saat initial load
- Jika cookie tidak ada, gunakan default `light`

### FR-3: Theme Application

**CSS Variables:**
Tema mengubah CSS variables di `:root` dan `.dark`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... other light mode variables */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... other dark mode variables */
}
```

**HTML Attribute:**

- Light mode: `<html class="">`
- Dark mode: `<html class="dark">`
- System mode: `<html class="">` atau `<html class="dark">` tergantung system

**Transition:**

- Smooth transition 200ms untuk color changes
- Tidak ada flash of unstyled content (FOUC)

### FR-4: Integration Points

**Marketing Header:**

- Toggle button di sebelah kanan, sebelum "Sign In" button
- Visible di semua breakpoints
- Icon only (no text) di mobile

**Authenticated Header:**

- Toggle button di sebelah notification bell
- Visible di semua breakpoints
- Icon only (no text) di mobile

## Non-Functional Requirements

### NFR-1: Performance

- Theme switch harus instant (<100ms)
- Tidak ada layout shift saat switch
- Tidak ada flicker/flash

### NFR-2: Accessibility

- Keyboard navigable (Tab, Enter, Escape)
- Screen reader friendly (aria-labels)
- Focus visible
- Color contrast ratio ≥ 4.5:1 (WCAG AA)

### NFR-3: Browser Compatibility

- Support semua modern browsers (Chrome, Firefox, Safari, Edge)
- Graceful degradation untuk browsers tanpa CSS variables
- Cookie support required

### NFR-4: Mobile Responsiveness

- Touch-friendly (min 44x44px tap target)
- Dropdown tidak keluar dari viewport
- Smooth animation di mobile

## API Specification

### useTheme Hook (from next-themes)

```typescript
interface UseThemeReturn {
  theme: string | undefined; // Current theme: "light" | "dark" | "system"
  setTheme: (theme: string) => void; // Function to change theme
  systemTheme: "light" | "dark"; // Current system preference
  themes: string[]; // Available themes
  resolvedTheme: "light" | "dark"; // Actual applied theme
}
```

### useThemeToggle Hook (Custom)

```typescript
interface UseThemeToggleReturn {
  currentTheme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  cycleTheme: () => void; // Cycle: light → dark → system → light
  isLight: boolean;
  isDark: boolean;
  isSystem: boolean;
}
```

## Component Specification

### ThemeToggle Component

```typescript
interface ThemeToggleProps {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}
```

**Render Logic:**

```
IF theme === "light"
  SHOW Sun icon
ELSE IF theme === "dark"
  SHOW Moon icon
ELSE IF theme === "system"
  SHOW Monitor icon
```

**Dropdown Items:**

```
☀️ Light    [✓ if active]
🌙 Dark     [✓ if active]
💻 System   [✓ if active]
```

## Validation Rules

### VR-1: Theme Value Validation

```typescript
const VALID_THEMES = ["light", "dark", "system"] as const;

function isValidTheme(value: unknown): value is Theme {
  return typeof value === "string" && VALID_THEMES.includes(value);
}
```

### VR-2: Cookie Validation

- If cookie value not in `["light", "dark", "system"]` → use default "light"
- If cookie expired → use default "light"
- If cookie missing → use default "light"

## Error Scenarios

### ES-1: Cookie Blocked

**Scenario:** User browser blocks cookies
**Behavior:**

- Theme still works via localStorage
- Warning logged to console
- Theme resets on browser close

### ES-2: JavaScript Disabled

**Scenario:** User has JavaScript disabled
**Behavior:**

- Default to light mode
- No toggle functionality
- Graceful degradation

### ES-3: System Preference Unavailable

**Scenario:** Browser doesn't support `prefers-color-scheme`
**Behavior:**

- "System" mode defaults to light
- Other modes work normally

## Testing Scenarios

### TS-1: Initial Load

```
GIVEN user visits site for first time
WHEN page loads
THEN theme should be "light" (default)
AND cookie "theme" should be set to "light"
```

### TS-2: Theme Switch

```
GIVEN user is on light mode
WHEN user clicks toggle and selects "Dark"
THEN theme should change to dark
AND cookie "theme" should be "dark"
AND HTML should have class "dark"
AND no flicker should occur
```

### TS-3: Page Refresh

```
GIVEN user has selected "dark" theme
WHEN user refreshes page
THEN theme should remain "dark"
AND cookie "theme" should still be "dark"
AND no flash of light theme should occur
```

### TS-4: System Mode

```
GIVEN user selects "System" mode
AND system preference is dark
WHEN page loads
THEN theme should be dark
AND cookie "theme" should be "system"
WHEN system preference changes to light
THEN theme should automatically change to light
```

### TS-5: Cross-Page Persistence

```
GIVEN user sets theme to "dark" on marketing page
WHEN user navigates to authenticated pages
THEN theme should remain "dark"
AND vice versa
```

## UI/UX Specifications

### Toggle Button

- **Size:** 40x40px (icon variant)
- **Icon Size:** 20x20px
- **Hover:** Background opacity change
- **Active:** Slight scale down (0.95)
- **Focus:** Visible outline ring

### Dropdown Menu

- **Width:** 160px
- **Item Height:** 40px
- **Padding:** 8px 12px
- **Border Radius:** 8px
- **Shadow:** Medium elevation
- **Animation:** Fade in + slide down (150ms)

### Icons

- **Light Mode:** `Sun` from lucide-react
- **Dark Mode:** `Moon` from lucide-react
- **System Mode:** `Monitor` from lucide-react
- **Checkmark:** `Check` from lucide-react

## Implementation Notes

### next-themes Configuration

```typescript
<ThemeProvider
  attribute="class"           // Use class-based theming
  defaultTheme="light"        // Default if no cookie
  enableSystem={true}         // Allow system preference
  storageKey="theme"          // Cookie/localStorage key
  disableTransitionOnChange={false}  // Enable smooth transitions
>
```

### CSS Transition

```css
* {
  transition:
    background-color 200ms ease-in-out,
    border-color 200ms ease-in-out,
    color 200ms ease-in-out;
}
```

### Prevent FOUC

```typescript
// next-themes automatically injects script to prevent FOUC
// No additional configuration needed
```

## Success Criteria

- ✅ User dapat toggle antara light/dark/system mode
- ✅ Tema tersimpan di cookie dan persisten
- ✅ Tidak ada flicker saat switch atau refresh
- ✅ Smooth transition animation
- ✅ Accessible via keyboard
- ✅ Responsive di semua device sizes
- ✅ Bekerja di marketing dan authenticated pages
